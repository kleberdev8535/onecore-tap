package com.onecore.tap.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;

import com.jayway.jsonpath.JsonPath;
import com.onecore.tap.support.RestaurantApiTest;
import com.onecore.tap.users.Role;

/** Assinaturas, cobranças, rotina de inadimplência e financeiro da OneCore Business. */
class BillingIntegrationTest extends RestaurantApiTest {

	@Autowired
	JdbcTemplate jdbc;

	MockHttpSession admin;

	@BeforeEach
	void setUp() throws Exception {
		admin = login(createUser(null, Role.SUPER_ADMIN));
	}

	@Test
	void activationCreatesTheSubscriptionAndTheFirstInvoice() throws Exception {
		String id = readyRestaurant(planId(14900, 0));
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"ACTIVATE\"}").andExpect(status().isOk());

		mvc.perform(get("/api/admin/restaurants/" + id + "/billing").session(admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.subscription.status").value("ACTIVE"))
			.andExpect(jsonPath("$.subscription.priceCents").value(14900))
			.andExpect(jsonPath("$.invoices.length()").value(1))
			.andExpect(jsonPath("$.invoices[0].status").value("OPEN"))
			.andExpect(jsonPath("$.invoices[0].dueDate").value(today().toString()));

		// O proprietário vê a própria assinatura (somente leitura); outro restaurante não acessa nada do admin.
		MockHttpSession owner = login(ownerOf(id));
		mvc.perform(get("/api/restaurant/subscription").session(owner))
			.andExpect(jsonPath("$.subscription.planName").value(Matchers.startsWith("Plano")));
		mvc.perform(get("/api/admin/subscriptions").session(owner)).andExpect(status().isForbidden());
		send(owner, post("/api/admin/billing/run")).andExpect(status().isForbidden());
	}

	@Test
	void overdueSubscriptionIsSuspendedAfterGraceAndReactivatedWhenPaid() throws Exception {
		String id = readyRestaurant(planId(9900, 0));
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"ACTIVATE\"}").andExpect(status().isOk());
		MockHttpSession waiter = login(createUser(UUID.fromString(id), Role.WAITER));

		backdateInvoice(id, 3);
		send(admin, post("/api/admin/billing/run")).andExpect(status().isOk());
		assertThat(subscriptionStatus(id)).isEqualTo("PAST_DUE");
		assertThat(restaurantStatus(id)).isEqualTo("ACTIVE");

		backdateInvoice(id, 15);
		send(admin, post("/api/admin/billing/run"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.suspended").value(Matchers.greaterThanOrEqualTo(1)));
		assertThat(subscriptionStatus(id)).isEqualTo("SUSPENDED");
		assertThat(restaurantStatus(id)).isEqualTo("SUSPENDED");
		// Equipe perde o acesso imediatamente (revalidação de sessão).
		mvc.perform(get("/api/auth/me").session(waiter)).andExpect(status().isUnauthorized());

		// Rodar de novo não duplica cobranças nem eventos.
		send(admin, post("/api/admin/billing/run")).andExpect(jsonPath("$.invoicesIssued").value(0));

		String invoiceId = openInvoice(id);
		send(admin, post("/api/admin/invoices/" + invoiceId + "/pay"), "{\"method\":\"PIX\",\"notes\":\"Comprovante 123\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PAID"));
		assertThat(subscriptionStatus(id)).isEqualTo("ACTIVE");
		assertThat(restaurantStatus(id)).isEqualTo("ACTIVE");
		send(admin, post("/api/admin/invoices/" + invoiceId + "/pay"), "{\"method\":\"PIX\"}").andExpect(status().isConflict());
	}

	@Test
	void manualSuspensionIsNeverUndoneByPayment() throws Exception {
		String id = readyRestaurant(planId(9900, 0));
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"ACTIVATE\"}");
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"SUSPEND\",\"reason\":\"Pedido do cliente\"}")
			.andExpect(status().isOk());

		send(admin, post("/api/admin/invoices/" + openInvoice(id) + "/pay"), "{\"method\":\"TRANSFER\"}").andExpect(status().isOk());

		assertThat(restaurantStatus(id)).isEqualTo("SUSPENDED");
	}

	@Test
	void trialBecomesPayingWhenItEnds() throws Exception {
		String id = readyRestaurant(planId(19900, 7));
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"START_TRIAL\"}").andExpect(status().isOk());
		assertThat(subscriptionStatus(id)).isEqualTo("TRIALING");
		mvc.perform(get("/api/admin/restaurants/" + id + "/billing").session(admin)).andExpect(jsonPath("$.invoices.length()").value(0));

		jdbc.update("update subscriptions set trial_ends_at = now() - interval '1 hour' where restaurant_id = ?::uuid", id);
		send(admin, post("/api/admin/billing/run")).andExpect(status().isOk());

		assertThat(subscriptionStatus(id)).isEqualTo("ACTIVE");
		assertThat(restaurantStatus(id)).isEqualTo("ACTIVE");
		mvc.perform(get("/api/admin/restaurants/" + id + "/billing").session(admin))
			.andExpect(jsonPath("$.invoices.length()").value(1))
			.andExpect(jsonPath("$.invoices[0].amountCents").value(19900));
	}

	@Test
	void renewalIssuesOneInvoicePerPeriodAndPlanChangeAppliesToTheNext() throws Exception {
		String id = readyRestaurant(planId(10000, 0));
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"ACTIVATE\"}");

		// Upgrade: assinatura passa a valer 25000 a partir da próxima cobrança; a atual fica como está.
		send(admin, put("/api/admin/restaurants/" + id + "/plan"), "{\"planId\":\"%s\"}".formatted(planId(25000, 0)))
			.andExpect(status().isOk());
		mvc.perform(get("/api/admin/restaurants/" + id + "/billing").session(admin))
			.andExpect(jsonPath("$.subscription.priceCents").value(25000))
			.andExpect(jsonPath("$.invoices[0].amountCents").value(10000));

		jdbc.update("""
				update subscriptions set current_period_start = current_period_start - interval '1 month',
				       current_period_end = current_date where restaurant_id = ?::uuid""", id);
		// A cobrança do período anterior também recua (simula que o mês passou).
		jdbc.update("""
				update subscription_invoices set period_start = period_start - interval '1 month',
				       period_end = current_date, due_date = due_date - interval '1 month' where restaurant_id = ?::uuid""", id);
		send(admin, post("/api/admin/invoices/" + openInvoice(id) + "/pay"), "{\"method\":\"PIX\"}").andExpect(status().isOk());
		send(admin, post("/api/admin/billing/run")).andExpect(status().isOk());
		send(admin, post("/api/admin/billing/run")).andExpect(status().isOk());

		mvc.perform(get("/api/admin/restaurants/" + id + "/billing").session(admin))
			.andExpect(jsonPath("$.invoices.length()").value(2))
			.andExpect(jsonPath("$.invoices[0].amountCents").value(25000))
			.andExpect(jsonPath("$.invoices[0].periodStart").value(today().toString()));
	}

	@Test
	void platformFinanceCountsSubscriptionsAndPlatesButNotRestaurantSales() throws Exception {
		String from = today().toString();
		String before = mvc.perform(get("/api/admin/finance?from=%s&to=%s".formatted(from, from)).session(admin))
			.andReturn().getResponse().getContentAsString();

		String id = readyRestaurant(planId(12000, 0));
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"ACTIVATE\"}");
		send(admin, put("/api/admin/settings"), "{\"platePriceCents\":3500,\"billingGraceDays\":10}").andExpect(status().isOk());
		String saleId = idOf(send(admin, post("/api/admin/restaurants/" + id + "/plate-sales"), "{\"quantity\":10}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.totalCents").value(35000)));
		send(admin, post("/api/admin/plate-sales/" + saleId + "/pay"), "{\"method\":\"PIX\"}").andExpect(status().isOk());
		send(admin, post("/api/admin/invoices/" + openInvoice(id) + "/pay"), "{\"method\":\"BOLETO\"}").andExpect(status().isOk());
		// Preço da plaquinha muda depois: a venda mantém o valor praticado.
		send(admin, put("/api/admin/settings"), "{\"platePriceCents\":4000,\"billingGraceDays\":10}").andExpect(status().isOk());

		String after = mvc.perform(get("/api/admin/finance?from=%s&to=%s".formatted(from, from)).session(admin))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		assertThat(delta(before, after, "$.receivedPlatesCents")).isEqualTo(35000);
		assertThat(delta(before, after, "$.receivedSubscriptionsCents")).isEqualTo(12000);
		assertThat(delta(before, after, "$.mrrCents")).isEqualTo(12000);
		assertThat(after).doesNotContain("soldCents");
		mvc.perform(get("/api/admin/restaurants/" + id + "/billing").session(admin))
			.andExpect(jsonPath("$.plateSales[0].unitPriceCents").value(3500));
	}

	@Test
	void cancellingTheRestaurantCancelsTheSubscription() throws Exception {
		String id = readyRestaurant(planId(9900, 0));
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"ACTIVATE\"}");
		send(admin, post("/api/admin/restaurants/" + id + "/status"), "{\"action\":\"CANCEL\",\"reason\":\"Encerrou as atividades\"}")
			.andExpect(status().isOk());
		assertThat(subscriptionStatus(id)).isEqualTo("CANCELLED");
		// A cobrança em aberto continua registrada (dívida real), mas pode ser anulada com motivo.
		send(admin, post("/api/admin/invoices/" + openInvoice(id) + "/void"), "{\"reason\":\"Acordo de encerramento\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("VOID"));
	}

	// ---------------------------------------------------------------- auxiliares

	/** Restaurante com plano, proprietário, mesa e plaquinha vinculada: pronto para ativar. */
	private String readyRestaurant(String planId) throws Exception {
		String id = idOf(send(admin, post("/api/admin/restaurants"), "{\"tradeName\":\"Assinante %s\"}".formatted(suffix())));
		send(admin, put("/api/admin/restaurants/" + id + "/plan"), "{\"planId\":\"%s\"}".formatted(planId)).andExpect(status().isOk());
		createUser(UUID.fromString(id), Role.RESTAURANT_OWNER);
		String tableId = JsonPath.read(send(admin, post("/api/admin/restaurants/" + id + "/tables"), "{\"labels\":[\"1\"]}")
			.andReturn().getResponse().getContentAsString(), "$[0].id");
		String batchId = idOf(send(admin, post("/api/admin/plate-batches"), "{\"quantity\":1}"));
		String plateId = JsonPath.read(mvc.perform(get("/api/admin/plates?batchId=" + batchId).session(admin))
			.andReturn().getResponse().getContentAsString(), "$.items[0].id");
		send(admin, post("/api/admin/plates/" + plateId + "/changes"),
				"{\"action\":\"BIND\",\"restaurantId\":\"%s\",\"tableId\":\"%s\"}".formatted(id, tableId)).andExpect(status().isOk());
		return id;
	}

	private String planId(int priceCents, int trialDays) throws Exception {
		return idOf(send(admin, post("/api/admin/plans"), """
				{"code":"p-%s","name":"Plano %s","monthlyPriceCents":%d,"trialDays":%d,"features":[],"active":true}"""
			.formatted(suffix(), suffix(), priceCents, trialDays)).andExpect(status().isCreated()));
	}

	private com.onecore.tap.users.User ownerOf(String restaurantId) {
		return users.findFirstByRestaurantIdAndRoleOrderByCreatedAtAsc(UUID.fromString(restaurantId), Role.RESTAURANT_OWNER)
			.orElseThrow();
	}

	private void backdateInvoice(String restaurantId, int daysAgo) {
		jdbc.update("update subscription_invoices set due_date = current_date - ? where restaurant_id = ?::uuid and status = 'OPEN'",
				daysAgo, restaurantId);
	}

	private String openInvoice(String restaurantId) {
		return jdbc.queryForObject("select id::text from subscription_invoices where restaurant_id = ?::uuid and status = 'OPEN' order by period_start limit 1",
				String.class, restaurantId);
	}

	private String subscriptionStatus(String restaurantId) {
		return jdbc.queryForObject("select status from subscriptions where restaurant_id = ?::uuid", String.class, restaurantId);
	}

	private String restaurantStatus(String restaurantId) {
		return restaurants.findById(UUID.fromString(restaurantId)).map(r -> r.getStatus().name()).orElseThrow();
	}

	private static long delta(String before, String after, String path) {
		return ((Number) JsonPath.read(after, path)).longValue() - ((Number) JsonPath.read(before, path)).longValue();
	}

	private static LocalDate today() {
		return LocalDate.now(ZoneId.of("America/Sao_Paulo"));
	}

}
