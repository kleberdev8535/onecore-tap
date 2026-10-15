package com.onecore.tap.plates;

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

/** Historico imutavel de cada mudanca de status ou vinculo de uma plaquinha. */
@Entity
@Table(name = "plate_assignments")
public class PlateEvent {

	public enum Type {
		CREATED, RESERVED, ASSIGNED, TRANSFERRED, RELEASED, SUSPENDED, REACTIVATED, DAMAGED, RESTORED, DEACTIVATED
	}

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	/** Ordem estavel dos eventos (timestamps podem empatar). Gerado pelo banco. */
	@Column(insertable = false, updatable = false)
	private Long seq;

	@Column(name = "plate_id", nullable = false, updatable = false)
	private UUID plateId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, updatable = false)
	private Type event;

	@Enumerated(EnumType.STRING)
	@Column(name = "from_status", updatable = false)
	private PlateStatus fromStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "to_status", nullable = false, updatable = false)
	private PlateStatus toStatus;

	@Column(name = "restaurant_id", updatable = false)
	private UUID restaurantId;

	@Column(name = "table_id", updatable = false)
	private UUID tableId;

	@Column(name = "actor_email", updatable = false)
	private String actorEmail;

	@Column(updatable = false)
	private String reason;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected PlateEvent() {
	}

	PlateEvent(UUID plateId, Type event, PlateStatus fromStatus, PlateStatus toStatus, UUID restaurantId,
			UUID tableId, String actorEmail, String reason, Instant createdAt) {
		this.plateId = plateId;
		this.event = event;
		this.fromStatus = fromStatus;
		this.toStatus = toStatus;
		this.restaurantId = restaurantId;
		this.tableId = tableId;
		this.actorEmail = actorEmail;
		this.reason = reason;
		this.createdAt = createdAt;
	}

	public UUID getId() {
		return id;
	}

	public Type getEvent() {
		return event;
	}

	public PlateStatus getFromStatus() {
		return fromStatus;
	}

	public PlateStatus getToStatus() {
		return toStatus;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public UUID getTableId() {
		return tableId;
	}

	public String getActorEmail() {
		return actorEmail;
	}

	public String getReason() {
		return reason;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
