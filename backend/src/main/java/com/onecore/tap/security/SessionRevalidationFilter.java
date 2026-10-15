package com.onecore.tap.security;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.users.User;
import com.onecore.tap.users.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * Revalida a cada requisicao autenticada se o usuario continua ativo, com o mesmo perfil e restaurante, e se o
 * restaurante ainda permite acesso. Desativar um funcionario ou suspender um restaurante encerra as sessoes
 * abertas imediatamente, sem esperar o proximo login.
 *
 * Instanciado manualmente no SecurityConfig (nao e @Component) para nao ser registrado duas vezes como filtro.
 */
class SessionRevalidationFilter extends OncePerRequestFilter {

	private final UserRepository users;

	private final RestaurantRepository restaurants;

	private final AuditService audit;

	SessionRevalidationFilter(UserRepository users, RestaurantRepository restaurants, AuditService audit) {
		this.users = users;
		this.restaurants = restaurants;
		this.audit = audit;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		Optional<AuthenticatedUser> principal = CurrentUser.find();
		if (principal.isPresent() && !stillValid(principal.get())) {
			AuthenticatedUser user = principal.get();
			HttpSession session = request.getSession(false);
			if (session != null) {
				session.invalidate();
			}
			SecurityContextHolder.clearContext();
			audit.record(AuditAction.SESSION_REVOKED, user, "user", user.id(), request,
					Map.of("reason", "user_or_restaurant_no_longer_allowed"));
			response.sendError(HttpStatus.UNAUTHORIZED.value());
			return;
		}
		chain.doFilter(request, response);
	}

	private boolean stillValid(AuthenticatedUser principal) {
		Optional<User> current = users.findById(principal.id());
		if (current.isEmpty()) {
			return false;
		}
		User user = current.get();
		if (!user.isActive() || user.getRole() != principal.role()
				|| !java.util.Objects.equals(user.getRestaurantId(), principal.restaurantId())) {
			return false;
		}
		return user.getRestaurantId() == null || restaurants.findById(user.getRestaurantId())
			.map(r -> r.getStatus().allowsStaffLogin())
			.orElse(false);
	}

}
