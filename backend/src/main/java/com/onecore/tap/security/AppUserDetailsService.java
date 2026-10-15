package com.onecore.tap.security;

import java.time.Instant;

import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.users.User;
import com.onecore.tap.users.UserRepository;

@Service
public class AppUserDetailsService implements UserDetailsService {

	private final UserRepository users;

	private final RestaurantRepository restaurants;

	public AppUserDetailsService(UserRepository users, RestaurantRepository restaurants) {
		this.users = users;
		this.restaurants = restaurants;
	}

	@Override
	@Transactional(readOnly = true)
	public AuthenticatedUser loadUserByUsername(String email) {
		User user = users.findByEmail(email.trim())
			.orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
		boolean restaurantAllowsLogin = user.getRestaurantId() == null || restaurants.findById(user.getRestaurantId())
			.map(r -> r.getStatus().allowsStaffLogin())
			.orElse(false);
		return new AuthenticatedUser(user.getId(), user.getRestaurantId(), user.getEmail(), user.getName(),
				user.getRole(), user.getPasswordHash(), user.isActive() && restaurantAllowsLogin,
				user.isLocked(Instant.now()));
	}

}
