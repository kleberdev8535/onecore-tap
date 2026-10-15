package com.onecore.tap.users;

import java.time.Instant;
import java.util.UUID;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Usuários não usam @TenantId: o login precisa localizar o usuário antes de conhecer o restaurante. Consultas de
 * funcionários por restaurante devem filtrar explicitamente pelo restaurantId resolvido da sessão.
 */
@Entity
@Table(name = "users")
public class User extends BaseEntity {

	@Column(name = "restaurant_id")
	private UUID restaurantId;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(nullable = false, length = 160)
	private String email;

	@Column(name = "password_hash", nullable = false)
	private String passwordHash;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private Role role;

	@Column(nullable = false)
	private boolean active = true;

	@Column(name = "failed_login_attempts", nullable = false)
	private int failedLoginAttempts;

	@Column(name = "locked_until")
	private Instant lockedUntil;

	@Column(name = "last_login_at")
	private Instant lastLoginAt;

	protected User() {
	}

	public User(UUID restaurantId, String name, String email, String passwordHash, Role role) {
		if (role.isPlatform() != (restaurantId == null)) {
			throw new IllegalArgumentException("Super Admin não pertence a restaurante; demais perfis precisam de um.");
		}
		this.restaurantId = restaurantId;
		this.name = name;
		this.email = email.trim().toLowerCase();
		this.passwordHash = passwordHash;
		this.role = role;
	}

	public boolean isLocked(Instant now) {
		return lockedUntil != null && lockedUntil.isAfter(now);
	}

	public void registerFailedLogin(int maxAttempts, Instant lockUntil) {
		failedLoginAttempts++;
		if (failedLoginAttempts >= maxAttempts) {
			lockedUntil = lockUntil;
			failedLoginAttempts = 0;
		}
	}

	public void registerSuccessfulLogin(Instant now) {
		failedLoginAttempts = 0;
		lockedUntil = null;
		lastLoginAt = now;
	}

	public void changePassword(String newHash) {
		this.passwordHash = newHash;
		this.failedLoginAttempts = 0;
		this.lockedUntil = null;
	}

	public void rename(String name) {
		this.name = name;
	}

	/** Troca de perfil dentro do mesmo restaurante. Perfis de plataforma nunca mudam por aqui. */
	public void changeRole(Role role) {
		if (role.isPlatform() || this.role.isPlatform()) {
			throw new IllegalArgumentException("Perfil de plataforma não pode ser atribuído ou alterado.");
		}
		this.role = role;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public String getName() {
		return name;
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public Role getRole() {
		return role;
	}

	public boolean isActive() {
		return active;
	}

	public Instant getLockedUntil() {
		return lockedUntil;
	}

	public Instant getLastLoginAt() {
		return lastLoginAt;
	}

}
