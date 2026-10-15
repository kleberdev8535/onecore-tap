package com.onecore.tap.audit;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.ColumnTransformer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Registro imutavel. Sem @TenantId: o Super Admin consulta a trilha global e as consultas filtram explicitamente. */
@Entity
@Table(name = "audit_logs")
public class AuditLog {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "restaurant_id", updatable = false)
	private UUID restaurantId;

	@Column(name = "actor_user_id", updatable = false)
	private UUID actorUserId;

	@Column(name = "actor_email", updatable = false)
	private String actorEmail;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, updatable = false)
	private AuditAction action;

	@Column(name = "entity_type", updatable = false)
	private String entityType;

	@Column(name = "entity_id", updatable = false)
	private String entityId;

	@Column(name = "ip_address", updatable = false)
	private String ipAddress;

	@Column(name = "user_agent", updatable = false)
	private String userAgent;

	@ColumnTransformer(write = "?::jsonb")
	@Column(columnDefinition = "jsonb", updatable = false)
	private String details;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected AuditLog() {
	}

	AuditLog(UUID restaurantId, UUID actorUserId, String actorEmail, AuditAction action, String entityType,
			String entityId, String ipAddress, String userAgent, String details) {
		this.restaurantId = restaurantId;
		this.actorUserId = actorUserId;
		this.actorEmail = actorEmail;
		this.action = action;
		this.entityType = entityType;
		this.entityId = entityId;
		this.ipAddress = ipAddress;
		this.userAgent = userAgent;
		this.details = details;
	}

	public UUID getId() {
		return id;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public UUID getActorUserId() {
		return actorUserId;
	}

	public String getActorEmail() {
		return actorEmail;
	}

	public AuditAction getAction() {
		return action;
	}

	public String getEntityType() {
		return entityType;
	}

	public String getEntityId() {
		return entityId;
	}

	public String getIpAddress() {
		return ipAddress;
	}

	public String getDetails() {
		return details;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
