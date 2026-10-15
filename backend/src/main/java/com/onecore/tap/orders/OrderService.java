package com.onecore.tap.orders;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.notifications.RealtimeEvent;
import com.onecore.tap.orders.OrderDtos.Board;
import com.onecore.tap.orders.OrderDtos.EventView;
import com.onecore.tap.orders.OrderDtos.ItemView;
import com.onecore.tap.orders.OrderDtos.OptionView;
import com.onecore.tap.orders.OrderDtos.OrderDetail;
import com.onecore.tap.orders.OrderDtos.OrderView;
import com.onecore.tap.orders.OrderDtos.PlaceOrderRequest;
import com.onecore.tap.orders.OrderDtos.PublicOrderView;
import com.onecore.tap.orders.OrderDtos.PublicSession;
import com.onecore.tap.orders.OrderDtos.ServiceRequestView;
import com.onecore.tap.orders.OrderDtos.TableActivity;
import com.onecore.tap.orders.OrderDtos.TableState;
import com.onecore.tap.orders.OrderPricing.ItemChoice;
import com.onecore.tap.orders.OrderPricing.PricedLine;
import com.onecore.tap.orders.OrderPricing.PricedOption;
import com.onecore.tap.orders.OrderPricing.PricedOrder;
import com.onecore.tap.plates.PlateResolver.ResolvedPlate;
import com.onecore.tap.products.MenuService;
import com.onecore.tap.restaurants.OpeningHours;
import com.onecore.tap.restaurants.RestaurantSettingsService;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.Permission;
import com.onecore.tap.tenancy.TenantContext;

/**
 * Pedidos, atendimento das mesas e chamados.
 *
 * Métodos públicos (cardápio) executam no contexto do restaurante resolvido pela plaquinha. Métodos da equipe usam
 * o restaurante da sessão. Em ambos os casos todas as entidades são filtradas por @TenantId.
 */
@Service
public class OrderService {

	/** Concluídos e cancelados continuam visíveis no quadro por este período. */
	static final Duration BOARD_HISTORY = Duration.ofHours(6);

	private static final SecureRandom RANDOM = new SecureRandom();

	private final OrderRepository orders;

	private final OrderItemRepository items;

	private final OrderItemOptionRepository itemOptions;

	private final OrderEventRepository events;

	private final TableSessionRepository sessions;

	private final ServiceRequestRepository requests;

	private final MenuService menu;

	private final RestaurantSettingsService settings;

	private final JdbcTemplate jdbc;

	private final TransactionTemplate tx;

	private final ApplicationEventPublisher publisher;

	private final Clock clock;

	OrderService(OrderRepository orders, OrderItemRepository items, OrderItemOptionRepository itemOptions,
			OrderEventRepository events, TableSessionRepository sessions, ServiceRequestRepository requests,
			MenuService menu, RestaurantSettingsService settings, JdbcTemplate jdbc, TransactionTemplate tx,
			ApplicationEventPublisher publisher, Clock clock) {
		this.orders = orders;
		this.items = items;
		this.itemOptions = itemOptions;
		this.events = events;
		this.sessions = sessions;
		this.requests = requests;
		this.menu = menu;
		this.settings = settings;
		this.jdbc = jdbc;
		this.tx = tx;
		this.publisher = publisher;
		this.clock = clock;
	}

	// ================================================================== Cliente

	public boolean isOpenNow(UUID restaurantId) {
		return TenantContext.callAs(restaurantId,
				() -> OpeningHours.isOpen(settings.ranges(), ZonedDateTime.now(clock)));
	}

	/**
	 * Cria o pedido a partir das escolhas do cliente. Preços e regras vêm do cardápio atual; o pedido entra como
	 * "aguardando confirmação" quando o restaurante exige confirmação (padrão).
	 */
	public PublicOrderView place(ResolvedPlate plate, PlaceOrderRequest req) {
		UUID restaurantId = plate.restaurant().getId();
		if (!plate.preview() && !isOpenNow(restaurantId)) {
			throw new ConflictException("O restaurante está fechado agora. Confira o horário de funcionamento.");
		}
		return TenantContext.callAs(restaurantId, () -> tx.execute(status -> {
			List<ItemChoice> choices = req.items()
				.stream()
				.map(i -> new ItemChoice(i.productId(), i.quantity(), i.notes(), i.optionIds()))
				.toList();
			PricedOrder priced = OrderPricing.price(choices,
					menu.catalog(choices.stream().map(ItemChoice::productId).collect(Collectors.toSet())));

			UUID sessionId = openSession(restaurantId, plate.table().getId());
			int number = nextNumber(restaurantId);
			OrderStatus initial = plate.restaurant().isRequireOrderConfirmation() ? OrderStatus.AWAITING_CONFIRMATION
					: OrderStatus.NEW;
			Instant now = clock.instant();
			Order order = orders.saveAndFlush(new Order(number, plate.table().getId(), plate.table().getLabel(),
					sessionId, newToken(16), req.clientToken(), blank(req.customerName()), blank(req.notes()), initial,
					priced.totalCents(), plate.preview(), now));
			saveLines(order.getId(), priced.lines());
			events.save(new OrderEvent(order.getId(), null, initial, null,
					plate.preview() ? "Pedido de teste" : "Cliente", null, now));
			publish(restaurantId, "order.created", order);
			return toPublic(order, linesOf(List.of(order.getId())).getOrDefault(order.getId(), List.of()));
		}));
	}

	public PublicSession session(ResolvedPlate plate, String clientToken) {
		UUID restaurantId = plate.restaurant().getId();
		return TenantContext.callAs(restaurantId, () -> tx.execute(status -> {
			var open = sessions.findOpen(plate.table().getId());
			List<ServiceRequest.Type> openRequests = requests.findOpenOfTable(plate.table().getId())
				.stream()
				.map(r -> r.type)
				.toList();
			if (open.isEmpty()) {
				return new PublicSession(plate.table().getLabel(), false, null, 0, 0, List.of(), openRequests);
			}
			List<Order> all = orders.findBySessionIdOrderByCreatedAtAsc(open.get().id);
			List<Order> valid = all.stream().filter(o -> o.getStatus() != OrderStatus.CANCELLED).toList();
			List<Order> mine = clientToken == null ? List.of()
					: orders.findBySessionIdAndClientTokenOrderByCreatedAtDesc(open.get().id, clientToken);
			Map<UUID, List<ItemView>> lines = linesOf(mine.stream().map(Order::getId).toList());
			return new PublicSession(plate.table().getLabel(), true, open.get().openedAt,
					valid.stream().mapToInt(Order::getTotalCents).sum(), valid.size(),
					mine.stream().map(o -> toPublic(o, lines.getOrDefault(o.getId(), List.of()))).toList(),
					openRequests);
		}));
	}

	public PublicOrderView track(String trackingToken) {
		if (trackingToken == null || !trackingToken.matches("^[A-Za-z0-9_-]{16,32}$")) {
			throw new NotFoundException("Pedido não encontrado.");
		}
		// O token é global e aleatório; a busca do restaurante é a única consulta fora do contexto de tenant.
		List<UUID> owner = jdbc.queryForList("select restaurant_id from orders where tracking_token = ?", UUID.class,
				trackingToken);
		if (owner.isEmpty()) {
			throw new NotFoundException("Pedido não encontrado.");
		}
		return TenantContext.callAs(owner.get(0), () -> tx.execute(status -> {
			Order order = orders.findByTrackingToken(trackingToken)
				.orElseThrow(() -> new NotFoundException("Pedido não encontrado."));
			return toPublic(order, linesOf(List.of(order.getId())).getOrDefault(order.getId(), List.of()));
		}));
	}

	/** Chamar garçom ou pedir a conta. Repetir o pedido enquanto ele está aberto não cria outro chamado. */
	public ServiceRequestView requestService(ResolvedPlate plate, ServiceRequest.Type type) {
		UUID restaurantId = plate.restaurant().getId();
		return TenantContext.callAs(restaurantId, () -> tx.execute(status -> {
			UUID tableId = plate.table().getId();
			ServiceRequest request = requests.findOpen(tableId, type).orElse(null);
			if (request == null) {
				int inserted = jdbc.update("""
						insert into service_requests (restaurant_id, table_id, table_label, type)
						values (?, ?, ?, ?) on conflict (table_id, type) where status = 'OPEN' do nothing""",
						restaurantId, tableId, plate.table().getLabel(), type.name());
				request = requests.findOpen(tableId, type).orElseThrow();
				if (inserted > 0) {
					publisher.publishEvent(new RealtimeEvent(restaurantId, "request.created",
							Map.of("requestType", type.name(), "tableLabel", plate.table().getLabel())));
				}
			}
			return requestView(request);
		}));
	}

	// ================================================================== Equipe

	@Transactional(readOnly = true)
	public Board board() {
		Instant now = clock.instant();
		List<Order> list = orders.findBoard(now.minus(BOARD_HISTORY));
		return new Board(views(list), openRequests(), now);
	}

	@Transactional(readOnly = true)
	public Page<OrderView> history(OrderStatus status, LocalDate from, LocalDate to, String search, int page) {
		Specification<Order> spec = (root, q, cb) -> cb.conjunction();
		if (status != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
		}
		if (from != null) {
			Instant start = from.atStartOfDay(OpeningHours.BUSINESS_ZONE).toInstant();
			spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), start));
		}
		if (to != null) {
			Instant end = to.plusDays(1).atStartOfDay(OpeningHours.BUSINESS_ZONE).toInstant();
			spec = spec.and((root, q, cb) -> cb.lessThan(root.get("createdAt"), end));
		}
		if (search != null && !search.isBlank()) {
			String term = search.trim().replace("#", "").toLowerCase(Locale.ROOT);
			Integer number = term.matches("\\d{1,9}") ? Integer.valueOf(term) : null;
			spec = spec.and((root, q, cb) -> number != null
					? cb.or(cb.equal(root.get("number"), number), cb.equal(cb.lower(root.get("tableLabel")), term))
					: cb.like(cb.lower(root.get("tableLabel")), "%" + term + "%"));
		}
		Page<Order> result = orders.findAll(spec,
				PageRequest.of(Math.max(page, 0), 25, Sort.by(Sort.Direction.DESC, "createdAt")));
		Map<UUID, List<ItemView>> lines = linesOf(result.getContent().stream().map(Order::getId).toList());
		return result.map(o -> toView(o, lines.getOrDefault(o.getId(), List.of())));
	}

	@Transactional(readOnly = true)
	public OrderDetail detail(UUID id) {
		Order order = order(id);
		List<EventView> history = events.findByOrderIdOrderBySeqAsc(id)
			.stream()
			.map(e -> new EventView(e.fromStatus == null ? null : OrderStatus.valueOf(e.fromStatus),
					OrderStatus.valueOf(e.toStatus), e.actorName, e.reason, e.createdAt))
			.toList();
		return new OrderDetail(toView(order, linesOf(List.of(id)).getOrDefault(id, List.of())), history);
	}

	/**
	 * Move o pedido de etapa. Recusa transições fora do fluxo, etapas que o perfil não pode executar e mudanças
	 * concorrentes (outra pessoa já moveu o pedido: o "from" informado não confere).
	 */
	@Transactional
	public OrderView transition(UUID id, OrderStatus from, OrderStatus to, String reason, AuthenticatedUser actor) {
		Order order = order(id);
		if (order.getStatus() != from) {
			throw new ConflictException("O pedido #" + order.getNumber() + " já está em \"" + order.getStatus().label()
					+ "\". A tela foi atualizada.");
		}
		if (!from.canMoveTo(to)) {
			throw new ConflictException("Não é possível mover de \"" + from.label() + "\" para \"" + to.label() + "\".");
		}
		Set<Permission> perms = actor.role().permissions();
		boolean manage = perms.contains(Permission.ORDERS_MANAGE);
		boolean kitchen = perms.contains(Permission.KITCHEN_OPERATE) && from.isKitchenStep(to);
		if (!manage && !kitchen) {
			throw new AccessDeniedException("Perfil sem permissão para esta etapa");
		}
		String cleanReason = blank(reason);
		if (to == OrderStatus.CANCELLED && cleanReason == null) {
			throw new ConflictException("Informe o motivo do cancelamento.");
		}
		if (to == OrderStatus.CANCELLED && order.isPaid()) {
			throw new ConflictException("O pedido #" + order.getNumber()
					+ " já tem pagamento registrado. Estorne o registro no Financeiro antes de cancelar.");
		}
		Instant now = clock.instant();
		order.moveTo(to, cleanReason, now);
		orders.flush();
		events.save(new OrderEvent(order.getId(), from, to, actor.id(), actor.name(), cleanReason, now));
		publish(order.getRestaurantId(), "order.updated", order);
		return toView(order, linesOf(List.of(id)).getOrDefault(id, List.of()));
	}

	@Transactional(readOnly = true)
	public List<ServiceRequestView> openRequests() {
		return requests.findOpen().stream().map(OrderService::requestView).toList();
	}

	@Transactional
	public void resolveRequest(UUID id, AuthenticatedUser actor) {
		ServiceRequest request = requests.findById(id)
			.orElseThrow(() -> new NotFoundException("Chamado não encontrado."));
		if (!"OPEN".equals(request.status)) {
			return;
		}
		request.resolve(actor.name(), clock.instant());
		requests.flush();
		publisher.publishEvent(new RealtimeEvent(request.restaurantId, "request.resolved",
				Map.of("requestType", request.type.name(), "tableLabel", request.tableLabel)));
	}

	/** Situação de cada mesa com atendimento aberto ou chamado pendente. Mesas ausentes do mapa estão livres. */
	@Transactional(readOnly = true)
	public Map<UUID, TableActivity> tableActivity() {
		List<TableSession> open = sessions.findAllOpen();
		Map<UUID, List<Order>> bySession = orders
			.findBySessionIdInOrderByCreatedAtAsc(open.stream().map(s -> s.id).toList())
			.stream()
			.collect(Collectors.groupingBy(Order::getSessionId));
		Map<UUID, Set<ServiceRequest.Type>> pending = requests.findOpen()
			.stream()
			.collect(Collectors.groupingBy(r -> r.tableId, Collectors.mapping(r -> r.type, Collectors.toSet())));
		Map<UUID, TableActivity> result = new HashMap<>();
		for (TableSession s : open) {
			List<Order> list = bySession.getOrDefault(s.id, List.of());
			List<Order> valid = list.stream().filter(o -> o.getStatus() != OrderStatus.CANCELLED).toList();
			int active = (int) list.stream().filter(o -> !o.getStatus().isFinal()).count();
			result.put(s.tableId, new TableActivity(s.tableId, stateOf(pending.get(s.tableId), true), s.openedAt,
					valid.stream().mapToInt(Order::getTotalCents).sum(), valid.size(), active));
		}
		pending.forEach((tableId, types) -> result.computeIfAbsent(tableId,
				t -> new TableActivity(t, stateOf(types, false), null, 0, 0, 0)));
		return result;
	}

	/**
	 * Encerra o atendimento da mesa: exige que não haja pedidos em andamento, conclui os entregues e resolve os
	 * chamados. Não registra pagamento (módulo financeiro, Fase 5).
	 */
	@Transactional
	public void closeTable(UUID tableId, AuthenticatedUser actor) {
		TableSession session = sessions.findOpen(tableId).orElse(null);
		Instant now = clock.instant();
		if (session != null) {
			List<Order> list = orders.findBySessionIdOrderByCreatedAtAsc(session.id);
			long pendingOrders = list.stream()
				.filter(o -> !o.getStatus().isFinal() && o.getStatus() != OrderStatus.DELIVERED)
				.count();
			if (pendingOrders > 0) {
				throw new ConflictException("Há " + pendingOrders + (pendingOrders == 1 ? " pedido" : " pedidos")
						+ " em andamento nesta mesa. Entregue ou cancele antes de encerrar o atendimento.");
			}
			for (Order o : list) {
				if (o.getStatus() == OrderStatus.DELIVERED) {
					o.moveTo(OrderStatus.COMPLETED, null, now);
					events.save(new OrderEvent(o.getId(), OrderStatus.DELIVERED, OrderStatus.COMPLETED, actor.id(),
							actor.name(), "Atendimento da mesa encerrado", now));
				}
			}
			session.closedAt = now;
			session.closedBy = actor.name();
		}
		requests.findOpenOfTable(tableId).forEach(r -> r.resolve(actor.name(), now));
		sessions.flush();
		publisher.publishEvent(new RealtimeEvent(actor.restaurantId(), "table.updated",
				Map.of("tableId", tableId.toString())));
	}

	// ================================================================== Apoio

	private static TableState stateOf(Set<ServiceRequest.Type> pending, boolean occupied) {
		if (pending != null && pending.contains(ServiceRequest.Type.REQUEST_BILL)) {
			return TableState.AWAITING_BILL;
		}
		if (pending != null && pending.contains(ServiceRequest.Type.CALL_WAITER)) {
			return TableState.AWAITING_SERVICE;
		}
		return occupied ? TableState.OCCUPIED : TableState.FREE;
	}

	/** Abre o atendimento da mesa se ainda não houver um. Seguro contra pedidos simultâneos (índice único parcial). */
	private UUID openSession(UUID restaurantId, UUID tableId) {
		jdbc.update("""
				insert into table_sessions (restaurant_id, table_id) values (?, ?)
				on conflict (table_id) where closed_at is null do nothing""", restaurantId, tableId);
		return sessions.findOpen(tableId).orElseThrow().id;
	}

	/** Próximo número do restaurante, incrementado atomicamente no banco. */
	private int nextNumber(UUID restaurantId) {
		Integer n = jdbc.queryForObject("""
				insert into restaurant_order_counters (restaurant_id, last_number) values (?, 1)
				on conflict (restaurant_id) do update set last_number = restaurant_order_counters.last_number + 1
				returning last_number""", Integer.class, restaurantId);
		return n == null ? 1 : n;
	}

	private void saveLines(UUID orderId, List<PricedLine> lines) {
		for (int i = 0; i < lines.size(); i++) {
			PricedLine line = lines.get(i);
			OrderItem item = items.save(new OrderItem(orderId, line.productId(), line.productName(),
					line.unitPriceCents(), line.quantity(), line.notes(), i));
			for (PricedOption o : line.options()) {
				itemOptions.save(new OrderItemOption(item.id, o.groupName(), o.optionId(), o.optionName(),
						o.priceCents()));
			}
		}
		items.flush();
	}

	private Map<UUID, List<ItemView>> linesOf(Collection<UUID> orderIds) {
		if (orderIds.isEmpty()) {
			return Map.of();
		}
		List<OrderItem> all = items.findByOrderIdInOrderByPositionAsc(orderIds);
		Map<UUID, List<OptionView>> optionsByItem = all.isEmpty() ? Map.of()
				: itemOptions.findByOrderItemIdIn(all.stream().map(i -> i.id).toList())
					.stream()
					.collect(Collectors.groupingBy(o -> o.orderItemId,
							Collectors.mapping(o -> new OptionView(o.groupName, o.optionName, o.priceCents),
									Collectors.toList())));
		Map<UUID, List<ItemView>> result = new HashMap<>();
		for (OrderItem i : all) {
			result.computeIfAbsent(i.orderId, k -> new ArrayList<>())
				.add(new ItemView(i.productName, i.quantity, i.unitPriceCents, i.totalCents, i.notes,
						optionsByItem.getOrDefault(i.id, List.of())));
		}
		return result;
	}

	private List<OrderView> views(List<Order> list) {
		Map<UUID, List<ItemView>> lines = linesOf(list.stream().map(Order::getId).toList());
		return list.stream().map(o -> toView(o, lines.getOrDefault(o.getId(), List.of()))).toList();
	}

	private static OrderView toView(Order o, List<ItemView> lines) {
		return new OrderView(o.getId(), o.getNumber(), o.getTableId(), o.getTableLabel(), o.getStatus(),
				o.getPaymentStatus(), o.getCustomerName(), o.getNotes(), o.getTotalCents(), o.isTest(),
				o.getCreatedAt(), o.getConfirmedAt(), o.getPreparingAt(), o.getReadyAt(), o.getDeliveredAt(),
				o.getCompletedAt(), o.getCancelledAt(), o.getCancelReason(), lines);
	}

	private static PublicOrderView toPublic(Order o, List<ItemView> lines) {
		return new PublicOrderView(o.getTrackingToken(), o.getNumber(), o.getTableLabel(), o.getStatus(),
				o.getStatus().label(), o.getTotalCents(), o.isTest(), o.getCreatedAt(), o.getUpdatedAt(), lines);
	}

	private static ServiceRequestView requestView(ServiceRequest r) {
		return new ServiceRequestView(r.id, r.tableId, r.tableLabel, r.type, r.createdAt);
	}

	private void publish(UUID restaurantId, String type, Order order) {
		Map<String, Object> data = new HashMap<>();
		data.put("orderId", order.getId().toString());
		data.put("number", order.getNumber());
		data.put("tableLabel", order.getTableLabel());
		data.put("status", order.getStatus().name());
		publisher.publishEvent(new RealtimeEvent(restaurantId, type, data));
	}

	private Order order(UUID id) {
		return orders.findById(id).orElseThrow(() -> new NotFoundException("Pedido não encontrado."));
	}

	static String newToken(int bytes) {
		byte[] buffer = new byte[bytes];
		RANDOM.nextBytes(buffer);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
	}

	private static String blank(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
