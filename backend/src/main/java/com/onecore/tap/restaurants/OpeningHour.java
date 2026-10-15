package com.onecore.tap.restaurants;

import java.time.LocalTime;
import java.util.UUID;

import org.hibernate.annotations.TenantId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Faixa de funcionamento em um dia da semana (1 = segunda ... 7 = domingo). Um dia pode ter mais de uma faixa
 * (ex.: almoço e jantar). Fechamento menor ou igual à abertura significa que vira a noite.
 */
@Entity
@Table(name = "restaurant_opening_hours")
public class OpeningHour {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(nullable = false)
	private short weekday;

	@Column(name = "opens_at", nullable = false)
	private LocalTime opensAt;

	@Column(name = "closes_at", nullable = false)
	private LocalTime closesAt;

	protected OpeningHour() {
	}

	public OpeningHour(int weekday, LocalTime opensAt, LocalTime closesAt) {
		this.weekday = (short) weekday;
		this.opensAt = opensAt;
		this.closesAt = closesAt;
	}

	public int getWeekday() {
		return weekday;
	}

	public LocalTime getOpensAt() {
		return opensAt;
	}

	public LocalTime getClosesAt() {
		return closesAt;
	}

}
