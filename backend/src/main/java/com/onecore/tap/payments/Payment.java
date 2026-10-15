package com.onecore.tap.payments;

import java.time.Instant;
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

/**
 * Registro operacional de pagamento feito pela equipe (o caixa confirma que recebeu). Não representa liquidação
 * online e nunca guarda dados de cartão: só o método. Estornar exige motivo e devolve os pedidos para pendente.
 */
@Entity
@Table(name = "payments")
public class Payment {

	public enum Scope {
		ORDER, TABLE
	}

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, updatable = false, length = 10)
	private Scope scope;

	@Column(name = "table_id", updatable = false)
	private UUID tableId;

	@Column(name = "table_label", updatable = false, length = 20)
	private String tableLabel;

	@Column(name = "total_cents", nullable = false, updatable = false)
	private int totalCents;

	@Column(name = "registered_by_id", updatable = false)
	private UUID registeredById;

	@Column(name = "registered_by_name", nullable = false, updatable = false)
	private String registeredByName;

	@Column(updatable = false, length = 300)
	private String notes;

	@Column(name = "voided_at")
	private Instant voidedAt;

	@Column(name = "voided_by_name")
	private String voidedByName;

	@Column(name = "void_reason", length = 300)
	private String voidReason;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected Payment() {
	}

	Payment(Scope scope, UUID tableId, String tableLabel, int totalCents, UUID registeredById,
			String registeredByName, String notes, Instant createdAt) {
		this.scope = scope;
		this.tableId = tableId;
		this.tableLabel = tableLabel;
		this.totalCents = totalCents;
		this.registeredById = registeredById;
		this.registeredByName = registeredByName;
		this.notes = notes;
		this.createdAt = createdAt;
	}

	void voidBy(String name, String reason, Instant now) {
		this.voidedAt = now;
		this.voidedByName = name;
		this.voidReason = reason;
	}

	public boolean isVoided() {
		return voidedAt != null;
	}

	public UUID getId() {
		return id;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public Scope getScope() {
		return scope;
	}

	public UUID getTableId() {
		return tableId;
	}

	public String getTableLabel() {
		return tableLabel;
	}

	public int getTotalCents() {
		return totalCents;
	}

	public String getRegisteredByName() {
		return registeredByName;
	}

	public String getNotes() {
		return notes;
	}

	public Instant getVoidedAt() {
		return voidedAt;
	}

	public String getVoidedByName() {
		return voidedByName;
	}

	public String getVoidReason() {
		return voidReason;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
