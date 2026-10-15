package com.onecore.tap.support;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.users.Role;
import com.onecore.tap.users.User;
import com.onecore.tap.users.UserRepository;

@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTest {

	protected static final String PASSWORD = "SenhaForte123";

	@Autowired
	protected MockMvc mvc;

	@Autowired
	protected UserRepository users;

	@Autowired
	protected RestaurantRepository restaurants;

	@Autowired
	protected PasswordEncoder passwordEncoder;

	@DynamicPropertySource
	static void database(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", TestDatabase.CONNECTION::url);
		registry.add("spring.datasource.username", TestDatabase.CONNECTION::username);
		registry.add("spring.datasource.password", TestDatabase.CONNECTION::password);
		// Os testes rodam todos do mesmo "IP"; o limite por IP tem teste unitario próprio.
		registry.add("onecore.security.ip-login-limit", () -> 10_000);
		// A rotina de cobrança é exercitada diretamente nos testes, nunca pelo agendador.
		registry.add("onecore.billing.job-enabled", () -> "false");
		registry.add("onecore.orders.orders-per-ip", () -> 10_000);
		registry.add("onecore.orders.orders-per-plate", () -> 10_000);
		registry.add("onecore.orders.requests-per-ip", () -> 10_000);
	}

	protected Restaurant createRestaurant(String name) {
		return restaurants.saveAndFlush(new Restaurant(name.toLowerCase().replace(' ', '-') + "-" + suffix(), name));
	}

	protected User createUser(UUID restaurantId, Role role) {
		String email = role.name().toLowerCase() + "-" + suffix() + "@teste.onecore.dev";
		return users.saveAndFlush(new User(restaurantId, "Usuário " + role, email, passwordEncoder.encode(PASSWORD), role));
	}

	protected MockHttpSession login(User user) throws Exception {
		MvcResult result = mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(user.getEmail(), PASSWORD))).andExpect(status().isOk()).andReturn();
		return (MockHttpSession) result.getRequest().getSession(false);
	}

	protected static String loginJson(String email, String password) {
		return "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password);
	}

	protected static String suffix() {
		return UUID.randomUUID().toString().substring(0, 8);
	}

}
