package com.onecore.tap.tables;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.plans.PlanRepository;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.tenancy.TenantContext;

/**
 * Mesas criadas pelo Super Admin durante a implantacao. A escrita acontece no contexto do restaurante
 * (TenantContext), de forma que o Hibernate grave o restaurant_id correto pelo @TenantId.
 */
@Service
public class TableService {

	private final RestaurantTableRepository tables;

	private final RestaurantRepository restaurants;

	private final PlanRepository plans;

	private final TransactionTemplate tx;

	public TableService(RestaurantTableRepository tables, RestaurantRepository restaurants, PlanRepository plans,
			TransactionTemplate tx) {
		this.tables = tables;
		this.restaurants = restaurants;
		this.plans = plans;
		this.tx = tx;
	}

	/** Cria varias mesas de uma vez (ex.: 1 a 12). Rotulos ja existentes sao recusados. */
	public List<RestaurantTable> create(UUID restaurantId, List<String> labels, Integer capacity) {
		Restaurant restaurant = restaurants.findById(restaurantId)
			.orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
		List<String> clean = normalize(labels);
		return TenantContext.callAs(restaurantId, () -> tx.execute(status -> {
			Set<String> existing = new HashSet<>();
			tables.labelsOfRestaurant(restaurantId).forEach(l -> existing.add(l.toLowerCase(Locale.ROOT)));
			List<String> duplicated = clean.stream().filter(l -> existing.contains(l.toLowerCase(Locale.ROOT))).toList();
			if (!duplicated.isEmpty()) {
				throw new ConflictException("Já existem mesas com estes nomes: " + String.join(", ", duplicated) + ".");
			}
			if (restaurant.getPlanId() != null) {
				plans.findById(restaurant.getPlanId()).ifPresent(plan -> {
					if (plan.getMaxTables() != null && existing.size() + clean.size() > plan.getMaxTables()) {
						throw new ConflictException("O plano " + plan.getName() + " permite até " + plan.getMaxTables()
								+ " mesas. Hoje existem " + existing.size() + ".");
					}
				});
			}
			List<RestaurantTable> created = new ArrayList<>();
			clean.forEach(label -> created.add(tables.save(new RestaurantTable(label, capacity))));
			tables.flush();
			return created;
		}));
	}

	/** Junta nomes avulsos e um intervalo numérico (ex.: 1 a 12 vira 01..12). */
	public static List<String> expand(List<String> labels, Integer from, Integer to) {
		List<String> all = new ArrayList<>();
		if (labels != null) {
			all.addAll(labels);
		}
		if (from != null && to != null) {
			if (to < from || to - from >= 200) {
				throw new ConflictException("Intervalo inválido (máximo de 200 mesas por vez).");
			}
			int width = Math.max(2, String.valueOf(to).length());
			for (int n = from; n <= to; n++) {
				all.add(String.format("%0" + width + "d", n));
			}
		}
		return all;
	}

	/** Edição pelo próprio restaurante: executa no tenant da sessão. */
	@org.springframework.transaction.annotation.Transactional
	public RestaurantTable update(UUID tableId, String label, Integer capacity, boolean active) {
		RestaurantTable table = tables.findById(tableId)
			.orElseThrow(() -> new NotFoundException("Mesa não encontrada."));
		String clean = normalize(List.of(label)).get(0);
		boolean renamed = !clean.equalsIgnoreCase(table.getLabel());
		if (renamed && tables.labelsOfRestaurant(table.getRestaurantId())
			.stream()
			.anyMatch(l -> l.equalsIgnoreCase(clean))) {
			throw new ConflictException("Já existe uma mesa com o nome " + clean + ".");
		}
		table.update(clean, capacity, active);
		tables.flush();
		return table;
	}

	static List<String> normalize(List<String> labels) {
		List<String> clean = new ArrayList<>();
		Set<String> seen = new HashSet<>();
		for (String raw : labels) {
			String label = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
			if (label.isEmpty()) {
				continue;
			}
			if (label.length() > 20) {
				throw new ConflictException("O nome da mesa deve ter até 20 caracteres: " + label);
			}
			if (seen.add(label.toLowerCase(Locale.ROOT))) {
				clean.add(label);
			}
		}
		if (clean.isEmpty()) {
			throw new ConflictException("Informe ao menos uma mesa.");
		}
		if (clean.size() > 200) {
			throw new ConflictException("Cadastre no máximo 200 mesas por vez.");
		}
		return clean;
	}

}
