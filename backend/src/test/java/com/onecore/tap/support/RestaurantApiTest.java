package com.onecore.tap.support;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;
import com.onecore.tap.plans.Plan;
import com.onecore.tap.plans.PlanRepository;
import com.onecore.tap.restaurants.Restaurant;

/** Base dos testes do painel do restaurante: requisições autenticadas com CSRF e criação de planos. */
public abstract class RestaurantApiTest extends IntegrationTest {

	@Autowired
	protected PlanRepository plans;

	protected ResultActions send(MockHttpSession session, MockHttpServletRequestBuilder request, String json)
			throws Exception {
		return mvc.perform(request.with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	protected ResultActions send(MockHttpSession session, MockHttpServletRequestBuilder request) throws Exception {
		return mvc.perform(request.with(csrf()).session(session));
	}

	protected static String idOf(ResultActions result) throws Exception {
		return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
	}

	protected void assignPlan(Restaurant restaurant, Integer maxTables, Integer maxUsers) {
		Plan plan = new Plan("teste-" + suffix());
		plan.update("Plano teste", null, 9900, maxTables, maxUsers, 0, java.util.List.of(), true);
		plan = plans.saveAndFlush(plan);
		Restaurant fresh = restaurants.findById(restaurant.getId()).orElseThrow();
		fresh.assignPlan(plan.getId());
		restaurants.saveAndFlush(fresh);
	}

	protected static String uuid() {
		return UUID.randomUUID().toString();
	}

}
