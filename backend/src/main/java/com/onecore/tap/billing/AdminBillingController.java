package com.onecore.tap.billing;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.billing.BillingService.CycleResult;
import com.onecore.tap.billing.BillingService.InvoiceView;
import com.onecore.tap.billing.BillingService.PlateSaleView;
import com.onecore.tap.billing.BillingService.SubscriptionDetail;
import com.onecore.tap.billing.BillingService.SubscriptionView;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Tag(name = "Super Admin - Assinaturas e financeiro")
@RestController
@RequestMapping("/api/admin")
public class AdminBillingController {

	private final BillingService billing;

	private final PlatformFinanceService finance;

	public AdminBillingController(BillingService billing, PlatformFinanceService finance) {
		this.billing = billing;
		this.finance = finance;
	}

	public record ReceiptRequest(@NotNull(message = "Informe como foi recebido") ReceiptMethod method,
			@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate paidOn, @Size(max = 300) String notes) {
	}

	public record ReasonRequest(@Size(max = 300) String reason) {
	}

	public record PlateSaleRequest(
			@NotNull(message = "Informe a quantidade") @Min(value = 1, message = "Mínimo 1") @Max(value = 1000, message = "Máximo 1000") Integer quantity,
			@Size(max = 300) String notes) {
	}

	@GetMapping("/subscriptions")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public List<SubscriptionView> subscriptions() {
		return billing.list();
	}

	@Operation(summary = "Assinatura, cobranças e vendas de plaquinhas de um restaurante")
	@GetMapping("/restaurants/{id}/billing")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public ResponseEntity<SubscriptionDetail> detail(@PathVariable UUID id) {
		return billing.detail(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
	}

	@Operation(summary = "Registra o recebimento confirmado de uma cobrança (não processa pagamento)")
	@PostMapping("/invoices/{id}/pay")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_BILLING_MANAGE')")
	public InvoiceView payInvoice(@PathVariable UUID id, @Valid @RequestBody ReceiptRequest body) {
		return InvoiceView.of(billing.registerInvoicePayment(id, body.method(), body.paidOn(), body.notes(),
				CurrentUser.require()), billing.today());
	}

	@PostMapping("/invoices/{id}/void")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_BILLING_MANAGE')")
	public InvoiceView voidInvoice(@PathVariable UUID id, @Valid @RequestBody ReasonRequest body) {
		return InvoiceView.of(billing.voidInvoice(id, body.reason(), CurrentUser.require()), billing.today());
	}

	@PostMapping("/restaurants/{id}/plate-sales")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_BILLING_MANAGE')")
	public PlateSaleView registerPlateSale(@PathVariable UUID id, @Valid @RequestBody PlateSaleRequest body) {
		return PlateSaleView.of(billing.registerPlateSale(id, body.quantity(), body.notes(), CurrentUser.require()));
	}

	@PostMapping("/plate-sales/{id}/pay")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_BILLING_MANAGE')")
	public PlateSaleView payPlateSale(@PathVariable UUID id, @Valid @RequestBody ReceiptRequest body) {
		return PlateSaleView.of(billing.payPlateSale(id, body.method(), CurrentUser.require()));
	}

	@PostMapping("/plate-sales/{id}/void")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_BILLING_MANAGE')")
	public PlateSaleView voidPlateSale(@PathVariable UUID id, @Valid @RequestBody ReasonRequest body) {
		return PlateSaleView.of(billing.voidPlateSale(id, body.reason(), CurrentUser.require()));
	}

	@Operation(summary = "Executa agora a rotina diária de cobrança (idempotente)")
	@PostMapping("/billing/run")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_BILLING_MANAGE')")
	public CycleResult runCycle() {
		return billing.runCycle();
	}

	@Operation(summary = "Receita da OneCore Business (não inclui o faturamento dos restaurantes)")
	@GetMapping("/finance")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public PlatformFinanceService.Summary finance(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
		return finance.summary(from, to);
	}

}
