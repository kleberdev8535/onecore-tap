package com.onecore.tap.security;

import java.util.Optional;
import java.util.UUID;

import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

	private CurrentUser() {
	}

	public static Optional<AuthenticatedUser> find() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
			return Optional.of(user);
		}
		return Optional.empty();
	}

	public static AuthenticatedUser require() {
		return find().orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Sessão não autenticada"));
	}

	/** Restaurante da sessão. Lanca exceção para usuários sem restaurante (Super Admin). */
	public static UUID requireRestaurantId() {
		UUID id = require().restaurantId();
		if (id == null) {
			throw new org.springframework.security.access.AccessDeniedException("Usuário sem restaurante");
		}
		return id;
	}

}
