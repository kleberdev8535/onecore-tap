package com.onecore.tap.restaurants;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;
import com.onecore.tap.support.IntegrationTest;
import com.onecore.tap.users.Role;
import com.onecore.tap.users.User;

/** Fluxo completo de implantacao pela API, como o Super Admin faria pela interface. */
class OnboardingIntegrationTest extends IntegrationTest {

	MockHttpSession admin;

	@BeforeEach
	void setUp() throws Exception {
		admin = login(createUser(null, Role.SUPER_ADMIN));
	}

	@Test
	void fullOnboardingFromCreationToActivation() throws Exception {
		String id = idOf(send(post("/api/admin/restaurants"), "{\"tradeName\":\"Burger Prime %s\"}".formatted(suffix()))
			.andExpect(status().isCreated()));

		send(put("/api/admin/restaurants/" + id + "/branding"),
				"{\"primaryColor\":\"#e11d48\",\"accentColor\":\"#111827\",\"logoUrl\":\"https://cdn.exemplo.com/logo.png\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.primaryColor").value("#E11D48"));

		// Ativar antes de concluir a implantacao e recusado com o que falta.
		send(post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"ACTIVATE\"}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("plano")));

		String planId = createPlan(10, 7);
		send(put("/api/admin/restaurants/" + id + "/plan"), "{\"planId\":\"%s\"}".formatted(planId))
			.andExpect(status().isOk());

		String ownerEmail = "dono-" + suffix() + "@burger.dev";
		String inviteJson = send(post("/api/admin/restaurants/" + id + "/owner"),
				"{\"name\":\"Carla Souza\",\"email\":\"%s\"}".formatted(ownerEmail))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.inviteLink").value(org.hamcrest.Matchers.containsString("convite=1")))
			.andReturn()
			.getResponse()
			.getContentAsString();

		send(post("/api/admin/restaurants/" + id + "/tables"), "{\"from\":1,\"to\":3,\"capacity\":4}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$[0].label").value("01"))
			.andExpect(jsonPath("$.length()").value(3));

		String tableId = JsonPath.read(mvc.perform(get("/api/admin/restaurants/" + id + "/tables").session(admin))
			.andReturn()
			.getResponse()
			.getContentAsString(), "$[0].id");
		String batchId = idOf(send(post("/api/admin/plate-batches"), "{\"quantity\":1}"));
		String plateId = JsonPath.read(mvc.perform(get("/api/admin/plates?batchId=" + batchId).session(admin))
			.andReturn()
			.getResponse()
			.getContentAsString(), "$.items[0].id");
		send(post("/api/admin/plates/" + plateId + "/changes"),
				"{\"action\":\"BIND\",\"restaurantId\":\"%s\",\"tableId\":\"%s\"}".formatted(id, tableId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.plate.status").value("ACTIVE"))
			.andExpect(jsonPath("$.plate.table.name").value("01"));

		mvc.perform(get("/api/admin/restaurants/" + id + "/onboarding").session(admin))
			.andExpect(jsonPath("$.readyToActivate").value(true))
			.andExpect(jsonPath("$.tableCount").value(3))
			.andExpect(jsonPath("$.activePlateCount").value(1));

		send(post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"START_TRIAL\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("TRIAL"));

		// O proprietario aceita o convite, cria a senha e entra.
		String token = tokenFrom(JsonPath.read(inviteJson, "$.inviteLink"));
		mvc.perform(post("/api/auth/password/reset").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"token\":\"%s\",\"newPassword\":\"SenhaDaCarla2026\"}".formatted(token)))
			.andExpect(status().isNoContent());
		mvc.perform(post("/api/auth/login").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginJson(ownerEmail, "SenhaDaCarla2026")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.restaurant.id").value(id))
			.andExpect(jsonPath("$.role").value("RESTAURANT_OWNER"));
	}

	@Test
	void planTableLimitIsEnforced() throws Exception {
		String id = idOf(send(post("/api/admin/restaurants"), "{\"tradeName\":\"Bistrô %s\"}".formatted(suffix())));
		send(put("/api/admin/restaurants/" + id + "/plan"), "{\"planId\":\"%s\"}".formatted(createPlan(2, 0)))
			.andExpect(status().isOk());

		send(post("/api/admin/restaurants/" + id + "/tables"), "{\"from\":1,\"to\":3}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("até 2 mesas")));
		send(post("/api/admin/restaurants/" + id + "/tables"), "{\"labels\":[\"Varanda\",\"varanda\",\"Balcão\"]}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.length()").value(2));
	}

	@Test
	void suspendingTheRestaurantRevokesOpenStaffSessionsImmediately() throws Exception {
		Restaurant r = createRestaurant("Pizzaria Vesúvio");
		r.changeStatus(RestaurantStatus.ACTIVE);
		restaurants.saveAndFlush(r);
		MockHttpSession waiter = login(createUser(r.getId(), Role.WAITER));
		mvc.perform(get("/api/restaurant/categories").session(waiter)).andExpect(status().isOk());

		send(post("/api/admin/restaurants/" + r.getId() + "/status"),
				"{\"action\":\"SUSPEND\",\"reason\":\"Inadimplência\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("SUSPENDED"));

		mvc.perform(get("/api/restaurant/categories").session(waiter)).andExpect(status().isUnauthorized());
		assertThat(waiter.isInvalid()).isTrue();
	}

	@Test
	void deactivatingAUserRevokesTheirSession() throws Exception {
		Restaurant r = createRestaurant("Café Lumen");
		User cashier = createUser(r.getId(), Role.CASHIER);
		MockHttpSession session = login(cashier);
		mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());

		send(post("/api/admin/users/" + cashier.getId() + "/deactivate"), null).andExpect(status().isOk());

		mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
	}

	@Test
	void secondOwnerAndDuplicatedEmailsAreRejected() throws Exception {
		String id = idOf(send(post("/api/admin/restaurants"), "{\"tradeName\":\"Empório %s\"}".formatted(suffix())));
		String email = "dono-" + suffix() + "@emporio.dev";
		send(post("/api/admin/restaurants/" + id + "/owner"), "{\"name\":\"Ana\",\"email\":\"%s\"}".formatted(email))
			.andExpect(status().isCreated());
		send(post("/api/admin/restaurants/" + id + "/owner"), "{\"name\":\"Bia\",\"email\":\"outra-%s@x.dev\"}".formatted(suffix()))
			.andExpect(status().isConflict());
	}

	@Test
	void auditTrailListsSuperAdminActions() throws Exception {
		String id = idOf(send(post("/api/admin/restaurants"), "{\"tradeName\":\"Auditado %s\"}".formatted(suffix())));
		mvc.perform(get("/api/admin/audit?action=RESTAURANT_CREATED&restaurantId=" + id).session(admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items.length()").value(1))
			.andExpect(jsonPath("$.items[0].entityId").value(id));
	}

	@Test
	void platePriceIsConfigurable() throws Exception {
		send(put("/api/admin/settings"), "{\"platePriceCents\":3900}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.platePriceCents").value(3900));
		send(put("/api/admin/settings"), "{\"platePriceCents\":3500}").andExpect(status().isOk());
	}

	// ---------------------------------------------------------------- auxiliares

	private String createPlan(int maxTables, int trialDays) throws Exception {
		return idOf(send(post("/api/admin/plans"),
				"{\"code\":\"plano-%s\",\"name\":\"Plano %s\",\"monthlyPriceCents\":14900,\"maxTables\":%d,\"trialDays\":%d,\"features\":[\"Cardápio digital\"],\"active\":true}"
					.formatted(suffix(), suffix(), maxTables, trialDays))
			.andExpect(status().isCreated()));
	}

	private ResultActions send(MockHttpServletRequestBuilder builder, String json) throws Exception {
		builder.with(csrf()).session(admin);
		if (json != null) {
			builder.contentType(MediaType.APPLICATION_JSON).content(json);
		}
		return mvc.perform(builder);
	}

	private static String idOf(ResultActions result) throws Exception {
		return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
	}

	private static String tokenFrom(String link) {
		Matcher m = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(link);
		assertThat(m.find()).isTrue();
		return m.group(1);
	}


}
