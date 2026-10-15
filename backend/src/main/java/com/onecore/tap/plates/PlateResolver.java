package com.onecore.tap.plates;

import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;
import com.onecore.tap.tables.RestaurantTable;
import com.onecore.tap.tables.RestaurantTableRepository;
import com.onecore.tap.tenancy.TenantContext;

/**
 * Resolve a URL pública da plaquinha (/t/{token}) em restaurante e mesa. Ponto único usado pelo cardápio, pelos
 * pedidos e pelos chamados: o restaurante nunca vem do cliente, só da plaquinha.
 *
 * Restaurantes em operação (ativo ou em teste) atendem qualquer pessoa. Um restaurante ainda em implantação atende
 * somente quem está logado como Super Admin ou como equipe daquele restaurante: é o "pedido de teste" do checklist
 * de implantação, e esses pedidos ficam marcados como teste.
 */
@Service
public class PlateResolver {

	public static final String UNAVAILABLE = "Esta mesa não está disponível para pedidos no momento. Chame um atendente.";

	public record ResolvedPlate(String token, Restaurant restaurant, RestaurantTable table, boolean preview) {
	}

	private final PlateRepository plates;

	private final RestaurantRepository restaurants;

	private final RestaurantTableRepository tables;

	private final TransactionTemplate tx;

	PlateResolver(PlateRepository plates, RestaurantRepository restaurants, RestaurantTableRepository tables,
			TransactionTemplate tx) {
		this.plates = plates;
		this.restaurants = restaurants;
		this.tables = tables;
		this.tx = tx;
	}

	/** Deve ser chamado fora de transação (a leitura da mesa usa o contexto do restaurante resolvido). */
	public ResolvedPlate resolve(String rawToken) {
		String token = rawToken == null ? "" : rawToken.trim().toUpperCase(Locale.ROOT);
		if (!PlateTokenGenerator.isWellFormed(token)) {
			throw new NotFoundException(UNAVAILABLE);
		}
		Plate plate = plates.findByPublicToken(token)
			.filter(p -> p.getStatus() == PlateStatus.ACTIVE)
			.orElseThrow(() -> new NotFoundException(UNAVAILABLE));
		Restaurant restaurant = restaurants.findById(plate.getRestaurantId())
			.orElseThrow(() -> new NotFoundException(UNAVAILABLE));
		boolean live = restaurant.getStatus() == RestaurantStatus.ACTIVE
				|| restaurant.getStatus() == RestaurantStatus.TRIAL;
		boolean preview = !live && restaurant.getStatus() == RestaurantStatus.ONBOARDING
				&& canPreview(restaurant);
		if (!live && !preview) {
			throw new NotFoundException(UNAVAILABLE);
		}
		RestaurantTable table = TenantContext.callAs(restaurant.getId(),
				() -> tx.execute(s -> tables.findById(plate.getTableId())))
			.flatMap(t -> t.isActive() ? Optional.of(t) : Optional.empty())
			.orElseThrow(() -> new NotFoundException(UNAVAILABLE));
		return new ResolvedPlate(token, restaurant, table, preview);
	}

	private static boolean canPreview(Restaurant restaurant) {
		Optional<AuthenticatedUser> user = CurrentUser.find();
		return user.isPresent() && (user.get().role().isPlatform()
				|| restaurant.getId().equals(user.get().restaurantId()));
	}

}
