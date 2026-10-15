package com.onecore.tap.plates;

import java.time.Instant;
import java.util.UUID;

import com.onecore.tap.common.BaseEntity;
import com.onecore.tap.common.ConflictException;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Plaquinha fisica (NFC + QR Code). O publicToken compoe a URL permanente gravada no chip e impressa no QR:
 * ele nunca muda. Trocar de restaurante ou mesa altera apenas o vinculo.
 *
 * As regras de transicao vivem aqui; o banco reforca a coerencia status/vinculo com uma constraint.
 */
@Entity
@Table(name = "plates")
public class Plate extends BaseEntity {

	@Column(nullable = false, length = 16, updatable = false)
	private String serial;

	@Column(name = "public_token", nullable = false, length = 16, updatable = false)
	private String publicToken;

	@Column(name = "batch_id", nullable = false, updatable = false)
	private UUID batchId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private PlateStatus status = PlateStatus.AVAILABLE;

	@Column(name = "restaurant_id")
	private UUID restaurantId;

	@Column(name = "table_id")
	private UUID tableId;

	@Column(name = "activated_at")
	private Instant activatedAt;

	protected Plate() {
	}

	Plate(String serial, String publicToken, UUID batchId) {
		this.serial = serial;
		this.publicToken = publicToken;
		this.batchId = batchId;
	}

	/** Vincula a um restaurante. Sem mesa fica RESERVED; com mesa fica ACTIVE (inclui transferencia). */
	void bind(UUID restaurantId, UUID tableId, Instant now) {
		require(status == PlateStatus.AVAILABLE || status == PlateStatus.RESERVED || status == PlateStatus.ACTIVE,
				"vincular");
		this.restaurantId = restaurantId;
		this.tableId = tableId;
		if (tableId == null) {
			status = PlateStatus.RESERVED;
		}
		else {
			status = PlateStatus.ACTIVE;
			if (activatedAt == null) {
				activatedAt = now;
			}
		}
	}

	void release() {
		require(status.isBound(), "desvincular");
		clearBinding();
		status = PlateStatus.AVAILABLE;
	}

	void suspend() {
		require(status == PlateStatus.ACTIVE, "suspender");
		status = PlateStatus.SUSPENDED;
	}

	void reactivate() {
		require(status == PlateStatus.SUSPENDED, "reativar");
		status = PlateStatus.ACTIVE;
	}

	void markDamaged() {
		require(status != PlateStatus.DAMAGED && status != PlateStatus.DEACTIVATED, "marcar como danificada");
		clearBinding();
		status = PlateStatus.DAMAGED;
	}

	/** Plaquinha danificada que passou pela inspecao volta ao estoque. */
	void restoreToStock() {
		require(status == PlateStatus.DAMAGED, "devolver ao estoque");
		status = PlateStatus.AVAILABLE;
	}

	void deactivate() {
		require(status != PlateStatus.DEACTIVATED, "desativar");
		clearBinding();
		status = PlateStatus.DEACTIVATED;
	}

	private void clearBinding() {
		restaurantId = null;
		tableId = null;
	}

	private void require(boolean condition, String action) {
		if (!condition) {
			throw new ConflictException(
					"Não é possível " + action + " a plaquinha " + serial + " no status atual (" + status + ").");
		}
	}

	public String getSerial() {
		return serial;
	}

	public String getPublicToken() {
		return publicToken;
	}

	public UUID getBatchId() {
		return batchId;
	}

	public PlateStatus getStatus() {
		return status;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public UUID getTableId() {
		return tableId;
	}

	public Instant getActivatedAt() {
		return activatedAt;
	}

}
