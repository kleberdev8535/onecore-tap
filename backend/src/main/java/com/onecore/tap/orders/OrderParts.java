package com.onecore.tap.orders;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.TenantId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** Entidades auxiliares do pedido (itens, opções, histórico, atendimento e chamados). Todas isoladas por restaurante. */
final class OrderParts {

	private OrderParts() {
	}

}

@Entity
@Table(name = "order_items")
class OrderItem {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	UUID restaurantId;

	@Column(name = "order_id", nullable = false, updatable = false)
	UUID orderId;

	@Column(name = "product_id", updatable = false)
	UUID productId;

	@Column(name = "product_name", nullable = false, updatable = false)
	String productName;

	@Column(name = "unit_price_cents", nullable = false, updatable = false)
	int unitPriceCents;

	@Column(nullable = false, updatable = false)
	int quantity;

	@Column(name = "total_cents", nullable = false, updatable = false)
	int totalCents;

	@Column(updatable = false)
	String notes;

	@Column(nullable = false, updatable = false)
	int position;

	protected OrderItem() {
	}

	OrderItem(UUID orderId, UUID productId, String productName, int unitPriceCents, int quantity, String notes,
			int position) {
		this.orderId = orderId;
		this.productId = productId;
		this.productName = productName;
		this.unitPriceCents = unitPriceCents;
		this.quantity = quantity;
		this.totalCents = unitPriceCents * quantity;
		this.notes = notes;
		this.position = position;
	}

}

@Entity
@Table(name = "order_item_options")
class OrderItemOption {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	UUID restaurantId;

	@Column(name = "order_item_id", nullable = false, updatable = false)
	UUID orderItemId;

	@Column(name = "group_name", nullable = false, updatable = false)
	String groupName;

	@Column(name = "option_id", updatable = false)
	UUID optionId;

	@Column(name = "option_name", nullable = false, updatable = false)
	String optionName;

	@Column(name = "price_cents", nullable = false, updatable = false)
	int priceCents;

	protected OrderItemOption() {
	}

	OrderItemOption(UUID orderItemId, String groupName, UUID optionId, String optionName, int priceCents) {
		this.orderItemId = orderItemId;
		this.groupName = groupName;
		this.optionId = optionId;
		this.optionName = optionName;
		this.priceCents = priceCents;
	}

}

@Entity
@Table(name = "order_events")
class OrderEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	UUID id;

	@Column(insertable = false, updatable = false)
	Long seq;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	UUID restaurantId;

	@Column(name = "order_id", nullable = false, updatable = false)
	UUID orderId;

	@Column(name = "from_status", updatable = false)
	String fromStatus;

	@Column(name = "to_status", nullable = false, updatable = false)
	String toStatus;

	@Column(name = "actor_user_id", updatable = false)
	UUID actorUserId;

	@Column(name = "actor_name", updatable = false)
	String actorName;

	@Column(updatable = false)
	String reason;

	@Column(name = "created_at", nullable = false, updatable = false)
	Instant createdAt;

	protected OrderEvent() {
	}

	OrderEvent(UUID orderId, OrderStatus from, OrderStatus to, UUID actorUserId, String actorName, String reason,
			Instant now) {
		this.orderId = orderId;
		this.fromStatus = from == null ? null : from.name();
		this.toStatus = to.name();
		this.actorUserId = actorUserId;
		this.actorName = actorName;
		this.reason = reason;
		this.createdAt = now;
	}

}

@Entity
@Table(name = "table_sessions")
class TableSession {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	UUID restaurantId;

	@Column(name = "table_id", nullable = false, updatable = false)
	UUID tableId;

	@Column(name = "opened_at", nullable = false, updatable = false)
	Instant openedAt;

	@Column(name = "closed_at")
	Instant closedAt;

	@Column(name = "closed_by")
	String closedBy;

	protected TableSession() {
	}

}

@Entity
@Table(name = "service_requests")
class ServiceRequest {

	enum Type {
		CALL_WAITER, REQUEST_BILL
	}

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	UUID restaurantId;

	@Column(name = "table_id", nullable = false, updatable = false)
	UUID tableId;

	@Column(name = "table_label", nullable = false, updatable = false)
	String tableLabel;

	@jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
	@Column(nullable = false, updatable = false)
	Type type;

	@Column(nullable = false)
	String status = "OPEN";

	@Column(name = "created_at", nullable = false, updatable = false)
	Instant createdAt;

	@Column(name = "resolved_at")
	Instant resolvedAt;

	@Column(name = "resolved_by")
	String resolvedBy;

	protected ServiceRequest() {
	}

	ServiceRequest(UUID tableId, String tableLabel, Type type) {
		this.tableId = tableId;
		this.tableLabel = tableLabel;
		this.type = type;
	}

	@PrePersist
	void onCreate() {
		createdAt = Instant.now();
	}

	void resolve(String by, Instant now) {
		status = "RESOLVED";
		resolvedBy = by;
		resolvedAt = now;
	}

}
