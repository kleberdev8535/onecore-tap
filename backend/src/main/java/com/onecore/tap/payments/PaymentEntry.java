package com.onecore.tap.payments;

import java.util.UUID;

import org.hibernate.annotations.TenantId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Parte de um pagamento por método (ex.: R$ 50 no Pix + R$ 30,50 em dinheiro). */
@Entity
@Table(name = "payment_entries")
public class PaymentEntry {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(name = "payment_id", nullable = false, updatable = false)
	private UUID paymentId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, updatable = false, length = 10)
	private PaymentMethod method;

	@Column(name = "amount_cents", nullable = false, updatable = false)
	private int amountCents;

	@Column(name = "received_cents", updatable = false)
	private Integer receivedCents;

	protected PaymentEntry() {
	}

	PaymentEntry(UUID paymentId, PaymentMethod method, int amountCents, Integer receivedCents) {
		this.paymentId = paymentId;
		this.method = method;
		this.amountCents = amountCents;
		this.receivedCents = receivedCents;
	}

	public UUID getPaymentId() {
		return paymentId;
	}

	public PaymentMethod getMethod() {
		return method;
	}

	public int getAmountCents() {
		return amountCents;
	}

	public Integer getReceivedCents() {
		return receivedCents;
	}

	public int changeCents() {
		return receivedCents == null ? 0 : receivedCents - amountCents;
	}

}
