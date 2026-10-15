package com.onecore.tap.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;
import com.onecore.tap.restaurants.OpeningHours;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.support.RestaurantApiTest;
import com.onecore.tap.users.Role;

/** Pedidos de ponta a ponta: cardápio público, cálculo no servidor, Kanban, cozinha, mesas, chamados e isolamento. */
class OrderIntegrationTest extends RestaurantApiTest {

	MockHttpSession admin;

	Restaurant restaurant;

	MockHttpSession owner;

	String plateToken;

	String productId;

	String simpleId;

	String doubleId;

	String baconId;

	String waterId;

	@BeforeEach
	void setUp() throws Exception {
		admin = login(createUser(null, Role.SUPER_ADMIN));
		restaurant = createLiveRestaurant("Burger House");
		owner = login(createUser(restaurant.getId(), Role.RESTAURANT_OWNER));
		plateToken = bindPlate(restaurant, "05");

		String category = idOf(send(owner, post("/api/restaurant/categories"), "{\"name\":\"Lanches\"}"));
		String sizeJson = send(owner, post("/api/restaurant/addon-groups"), """
				{"name":"Tamanho","minChoices":1,"maxChoices":1,
				 "options":[{"name":"Simples","priceCents":0,"available":true},{"name":"Duplo","priceCents":1200,"available":true}]}""")
			.andReturn().getResponse().getContentAsString();
		String extrasJson = send(owner, post("/api/restaurant/addon-groups"), """
				{"name":"Adicionais","minChoices":0,"maxChoices":2,
				 "options":[{"name":"Bacon","priceCents":500,"available":true},{"name":"Ovo","priceCents":300,"available":false}]}""")
			.andReturn().getResponse().getContentAsString();
		simpleId = JsonPath.read(sizeJson, "$.options[0].id");
		doubleId = JsonPath.read(sizeJson, "$.options[1].id");
		baconId = JsonPath.read(extrasJson, "$.options[0].id");
		productId = idOf(send(owner, post("/api/restaurant/products"), """
				{"categoryId":"%s","name":"X-Bacon","priceCents":3000,"active":true,"available":true,"featured":false,
				 "addonGroupIds":["%s","%s"]}""".formatted(category, JsonPath.read(sizeJson, "$.id"),
				JsonPath.read(extrasJson, "$.id"))));
		waterId = idOf(send(owner, post("/api/restaurant/products"), """
				{"categoryId":"%s","name":"Água","priceCents":500,"active":true,"available":true,"featured":false}"""
			.formatted(category)));
	}

	@Test
	void serverComputesPricesAndIgnoresValuesSentByTheBrowser() throws Exception {
		// O navegador tenta mandar preço e total: são ignorados.
		String body = """
				{"clientToken":"%s","customerName":"Ana","totalCents":1,
				 "items":[{"productId":"%s","quantity":2,"priceCents":1,"optionIds":["%s","%s"],"notes":"sem cebola"},
				          {"productId":"%s","quantity":1}]}""".formatted(client("a"), productId, doubleId, baconId, waterId);
		String json = placeOrder(body).andExpect(status().isCreated())
			.andExpect(jsonPath("$.totalCents").value((3000 + 1200 + 500) * 2 + 500))
			.andExpect(jsonPath("$.status").value("AWAITING_CONFIRMATION"))
			.andExpect(jsonPath("$.number").value(1))
			.andExpect(jsonPath("$.tableLabel").value("05"))
			.andExpect(jsonPath("$.items[0].unitPriceCents").value(4700))
			.andExpect(jsonPath("$.items[0].options[*].optionName", Matchers.contains("Duplo", "Bacon")))
			.andReturn().getResponse().getContentAsString();

		String tracking = JsonPath.read(json, "$.trackingToken");
		mvc.perform(get("/api/public/orders/" + tracking))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.statusLabel").value("Aguardando confirmação"))
			.andExpect(jsonPath("$.id").doesNotExist());

		// Valor parcial da mesa é o mesmo para todos; "meus pedidos" só do aparelho.
		mvc.perform(get("/api/public/plates/" + plateToken + "/session?client=" + client("a")))
			.andExpect(jsonPath("$.tableTotalCents").value(9900))
			.andExpect(jsonPath("$.myOrders.length()").value(1));
		mvc.perform(get("/api/public/plates/" + plateToken + "/session?client=" + client("b")))
			.andExpect(jsonPath("$.tableTotalCents").value(9900))
			.andExpect(jsonPath("$.myOrders.length()").value(0));

		// Preço do cardápio muda depois: o pedido mantém o valor praticado.
		send(owner, put("/api/restaurant/products/" + waterId), """
				{"categoryId":"%s","name":"Água","priceCents":900,"active":true,"available":true,"featured":false}"""
			.formatted(JsonPath.<String>read(mvc.perform(get("/api/restaurant/products/" + waterId).session(owner))
				.andReturn().getResponse().getContentAsString(), "$.categoryId")));
		mvc.perform(get("/api/public/orders/" + tracking)).andExpect(jsonPath("$.items[1].unitPriceCents").value(500));
	}

	@Test
	void choiceRulesAndAvailabilityAreEnforced() throws Exception {
		String ovoId = JsonPath.read(mvc.perform(get("/api/restaurant/addon-groups").session(owner))
			.andReturn().getResponse().getContentAsString(), "$[1].options[1].id");
		// Variação obrigatória ausente.
		placeOrder(order(productId, 1, baconId)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("Escolha uma opção de Tamanho")));
		// Duas opções da mesma variação.
		placeOrder(order(productId, 1, simpleId, doubleId)).andExpect(status().isConflict());
		// Opção esgotada.
		placeOrder(order(productId, 1, simpleId, ovoId)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("Ovo está indisponível")));
		// Opção que não pertence ao produto.
		placeOrder(order(waterId, 1, baconId)).andExpect(status().isConflict());
		// Quantidade inválida.
		placeOrder(order(waterId, 0)).andExpect(status().isBadRequest());
		// Produto esgotado.
		send(owner, put("/api/restaurant/products/" + waterId + "/availability"), "{\"available\":false}");
		placeOrder(order(waterId, 1)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("Água está indisponível")));
		// Produto de outro restaurante.
		Restaurant other = createLiveRestaurant("Outro");
		MockHttpSession otherOwner = login(createUser(other.getId(), Role.RESTAURANT_OWNER));
		String otherCategory = idOf(send(otherOwner, post("/api/restaurant/categories"), "{\"name\":\"X\"}"));
		String foreign = idOf(send(otherOwner, post("/api/restaurant/products"), """
				{"categoryId":"%s","name":"Pizza","priceCents":100,"active":true,"available":true,"featured":false}"""
			.formatted(otherCategory)));
		placeOrder(order(foreign, 1)).andExpect(status().isConflict());
	}

	@Test
	void kanbanFlowRespectsTransitionsAndRoles() throws Exception {
		String id = orderId(placeOrder(order(waterId, 1)));
		MockHttpSession kitchen = login(createUser(restaurant.getId(), Role.KITCHEN));
		MockHttpSession waiter = login(createUser(restaurant.getId(), Role.WAITER));
		MockHttpSession cashier = login(createUser(restaurant.getId(), Role.CASHIER));

		move(kitchen, id, "AWAITING_CONFIRMATION", "NEW").andExpect(status().isForbidden());
		move(owner, id, "AWAITING_CONFIRMATION", "READY").andExpect(status().isConflict());
		move(waiter, id, "AWAITING_CONFIRMATION", "NEW").andExpect(status().isOk());
		// Dois cliques ao mesmo tempo: o segundo encontra o pedido já movido.
		move(waiter, id, "AWAITING_CONFIRMATION", "NEW").andExpect(status().isConflict());
		move(cashier, id, "NEW", "IN_PREPARATION").andExpect(status().isForbidden());
		move(kitchen, id, "NEW", "IN_PREPARATION").andExpect(status().isOk());
		move(kitchen, id, "IN_PREPARATION", "READY").andExpect(status().isOk());
		move(kitchen, id, "READY", "DELIVERED").andExpect(status().isForbidden());
		move(waiter, id, "READY", "DELIVERED").andExpect(status().isOk());

		mvc.perform(get("/api/restaurant/orders/" + id).session(cashier))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.history[*].toStatus",
					Matchers.contains("AWAITING_CONFIRMATION", "NEW", "IN_PREPARATION", "READY", "DELIVERED")))
			.andExpect(jsonPath("$.order.readyAt").isNotEmpty());

		String other = orderId(placeOrder(order(waterId, 1)));
		send(owner, post("/api/restaurant/orders/" + other + "/transition"),
				"{\"from\":\"AWAITING_CONFIRMATION\",\"to\":\"CANCELLED\"}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("motivo")));
		send(owner, post("/api/restaurant/orders/" + other + "/transition"),
				"{\"from\":\"AWAITING_CONFIRMATION\",\"to\":\"CANCELLED\",\"reason\":\"Pedido de fora do restaurante\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.cancelReason").value("Pedido de fora do restaurante"));
		move(owner, other, "CANCELLED", "NEW").andExpect(status().isConflict());

		mvc.perform(get("/api/restaurant/orders/board").session(kitchen))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.orders.length()").value(2));
		mvc.perform(get("/api/restaurant/orders?status=CANCELLED").session(owner))
			.andExpect(jsonPath("$.totalItems").value(1));
	}

	@Test
	void restaurantTablesExposeThePermanentLinkOfTheirPlateOnly() throws Exception {
		mvc.perform(get("/api/restaurant/tables").session(owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].label").value("05"))
			.andExpect(jsonPath("$[0].plate.publicUrl").value(Matchers.endsWith("/t/" + plateToken)))
			.andExpect(jsonPath("$[0].plate.status").value("ACTIVE"));

		// Garçom consulta mesas e também vê o link (para abrir o cardápio com o cliente).
		MockHttpSession waiter = login(createUser(restaurant.getId(), Role.WAITER));
		mvc.perform(get("/api/restaurant/tables").session(waiter))
			.andExpect(jsonPath("$[0].plate.publicUrl").value(Matchers.endsWith("/t/" + plateToken)));

		// Outro restaurante não enxerga a mesa nem o link.
		Restaurant other = createLiveRestaurant("Outro Bar");
		MockHttpSession otherOwner = login(createUser(other.getId(), Role.RESTAURANT_OWNER));
		String otherTables = mvc.perform(get("/api/restaurant/tables").session(otherOwner))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		assertThat(otherTables).doesNotContain(plateToken);
	}

	@Test
	void tableAttendanceRequestsAndClosing() throws Exception {
		String id = orderId(placeOrder(order(waterId, 2)));
		mvc.perform(get("/api/restaurant/tables").session(owner))
			.andExpect(jsonPath("$[0].state").value("OCCUPIED"))
			.andExpect(jsonPath("$[0].openTotalCents").value(1000));

		send(anonymous(), post("/api/public/plates/" + plateToken + "/requests"), "{\"type\":\"CALL_WAITER\"}")
			.andExpect(status().isCreated());
		send(anonymous(), post("/api/public/plates/" + plateToken + "/requests"), "{\"type\":\"CALL_WAITER\"}")
			.andExpect(status().isCreated());
		send(anonymous(), post("/api/public/plates/" + plateToken + "/requests"), "{\"type\":\"REQUEST_BILL\"}");
		mvc.perform(get("/api/restaurant/orders/requests").session(owner)).andExpect(jsonPath("$.length()").value(2));
		mvc.perform(get("/api/restaurant/tables").session(owner))
			.andExpect(jsonPath("$[0].state").value("AWAITING_BILL"));
		// Pedir a conta não marca pedidos como pagos.
		mvc.perform(get("/api/restaurant/orders/" + id).session(owner))
			.andExpect(jsonPath("$.order.paymentStatus").value("UNPAID"));

		String tableId = JsonPath.read(mvc.perform(get("/api/restaurant/tables").session(owner))
			.andReturn().getResponse().getContentAsString(), "$[0].id");
		send(owner, post("/api/restaurant/tables/" + tableId + "/close")).andExpect(status().isConflict());

		move(owner, id, "AWAITING_CONFIRMATION", "NEW");
		move(owner, id, "NEW", "IN_PREPARATION");
		move(owner, id, "IN_PREPARATION", "READY");
		move(owner, id, "READY", "DELIVERED");
		send(owner, post("/api/restaurant/tables/" + tableId + "/close"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.state").value("FREE"));
		mvc.perform(get("/api/restaurant/orders/" + id).session(owner))
			.andExpect(jsonPath("$.order.status").value("COMPLETED"));
		mvc.perform(get("/api/restaurant/orders/requests").session(owner)).andExpect(jsonPath("$.length()").value(0));

		// Novo atendimento: o valor parcial recomeça.
		placeOrder(order(waterId, 1));
		mvc.perform(get("/api/public/plates/" + plateToken + "/session?client=" + client("a")))
			.andExpect(jsonPath("$.tableTotalCents").value(500));
	}

	@Test
	void restaurantsNeverSeeEachOthersOrders() throws Exception {
		String id = orderId(placeOrder(order(waterId, 1)));
		Restaurant other = createLiveRestaurant("Concorrente");
		MockHttpSession otherOwner = login(createUser(other.getId(), Role.RESTAURANT_OWNER));

		mvc.perform(get("/api/restaurant/orders/board").session(otherOwner))
			.andExpect(jsonPath("$.orders.length()").value(0));
		mvc.perform(get("/api/restaurant/orders/" + id).session(otherOwner)).andExpect(status().isNotFound());
		move(otherOwner, id, "AWAITING_CONFIRMATION", "NEW").andExpect(status().isNotFound());
		mvc.perform(get("/api/restaurant/orders").session(otherOwner)).andExpect(jsonPath("$.totalItems").value(0));
		mvc.perform(get("/api/restaurant/orders/board").session(owner)).andExpect(jsonPath("$.orders.length()").value(1));
	}

	@Test
	void onboardingRestaurantAcceptsOnlyTestOrdersFromItsTeamOrSuperAdmin() throws Exception {
		Restaurant onboarding = createRestaurant("Em Implantação");
		String token = bindPlate(onboarding, "01");
		MockHttpSession team = login(createUser(onboarding.getId(), Role.RESTAURANT_OWNER));
		String category = idOf(send(team, post("/api/restaurant/categories"), "{\"name\":\"Bebidas\"}"));
		String product = idOf(send(team, post("/api/restaurant/products"), """
				{"categoryId":"%s","name":"Suco","priceCents":800,"active":true,"available":true,"featured":false}"""
			.formatted(category)));

		mvc.perform(get("/api/public/plates/" + token + "/menu")).andExpect(status().isNotFound());
		mvc.perform(get("/api/public/plates/" + token + "/menu").session(admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.preview").value(true));
		send(team, post("/api/public/plates/" + token + "/orders"), order(product, 1))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.test").value(true));

		mvc.perform(get("/api/admin/restaurants/" + onboarding.getId() + "/onboarding").session(admin))
			.andExpect(jsonPath("$.steps[?(@.key == 'test_order')].done").value(Matchers.contains(true)));
		// Pedido de teste fica fora das vendas.
		mvc.perform(get("/api/restaurant/dashboard").session(team))
			.andExpect(jsonPath("$.sales.current.orders").value(0))
			.andExpect(jsonPath("$.sales.testOrders").value(1));
	}

	@Test
	void dashboardReportsRealSales() throws Exception {
		String id = orderId(placeOrder(order(waterId, 3)));
		placeOrder(order(productId, 1, simpleId));
		String cancelled = orderId(placeOrder(order(waterId, 1)));
		send(owner, post("/api/restaurant/orders/" + cancelled + "/transition"),
				"{\"from\":\"AWAITING_CONFIRMATION\",\"to\":\"CANCELLED\",\"reason\":\"Teste\"}");
		assertThat(id).isNotBlank();

		mvc.perform(get("/api/restaurant/dashboard?period=7d").session(owner))
			.andExpect(jsonPath("$.ordersModuleAvailable").value(true))
			.andExpect(jsonPath("$.sales.current.revenueCents").value(1500 + 3000))
			.andExpect(jsonPath("$.sales.current.orders").value(2))
			.andExpect(jsonPath("$.sales.current.averageTicketCents").value(2250))
			.andExpect(jsonPath("$.sales.current.cancelled").value(1))
			.andExpect(jsonPath("$.sales.topProducts[0].name").value("Água"))
			.andExpect(jsonPath("$.sales.live.awaitingConfirmation").value(2))
			.andExpect(jsonPath("$.sales.live.occupiedTables").value(1))
			.andExpect(jsonPath("$.sales.hourly.length()").value(24));
	}

	@Test
	void ordersSkipConfirmationWhenDisabledAndRespectOpeningHours() throws Exception {
		send(owner, put("/api/restaurant/settings/operation"), "{\"requireOrderConfirmation\":false}");
		placeOrder(order(waterId, 1)).andExpect(jsonPath("$.status").value("NEW"));

		// Aberto só em um dia que não é hoje nem ontem: fechado agora.
		DayOfWeek today = LocalDate.now(OpeningHours.BUSINESS_ZONE).getDayOfWeek();
		int other = today.plus(3).getValue();
		send(owner, put("/api/restaurant/settings/hours"),
				"{\"hours\":[{\"weekday\":%d,\"opensAt\":\"10:00\",\"closesAt\":\"11:00\"}]}".formatted(other));
		mvc.perform(get("/api/public/plates/" + plateToken + "/menu")).andExpect(jsonPath("$.openNow").value(false));
		placeOrder(order(waterId, 1)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("fechado")));
	}

	@Test
	void concurrentOrdersGetUniqueNumbersAndShareOneAttendance() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(8);
		List<Callable<Integer>> calls = new ArrayList<>();
		for (int i = 0; i < 12; i++) {
			calls.add(() -> JsonPath.read(placeOrder(order(waterId, 1)).andReturn().getResponse().getContentAsString(),
					"$.number"));
		}
		Set<Integer> numbers = new HashSet<>();
		for (Future<Integer> f : pool.invokeAll(calls)) {
			numbers.add(f.get());
		}
		pool.shutdown();
		assertThat(numbers).hasSize(12).allMatch(n -> n >= 1 && n <= 12);
		mvc.perform(get("/api/public/plates/" + plateToken + "/session"))
			.andExpect(jsonPath("$.tableOrders").value(12));
	}

	@Test
	void realtimeStreamDeliversEventsOnlyToTheOwningRestaurant() throws Exception {
		MvcResult mine = mvc.perform(get("/api/restaurant/events").session(owner).accept(MediaType.TEXT_EVENT_STREAM))
			.andExpect(status().isOk())
			.andReturn();
		Restaurant other = createLiveRestaurant("Vizinho");
		MvcResult theirs = mvc.perform(get("/api/restaurant/events")
			.session(login(createUser(other.getId(), Role.RESTAURANT_OWNER)))
			.accept(MediaType.TEXT_EVENT_STREAM)).andReturn();

		placeOrder(order(waterId, 1));

		assertThat(mine.getResponse().getContentAsString()).contains("event:order.created").contains("\"tableLabel\":\"05\"");
		assertThat(theirs.getResponse().getContentAsString()).doesNotContain("order.created");
		mvc.perform(get("/api/restaurant/events")).andExpect(status().isUnauthorized());
	}

	// ---------------------------------------------------------------- auxiliares

	private Restaurant createLiveRestaurant(String name) {
		Restaurant r = createRestaurant(name);
		r.changeStatus(RestaurantStatus.ACTIVE);
		return restaurants.saveAndFlush(r);
	}

	/** Mesa + plaquinha vinculada pelo Super Admin, como na implantação. Retorna o token público. */
	private String bindPlate(Restaurant r, String label) throws Exception {
		String tableId = JsonPath.read(send(admin, post("/api/admin/restaurants/" + r.getId() + "/tables"),
				"{\"labels\":[\"%s\"]}".formatted(label)).andReturn().getResponse().getContentAsString(), "$[0].id");
		String batchId = idOf(send(admin, post("/api/admin/plate-batches"), "{\"quantity\":1}"));
		String platesJson = mvc.perform(get("/api/admin/plates?batchId=" + batchId).session(admin))
			.andReturn().getResponse().getContentAsString();
		send(admin, post("/api/admin/plates/" + JsonPath.read(platesJson, "$.items[0].id") + "/changes"),
				"{\"action\":\"BIND\",\"restaurantId\":\"%s\",\"tableId\":\"%s\"}".formatted(r.getId(), tableId))
			.andExpect(status().isOk());
		return JsonPath.read(platesJson, "$.items[0].publicToken");
	}

	private ResultActions placeOrder(String json) throws Exception {
		return mvc.perform(post("/api/public/plates/" + plateToken + "/orders").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private String order(String product, int quantity, String... options) {
		String opts = String.join(",", java.util.Arrays.stream(options).map(o -> "\"" + o + "\"").toList());
		return """
				{"clientToken":"%s","items":[{"productId":"%s","quantity":%d,"optionIds":[%s]}]}"""
			.formatted(client("a"), product, quantity, opts);
	}

	private ResultActions move(MockHttpSession session, String id, String from, String to) throws Exception {
		return send(session, post("/api/restaurant/orders/" + id + "/transition"),
				"{\"from\":\"%s\",\"to\":\"%s\"}".formatted(from, to));
	}

	private String orderId(ResultActions placed) throws Exception {
		String tracking = JsonPath.read(placed.andReturn().getResponse().getContentAsString(), "$.trackingToken");
		String board = mvc.perform(get("/api/restaurant/orders/board").session(owner))
			.andReturn().getResponse().getContentAsString();
		int number = JsonPath.read(mvc.perform(get("/api/public/orders/" + tracking))
			.andReturn().getResponse().getContentAsString(), "$.number");
		List<String> ids = JsonPath.read(board, "$.orders[?(@.number == " + number + ")].id");
		return ids.get(0);
	}

	private MockHttpSession anonymous() {
		return new MockHttpSession();
	}

	private static String client(String who) {
		return ("cliente-" + who + "-0123456789abcdef").substring(0, 26);
	}

}
