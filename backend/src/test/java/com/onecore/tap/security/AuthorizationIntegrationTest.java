package com.onecore.tap.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;

import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.support.IntegrationTest;
import com.onecore.tap.users.Role;

class AuthorizationIntegrationTest extends IntegrationTest {

	@Test
	void restaurantOwnerCannotAccessPlatformAdmin() throws Exception {
		Restaurant restaurant = createRestaurant("Cafe Central");
		MockHttpSession owner = login(createUser(restaurant.getId(), Role.RESTAURANT_OWNER));

		mvc.perform(get("/api/admin/overview").session(owner)).andExpect(status().isForbidden());
		mvc.perform(get("/api/admin/restaurants").session(owner)).andExpect(status().isForbidden());
		mvc.perform(get("/api/admin/restaurants/" + restaurant.getId()).session(owner))
			.andExpect(status().isForbidden());
	}

	@Test
	void superAdminCannotUseRestaurantOperationalEndpoints() throws Exception {
		MockHttpSession admin = login(createUser(null, Role.SUPER_ADMIN));
		mvc.perform(get("/api/restaurant/categories").session(admin)).andExpect(status().isForbidden());
	}

	@Test
	void kitchenCannotManageMenu() throws Exception {
		Restaurant restaurant = createRestaurant("Sushi Bar");
		MockHttpSession kitchen = login(createUser(restaurant.getId(), Role.KITCHEN));

		mvc.perform(get("/api/restaurant/categories").session(kitchen)).andExpect(status().isForbidden());
		mvc.perform(post("/api/restaurant/categories").with(csrf())
			.session(kitchen)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Bebidas\"}")).andExpect(status().isForbidden());
	}

	@Test
	void waiterCanViewMenuButNotManageIt() throws Exception {
		Restaurant restaurant = createRestaurant("Bar do Porto");
		MockHttpSession waiter = login(createUser(restaurant.getId(), Role.WAITER));

		mvc.perform(get("/api/restaurant/categories").session(waiter)).andExpect(status().isOk());
		mvc.perform(post("/api/restaurant/categories").with(csrf())
			.session(waiter)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Petiscos\"}")).andExpect(status().isForbidden());
	}

	@Test
	void superAdminSeesGlobalOverviewAndCreatesRestaurants() throws Exception {
		MockHttpSession admin = login(createUser(null, Role.SUPER_ADMIN));

		mvc.perform(get("/api/admin/overview").session(admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.restaurants.total").isNumber());

		mvc.perform(post("/api/admin/restaurants").with(csrf())
			.session(admin)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"tradeName\":\"Hamburgueria Sao Joao %s\",\"state\":\"SP\"}".formatted(suffix())))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.slug").value(org.hamcrest.Matchers.startsWith("hamburgueria-sao-joao-")))
			.andExpect(jsonPath("$.status").value("ONBOARDING"));
	}

	@Test
	void restaurantCreationValidatesInput() throws Exception {
		MockHttpSession admin = login(createUser(null, Role.SUPER_ADMIN));
		mvc.perform(post("/api/admin/restaurants").with(csrf())
			.session(admin)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"tradeName\":\"\",\"cnpj\":\"123\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.tradeName").exists())
			.andExpect(jsonPath("$.fields.cnpj").exists());
	}

}
