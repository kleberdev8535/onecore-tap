package com.onecore.tap.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;
import com.onecore.tap.plans.Plan;
import com.onecore.tap.plans.PlanModule;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.support.RestaurantApiTest;
import com.onecore.tap.users.Role;

/** Registro de pagamentos, estorno, financeiro, relatórios e módulos do plano, com permissões e isolamento. */
class PaymentIntegrationTest extends RestaurantApiTest {

	MockHttpSession admin;

	Restaurant restaurant;

	MockHttpSession owner;

	MockHttpSession cashier;

	String plateToken;

	String tableId;

	String waterId;

	String burgerId;

	@BeforeEach
	void setUp() throws Exception {
		admin = login(createUser(null, Role.SUPER_ADMIN));
		restaurant = createLiveRestaurant("Cantina Fiscal");
		owner = login(createUser(restaurant.getId(), Role.RESTAURANT_OWNER));
		cashier = login(createUser(restaurant.getId(), Role.CASHIER));
		plateToken = bindPlate(restaurant, "07");
		tableId = JsonPath.read(mvc.perform(get("/api/restaurant/tables").session(owner))
			.andReturn().getResponse().getContentAsString(), "$[0].id");
		String drinks = idOf(send(owner, post("/api/restaurant/categories"), "{\"name\":\"Bebidas\"}"));
		String food = idOf(send(owner, post("/api/restaurant/categories"), "{\"name\":\"Lanches\"}"));
		waterId = product(drinks, "Água", 500);
		burgerId = product(food, "X-Burger", 3000);
	}

	@Test
	void cashierClosesTheTableSplittingMethodsAndWaiterCannot() throws Exception {
		String a = accepted(order(burgerId, 2));
		String b = accepted(order(waterId, 1));

		MockHttpSession waiter = login(createUser(restaurant.getId(), Role.WAITER));
		String tableBody = """
				{"scope":"TABLE","tableId":"%s","entries":[{"method":"PIX","amountCents":4000},
				 {"method":"CASH","amountCents":2500,"receivedCents":3000}]}""".formatted(tableId);
		send(waiter, post("/api/restaurant/payments"), tableBody).andExpect(status().isForbidden());
		send(login(createUser(restaurant.getId(), Role.KITCHEN)), post("/api/restaurant/payments"), tableBody)
			.andExpect(status().isForbidden());

		send(cashier, post("/api/restaurant/payments"), tableBody)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.totalCents").value(6500))
			.andExpect(jsonPath("$.tableLabel").value("07"))
			.andExpect(jsonPath("$.orderNumbers.length()").value(2))
			.andExpect(jsonPath("$.entries[1].changeCents").value(500))
			.andExpect(jsonPath("$.registeredBy").value(Matchers.startsWith("Usuário")));

		for (String id : List.of(a, b)) {
			mvc.perform(get("/api/restaurant/orders/" + id).session(owner))
				.andExpect(jsonPath("$.order.paymentStatus").value("PAID"));
		}
		mvc.perform(get("/api/restaurant/payments/pending").session(cashier)).andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void amountsMustMatchAndOrdersCannotBePaidTwice() throws Exception {
		String id = accepted(order(waterId, 2));
		String awaiting = orderId(placeOrder(order(waterId, 1)));

		pay(List.of(id), "[{\"method\":\"CARD\",\"amountCents\":999}]")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("precisa ser igual")));
		pay(List.of(id), "[{\"method\":\"CASH\",\"amountCents\":1000,\"receivedCents\":500}]")
			.andExpect(status().isConflict());
		pay(List.of(awaiting), "[{\"method\":\"PIX\",\"amountCents\":500}]")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("Confirme")));

		pay(List.of(id), "[{\"method\":\"CARD\",\"amountCents\":1000}]").andExpect(status().isCreated());
		pay(List.of(id), "[{\"method\":\"CARD\",\"amountCents\":1000}]")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("já tem pagamento")));
	}

	@Test
	void paidOrderCannotBeCancelledUntilThePaymentIsVoided() throws Exception {
		String id = accepted(order(burgerId, 1));
		String paymentId = idOf(pay(List.of(id), "[{\"method\":\"PIX\",\"amountCents\":3000}]"));

		send(owner, post("/api/restaurant/orders/" + id + "/transition"),
				"{\"from\":\"NEW\",\"to\":\"CANCELLED\",\"reason\":\"Desistiu\"}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("Estorne")));

		send(cashier, post("/api/restaurant/payments/" + paymentId + "/void"), "{\"reason\":\"\"}")
			.andExpect(status().isConflict());
		send(cashier, post("/api/restaurant/payments/" + paymentId + "/void"), "{\"reason\":\"Lançado na mesa errada\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.voidReason").value("Lançado na mesa errada"));
		send(cashier, post("/api/restaurant/payments/" + paymentId + "/void"), "{\"reason\":\"de novo\"}")
			.andExpect(status().isConflict());

		mvc.perform(get("/api/restaurant/orders/" + id).session(owner))
			.andExpect(jsonPath("$.order.paymentStatus").value("UNPAID"));
		send(owner, post("/api/restaurant/orders/" + id + "/transition"),
				"{\"from\":\"NEW\",\"to\":\"CANCELLED\",\"reason\":\"Desistiu\"}")
			.andExpect(status().isOk());
	}

	@Test
	void anotherRestaurantCannotPayVoidOrSeeOurFinance() throws Exception {
		String id = accepted(order(burgerId, 1));
		Restaurant other = createLiveRestaurant("Bar Vizinho");
		MockHttpSession intruder = login(createUser(other.getId(), Role.CASHIER));

		send(intruder, post("/api/restaurant/payments"),
				"{\"scope\":\"ORDER\",\"orderIds\":[\"%s\"],\"entries\":[{\"method\":\"PIX\",\"amountCents\":3000}]}".formatted(id))
			.andExpect(status().isNotFound());
		send(intruder, post("/api/restaurant/payments"),
				"{\"scope\":\"TABLE\",\"tableId\":\"%s\",\"entries\":[{\"method\":\"PIX\",\"amountCents\":3000}]}".formatted(tableId))
			.andExpect(status().isConflict());

		String paymentId = idOf(pay(List.of(id), "[{\"method\":\"PIX\",\"amountCents\":3000}]"));
		send(intruder, post("/api/restaurant/payments/" + paymentId + "/void"), "{\"reason\":\"x\"}")
			.andExpect(status().isNotFound());
		mvc.perform(get("/api/restaurant/payments?from=%s&to=%s".formatted(today(), today())).session(intruder))
			.andExpect(jsonPath("$.totalItems").value(0));
		mvc.perform(get("/api/restaurant/finance/summary?from=%s&to=%s".formatted(today(), today()))
			.session(login(createUser(other.getId(), Role.RESTAURANT_OWNER))))
			.andExpect(jsonPath("$.current.soldCents").value(0));
	}

	@Test
	void financeSummaryBreaksDownSalesAndPayments() throws Exception {
		String burgers = accepted(order(burgerId, 2));
		String water = accepted(order(waterId, 3));
		String cancelled = accepted(order(waterId, 1));
		send(owner, post("/api/restaurant/orders/" + cancelled + "/transition"),
				"{\"from\":\"NEW\",\"to\":\"CANCELLED\",\"reason\":\"Erro\"}").andExpect(status().isOk());
		pay(List.of(burgers), "[{\"method\":\"CARD\",\"amountCents\":6000}]").andExpect(status().isCreated());

		mvc.perform(get("/api/restaurant/finance/summary?from=%s&to=%s".formatted(today(), today())).session(owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.current.soldCents").value(7500))
			.andExpect(jsonPath("$.current.orders").value(2))
			.andExpect(jsonPath("$.current.averageTicketCents").value(3750))
			.andExpect(jsonPath("$.current.paidCents").value(6000))
			.andExpect(jsonPath("$.current.pendingCents").value(1500))
			.andExpect(jsonPath("$.current.cancelledOrders").value(1))
			.andExpect(jsonPath("$.byMethod[0].method").value("CARD"))
			.andExpect(jsonPath("$.byMethod[0].totalCents").value(6000))
			.andExpect(jsonPath("$.byProduct[0].name").value("X-Burger"))
			.andExpect(jsonPath("$.byCategory[*].name", Matchers.containsInAnyOrder("Lanches", "Bebidas")))
			.andExpect(jsonPath("$.byTable[0].name").value("07"))
			.andExpect(jsonPath("$.previous.soldCents").value(0));

		// Caixa consulta o financeiro; garçom não.
		mvc.perform(get("/api/restaurant/finance/summary?from=%s&to=%s".formatted(today(), today())).session(cashier))
			.andExpect(status().isOk());
		mvc.perform(get("/api/restaurant/finance/summary?from=%s&to=%s".formatted(today(), today()))
			.session(login(createUser(restaurant.getId(), Role.WAITER)))).andExpect(status().isForbidden());

		mvc.perform(get("/api/restaurant/finance/summary?from=%s&to=%s".formatted(today(), today().minusDays(1))).session(owner))
			.andExpect(status().isConflict());
		assertThat(water).isNotBlank();
	}

	@Test
	void reportsExportCsvForSpreadsheets() throws Exception {
		String id = accepted(order(burgerId, 1));
		pay(List.of(id), "[{\"method\":\"PIX\",\"amountCents\":1000},{\"method\":\"CASH\",\"amountCents\":2000}]");

		String csv = mvc.perform(get("/api/restaurant/reports/orders.csv?from=%s&to=%s".formatted(today(), today())).session(owner))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Disposition", Matchers.containsString("pedidos-")))
			.andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
		assertThat(csv).startsWith("﻿Pedido;Data;Hora;Mesa;Status;Pagamento;Métodos;Total (R$)");
		assertThat(csv).contains(";07;").contains(";Pago;").contains("30,00").contains("Pix").contains("Dinheiro");

		String items = mvc.perform(get("/api/restaurant/reports/items.csv?from=%s&to=%s".formatted(today(), today())).session(owner))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
		assertThat(items).contains("X-Burger;Lanches;1;30,00");
	}

	@Test
	void planModulesAreEnforcedButPaymentsStayAvailable() throws Exception {
		Plan basic = new Plan("basico-" + suffix());
		basic.update("Básico", null, 4900, null, null, 0, List.of(), true);
		basic.changeModules(Set.of());
		basic = plans.saveAndFlush(basic);
		Restaurant fresh = restaurants.findById(restaurant.getId()).orElseThrow();
		fresh.assignPlan(basic.getId());
		restaurants.saveAndFlush(fresh);

		mvc.perform(get("/api/auth/me").session(owner)).andExpect(jsonPath("$.modules.length()").value(0));
		mvc.perform(get("/api/restaurant/finance/summary?from=%s&to=%s".formatted(today(), today())).session(owner))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("PLAN_MODULE_NOT_INCLUDED"))
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("Financeiro")));
		mvc.perform(get("/api/restaurant/reports/orders.csv?from=%s&to=%s".formatted(today(), today())).session(owner))
			.andExpect(status().isForbidden());

		String id = accepted(order(waterId, 1));
		pay(List.of(id), "[{\"method\":\"PIX\",\"amountCents\":500}]").andExpect(status().isCreated());

		// Perfil só de cozinha depende do módulo Cozinha.
		MockHttpSession kitchen = login(createUser(restaurant.getId(), Role.KITCHEN));
		send(kitchen, post("/api/restaurant/orders/" + id + "/transition"), "{\"from\":\"NEW\",\"to\":\"IN_PREPARATION\"}")
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(Matchers.containsString("Painel da cozinha")));
		basic.changeModules(Set.of(PlanModule.KITCHEN));
		plans.saveAndFlush(basic);
		send(kitchen, post("/api/restaurant/orders/" + id + "/transition"), "{\"from\":\"NEW\",\"to\":\"IN_PREPARATION\"}")
			.andExpect(status().isOk());
	}

	// ---------------------------------------------------------------- auxiliares

	private ResultActions pay(List<String> orderIds, String entries) throws Exception {
		String ids = String.join(",", orderIds.stream().map(i -> "\"" + i + "\"").toList());
		return send(cashier, post("/api/restaurant/payments"),
				"{\"scope\":\"ORDER\",\"orderIds\":[%s],\"entries\":%s}".formatted(ids, entries));
	}

	/** Cria o pedido pelo cardápio público e confirma (aguardando confirmação -> novo). */
	private String accepted(String json) throws Exception {
		String id = orderId(placeOrder(json));
		send(owner, post("/api/restaurant/orders/" + id + "/transition"),
				"{\"from\":\"AWAITING_CONFIRMATION\",\"to\":\"NEW\"}").andExpect(status().isOk());
		return id;
	}

	private String product(String category, String name, int price) throws Exception {
		return idOf(send(owner, post("/api/restaurant/products"), """
				{"categoryId":"%s","name":"%s","priceCents":%d,"active":true,"available":true,"featured":false}"""
			.formatted(category, name, price)));
	}

	private Restaurant createLiveRestaurant(String name) {
		Restaurant r = createRestaurant(name);
		r.changeStatus(RestaurantStatus.ACTIVE);
		return restaurants.saveAndFlush(r);
	}

	private String bindPlate(Restaurant r, String label) throws Exception {
		String table = JsonPath.read(send(admin, post("/api/admin/restaurants/" + r.getId() + "/tables"),
				"{\"labels\":[\"%s\"]}".formatted(label)).andReturn().getResponse().getContentAsString(), "$[0].id");
		String batchId = idOf(send(admin, post("/api/admin/plate-batches"), "{\"quantity\":1}"));
		String platesJson = mvc.perform(get("/api/admin/plates?batchId=" + batchId).session(admin))
			.andReturn().getResponse().getContentAsString();
		send(admin, post("/api/admin/plates/" + JsonPath.read(platesJson, "$.items[0].id") + "/changes"),
				"{\"action\":\"BIND\",\"restaurantId\":\"%s\",\"tableId\":\"%s\"}".formatted(r.getId(), table))
			.andExpect(status().isOk());
		return JsonPath.read(platesJson, "$.items[0].publicToken");
	}

	private ResultActions placeOrder(String json) throws Exception {
		return mvc.perform(post("/api/public/plates/" + plateToken + "/orders").with(csrf())
			.contentType(MediaType.APPLICATION_JSON)
			.content(json)).andExpect(status().isCreated());
	}

	private static String order(String product, int quantity) {
		return """
				{"clientToken":"cliente-financeiro-0123456","items":[{"productId":"%s","quantity":%d}]}"""
			.formatted(product, quantity);
	}

	private String orderId(ResultActions placed) throws Exception {
		String tracking = JsonPath.read(placed.andReturn().getResponse().getContentAsString(), "$.trackingToken");
		int number = JsonPath.read(mvc.perform(get("/api/public/orders/" + tracking))
			.andReturn().getResponse().getContentAsString(), "$.number");
		String board = mvc.perform(get("/api/restaurant/orders/board").session(owner))
			.andReturn().getResponse().getContentAsString();
		List<String> ids = JsonPath.read(board, "$.orders[?(@.number == " + number + ")].id");
		return ids.getFirst();
	}

	private static LocalDate today() {
		return LocalDate.now(ZoneId.of("America/Sao_Paulo"));
	}

}
