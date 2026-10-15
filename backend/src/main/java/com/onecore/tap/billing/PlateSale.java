package com.onecore.tap.billing;

import java.time.Instant;
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

/** Venda de plaquinhas a um restaurante, com o preço unitário congelado no momento da venda. */
@Entity
@Table(name = "plate_sales")
public class PlateSale {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(nullable = false, updatable = false)
	private int quantity;

	@Column(name = "unit_price_cents", nullable = false, updatable = false)
	private int unitPriceCents;

	@Column(name = "total_cents", nullable = false, updatable = false)
	private int totalCents;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private Invoice.Status status = Invoice.Status.OPEN;

	@Column(name = "paid_at")
	private Instant paidAt;

	@Enumerated(EnumType.STRING)
	@Column(name = "payment_method", length = 20)
	private ReceiptMethod paymentMethod;

	@Column(length = 300)
	private String notes;

	@Column(name = "registered_by", nullable = false, updatable = false)
	private String registeredBy;

	@Column(name = "voided_at")
	private Instant voidedAt;

	@Column(name = "void_reason", length = 300)
	private String voidReason;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Version
	private long version;

	protected PlateSale() {
	}

	PlateSale(UUID restaurantId, int quantity, int unitPriceCents, String notes, String registeredBy, Instant now) {
		this.restaurantId = restaurantId;
		this.quantity = quantity;
		this.unitPriceCents = unitPriceCents;
		this.totalCents = quantity * unitPriceCents;
		this.notes = notes;
		this.registeredBy = registeredBy;
		this.createdAt = now;
	}

	void markPaid(ReceiptMethod method, Instant now) {
		status = Invoice.Status.PAID;
		paymentMethod = method;
		paidAt = now;
	}

	void voidWith(String reason, Instant now) {
		status = Invoice.Status.VOID;
		voidReason = reason;
		voidedAt = now;
	}

	public UUID getId() {
		return id;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public int getQuantity() {
		return quantity;
	}

	public int getUnitPriceCents() {
		return unitPriceCents;
	}

	public int getTotalCents() {
		return totalCents;
	}

	public Invoice.Status getStatus() {
		return status;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public ReceiptMethod getPaymentMethod() {
		return paymentMethod;
	}

	public String getNotes() {
		return notes;
	}

	public String getRegisteredBy() {
		return registeredBy;
	}

	public String getVoidReason() {
		return voidReason;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
