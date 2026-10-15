package com.onecore.tap.plans;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Módulos que podem ser liberados ou não por plano. O núcleo (cardápio, mesas, pedidos, registro de pagamento)
 * está em todos os planos; estes são os opcionais.
 */
public enum PlanModule {

	KITCHEN("Painel da cozinha"), FINANCE("Financeiro"), REPORTS("Relatórios");

	public static final String ALL_CODES = "KITCHEN,FINANCE,REPORTS";

	private final String label;

	PlanModule(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}

	static String encode(Set<PlanModule> modules) {
		return modules.stream().sorted().map(Enum::name).collect(Collectors.joining(","));
	}

	static Set<PlanModule> decode(String codes) {
		Set<PlanModule> set = EnumSet.noneOf(PlanModule.class);
		if (codes == null || codes.isBlank()) {
			return set;
		}
		Arrays.stream(codes.split(","))
			.map(String::trim)
			.filter(c -> !c.isEmpty())
			.forEach(c -> Arrays.stream(values()).filter(m -> m.name().equals(c)).forEach(set::add));
		return set;
	}

}
