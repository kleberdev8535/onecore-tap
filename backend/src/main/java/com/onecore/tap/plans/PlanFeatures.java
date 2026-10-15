package com.onecore.tap.plans;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.security.CurrentUser;

/**
 * Verificação central dos módulos do plano do restaurante logado. Restaurante sem plano (em implantação)
 * não sofre restrição: a OneCore Business define o plano antes de ativar.
 */
@Service
public class PlanFeatures {

	private final RestaurantRepository restaurants;

	private final PlanRepository plans;

	public PlanFeatures(RestaurantRepository restaurants, PlanRepository plans) {
		this.restaurants = restaurants;
		this.plans = plans;
	}

	@Transactional(readOnly = true)
	public Set<PlanModule> modulesOf(UUID restaurantId) {
		return restaurants.findById(restaurantId)
			.map(r -> r.getPlanId() == null ? EnumSet.allOf(PlanModule.class)
					: plans.findById(r.getPlanId()).map(Plan::moduleSet).orElse(EnumSet.allOf(PlanModule.class)))
			.orElse(EnumSet.noneOf(PlanModule.class));
	}

	/** Lança PlanModuleNotIncludedException (403 com mensagem) se o plano não inclui o módulo. */
	public void require(PlanModule module) {
		if (!modulesOf(CurrentUser.requireRestaurantId()).contains(module)) {
			throw new PlanModuleNotIncludedException(module);
		}
	}

	public static class PlanModuleNotIncludedException extends RuntimeException {

		public PlanModuleNotIncludedException(PlanModule module) {
			super("O plano do seu restaurante não inclui o módulo " + module.label()
					+ ". Fale com a OneCore Business para mudar de plano.");
		}

	}

}
