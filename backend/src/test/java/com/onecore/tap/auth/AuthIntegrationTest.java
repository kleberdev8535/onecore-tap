package com.onecore.tap.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.support.IntegrationTest;
import com.onecore.tap.users.Role;
import com.onecore.tap.users.User;

class AuthIntegrationTest extends IntegrationTest {

	@MockitoBean
	MailGateway mailGateway;

	@Test
	void loginCreatesSessionAndMeReturnsProfile() throws Exception {
		Restaurant restaurant = createRestaurant("Burger House");
		User owner = createUser(restaurant.getId(), Role.RESTAURANT_OWNER);

		MockHttpSession session = login(owner);

		mvc.perform(get("/api/auth/me").session(session))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value(owner.getEmail()))
			.andExpect(jsonPath("$.role").value("RESTAURANT_OWNER"))
			.andExpect(jsonPath("$.restaurant.id").value(restaurant.getId().toString()))
			.andExpect(jsonPath("$.permissions").isArray());
	}

	@Test
	void loginResponseNeverExposesPasswordHash() throws Exception {
		User admin = createUser(null, Role.SUPER_ADMIN);
		mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(admin.getEmail(), PASSWORD)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.passwordHash").doesNotExist())
			.andExpect(jsonPath("$.password").doesNotExist());
	}

	@Test
	void wrongPasswordAndUnknownEmailReturnTheSameGenericMessage() throws Exception {
		User admin = createUser(null, Role.SUPER_ADMIN);

		mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(admin.getEmail(), "SenhaErrada999")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.detail").value(AuthService.INVALID_CREDENTIALS));

		mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson("ninguem-" + suffix() + "@teste.dev", "SenhaErrada999")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.detail").value(AuthService.INVALID_CREDENTIALS));
	}

	@Test
	void accountIsLockedAfterRepeatedFailuresEvenWithCorrectPassword() throws Exception {
		User admin = createUser(null, Role.SUPER_ADMIN);
		for (int i = 0; i < 5; i++) {
			mvc.perform(post("/api/auth/login").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(loginJson(admin.getEmail(), "SenhaErrada999"))).andExpect(status().isUnauthorized());
		}

		mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(admin.getEmail(), PASSWORD))).andExpect(status().isTooManyRequests());

		assertThat(users.findById(admin.getId()).orElseThrow().getLockedUntil()).isNotNull();
	}

	@Test
	void loginWithoutCsrfTokenIsRejected() throws Exception {
		User admin = createUser(null, Role.SUPER_ADMIN);
		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(admin.getEmail(), PASSWORD))).andExpect(status().isForbidden());
	}

	@Test
	void protectedEndpointsRequireSession() throws Exception {
		mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/admin/overview")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/restaurant/categories")).andExpect(status().isUnauthorized());
	}

	/**
	 * O nome do header/cookie não e verificado aqui: o csrf() do spring-security-test substitui o repositorio de
	 * tokens no MockMvc. O cookie XSRF-TOKEN real e validado no smoke test documentado no README.
	 */
	@Test
	void csrfEndpointIssuesToken() throws Exception {
		mvc.perform(get("/api/auth/csrf"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").isNotEmpty())
			.andExpect(jsonPath("$.headerName").isNotEmpty());
	}

	@Test
	void logoutInvalidatesSession() throws Exception {
		User admin = createUser(null, Role.SUPER_ADMIN);
		MockHttpSession session = login(admin);

		mvc.perform(post("/api/auth/logout").with(csrf()).session(session)).andExpect(status().isNoContent());

		assertThat(session.isInvalid()).isTrue();
	}

	@Test
	void staffOfSuspendedRestaurantCannotLogin() throws Exception {
		Restaurant restaurant = createRestaurant("Pizzaria Suspensa");
		User waiter = createUser(restaurant.getId(), Role.WAITER);
		restaurant.changeStatus(RestaurantStatus.SUSPENDED);
		restaurants.saveAndFlush(restaurant);

		mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(waiter.getEmail(), PASSWORD))).andExpect(status().isForbidden());
	}

	@Test
	void passwordResetFlowChangesPasswordAndTokenIsSingleUse() throws Exception {
		User admin = createUser(null, Role.SUPER_ADMIN);

		mvc.perform(post("/api/auth/password/forgot").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"%s\"}".formatted(admin.getEmail()))).andExpect(status().isAccepted());

		ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
		verify(mailGateway).send(eq(admin.getEmail()), anyString(), body.capture());
		Matcher matcher = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(body.getValue());
		assertThat(matcher.find()).isTrue();
		String token = matcher.group(1);
		String resetJson = "{\"token\":\"%s\",\"newPassword\":\"NovaSenha2026x\"}".formatted(token);

		mvc.perform(post("/api/auth/password/reset").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(resetJson)).andExpect(status().isNoContent());

		mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(admin.getEmail(), "NovaSenha2026x"))).andExpect(status().isOk());

		mvc.perform(post("/api/auth/password/reset").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(resetJson)).andExpect(status().isBadRequest());
	}

	@Test
	void forgotPasswordForUnknownEmailLooksIdentical() throws Exception {
		mvc.perform(post("/api/auth/password/forgot").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"ninguem-%s@teste.dev\"}".formatted(suffix()))).andExpect(status().isAccepted());
	}

	@Test
	void weakPasswordIsRejectedOnReset() throws Exception {
		mvc.perform(post("/api/auth/password/reset").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"token\":\"x\",\"newPassword\":\"curta\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.newPassword").exists());
	}

}
