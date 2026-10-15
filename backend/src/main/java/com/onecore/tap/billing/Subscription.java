package com.onecore.tap.billing;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Assinatura de um restaurante com a OneCore Business. Uma por restaurante. O valor mensal é congelado na
 * assinatura: mudar o preço do plano não altera quem já assina; trocar de plano atualiza o valor a partir da
 * próxima cobrança.
 */
@Entity
@Table(name = "subscriptions")
public class Subscription extends BaseEntity {

	public enum Status {
		TRIALING("Em teste"), ACTIVE("Em dia"), PAST_DUE("Em atraso"), SUSPENDED("Suspensa"), CANCELLED("Cancelada");

		private final String label;

		Status(String label) {
			this.label = label;
		}

		public String label() {
			return label;
		}
	}

	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(name = "plan_id", nullable = false)
	private UUID planId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private Status status;

	@Column(name = "price_cents", nullable = false)
	private int priceCents;

	@Column(name = "trial_ends_at")
	private Instant trialEndsAt;

	@Column(name = "current_period_start")
	private LocalDate currentPeriodStart;

	@Column(name = "current_period_end")
	private LocalDate currentPeriodEnd;

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	@Column(name = "cancel_reason", length = 300)
	private String cancelReason;

	/** Integração futura (ex.: MERCADO_PAGO). Nula = cobranças registradas manualmente. */
	@Column(length = 30)
	private String provider;

	@Column(name = "provider_reference", length = 120)
	private String providerReference;

	protected Subscription() {
	}

	Subscription(UUID restaurantId, UUID planId, int priceCents) {
		this.restaurantId = restaurantId;
		this.planId = planId;
		this.priceCents = priceCents;
	}

	void startTrial(Instant endsAt) {
		status = Status.TRIALING;
		trialEndsAt = endsAt;
		currentPeriodStart = null;
		currentPeriodEnd = null;
	}

	void startPeriod(LocalDate start) {
		status = Status.ACTIVE;
		currentPeriodStart = start;
		currentPeriodEnd = start.plusMonths(1);
	}

	/** Avança para o próximo ciclo mensal. */
	void advance() {
		currentPeriodStart = currentPeriodEnd;
		currentPeriodEnd = currentPeriodEnd.plusMonths(1);
	}

	void changePlan(UUID planId, int priceCents) {
		this.planId = planId;
		this.priceCents = priceCents;
	}

	void changeStatus(Status status) {
		this.status = status;
	}

	void cancel(String reason, Instant now) {
		status = Status.CANCELLED;
		cancelledAt = now;
		cancelReason = reason;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public UUID getPlanId() {
		return planId;
	}

	public Status getStatus() {
		return status;
	}

	public int getPriceCents() {
		return priceCents;
	}

	public Instant getTrialEndsAt() {
		return trialEndsAt;
	}

	public LocalDate getCurrentPeriodStart() {
		return currentPeriodStart;
	}

	public LocalDate getCurrentPeriodEnd() {
		return currentPeriodEnd;
	}

	public Instant getCancelledAt() {
		return cancelledAt;
	}

	public String getCancelReason() {
		return cancelReason;
	}

	public String getProvider() {
		return provider;
	}

}
