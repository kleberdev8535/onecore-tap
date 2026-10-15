package com.onecore.tap.tenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;

import com.jayway.jsonpath.JsonPath;
import com.onecore.tap.categories.Category;
import com.onecore.tap.categories.CategoryRepository;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.support.IntegrationTest;
import com.onecore.tap.users.Role;

/**
 * Prova que um restaurante não enxerga nem altera dados de outro, mesmo manipulando IDs, URLs ou o corpo.
 */
class TenantIsolationIntegrationTest extends IntegrationTest {

	@Autowired
	CategoryRepository categories;

	@Autowired
	TransactionTemplate tx;

	Restaurant restaurantA;

	Restaurant restaurantB;

	MockHttpSession ownerA;

	MockHttpSession ownerB;

	@BeforeEach
	void setUp() throws Exception {
		restaurantA = createRestaurant("Restaurante A");
		restaurantB = createRestaurant("Restaurante B");
		ownerA = login(createUser(restaurantA.getId(), Role.RESTAURANT_OWNER));
		ownerB = login(createUser(restaurantB.getId(), Role.RESTAURANT_OWNER));
	}

	@Test
	void restaurantCannotListOrReadAnotherRestaurantsData() throws Exception {
		String categoryId = createCategory(ownerA, "Lanches");

		mvc.perform(get("/api/restaurant/categories").session(ownerA))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", Matchers.hasItem(categoryId)));

		mvc.perform(get("/api/restaurant/categories").session(ownerB))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", Matchers.not(Matchers.hasItem(categoryId))));

		// Acesso direto pelo ID de outro restaurante: responde como inexistente.
		mvc.perform(get("/api/restaurant/categories/" + categoryId).session(ownerB))
			.andExpect(status().isNotFound());
		mvc.perform(get("/api/restaurant/categories/" + categoryId).session(ownerA)).andExpect(status().isOk());
	}

	@Test
	void restaurantIdSentByClientIsIgnored() throws Exception {
		String json = "{\"name\":\"Intrusa\",\"restaurantId\":\"%s\"}".formatted(restaurantA.getId());
		String createdId = JsonPath.read(mvc.perform(post("/api/restaurant/categories").with(csrf())
			.session(ownerB)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");

		Category saved = TenantContext.callAs(restaurantB.getId(),
				() -> tx.execute(s -> categories.findById(java.util.UUID.fromString(createdId)).orElseThrow()));
		assertThat(saved.getRestaurantId()).isEqualTo(restaurantB.getId());

		mvc.perform(get("/api/restaurant/categories").session(ownerA))
			.andExpect(jsonPath("$[*].id", Matchers.not(Matchers.hasItem(createdId))));
	}

	@Test
	void sameNameIsAllowedInDifferentRestaurants() throws Exception {
		createCategory(ownerA, "Bebidas");
		createCategory(ownerB, "Bebidas");
		mvc.perform(post("/api/restaurant/categories").with(csrf())
			.session(ownerA)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"bebidas\"}")).andExpect(status().isConflict());
	}

	@Test
	void queriesWithoutTenantContextReturnNothing() throws Exception {
		createCategory(ownerA, "Sobremesas");
		SecurityContextHolder.clearContext();

		Long visible = tx.execute(s -> categories.count());

		assertThat(visible).isZero();
	}

	@Test
	void explicitTenantContextOnlySeesThatRestaurant() throws Exception {
		String idA = createCategory(ownerA, "Porcoes");
		String idB = createCategory(ownerB, "Porcoes");

		var namesInA = TenantContext.callAs(restaurantA.getId(),
				() -> tx.execute(s -> categories.findAll().stream().map(c -> c.getId().toString()).toList()));

		assertThat(namesInA).contains(idA).doesNotContain(idB);
	}

	@Test
	void switchingTenantInsideAnOpenTransactionIsRefused() {
		org.assertj.core.api.Assertions.assertThatThrownBy(() -> tx.execute(
				s -> TenantContext.callAs(restaurantA.getId(), () -> categories.count())))
			.isInstanceOf(IllegalStateException.class);
	}

	private String createCategory(MockHttpSession session, String name) throws Exception {
		String body = mvc.perform(post("/api/restaurant/categories").with(csrf())
			.session(session)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"%s\"}".formatted(name)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

}
