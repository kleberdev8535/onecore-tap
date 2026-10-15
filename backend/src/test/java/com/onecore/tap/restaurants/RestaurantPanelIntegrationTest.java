package com.onecore.tap.restaurants;

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
import com.onecore.tap.support.RestaurantApiTest;
import com.onecore.tap.users.Role;

/** Mesas, personalização, configurações e dashboard do painel do restaurante. */
class RestaurantPanelIntegrationTest extends RestaurantApiTest {

	Restaurant restaurant;

	MockHttpSession owner;

	@BeforeEach
	void setUp() throws Exception {
		restaurant = createRestaurant("Cantina Toscana");
		owner = login(createUser(restaurant.getId(), Role.RESTAURANT_OWNER));
	}

	@Test
	void tablesAreCreatedWithinPlanLimitAndEdited() throws Exception {
		assignPlan(restaurant, 3, null);
		String json = send(owner, post("/api/restaurant/tables"), "{\"from\":1,\"to\":3}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.length()").value(3))
			.andReturn()
			.getResponse()
			.getContentAsString();
		send(owner, post("/api/restaurant/tables"), "{\"labels\":[\"Varanda\"]}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("até 3 mesas")));

		String tableId = JsonPath.read(json, "$[0].id");
		send(owner, put("/api/restaurant/tables/" + tableId), "{\"label\":\"02\",\"capacity\":6,\"active\":true}")
			.andExpect(status().isConflict());
		send(owner, put("/api/restaurant/tables/" + tableId), "{\"label\":\"Janela\",\"capacity\":6,\"active\":false}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.label").value("Janela"))
			.andExpect(jsonPath("$.active").value(false));

		// Outro restaurante não altera a mesa.
		MockHttpSession intruder = login(createUser(createRestaurant("Outra").getId(), Role.RESTAURANT_OWNER));
		send(intruder, put("/api/restaurant/tables/" + tableId), "{\"label\":\"X\",\"active\":true}")
			.andExpect(status().isNotFound());
		mvc.perform(get("/api/restaurant/tables").session(intruder)).andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void waiterSeesTablesButCannotManageThemOrSettings() throws Exception {
		MockHttpSession waiter = login(createUser(restaurant.getId(), Role.WAITER));
		mvc.perform(get("/api/restaurant/tables").session(waiter)).andExpect(status().isOk());
		send(waiter, post("/api/restaurant/tables"), "{\"labels\":[\"10\"]}").andExpect(status().isForbidden());
		mvc.perform(get("/api/restaurant/settings").session(waiter)).andExpect(status().isForbidden());
		mvc.perform(get("/api/restaurant/dashboard").session(waiter)).andExpect(status().isForbidden());
	}

	@Test
	void ownerCustomizesBrandingContactHoursAndOperation() throws Exception {
		send(owner, put("/api/restaurant/settings/branding"), """
				{"logoUrl":"https://cdn.exemplo.com/logo.png","coverImageUrl":"https://cdn.exemplo.com/capa.jpg",
				 "primaryColor":"#b91c1c","accentColor":"#1f2937"}""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.primaryColor").value("#B91C1C"))
			.andExpect(jsonPath("$.coverImageUrl").value("https://cdn.exemplo.com/capa.jpg"));

		send(owner, put("/api/restaurant/settings/contact"), """
				{"email":"contato@cantina.dev","phone":"11988887777","city":"São Paulo","state":"SP",
				 "description":"Massas artesanais desde 1998"}""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.description").value("Massas artesanais desde 1998"));

		send(owner, put("/api/restaurant/settings/hours"), """
				{"hours":[{"weekday":2,"opensAt":"11:30","closesAt":"15:00"},
				          {"weekday":2,"opensAt":"18:00","closesAt":"23:30"},
				          {"weekday":6,"opensAt":"18:00","closesAt":"02:00"}]}""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.openingHours.length()").value(3));
		send(owner, put("/api/restaurant/settings/hours"), """
				{"hours":[{"weekday":3,"opensAt":"11:00","closesAt":"15:00"},
				          {"weekday":3,"opensAt":"14:00","closesAt":"20:00"}]}""")
			.andExpect(status().isConflict());

		send(owner, put("/api/restaurant/settings/operation"), "{\"requireOrderConfirmation\":false}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.requireOrderConfirmation").value(false));

		// O restaurante não altera nome comercial, CNPJ nem status: campos ignorados.
		mvc.perform(get("/api/restaurant/settings").session(owner))
			.andExpect(jsonPath("$.tradeName").value(restaurant.getTradeName()))
			.andExpect(jsonPath("$.status").value("ONBOARDING"));
	}

	@Test
	void dashboardReportsRealCountsAndZeroSalesWithoutOrders() throws Exception {
		mvc.perform(get("/api/restaurant/dashboard").session(owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.menu.products").value(0))
			.andExpect(jsonPath("$.ordersModuleAvailable").value(true))
			.andExpect(jsonPath("$.sales.current.orders").value(0))
			.andExpect(jsonPath("$.sales.current.revenueCents").value(0))
			.andExpect(jsonPath("$.setup[?(@.key == 'products')].done").value(Matchers.contains(false)));

		String categoryId = idOf(send(owner, post("/api/restaurant/categories"), "{\"name\":\"Massas\"}"));
		send(owner, post("/api/restaurant/categories"), "{\"name\":\"Vinhos\"}");
		send(owner, post("/api/restaurant/products"), """
				{"categoryId":"%s","name":"Lasanha","priceCents":5800,"active":true,"available":true,"featured":true}"""
			.formatted(categoryId)).andExpect(status().isCreated());

		mvc.perform(get("/api/restaurant/dashboard").session(owner))
			.andExpect(jsonPath("$.menu.products").value(1))
			.andExpect(jsonPath("$.menu.featuredProducts").value(1))
			.andExpect(jsonPath("$.menu.emptyCategories", Matchers.contains("Vinhos")))
			.andExpect(jsonPath("$.staff.active").value(1))
			.andExpect(jsonPath("$.setup[?(@.key == 'products')].done").value(Matchers.contains(true)));
	}

}
