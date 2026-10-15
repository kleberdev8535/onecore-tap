package com.onecore.tap.restaurants;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.onecore.tap.users.Role;
import com.onecore.tap.users.User;

class RestaurantServiceTest {

	@Test
	void slugifyRemovesAccentsAndSymbols() {
		assertThat(RestaurantService.slugify("Açaí & Café São João!")).isEqualTo("acai-cafe-sao-joao");
		assertThat(RestaurantService.slugify("  Burger   House  ")).isEqualTo("burger-house");
	}

	@Test
	void userLocksAfterMaxFailedAttempts() {
		User user = new User(UUID.randomUUID(), "Ana", "Ana@Teste.dev", "hash", Role.CASHIER);
		Instant now = Instant.parse("2026-01-01T12:00:00Z");
		for (int i = 0; i < 4; i++) {
			user.registerFailedLogin(5, now.plusSeconds(900));
		}
		assertThat(user.isLocked(now)).isFalse();
		user.registerFailedLogin(5, now.plusSeconds(900));
		assertThat(user.isLocked(now)).isTrue();
		assertThat(user.isLocked(now.plusSeconds(901))).isFalse();
		assertThat(user.getEmail()).isEqualTo("ana@teste.dev");
	}

	@Test
	void tenantRulesForUsersAreEnforced() {
		assertThatThrownBy(() -> new User(UUID.randomUUID(), "X", "x@x.dev", "h", Role.SUPER_ADMIN))
			.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new User(null, "X", "x@x.dev", "h", Role.WAITER))
			.isInstanceOf(IllegalArgumentException.class);
	}

}
