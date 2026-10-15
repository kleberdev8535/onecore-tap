package com.onecore.tap.billing;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * Cobrança mensal da assinatura. "Paga" só quando a OneCore Business registra o recebimento confirmado (ou,
 * no futuro, quando o provedor de pagamento confirmar). Nada é marcado como pago automaticamente.
 */
@Entity
@Table(name = "subscription_invoices")
public class Invoice {

	public enum Status {
		OPEN, PAID, VOID
	}

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "subscription_id", nullable = false, updatable = false)
	private UUID subscriptionId;

	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(name = "plan_name", nullable = false, updatable = false)
	private String planName;

	@Column(name = "period_start", nullable = false, updatable = false)
	private LocalDate periodStart;

	@Column(name = "period_end", nullable = false, updatable = false)
	private LocalDate periodEnd;

	@Column(name = "amount_cents", nullable = false, updatable = false)
	private int amountCents;

	@Column(name = "due_date", nullable = false, updatable = false)
	private LocalDate dueDate;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private Status status = Status.OPEN;

	@Column(name = "paid_at")
	private Instant paidAt;

	@Enumerated(EnumType.STRING)
	@Column(name = "payment_method", length = 20)
	private ReceiptMethod paymentMethod;

	@Column(name = "registered_by")
	private String registeredBy;

	@Column(length = 300)
	private String notes;

	@Column(name = "provider_payment_id")
	private String providerPaymentId;

	@Column(name = "voided_at")
	private Instant voidedAt;

	@Column(name = "void_reason", length = 300)
	private String voidReason;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Version
	private long version;

	protected Invoice() {
	}

	Invoice(UUID subscriptionId, UUID restaurantId, String planName, LocalDate periodStart, LocalDate periodEnd,
			int amountCents, LocalDate dueDate, Instant createdAt) {
		this.subscriptionId = subscriptionId;
		this.restaurantId = restaurantId;
		this.planName = planName;
		this.periodStart = periodStart;
		this.periodEnd = periodEnd;
		this.amountCents = amountCents;
		this.dueDate = dueDate;
		this.createdAt = createdAt;
	}

	void markPaid(ReceiptMethod method, Instant paidAt, String by, String notes) {
		this.status = Status.PAID;
		this.paymentMethod = method;
		this.paidAt = paidAt;
		this.registeredBy = by;
		this.notes = notes;
	}

	void voidWith(String reason, Instant now) {
		this.status = Status.VOID;
		this.voidReason = reason;
		this.voidedAt = now;
	}

	public boolean isOverdue(LocalDate today) {
		return status == Status.OPEN && dueDate.isBefore(today);
	}

	public UUID getId() {
		return id;
	}

	public UUID getSubscriptionId() {
		return subscriptionId;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public String getPlanName() {
		return planName;
	}

	public LocalDate getPeriodStart() {
		return periodStart;
	}

	public LocalDate getPeriodEnd() {
		return periodEnd;
	}

	public int getAmountCents() {
		return amountCents;
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public Status getStatus() {
		return status;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public ReceiptMethod getPaymentMethod() {
		return paymentMethod;
	}

	public String getRegisteredBy() {
		return registeredBy;
	}

	public String getNotes() {
		return notes;
	}

	public String getVoidReason() {
		return voidReason;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
