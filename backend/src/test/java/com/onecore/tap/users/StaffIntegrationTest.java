package com.onecore.tap.users;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

import com.jayway.jsonpath.JsonPath;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.support.RestaurantApiTest;

/** Gestão da equipe pelo proprietário: convites, perfis, limites do plano e isolamento. */
class StaffIntegrationTest extends RestaurantApiTest {

	Restaurant restaurant;

	User ownerUser;

	MockHttpSession owner;

	@BeforeEach
	void setUp() throws Exception {
		restaurant = createRestaurant("Bistrô Jardim");
		ownerUser = createUser(restaurant.getId(), Role.RESTAURANT_OWNER);
		owner = login(ownerUser);
	}

	@Test
	void ownerInvitesStaffAndInviteLinkCreatesPassword() throws Exception {
		String email = "garcom-" + suffix() + "@bistro.dev";
		String json = send(owner, post("/api/restaurant/staff"),
				"{\"name\":\"Paulo Lima\",\"email\":\"%s\",\"role\":\"WAITER\"}".formatted(email))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.user.role").value("WAITER"))
			.andExpect(jsonPath("$.user.pendingInvite").value(true))
			.andExpect(jsonPath("$.inviteLink").value(Matchers.containsString("convite=1")))
			.andReturn()
			.getResponse()
			.getContentAsString();

		String link = JsonPath.read(json, "$.inviteLink");
		String token = link.substring(link.indexOf("token=") + 6);
		mvc.perform(post("/api/auth/password/reset")
			.with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
			.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
			.content("{\"token\":\"%s\",\"newPassword\":\"NovaSenha2026\"}".formatted(token)))
			.andExpect(status().isNoContent());
		mvc.perform(post("/api/auth/login")
			.with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
			.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
			.content(loginJson(email, "NovaSenha2026")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.restaurant.id").value(restaurant.getId().toString()));
	}

	@Test
	void ownerCannotCreateAnotherOwnerOrChangeOwnAccess() throws Exception {
		send(owner, post("/api/restaurant/staff"),
				"{\"name\":\"Sócio\",\"email\":\"socio-%s@bistro.dev\",\"role\":\"RESTAURANT_OWNER\"}".formatted(suffix()))
			.andExpect(status().isConflict());
		send(owner, post("/api/restaurant/staff"),
				"{\"name\":\"Hacker\",\"email\":\"x-%s@bistro.dev\",\"role\":\"SUPER_ADMIN\"}".formatted(suffix()))
			.andExpect(status().isConflict());
		send(owner, post("/api/restaurant/staff/" + ownerUser.getId() + "/deactivate"))
			.andExpect(status().isConflict());
	}

	@Test
	void changingRoleRevokesOpenSessionAndIsRecorded() throws Exception {
		User cashierUser = createUser(restaurant.getId(), Role.CASHIER);
		MockHttpSession cashier = login(cashierUser);
		mvc.perform(get("/api/restaurant/categories").session(cashier)).andExpect(status().isOk());

		send(owner, put("/api/restaurant/staff/" + cashierUser.getId()),
				"{\"name\":\"Caixa Promovido\",\"role\":\"RESTAURANT_MANAGER\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.role").value("RESTAURANT_MANAGER"));

		mvc.perform(get("/api/restaurant/categories").session(cashier)).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/restaurant/staff/" + cashierUser.getId() + "/activity").session(owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].action", Matchers.hasItem("STAFF_ROLE_CHANGED")));
	}

	@Test
	void planUserLimitIsEnforcedOnInviteAndReactivation() throws Exception {
		assignPlan(restaurant, null, 2);
		User waiter = createUser(restaurant.getId(), Role.WAITER);

		send(owner, post("/api/restaurant/staff"),
				"{\"name\":\"Excedente\",\"email\":\"ex-%s@bistro.dev\",\"role\":\"KITCHEN\"}".formatted(suffix()))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("2 usuários")));

		send(owner, post("/api/restaurant/staff/" + waiter.getId() + "/deactivate")).andExpect(status().isOk());
		send(owner, post("/api/restaurant/staff"),
				"{\"name\":\"Cozinha\",\"email\":\"cz-%s@bistro.dev\",\"role\":\"KITCHEN\"}".formatted(suffix()))
			.andExpect(status().isCreated());
		send(owner, post("/api/restaurant/staff/" + waiter.getId() + "/activate")).andExpect(status().isConflict());
	}

	@Test
	void staffOfAnotherRestaurantIsInvisibleAndManagersCannotManageStaff() throws Exception {
		Restaurant other = createRestaurant("Outro Bar");
		User foreign = createUser(other.getId(), Role.WAITER);

		mvc.perform(get("/api/restaurant/staff").session(owner))
			.andExpect(jsonPath("$[*].id", Matchers.not(Matchers.hasItem(foreign.getId().toString()))));
		send(owner, post("/api/restaurant/staff/" + foreign.getId() + "/deactivate")).andExpect(status().isNotFound());
		send(owner, put("/api/restaurant/staff/" + foreign.getId()), "{\"name\":\"X\",\"role\":\"KITCHEN\"}")
			.andExpect(status().isNotFound());
		mvc.perform(get("/api/restaurant/staff/" + foreign.getId() + "/activity").session(owner))
			.andExpect(status().isNotFound());

		MockHttpSession manager = login(createUser(restaurant.getId(), Role.RESTAURANT_MANAGER));
		mvc.perform(get("/api/restaurant/staff").session(manager)).andExpect(status().isForbidden());
	}

}
