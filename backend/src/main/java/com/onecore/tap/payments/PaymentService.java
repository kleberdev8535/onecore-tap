package com.onecore.tap.payments;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.notifications.RealtimeEvent;
import com.onecore.tap.orders.Order;
import com.onecore.tap.orders.OrderStatus;
import com.onecore.tap.payments.PaymentDtos.EntryInput;
import com.onecore.tap.payments.PaymentDtos.EntryView;
import com.onecore.tap.payments.PaymentDtos.PaymentView;
import com.onecore.tap.payments.PaymentDtos.PendingOrder;
import com.onecore.tap.payments.PaymentDtos.PendingTable;
import com.onecore.tap.security.AuthenticatedUser;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

/**
 * Registro e estorno de pagamentos de pedidos. Todas as consultas passam pelo tenant da sessão (@TenantId):
 * pedidos de outro restaurante simplesmente não são encontrados.
 */
@Service
public class PaymentService {

	/** Pedidos que podem ser pagos: aceitos pela equipe e não cancelados. */
	static final Set<OrderStatus> PAYABLE = EnumSet.of(OrderStatus.NEW, OrderStatus.IN_PREPARATION, OrderStatus.READY,
			OrderStatus.DELIVERED, OrderStatus.COMPLETED);

	private final PaymentRepository payments;

	private final PaymentEntryRepository entries;

	private final EntityManager em;

	private final ApplicationEventPublisher publisher;

	private final Clock clock;

	public PaymentService(PaymentRepository payments, PaymentEntryRepository entries, EntityManager em,
			ApplicationEventPublisher publisher, Clock clock) {
		this.payments = payments;
		this.entries = entries;
		this.em = em;
		this.publisher = publisher;
		this.clock = clock;
	}

	/**
	 * Registra o pagamento de pedidos específicos (scope ORDER) ou de todos os pedidos em aberto do atendimento
	 * atual da mesa (scope TABLE). A soma dos métodos precisa fechar exatamente com o total dos pedidos.
	 */
	@Transactional
	public PaymentView register(Payment.Scope scope, List<UUID> orderIds, UUID tableId, List<EntryInput> parts,
			String notes, AuthenticatedUser actor) {
		List<Order> list = scope == Payment.Scope.TABLE ? openOrdersOfTableForUpdate(tableId) : ordersForUpdate(orderIds);
		if (list.isEmpty()) {
			throw new ConflictException(scope == Payment.Scope.TABLE ? "Esta mesa não tem pedidos pendentes de pagamento."
					: "Selecione ao menos um pedido.");
		}
		for (Order o : list) {
			if (o.isTest()) {
				throw new ConflictException("O pedido #" + o.getNumber() + " é de teste e não recebe pagamento.");
			}
			if (o.getStatus() == OrderStatus.CANCELLED) {
				throw new ConflictException("O pedido #" + o.getNumber() + " está cancelado.");
			}
			if (o.getStatus() == OrderStatus.AWAITING_CONFIRMATION) {
				throw new ConflictException("Confirme o pedido #" + o.getNumber() + " antes de registrar o pagamento.");
			}
			if (o.isPaid()) {
				throw new ConflictException("O pedido #" + o.getNumber() + " já tem pagamento registrado.");
			}
		}
		Set<UUID> tables = list.stream().map(Order::getTableId).collect(Collectors.toSet());
		int total = list.stream().mapToInt(Order::getTotalCents).sum();
		validateParts(parts, total);

		Instant now = clock.instant();
		Order first = list.getFirst();
		boolean singleTable = tables.size() == 1;
		Payment payment = payments.save(new Payment(scope, singleTable ? first.getTableId() : null,
				singleTable ? first.getTableLabel() : null, total, actor.id(), actor.name(), blank(notes), now));
		payments.flush();
		List<PaymentEntry> saved = new ArrayList<>();
		for (EntryInput p : parts) {
			saved.add(entries.save(new PaymentEntry(payment.getId(), p.method(),
					p.amountCents(), p.method() == PaymentMethod.CASH ? p.receivedCents() : null)));
		}
		list.forEach(o -> o.markPaid(payment.getId(), now));
		em.flush();
		publishChange(first.getRestaurantId(), payment, list);
		return view(payment, saved, list);
	}

	/** Estorno do registro (erro de lançamento, devolução). Os pedidos voltam para pendente; nada é apagado. */
	@Transactional
	public PaymentView voidPayment(UUID paymentId, String reason, AuthenticatedUser actor) {
		Payment payment = payments.findById(paymentId)
			.orElseThrow(() -> new NotFoundException("Registro de pagamento não encontrado."));
		if (payment.isVoided()) {
			throw new ConflictException("Este registro já foi estornado.");
		}
		String cleanReason = blank(reason);
		if (cleanReason == null) {
			throw new ConflictException("Informe o motivo do estorno.");
		}
		List<Order> paid = em.createQuery("select o from Order o where o.paymentId = :id", Order.class)
			.setParameter("id", paymentId)
			.setLockMode(LockModeType.PESSIMISTIC_WRITE)
			.getResultList();
		payment.voidBy(actor.name(), cleanReason, clock.instant());
		paid.forEach(Order::markUnpaid);
		em.flush();
		publishChange(payment.getRestaurantId(), payment, paid);
		return view(payment, entries.findByPaymentIdIn(List.of(paymentId)), paid);
	}

	@Transactional(readOnly = true)
	public Page<PaymentView> list(Instant from, Instant to, Pageable pageable) {
		Page<Payment> page = payments.findInPeriod(from, to, pageable);
		List<UUID> ids = page.getContent().stream().map(Payment::getId).toList();
		Map<UUID, List<PaymentEntry>> byPayment = entries.findByPaymentIdIn(ids)
			.stream()
			.collect(Collectors.groupingBy(PaymentEntry::getPaymentId));
		Map<UUID, List<Order>> ordersByPayment = ids.isEmpty() ? Map.of()
				: em.createQuery("select o from Order o where o.paymentId in :ids", Order.class)
					.setParameter("ids", ids)
					.getResultList()
					.stream()
					.collect(Collectors.groupingBy(Order::getPaymentId));
		return page.map(p -> view(p, byPayment.getOrDefault(p.getId(), List.of()),
				ordersByPayment.getOrDefault(p.getId(), List.of())));
	}

	/** Pedidos aceitos ainda sem pagamento registrado, agrupados por mesa (inclui atendimentos já encerrados). */
	@Transactional(readOnly = true)
	public List<PendingTable> pending() {
		List<Order> list = em.createQuery("""
				select o from Order o
				where o.paymentStatus = 'UNPAID' and o.test = false and o.status in :statuses
				order by o.tableLabel, o.createdAt
				""", Order.class).setParameter("statuses", PAYABLE).getResultList();
		Set<UUID> openSessions = new java.util.HashSet<>(em
			.createQuery("select s.id from TableSession s where s.closedAt is null", UUID.class)
			.getResultList());
		Map<UUID, List<Order>> byTable = new java.util.LinkedHashMap<>();
		list.forEach(o -> byTable.computeIfAbsent(o.getTableId(), k -> new ArrayList<>()).add(o));
		return byTable.entrySet().stream().map(e -> {
			List<Order> orders = e.getValue();
			List<PendingOrder> items = orders.stream()
				.map(o -> new PendingOrder(o.getId(), o.getNumber(), o.getStatus(), o.getTotalCents(), o.getCreatedAt(),
						openSessions.contains(o.getSessionId())))
				.toList();
			boolean open = items.stream().anyMatch(PendingOrder::currentAttendance);
			return new PendingTable(e.getKey(), orders.getFirst().getTableLabel(), open,
					orders.stream().mapToInt(Order::getTotalCents).sum(), items);
		}).toList();
	}

	// ---------------------------------------------------------------- apoio

	static void validateParts(List<EntryInput> parts, int total) {
		if (parts == null || parts.isEmpty()) {
			throw new ConflictException("Informe ao menos um método de pagamento.");
		}
		if (parts.size() > 4) {
			throw new ConflictException("Divida em no máximo 4 partes.");
		}
		int sum = 0;
		for (EntryInput p : parts) {
			if (p.amountCents() == null || p.amountCents() <= 0) {
				throw new ConflictException("Cada parte precisa de um valor maior que zero.");
			}
			if (p.method() == PaymentMethod.CASH && p.receivedCents() != null && p.receivedCents() < p.amountCents()) {
				throw new ConflictException("O valor recebido em dinheiro é menor que o valor da parte.");
			}
			sum += p.amountCents();
		}
		if (sum != total) {
			throw new ConflictException("A soma dos métodos (" + money(sum) + ") precisa ser igual ao total dos pedidos ("
					+ money(total) + ").");
		}
	}

	private List<Order> ordersForUpdate(Collection<UUID> ids) {
		if (ids == null || ids.isEmpty()) {
			return List.of();
		}
		List<Order> found = em.createQuery("select o from Order o where o.id in :ids order by o.number", Order.class)
			.setParameter("ids", ids)
			.setLockMode(LockModeType.PESSIMISTIC_WRITE)
			.getResultList();
		if (found.size() != Set.copyOf(ids).size()) {
			// Pedido inexistente ou de outro restaurante (filtrado pelo tenant): mesma resposta.
			throw new NotFoundException("Pedido não encontrado.");
		}
		return found;
	}

	private List<Order> openOrdersOfTableForUpdate(UUID tableId) {
		if (tableId == null) {
			return List.of();
		}
		return em.createQuery("""
				select o from Order o
				where o.tableId = :tableId and o.paymentStatus = 'UNPAID' and o.test = false and o.status in :statuses
				  and o.sessionId in (select s.id from TableSession s where s.tableId = :tableId and s.closedAt is null)
				order by o.number
				""", Order.class)
			.setParameter("tableId", tableId)
			.setParameter("statuses", PAYABLE)
			.setLockMode(LockModeType.PESSIMISTIC_WRITE)
			.getResultList();
	}

	private void publishChange(UUID restaurantId, Payment payment, List<Order> orders) {
		Map<String, Object> data = new HashMap<>();
		data.put("paymentId", payment.getId().toString());
		data.put("orderIds", orders.stream().map(o -> o.getId().toString()).toList());
		publisher.publishEvent(new RealtimeEvent(restaurantId, "payment.updated", data));
	}

	static PaymentView view(Payment p, List<PaymentEntry> parts, List<Order> orders) {
		return new PaymentView(p.getId(), p.getScope(), p.getTableLabel(), p.getTotalCents(),
				parts.stream().map(e -> new EntryView(e.getMethod(), e.getAmountCents(), e.getReceivedCents(), e.changeCents())).toList(),
				orders.stream().map(Order::getNumber).sorted().toList(), p.getRegisteredByName(), p.getNotes(),
				p.getCreatedAt(), p.getVoidedAt(), p.getVoidedByName(), p.getVoidReason());
	}

	private static String money(int cents) {
		return "R$ %d,%02d".formatted(cents / 100, cents % 100);
	}

	private static String blank(String v) {
		return v == null || v.isBlank() ? null : v.trim();
	}

}
