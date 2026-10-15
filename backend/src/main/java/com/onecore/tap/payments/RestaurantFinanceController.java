package com.onecore.tap.payments;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.common.PageResponse;
import com.onecore.tap.payments.PaymentDtos.PaymentView;
import com.onecore.tap.payments.PaymentDtos.PendingTable;
import com.onecore.tap.payments.PaymentDtos.RegisterRequest;
import com.onecore.tap.payments.PaymentDtos.VoidRequest;
import com.onecore.tap.plans.PlanFeatures;
import com.onecore.tap.plans.PlanModule;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

/**
 * Pagamentos (registro operacional, disponível em todos os planos), indicadores financeiros (módulo Financeiro)
 * e exportações (módulo Relatórios). Caixa, gerente e proprietário registram; garçom e cozinha não.
 */
@Tag(name = "Restaurante - Financeiro")
@RestController
@RequestMapping("/api/restaurant")
public class RestaurantFinanceController {

	private final PaymentService payments;

	private final FinanceService finance;

	private final PlanFeatures planFeatures;

	private final AuditService audit;

	public RestaurantFinanceController(PaymentService payments, FinanceService finance, PlanFeatures planFeatures,
			AuditService audit) {
		this.payments = payments;
		this.finance = finance;
		this.planFeatures = planFeatures;
		this.audit = audit;
	}

	@Operation(summary = "Registra o pagamento de pedidos ou da mesa (registro operacional, não é cobrança online)")
	@PostMapping("/payments")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_PAYMENTS_REGISTER')")
	public PaymentView register(@Valid @RequestBody RegisterRequest body, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		PaymentView view = payments.register(body.scope(), body.orderIds(), body.tableId(), body.entries(), body.notes(),
				actor);
		Map<String, Object> details = new HashMap<>();
		details.put("totalCents", view.totalCents());
		details.put("orders", view.orderNumbers());
		details.put("methods", view.entries().stream().map(e -> e.method().name()).toList());
		if (view.tableLabel() != null) {
			details.put("table", view.tableLabel());
		}
		audit.record(AuditAction.PAYMENT_REGISTERED, actor, "payment", view.id(), request, details);
		return view;
	}

	@Operation(summary = "Estorna um registro de pagamento (com motivo). Os pedidos voltam para pendente")
	@PostMapping("/payments/{id}/void")
	@PreAuthorize("hasAuthority('PERM_PAYMENTS_REGISTER')")
	public PaymentView voidPayment(@PathVariable UUID id, @Valid @RequestBody VoidRequest body,
			HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		PaymentView view = payments.voidPayment(id, body.reason(), actor);
		audit.record(AuditAction.PAYMENT_VOIDED, actor, "payment", id, request,
				Map.of("totalCents", view.totalCents(), "orders", view.orderNumbers(), "reason", view.voidReason()));
		return view;
	}

	@Operation(summary = "Pedidos aceitos ainda sem pagamento registrado, por mesa")
	@GetMapping("/payments/pending")
	@PreAuthorize("hasAnyAuthority('PERM_PAYMENTS_REGISTER', 'PERM_FINANCE_VIEW')")
	public List<PendingTable> pending() {
		return payments.pending();
	}

	@GetMapping("/payments")
	@PreAuthorize("hasAnyAuthority('PERM_PAYMENTS_REGISTER', 'PERM_FINANCE_VIEW')")
	public PageResponse<PaymentView> list(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
			@RequestParam(defaultValue = "0") int page) {
		FinanceService.validate(from, to);
		var result = payments.list(FinanceService.startInstant(from), FinanceService.endInstant(to),
				PageRequest.of(Math.max(page, 0), 25));
		return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(), result.getTotalElements(),
				result.getTotalPages());
	}

	@Operation(summary = "Indicadores financeiros do período, comparados ao período anterior de mesma duração")
	@GetMapping("/finance/summary")
	@PreAuthorize("hasAuthority('PERM_FINANCE_VIEW')")
	public FinanceService.Summary summary(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
		planFeatures.require(PlanModule.FINANCE);
		return finance.summary(CurrentUser.requireRestaurantId(), from, to);
	}

	@Operation(summary = "Resumo de um período para relatórios e comparação entre datas")
	@GetMapping("/reports/summary")
	@PreAuthorize("hasAuthority('PERM_FINANCE_VIEW')")
	public FinanceService.Summary reportSummary(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
		planFeatures.require(PlanModule.REPORTS);
		return finance.summary(CurrentUser.requireRestaurantId(), from, to);
	}

	@GetMapping("/reports/orders.csv")
	@PreAuthorize("hasAuthority('PERM_FINANCE_VIEW')")
	public void ordersCsv(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, HttpServletResponse response)
			throws IOException {
		planFeatures.require(PlanModule.REPORTS);
		UUID restaurantId = CurrentUser.requireRestaurantId();
		FinanceService.validate(from, to);
		try (Writer out = csv(response, "pedidos-%s-a-%s.csv".formatted(from, to))) {
			finance.writeOrdersCsv(restaurantId, from, to, out);
		}
	}

	@GetMapping("/reports/items.csv")
	@PreAuthorize("hasAuthority('PERM_FINANCE_VIEW')")
	public void itemsCsv(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, HttpServletResponse response)
			throws IOException {
		planFeatures.require(PlanModule.REPORTS);
		UUID restaurantId = CurrentUser.requireRestaurantId();
		FinanceService.validate(from, to);
		try (Writer out = csv(response, "produtos-%s-a-%s.csv".formatted(from, to))) {
			finance.writeItemsCsv(restaurantId, from, to, out);
		}
	}

	private static Writer csv(HttpServletResponse response, String filename) throws IOException {
		response.setContentType("text/csv;charset=UTF-8");
		response.setHeader(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString());
		response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
		return new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8);
	}

}
