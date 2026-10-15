package com.onecore.tap.products;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import com.onecore.tap.users.Role;

/** Cardápio: categorias, produtos, adicionais e variações, com permissões e isolamento entre restaurantes. */
class MenuIntegrationTest extends RestaurantApiTest {

	MockHttpSession owner;

	MockHttpSession otherOwner;

	@BeforeEach
	void setUp() throws Exception {
		Restaurant r = createRestaurant("Burger House");
		Restaurant other = createRestaurant("Pizzaria Nápoles");
		owner = login(createUser(r.getId(), Role.RESTAURANT_OWNER));
		otherOwner = login(createUser(other.getId(), Role.RESTAURANT_OWNER));
	}

	@Test
	void createsProductWithAddonsAndVariation() throws Exception {
		String categoryId = category(owner, "Lanches");
		String size = idOf(send(owner, post("/api/restaurant/addon-groups"), """
				{"name":"Tamanho","minChoices":1,"maxChoices":1,
				 "options":[{"name":"Simples","priceCents":0,"available":true},
				            {"name":"Duplo","priceCents":1200,"available":true}]}""")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.options.length()").value(2)));
		String extras = idOf(send(owner, post("/api/restaurant/addon-groups"), """
				{"name":"Adicionais","minChoices":0,"maxChoices":3,
				 "options":[{"name":"Bacon","priceCents":500,"available":true},
				            {"name":"Queijo extra","priceCents":400,"available":true},
				            {"name":"Ovo","priceCents":300,"available":false}]}""")
			.andExpect(status().isCreated()));

		String productId = idOf(send(owner, post("/api/restaurant/products"), product(categoryId, "X-Bacon", 3290,
				"\"%s\",\"%s\"".formatted(size, extras)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.priceCents").value(3290))
			.andExpect(jsonPath("$.addonGroupIds[0]").value(size))
			.andExpect(jsonPath("$.addonGroupIds[1]").value(extras)));

		mvc.perform(get("/api/restaurant/addon-groups").session(owner))
			.andExpect(jsonPath("$[?(@.id == '%s')].productCount".formatted(extras)).value(Matchers.contains(1)));

		// Esgotar e reativar.
		send(owner, put("/api/restaurant/products/" + productId + "/availability"), "{\"available\":false}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.available").value(false));

		// Excluir o grupo remove o vínculo com o produto (cascata no banco).
		send(owner, delete("/api/restaurant/addon-groups/" + extras)).andExpect(status().isNoContent());
		mvc.perform(get("/api/restaurant/products/" + productId).session(owner))
			.andExpect(jsonPath("$.addonGroupIds.length()").value(1));
	}

	@Test
	void updatingAddonGroupKeepsExistingOptionsAndAllowsRecreatingRemovedName() throws Exception {
		String json = send(owner, post("/api/restaurant/addon-groups"), """
				{"name":"Molhos","minChoices":0,"maxChoices":2,
				 "options":[{"name":"Barbecue","priceCents":200,"available":true},
				            {"name":"Cheddar","priceCents":300,"available":true}]}""")
			.andReturn()
			.getResponse()
			.getContentAsString();
		String groupId = JsonPath.read(json, "$.id");
		String bbqId = JsonPath.read(json, "$.options[0].id");

		send(owner, put("/api/restaurant/addon-groups/" + groupId), """
				{"name":"Molhos","minChoices":0,"maxChoices":2,
				 "options":[{"id":"%s","name":"Barbecue","priceCents":250,"available":true},
				            {"name":"Cheddar","priceCents":300,"available":true}]}""".formatted(bbqId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.options[0].id").value(bbqId))
			.andExpect(jsonPath("$.options[0].priceCents").value(250))
			.andExpect(jsonPath("$.options[1].name").value("Cheddar"));
	}

	@Test
	void validatesPricesAndChoiceRules() throws Exception {
		String categoryId = category(owner, "Bebidas");
		send(owner, post("/api/restaurant/products"), product(categoryId, "Refrigerante", -1, ""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.priceCents").exists());
		send(owner, post("/api/restaurant/products"),
				product(categoryId, "Suco", 900, "").replace("null", "\"http://inseguro.com/a.png\""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.imageUrl").exists());
		send(owner, post("/api/restaurant/addon-groups"), """
				{"name":"Borda","minChoices":2,"maxChoices":1,"options":[{"name":"Catupiry","priceCents":800,"available":true}]}""")
			.andExpect(status().isConflict());
		send(owner, post("/api/restaurant/addon-groups"), """
				{"name":"Borda","minChoices":0,"maxChoices":3,"options":[{"name":"Catupiry","priceCents":800,"available":true}]}""")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("número de opções")));
		send(owner, post("/api/restaurant/products"), product(categoryId, "Água", 500, ""))
			.andExpect(status().isCreated());
		send(owner, post("/api/restaurant/products"), product(categoryId, "água", 600, ""))
			.andExpect(status().isConflict());
	}

	@Test
	void categoryWithProductsCannotBeDeletedAndReorderRequiresFullList() throws Exception {
		String a = category(owner, "Entradas");
		String b = category(owner, "Pratos");
		send(owner, post("/api/restaurant/products"), product(a, "Bruschetta", 2400, "")).andExpect(status().isCreated());

		send(owner, delete("/api/restaurant/categories/" + a)).andExpect(status().isConflict());
		send(owner, delete("/api/restaurant/categories/" + b)).andExpect(status().isNoContent());

		String c = category(owner, "Sobremesas");
		send(owner, put("/api/restaurant/categories/order"), "{\"ids\":[\"%s\",\"%s\"]}".formatted(c, a))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(c))
			.andExpect(jsonPath("$[1].productCount").value(1));
		send(owner, put("/api/restaurant/categories/order"), "{\"ids\":[\"%s\"]}".formatted(c))
			.andExpect(status().isConflict());
	}

	@Test
	void restaurantCannotUseOrSeeAnotherRestaurantsMenu() throws Exception {
		String foreignCategory = category(otherOwner, "Pizzas");
		String foreignGroup = idOf(send(otherOwner, post("/api/restaurant/addon-groups"),
				"{\"name\":\"Bordas\",\"minChoices\":0,\"maxChoices\":1,\"options\":[{\"name\":\"Cheddar\",\"priceCents\":700,\"available\":true}]}"));
		String foreignProduct = idOf(send(otherOwner, post("/api/restaurant/products"),
				product(foreignCategory, "Margherita", 4990, "")));

		// Usar a categoria ou o grupo de outro restaurante: tratado como inexistente.
		send(owner, post("/api/restaurant/products"), product(foreignCategory, "Intrusa", 100, ""))
			.andExpect(status().isNotFound());
		String mine = category(owner, "Minha");
		send(owner, post("/api/restaurant/products"), product(mine, "Com grupo alheio", 100, "\"" + foreignGroup + "\""))
			.andExpect(status().isNotFound());

		// Ler, alterar ou excluir pelo ID direto.
		mvc.perform(get("/api/restaurant/products/" + foreignProduct).session(owner)).andExpect(status().isNotFound());
		send(owner, put("/api/restaurant/products/" + foreignProduct + "/availability"), "{\"available\":false}")
			.andExpect(status().isNotFound());
		send(owner, delete("/api/restaurant/products/" + foreignProduct)).andExpect(status().isNotFound());
		send(owner, delete("/api/restaurant/addon-groups/" + foreignGroup)).andExpect(status().isNotFound());
		mvc.perform(get("/api/restaurant/products").session(owner))
			.andExpect(jsonPath("$[*].id", Matchers.not(Matchers.hasItem(foreignProduct))));

		mvc.perform(get("/api/restaurant/products/" + foreignProduct).session(otherOwner))
			.andExpect(jsonPath("$.available").value(true));
	}

	@Test
	void staffPermissionsOnMenu() throws Exception {
		Restaurant r = createRestaurant("Café Aurora");
		MockHttpSession manager = login(createUser(r.getId(), Role.RESTAURANT_MANAGER));
		MockHttpSession waiter = login(createUser(r.getId(), Role.WAITER));
		MockHttpSession kitchen = login(createUser(r.getId(), Role.KITCHEN));

		String categoryId = category(manager, "Cafés");
		send(manager, post("/api/restaurant/products"), product(categoryId, "Espresso", 700, ""))
			.andExpect(status().isCreated());

		mvc.perform(get("/api/restaurant/products").session(waiter)).andExpect(status().isOk());
		send(waiter, post("/api/restaurant/products"), product(categoryId, "Latte", 1200, ""))
			.andExpect(status().isForbidden());
		mvc.perform(get("/api/restaurant/addon-groups").session(kitchen)).andExpect(status().isForbidden());
	}

	private String category(MockHttpSession session, String name) throws Exception {
		return idOf(send(session, post("/api/restaurant/categories"), "{\"name\":\"%s\"}".formatted(name))
			.andExpect(status().isCreated()));
	}

	private static String product(String categoryId, String name, int priceCents, String groupIds) {
		return """
				{"categoryId":"%s","name":"%s","description":"Descrição","priceCents":%d,"imageUrl":null,
				 "active":true,"available":true,"featured":false,"addonGroupIds":[%s]}"""
			.formatted(categoryId, name, priceCents, groupIds);
	}

}
