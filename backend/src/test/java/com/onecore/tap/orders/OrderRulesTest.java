package com.onecore.tap.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.orders.OrderPricing.ItemChoice;
import com.onecore.tap.products.MenuService.CatalogGroup;
import com.onecore.tap.products.MenuService.CatalogOption;
import com.onecore.tap.products.MenuService.CatalogProduct;
import com.onecore.tap.restaurants.OpeningHours;
import com.onecore.tap.restaurants.OpeningHours.Range;

class OrderRulesTest {

	final UUID pizza = UUID.randomUUID();

	final CatalogOption small = new CatalogOption(UUID.randomUUID(), "Broto", 0, true);

	final CatalogOption large = new CatalogOption(UUID.randomUUID(), "Grande", 2500, true);

	final CatalogOption catupiry = new CatalogOption(UUID.randomUUID(), "Catupiry", 800, true);

	final CatalogOption cheddar = new CatalogOption(UUID.randomUUID(), "Cheddar", 900, false);

	final Map<UUID, CatalogProduct> catalog = Map.of(pizza, new CatalogProduct(pizza, "Calabresa", 4000, true,
			List.of(new CatalogGroup(UUID.randomUUID(), "Tamanho", 1, 1, List.of(small, large)),
					new CatalogGroup(UUID.randomUUID(), "Borda", 0, 1, List.of(catupiry, cheddar)))));

	@Test
	void pricesItemsFromCatalog() {
		var priced = OrderPricing.price(List.of(new ItemChoice(pizza, 3, " bem assada ", List.of(large.id(), catupiry.id()))),
				catalog);
		assertThat(priced.totalCents()).isEqualTo((4000 + 2500 + 800) * 3);
		assertThat(priced.lines().get(0).notes()).isEqualTo("bem assada");
	}

	@Test
	void rejectsInvalidChoices() {
		assertThatThrownBy(() -> OrderPricing.price(List.of(new ItemChoice(pizza, 1, null, List.of())), catalog))
			.isInstanceOf(ConflictException.class).hasMessageContaining("Escolha uma opção de Tamanho");
		assertThatThrownBy(() -> OrderPricing.price(
				List.of(new ItemChoice(pizza, 1, null, List.of(small.id(), cheddar.id()))), catalog))
			.hasMessageContaining("Cheddar está indisponível");
		assertThatThrownBy(() -> OrderPricing.price(
				List.of(new ItemChoice(pizza, 1, null, List.of(small.id(), small.id()))), catalog))
			.hasMessageContaining("repetidas");
		assertThatThrownBy(() -> OrderPricing.price(
				List.of(new ItemChoice(pizza, 51, null, List.of(small.id()))), catalog))
			.hasMessageContaining("quantidade");
		assertThatThrownBy(() -> OrderPricing.price(
				List.of(new ItemChoice(UUID.randomUUID(), 1, null, List.of())), catalog))
			.hasMessageContaining("não está mais no cardápio");
		assertThatThrownBy(() -> OrderPricing.price(List.of(), catalog)).hasMessageContaining("vazio");
	}

	@Test
	void statusMachineOnlyAllowsForwardStepsAndCancellation() {
		assertThat(OrderStatus.AWAITING_CONFIRMATION.canMoveTo(OrderStatus.NEW)).isTrue();
		assertThat(OrderStatus.AWAITING_CONFIRMATION.canMoveTo(OrderStatus.READY)).isFalse();
		assertThat(OrderStatus.READY.canMoveTo(OrderStatus.IN_PREPARATION)).isFalse();
		assertThat(OrderStatus.COMPLETED.canMoveTo(OrderStatus.CANCELLED)).isFalse();
		assertThat(OrderStatus.DELIVERED.canMoveTo(OrderStatus.CANCELLED)).isTrue();
		assertThat(OrderStatus.NEW.isKitchenStep(OrderStatus.IN_PREPARATION)).isTrue();
		assertThat(OrderStatus.READY.isKitchenStep(OrderStatus.DELIVERED)).isFalse();
	}

	@Test
	void openingHoursHandleOvernightRanges() {
		// 2026-10-17 é sábado (6); 2026-10-18 é domingo (7).
		List<Range> ranges = List.of(new Range(6, LocalTime.of(18, 0), LocalTime.of(2, 0)),
				new Range(7, LocalTime.of(11, 30), LocalTime.of(15, 0)));
		assertThat(OpeningHours.isOpen(ranges, at("2026-10-17T19:00"))).isTrue();
		assertThat(OpeningHours.isOpen(ranges, at("2026-10-18T01:30"))).isTrue();
		assertThat(OpeningHours.isOpen(ranges, at("2026-10-18T02:00"))).isFalse();
		assertThat(OpeningHours.isOpen(ranges, at("2026-10-18T12:00"))).isTrue();
		assertThat(OpeningHours.isOpen(ranges, at("2026-10-17T17:59"))).isFalse();
		assertThat(OpeningHours.isOpen(List.of(), at("2026-10-17T04:00"))).isTrue();
	}

	private static ZonedDateTime at(String local) {
		return java.time.LocalDateTime.parse(local).atZone(OpeningHours.BUSINESS_ZONE);
	}

}
