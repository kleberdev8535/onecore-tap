package com.onecore.tap.orders;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.TenantId;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "orders")
public class Order extends BaseEntity {

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(nullable = false, updatable = false)
	private int number;

	@Column(name = "table_id", nullable = false, updatable = false)
	private UUID tableId;

	@Column(name = "table_label", nullable = false, updatable = false, length = 20)
	private String tableLabel;

	@Column(name = "session_id", nullable = false, updatable = false)
	private UUID sessionId;

	@Column(name = "tracking_token", nullable = false, updatable = false, length = 32)
	private String trackingToken;

	@Column(name = "client_token", nullable = false, updatable = false, length = 64)
	private String clientToken;

	@Column(name = "customer_name", length = 60)
	private String customerName;

	@Column(length = 300)
	private String notes;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private OrderStatus status;

	@Column(name = "payment_status", nullable = false, length = 20)
	private String paymentStatus = "UNPAID";

	@Column(name = "payment_id")
	private UUID paymentId;

	@Column(name = "paid_at")
	private Instant paidAt;

	@Column(name = "subtotal_cents", nullable = false)
	private int subtotalCents;

	@Column(name = "total_cents", nullable = false)
	private int totalCents;

	@Column(name = "is_test", nullable = false, updatable = false)
	private boolean test;

	@Column(name = "confirmed_at")
	private Instant confirmedAt;

	@Column(name = "preparing_at")
	private Instant preparingAt;

	@Column(name = "ready_at")
	private Instant readyAt;

	@Column(name = "delivered_at")
	private Instant deliveredAt;

	@Column(name = "completed_at")
	private Instant completedAt;

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	@Column(name = "cancel_reason", length = 300)
	private String cancelReason;

	protected Order() {
	}

	Order(int number, UUID tableId, String tableLabel, UUID sessionId, String trackingToken, String clientToken,
			String customerName, String notes, OrderStatus status, int totalCents, boolean test, Instant now) {
		this.number = number;
		this.tableId = tableId;
		this.tableLabel = tableLabel;
		this.sessionId = sessionId;
		this.trackingToken = trackingToken;
		this.clientToken = clientToken;
		this.customerName = customerName;
		this.notes = notes;
		this.status = status;
		this.subtotalCents = totalCents;
		this.totalCents = totalCents;
		this.test = test;
		if (status == OrderStatus.NEW) {
			this.confirmedAt = now;
		}
	}

	/** Aplica a transição já validada pelo serviço e registra o horário da etapa. */
	void moveTo(OrderStatus target, String reason, Instant now) {
		this.status = target;
		switch (target) {
			case NEW -> confirmedAt = now;
			case IN_PREPARATION -> preparingAt = now;
			case READY -> readyAt = now;
			case DELIVERED -> deliveredAt = now;
			case COMPLETED -> completedAt = now;
			case CANCELLED -> {
				cancelledAt = now;
				cancelReason = reason;
			}
			default -> {
			}
		}
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public int getNumber() {
		return number;
	}

	public UUID getTableId() {
		return tableId;
	}

	public String getTableLabel() {
		return tableLabel;
	}

	public UUID getSessionId() {
		return sessionId;
	}

	public String getTrackingToken() {
		return trackingToken;
	}

	public String getClientToken() {
		return clientToken;
	}

	public String getCustomerName() {
		return customerName;
	}

	public String getNotes() {
		return notes;
	}

	public OrderStatus getStatus() {
		return status;
	}

	/** Registro operacional do pagamento (não é liquidação online). */
	public void markPaid(UUID paymentId, Instant now) {
		this.paymentStatus = "PAID";
		this.paymentId = paymentId;
		this.paidAt = now;
	}

	public void markUnpaid() {
		this.paymentStatus = "UNPAID";
		this.paymentId = null;
		this.paidAt = null;
	}

	public boolean isPaid() {
		return "PAID".equals(paymentStatus);
	}

	public UUID getPaymentId() {
		return paymentId;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public String getPaymentStatus() {
		return paymentStatus;
	}

	public int getSubtotalCents() {
		return subtotalCents;
	}

	public int getTotalCents() {
		return totalCents;
	}

	public boolean isTest() {
		return test;
	}

	public Instant getConfirmedAt() {
		return confirmedAt;
	}

	public Instant getPreparingAt() {
		return preparingAt;
	}

	public Instant getReadyAt() {
		return readyAt;
	}

	public Instant getDeliveredAt() {
		return deliveredAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public Instant getCancelledAt() {
		return cancelledAt;
	}

	public String getCancelReason() {
		return cancelReason;
	}

}
