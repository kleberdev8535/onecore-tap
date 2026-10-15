package com.onecore.tap.security;

import java.io.Serial;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.onecore.tap.users.Role;

/**
 * Principal guardado na sessão. O restaurantId daqui e a única fonte confiavel do tenant em requisicoes
 * autenticadas: nada que venha do cliente (URL, corpo, header) substitui esse valor.
 */
public record AuthenticatedUser(UUID id, UUID restaurantId, String email, String name, Role role,
		String passwordHash, boolean enabled, boolean locked) implements UserDetails {

	@Serial
	private static final long serialVersionUID = 1L;

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		List<GrantedAuthority> authorities = new ArrayList<>();
		authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name()));
		role.permissions().forEach(p -> authorities.add(new SimpleGrantedAuthority(p.authority())));
		return authorities;
	}

	@Override
	public String getPassword() {
		return passwordHash;
	}

	@Override
	public String getUsername() {
		return email;
	}

	@Override
	public boolean isAccountNonLocked() {
		return !locked;
	}

	@Override
	public boolean isEnabled() {
		return enabled;
	}

	/** Copia sem o hash da senha, para não manter o hash na sessão HTTP. */
	public AuthenticatedUser withoutCredentials() {
		return new AuthenticatedUser(id, restaurantId, email, name, role, null, enabled, locked);
	}

}
