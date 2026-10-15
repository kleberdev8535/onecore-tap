package com.onecore.tap.billing;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.plans.Plan;
import com.onecore.tap.plans.PlanRepository;
import com.onecore.tap.restaurants.OpeningHours;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.security.AuthenticatedUser;

/**
 * Assinaturas e cobranças da OneCore Business.
 *
 * Regras:
 * - A cobrança de cada mês é emitida no início do período e vence no primeiro dia do período.
 * - Vencida e em aberto: assinatura "em atraso" (inadimplente).
 * - Passada a carência (platform_settings.billing_grace_days): restaurante suspenso pela rotina.
 * - Recebimento registrado quitando o atraso: assinatura volta a "em dia" e, se a suspensão foi da rotina,
 *   o restaurante é reativado automaticamente. Suspensões manuais nunca são desfeitas pela rotina.
 * - Nada é marcado como pago sem um registro de recebimento (manual hoje, provedor no futuro).
 */
@Service
public class BillingService {

	private static final Logger log = LoggerFactory.getLogger(BillingService.class);

	static final ZoneId ZONE = OpeningHours.BUSINESS_ZONE;

	private final SubscriptionRepository subscriptions;

	private final InvoiceRepository invoices;

	private final PlateSaleRepository plateSales;

	private final RestaurantRepository restaurants;

	private final PlanRepository plans;

	private final JdbcTemplate jdbc;

	private final AuditService audit;

	private final Clock clock;

	public BillingService(SubscriptionRepository subscriptions, InvoiceRepository invoices,
			PlateSaleRepository plateSales, RestaurantRepository restaurants, PlanRepository plans, JdbcTemplate jdbc,
			AuditService audit, Clock clock) {
		this.subscriptions = subscriptions;
		this.invoices = invoices;
		this.plateSales = plateSales;
		this.restaurants = restaurants;
		this.plans = plans;
		this.jdbc = jdbc;
		this.audit = audit;
		this.clock = clock;
	}

	LocalDate today() {
		return LocalDate.now(clock.withZone(ZONE));
	}

	// ================================================================== Ciclo de vida (chamado pela implantação)

	/** Restaurante entrou em teste: assinatura em teste, sem cobrança até o fim do período. */
	@Transactional
	public void onTrialStarted(Restaurant restaurant, Instant trialEndsAt) {
		Plan plan = planOf(restaurant);
		Subscription s = subscriptions.findByRestaurantIdForUpdate(restaurant.getId())
			.orElseGet(() -> new Subscription(restaurant.getId(), plan.getId(), plan.getMonthlyPriceCents()));
		s.changePlan(plan.getId(), plan.getMonthlyPriceCents());
		s.startTrial(trialEndsAt);
		subscriptions.saveAndFlush(s);
		audit.record(AuditAction.SUBSCRIPTION_CREATED, null, "subscription", s.getId(), null,
				Map.of("restaurantId", restaurant.getId().toString(), "status", "TRIALING", "plan", plan.getCode()));
	}

	/**
	 * Restaurante ativado (da implantação ou convertendo o teste antes do fim): primeiro período começa hoje e a
	 * cobrança é emitida. Reativação manual de um suspenso: só recalcula a situação.
	 */
	@Transactional
	public void onActivated(Restaurant restaurant, RestaurantStatus previous) {
		Optional<Subscription> existing = subscriptions.findByRestaurantIdForUpdate(restaurant.getId());
		if (previous == RestaurantStatus.SUSPENDED && existing.isPresent()) {
			Subscription s = existing.get();
			if (s.getStatus() == Subscription.Status.SUSPENDED) {
				s.changeStatus(hasOverdue(s) ? Subscription.Status.PAST_DUE : Subscription.Status.ACTIVE);
			}
			return;
		}
		Plan plan = planOf(restaurant);
		Subscription s = existing.orElseGet(() -> new Subscription(restaurant.getId(), plan.getId(), plan.getMonthlyPriceCents()));
		s.changePlan(plan.getId(), plan.getMonthlyPriceCents());
		s.startPeriod(today());
		subscriptions.saveAndFlush(s);
		issueInvoice(s, plan.getName());
		audit.record(AuditAction.SUBSCRIPTION_CREATED, null, "subscription", s.getId(), null,
				Map.of("restaurantId", restaurant.getId().toString(), "status", "ACTIVE", "plan", plan.getCode()));
	}

	@Transactional
	public void onCancelled(UUID restaurantId, String reason) {
		subscriptions.findByRestaurantIdForUpdate(restaurantId).ifPresent(s -> {
			if (s.getStatus() != Subscription.Status.CANCELLED) {
				s.cancel(reason, clock.instant());
				audit.record(AuditAction.SUBSCRIPTION_STATUS_CHANGED, null, "subscription", s.getId(), null,
						Map.of("status", "CANCELLED", "reason", reason));
			}
		});
	}

	/** Upgrade/downgrade: o novo valor vale a partir da próxima cobrança (sem pró-rata). */
	@Transactional
	public void onPlanChanged(UUID restaurantId, Plan plan, AuthenticatedUser actor) {
		subscriptions.findByRestaurantIdForUpdate(restaurantId).ifPresent(s -> {
			if (s.getPlanId().equals(plan.getId())) {
				return;
			}
			int previous = s.getPriceCents();
			s.changePlan(plan.getId(), plan.getMonthlyPriceCents());
			audit.record(AuditAction.SUBSCRIPTION_PLAN_CHANGED, actor, "subscription", s.getId(), null,
					Map.of("plan", plan.getCode(), "previousPriceCents", previous, "priceCents", plan.getMonthlyPriceCents(),
							"direction", plan.getMonthlyPriceCents() >= previous ? "UPGRADE" : "DOWNGRADE"));
		});
	}

	// ================================================================== Recebimentos

	@Transactional
	public Invoice registerInvoicePayment(UUID invoiceId, ReceiptMethod method, LocalDate paidOn, String notes,
			AuthenticatedUser actor) {
		Invoice invoice = invoices.findById(invoiceId).orElseThrow(() -> new NotFoundException("Cobrança não encontrada."));
		if (invoice.getStatus() != Invoice.Status.OPEN) {
			throw new ConflictException("Esta cobrança não está em aberto.");
		}
		LocalDate day = paidOn == null ? today() : paidOn;
		if (day.isAfter(today())) {
			throw new ConflictException("A data do recebimento não pode ser futura.");
		}
		Instant paidAt = day.equals(today()) ? clock.instant() : day.atStartOfDay(ZONE).plusHours(12).toInstant();
		invoice.markPaid(method, paidAt, actor.email(), blank(notes));
		invoices.flush();
		audit.record(AuditAction.INVOICE_PAID, actor, "invoice", invoice.getId(), null,
				Map.of("restaurantId", invoice.getRestaurantId().toString(), "amountCents", invoice.getAmountCents(),
						"method", method.name()));
		subscriptions.findByRestaurantIdForUpdate(invoice.getRestaurantId()).ifPresent(this::settleIfUpToDate);
		return invoice;
	}

	@Transactional
	public Invoice voidInvoice(UUID invoiceId, String reason, AuthenticatedUser actor) {
		Invoice invoice = invoices.findById(invoiceId).orElseThrow(() -> new NotFoundException("Cobrança não encontrada."));
		if (invoice.getStatus() != Invoice.Status.OPEN) {
			throw new ConflictException("Só cobranças em aberto podem ser anuladas.");
		}
		String clean = requireReason(reason);
		invoice.voidWith(clean, clock.instant());
		invoices.flush();
		audit.record(AuditAction.INVOICE_VOIDED, actor, "invoice", invoice.getId(), null,
				Map.of("restaurantId", invoice.getRestaurantId().toString(), "reason", clean));
		subscriptions.findByRestaurantIdForUpdate(invoice.getRestaurantId()).ifPresent(this::settleIfUpToDate);
		return invoice;
	}

	/** Sem atraso pendente: assinatura volta a "em dia"; suspensão aplicada pela cobrança é desfeita. */
	private void settleIfUpToDate(Subscription s) {
		if (hasOverdue(s)) {
			return;
		}
		Instant now = clock.instant();
		if (s.getStatus() == Subscription.Status.PAST_DUE) {
			s.changeStatus(Subscription.Status.ACTIVE);
			audit.record(AuditAction.SUBSCRIPTION_STATUS_CHANGED, null, "subscription", s.getId(), null,
					Map.of("status", "ACTIVE", "reason", "Cobranças em dia"));
		}
		if (s.getStatus() == Subscription.Status.SUSPENDED) {
			Restaurant r = restaurants.findById(s.getRestaurantId()).orElseThrow();
			if (r.isSuspendedByBilling() && r.getStatus() == RestaurantStatus.SUSPENDED) {
				r.reactivateAfterBilling(now);
				s.changeStatus(Subscription.Status.ACTIVE);
				audit.record(AuditAction.RESTAURANT_REACTIVATED_BY_BILLING, null, "restaurant", r.getId(), null,
						Map.of("reason", "Cobranças quitadas"));
			}
		}
	}

	// ================================================================== Rotina diária

	public record CycleResult(LocalDate day, int trialsConverted, int invoicesIssued, int markedPastDue,
			int suspended) {
	}

	/**
	 * Rotina de cobrança, idempotente: rodar duas vezes no mesmo dia não duplica nada (uma cobrança por período,
	 * garantida por índice único). Um lock consultivo do PostgreSQL evita execução simultânea em duas instâncias.
	 */
	@Transactional
	public CycleResult runCycle() {
		Boolean locked = jdbc.queryForObject("select pg_try_advisory_xact_lock(4242001)", Boolean.class);
		if (!Boolean.TRUE.equals(locked)) {
			throw new ConflictException("A rotina de cobrança já está em execução.");
		}
		LocalDate today = today();
		Instant now = clock.instant();
		int trials = 0;
		int issued = 0;
		int pastDue = 0;
		int suspended = 0;

		// 1. Testes encerrados viram assinatura ativa com a primeira cobrança.
		for (Subscription s : subscriptions.findTrialsEndedBy(now)) {
			Restaurant r = restaurants.findById(s.getRestaurantId()).orElseThrow();
			LocalDate start = s.getTrialEndsAt().atZone(ZONE).toLocalDate();
			s.startPeriod(start.isAfter(today) ? today : start);
			if (r.getStatus() == RestaurantStatus.TRIAL) {
				r.changeStatus(RestaurantStatus.ACTIVE, null, now);
			}
			issued += issueInvoice(s, planName(s)) ? 1 : 0;
			trials++;
			audit.record(AuditAction.SUBSCRIPTION_STATUS_CHANGED, null, "subscription", s.getId(), null,
					Map.of("status", "ACTIVE", "reason", "Fim do período de teste"));
		}

		// 2. Renovação: emite a cobrança de cada período iniciado (recupera dias em que a rotina não rodou).
		for (Subscription s : subscriptions.findDueForRenewal(today)) {
			while (!s.getCurrentPeriodEnd().isAfter(today)) {
				s.advance();
				issued += issueInvoice(s, planName(s)) ? 1 : 0;
			}
		}
		subscriptions.flush();

		// 3. Atraso e 4. suspensão por inadimplência após a carência.
		int grace = graceDays();
		for (Subscription s : subscriptions.findByStatusIn(List.of(Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE))) {
			List<Invoice> open = invoices.findOpen(s.getId());
			Optional<Invoice> oldestOverdue = open.stream().filter(i -> i.isOverdue(today)).findFirst();
			if (oldestOverdue.isEmpty()) {
				continue;
			}
			if (s.getStatus() == Subscription.Status.ACTIVE) {
				s.changeStatus(Subscription.Status.PAST_DUE);
				pastDue++;
				audit.record(AuditAction.SUBSCRIPTION_STATUS_CHANGED, null, "subscription", s.getId(), null,
						Map.of("status", "PAST_DUE", "dueDate", oldestOverdue.get().getDueDate().toString()));
			}
			if (oldestOverdue.get().getDueDate().plusDays(grace).isBefore(today)) {
				Restaurant r = restaurants.findById(s.getRestaurantId()).orElseThrow();
				if (r.getStatus() == RestaurantStatus.ACTIVE || r.getStatus() == RestaurantStatus.TRIAL) {
					String reason = "Inadimplência: cobrança vencida em %s".formatted(oldestOverdue.get().getDueDate());
					r.suspendByBilling(reason, now);
					s.changeStatus(Subscription.Status.SUSPENDED);
					suspended++;
					audit.record(AuditAction.RESTAURANT_SUSPENDED_BY_BILLING, null, "restaurant", r.getId(), null,
							Map.of("reason", reason, "graceDays", grace));
				}
			}
		}
		subscriptions.flush();
		CycleResult result = new CycleResult(today, trials, issued, pastDue, suspended);
		audit.record(AuditAction.BILLING_CYCLE_RUN, null, "billing", today, null,
				Map.of("trialsConverted", trials, "invoicesIssued", issued, "markedPastDue", pastDue, "suspended", suspended));
		log.info("Rotina de cobrança {}: {}", today, result);
		return result;
	}

	/** Emite a cobrança do período atual, se ainda não existir. */
	private boolean issueInvoice(Subscription s, String planName) {
		if (invoices.existsBySubscriptionIdAndPeriodStart(s.getId(), s.getCurrentPeriodStart())) {
			return false;
		}
		Invoice invoice = invoices.save(new Invoice(s.getId(), s.getRestaurantId(), planName, s.getCurrentPeriodStart(),
				s.getCurrentPeriodEnd(), s.getPriceCents(), s.getCurrentPeriodStart(), clock.instant()));
		audit.record(AuditAction.INVOICE_ISSUED, null, "invoice", invoice.getId(), null,
				Map.of("restaurantId", s.getRestaurantId().toString(), "amountCents", s.getPriceCents(),
						"periodStart", s.getCurrentPeriodStart().toString()));
		return true;
	}

	private boolean hasOverdue(Subscription s) {
		LocalDate today = today();
		return invoices.findOpen(s.getId()).stream().anyMatch(i -> i.isOverdue(today));
	}

	// ================================================================== Venda de plaquinhas

	@Transactional
	public PlateSale registerPlateSale(UUID restaurantId, int quantity, String notes, AuthenticatedUser actor) {
		restaurants.findById(restaurantId).orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
		if (quantity < 1 || quantity > 1000) {
			throw new ConflictException("Quantidade entre 1 e 1000.");
		}
		PlateSale sale = plateSales.saveAndFlush(new PlateSale(restaurantId, quantity, platePrice(), blank(notes),
				actor.email(), clock.instant()));
		audit.record(AuditAction.PLATE_SALE_REGISTERED, actor, "plate_sale", sale.getId(), null,
				Map.of("restaurantId", restaurantId.toString(), "quantity", quantity, "totalCents", sale.getTotalCents()));
		return sale;
	}

	@Transactional
	public PlateSale payPlateSale(UUID id, ReceiptMethod method, AuthenticatedUser actor) {
		PlateSale sale = plateSales.findById(id).orElseThrow(() -> new NotFoundException("Venda não encontrada."));
		if (sale.getStatus() != Invoice.Status.OPEN) {
			throw new ConflictException("Esta venda não está em aberto.");
		}
		sale.markPaid(method, clock.instant());
		plateSales.flush();
		audit.record(AuditAction.PLATE_SALE_PAID, actor, "plate_sale", id, null,
				Map.of("totalCents", sale.getTotalCents(), "method", method.name()));
		return sale;
	}

	@Transactional
	public PlateSale voidPlateSale(UUID id, String reason, AuthenticatedUser actor) {
		PlateSale sale = plateSales.findById(id).orElseThrow(() -> new NotFoundException("Venda não encontrada."));
		if (sale.getStatus() != Invoice.Status.OPEN) {
			throw new ConflictException("Só vendas em aberto podem ser anuladas.");
		}
		String clean = requireReason(reason);
		sale.voidWith(clean, clock.instant());
		plateSales.flush();
		audit.record(AuditAction.PLATE_SALE_VOIDED, actor, "plate_sale", id, null, Map.of("reason", clean));
		return sale;
	}

	// ================================================================== Consultas

	public record InvoiceView(UUID id, String planName, LocalDate periodStart, LocalDate periodEnd, int amountCents,
			LocalDate dueDate, Invoice.Status status, boolean overdue, java.time.Instant paidAt, ReceiptMethod paymentMethod,
			String registeredBy, String notes, String voidReason) {

		static InvoiceView of(Invoice i, LocalDate today) {
			return new InvoiceView(i.getId(), i.getPlanName(), i.getPeriodStart(), i.getPeriodEnd(), i.getAmountCents(),
					i.getDueDate(), i.getStatus(), i.isOverdue(today), i.getPaidAt(), i.getPaymentMethod(),
					i.getRegisteredBy(), i.getNotes(), i.getVoidReason());
		}
	}

	public record PlateSaleView(UUID id, int quantity, int unitPriceCents, int totalCents, Invoice.Status status,
			java.time.Instant paidAt, ReceiptMethod paymentMethod, String notes, String registeredBy, String voidReason,
			java.time.Instant createdAt) {

		static PlateSaleView of(PlateSale s) {
			return new PlateSaleView(s.getId(), s.getQuantity(), s.getUnitPriceCents(), s.getTotalCents(), s.getStatus(),
					s.getPaidAt(), s.getPaymentMethod(), s.getNotes(), s.getRegisteredBy(), s.getVoidReason(),
					s.getCreatedAt());
		}
	}

	public record SubscriptionView(UUID id, UUID restaurantId, String restaurantName, String restaurantStatus,
			boolean suspendedByBilling, UUID planId, String planName, Subscription.Status status, String statusLabel,
			int priceCents, java.time.Instant trialEndsAt, LocalDate currentPeriodStart, LocalDate currentPeriodEnd,
			int openCents, int overdueCents, LocalDate nextDueDate, String provider) {
	}

	public record SubscriptionDetail(SubscriptionView subscription, List<InvoiceView> invoices,
			List<PlateSaleView> plateSales, int graceDays) {
	}

	@Transactional(readOnly = true)
	public List<SubscriptionView> list() {
		LocalDate today = today();
		Map<UUID, List<Invoice>> openByRestaurant = new HashMap<>();
		invoices.findAllOpen().forEach(i -> openByRestaurant.computeIfAbsent(i.getRestaurantId(), k -> new java.util.ArrayList<>()).add(i));
		Map<UUID, Restaurant> rest = new HashMap<>();
		restaurants.findAll().forEach(r -> rest.put(r.getId(), r));
		Map<UUID, String> planNames = new HashMap<>();
		plans.findAll().forEach(p -> planNames.put(p.getId(), p.getName()));
		return subscriptions.findAllByOrderByCreatedAtDesc()
			.stream()
			.map(s -> view(s, rest.get(s.getRestaurantId()), planNames.get(s.getPlanId()),
					openByRestaurant.getOrDefault(s.getRestaurantId(), List.of()), today))
			.toList();
	}

	@Transactional(readOnly = true)
	public Optional<SubscriptionDetail> detail(UUID restaurantId) {
		LocalDate today = today();
		Restaurant r = restaurants.findById(restaurantId).orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
		List<Invoice> all = invoices.findByRestaurantIdOrderByPeriodStartDesc(restaurantId);
		List<PlateSaleView> sales = plateSales.findByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream().map(PlateSaleView::of).toList();
		return subscriptions.findByRestaurantId(restaurantId)
			.map(s -> new SubscriptionDetail(
					view(s, r, plans.findById(s.getPlanId()).map(Plan::getName).orElse(""),
							all.stream().filter(i -> i.getStatus() == Invoice.Status.OPEN).toList(), today),
					all.stream().map(i -> InvoiceView.of(i, today)).toList(), sales, graceDays()))
			.or(() -> sales.isEmpty() ? Optional.empty()
					: Optional.of(new SubscriptionDetail(null, List.of(), sales, graceDays())));
	}

	private static SubscriptionView view(Subscription s, Restaurant r, String planName, List<Invoice> open, LocalDate today) {
		int openCents = open.stream().mapToInt(Invoice::getAmountCents).sum();
		int overdue = open.stream().filter(i -> i.isOverdue(today)).mapToInt(Invoice::getAmountCents).sum();
		LocalDate nextDue = open.stream().map(Invoice::getDueDate).min(LocalDate::compareTo)
			.orElse(s.getStatus() == Subscription.Status.TRIALING || s.getCurrentPeriodEnd() == null ? null : s.getCurrentPeriodEnd());
		return new SubscriptionView(s.getId(), s.getRestaurantId(), r == null ? "" : r.getTradeName(),
				r == null ? null : r.getStatus().name(), r != null && r.isSuspendedByBilling(), s.getPlanId(), planName,
				s.getStatus(), s.getStatus().label(), s.getPriceCents(), s.getTrialEndsAt(), s.getCurrentPeriodStart(),
				s.getCurrentPeriodEnd(), openCents, overdue, nextDue, s.getProvider());
	}

	// ================================================================== Apoio

	int graceDays() {
		String v = jdbc.query("select value from platform_settings where key = 'billing_grace_days'",
				rs -> rs.next() ? rs.getString(1) : null);
		return v == null ? 10 : Integer.parseInt(v);
	}

	int platePrice() {
		String v = jdbc.query("select value from platform_settings where key = 'plate_price_cents'",
				rs -> rs.next() ? rs.getString(1) : null);
		return v == null ? 0 : Integer.parseInt(v);
	}

	private Plan planOf(Restaurant restaurant) {
		if (restaurant.getPlanId() == null) {
			throw new ConflictException("Defina um plano antes de ativar.");
		}
		return plans.findById(restaurant.getPlanId()).orElseThrow();
	}

	private String planName(Subscription s) {
		return plans.findById(s.getPlanId()).map(Plan::getName).orElse("Plano");
	}

	private static String requireReason(String reason) {
		String clean = blank(reason);
		if (clean == null) {
			throw new ConflictException("Informe o motivo.");
		}
		return clean;
	}

	private static String blank(String v) {
		return v == null || v.isBlank() ? null : v.trim();
	}

}
