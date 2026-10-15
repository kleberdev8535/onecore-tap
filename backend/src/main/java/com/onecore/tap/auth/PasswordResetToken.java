package com.onecore.tap.auth;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Guarda apenas o hash SHA-256 do token; o valor bruto existe somente no link enviado ao usuário. */
@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "user_id", nullable = false, updatable = false)
	private UUID userId;

	@Column(name = "token_hash", nullable = false, updatable = false, length = 64)
	private String tokenHash;

	@Column(name = "expires_at", nullable = false, updatable = false)
	private Instant expiresAt;

	@Column(name = "used_at")
	private Instant usedAt;

	@Column(nullable = false, updatable = false, length = 20)
	private String purpose = "RESET";

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected PasswordResetToken() {
	}

	PasswordResetToken(UUID userId, String tokenHash, Instant expiresAt) {
		this(userId, tokenHash, expiresAt, "RESET");
	}

	PasswordResetToken(UUID userId, String tokenHash, Instant expiresAt, String purpose) {
		this.userId = userId;
		this.tokenHash = tokenHash;
		this.expiresAt = expiresAt;
		this.purpose = purpose;
	}

	boolean isInvite() {
		return "INVITE".equals(purpose);
	}

	boolean isUsable(Instant now) {
		return usedAt == null && expiresAt.isAfter(now);
	}

	void markUsed(Instant now) {
		usedAt = now;
	}

	UUID getUserId() {
		return userId;
	}

}
