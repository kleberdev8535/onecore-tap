package com.onecore.tap.plates;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "plate_batches")
public class PlateBatch {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, length = 40, updatable = false)
	private String code;

	@Column(name = "manufactured_on")
	private LocalDate manufacturedOn;

	@Column(nullable = false, updatable = false)
	private int quantity;

	@Column(length = 300)
	private String notes;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected PlateBatch() {
	}

	PlateBatch(String code, LocalDate manufacturedOn, int quantity, String notes) {
		this.code = code;
		this.manufacturedOn = manufacturedOn;
		this.quantity = quantity;
		this.notes = notes;
	}

	public UUID getId() {
		return id;
	}

	public String getCode() {
		return code;
	}

	public LocalDate getManufacturedOn() {
		return manufacturedOn;
	}

	public int getQuantity() {
		return quantity;
	}

	public String getNotes() {
		return notes;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

}
