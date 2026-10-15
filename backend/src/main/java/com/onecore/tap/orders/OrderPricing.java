package com.onecore.tap.orders;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.products.MenuService.CatalogGroup;
import com.onecore.tap.products.MenuService.CatalogOption;
import com.onecore.tap.products.MenuService.CatalogProduct;

/**
 * Cálculo do pedido no servidor. O navegador envia só o que foi escolhido (produto, quantidade, opções); preços,
 * disponibilidade e regras de escolha vêm do cardápio atual do banco.
 */
final class OrderPricing {

	static final int MAX_ITEMS = 30;

	static final int MAX_QUANTITY = 50;

	static final long MAX_ORDER_CENTS = 10_000_000L;

	record ItemChoice(UUID productId, int quantity, String notes, List<UUID> optionIds) {
	}

	record PricedOption(String groupName, UUID optionId, String optionName, int priceCents) {
	}

	record PricedLine(UUID productId, String productName, int unitPriceCents, int quantity, String notes,
			List<PricedOption> options) {

		int totalCents() {
			return unitPriceCents * quantity;
		}
	}

	record PricedOrder(List<PricedLine> lines, int totalCents) {
	}

	private OrderPricing() {
	}

	static PricedOrder price(List<ItemChoice> items, Map<UUID, CatalogProduct> catalog) {
		if (items == null || items.isEmpty()) {
			throw new ConflictException("O pedido está vazio.");
		}
		if (items.size() > MAX_ITEMS) {
			throw new ConflictException("Envie no máximo " + MAX_ITEMS + " itens por pedido.");
		}
		List<PricedLine> lines = new ArrayList<>();
		long total = 0;
		for (ItemChoice item : items) {
			PricedLine line = priceLine(item, catalog);
			lines.add(line);
			total += (long) line.unitPriceCents() * line.quantity();
		}
		if (total > MAX_ORDER_CENTS) {
			throw new ConflictException("O valor do pedido passou do limite permitido. Divida em mais de um pedido.");
		}
		return new PricedOrder(lines, (int) total);
	}

	private static PricedLine priceLine(ItemChoice item, Map<UUID, CatalogProduct> catalog) {
		if (item.quantity() < 1 || item.quantity() > MAX_QUANTITY) {
			throw new ConflictException("A quantidade de cada item deve ficar entre 1 e " + MAX_QUANTITY + ".");
		}
		CatalogProduct product = catalog.get(item.productId());
		if (product == null) {
			throw new ConflictException("Um item do pedido não está mais no cardápio. Atualize a página.");
		}
		if (!product.orderable()) {
			throw new ConflictException(product.name() + " está indisponível no momento.");
		}
		List<UUID> chosen = item.optionIds() == null ? List.of() : item.optionIds();
		if (new HashSet<>(chosen).size() != chosen.size()) {
			throw new ConflictException("Há opções repetidas em " + product.name() + ".");
		}

		Map<UUID, CatalogGroup> groupOfOption = new HashMap<>();
		Map<UUID, CatalogOption> optionById = new HashMap<>();
		for (CatalogGroup group : product.groups()) {
			for (CatalogOption option : group.options()) {
				groupOfOption.put(option.id(), group);
				optionById.put(option.id(), option);
			}
		}

		Map<UUID, Integer> countByGroup = new HashMap<>();
		List<PricedOption> priced = new ArrayList<>();
		int unit = product.priceCents();
		for (UUID optionId : chosen) {
			CatalogOption option = optionById.get(optionId);
			if (option == null) {
				throw new ConflictException("Uma opção escolhida para " + product.name()
						+ " não está mais disponível. Atualize a página.");
			}
			if (!option.available()) {
				throw new ConflictException(option.name() + " está indisponível no momento.");
			}
			CatalogGroup group = groupOfOption.get(optionId);
			countByGroup.merge(group.id(), 1, Integer::sum);
			priced.add(new PricedOption(group.name(), option.id(), option.name(), option.priceCents()));
			unit += option.priceCents();
		}

		Set<UUID> seen = new HashSet<>();
		for (CatalogGroup group : product.groups()) {
			if (!seen.add(group.id())) {
				continue;
			}
			int count = countByGroup.getOrDefault(group.id(), 0);
			if (count < group.minChoices()) {
				throw new ConflictException(group.minChoices() == 1 ? "Escolha uma opção de " + group.name() + " em "
						+ product.name() + "." : "Escolha ao menos " + group.minChoices() + " opções de " + group.name()
								+ " em " + product.name() + ".");
			}
			if (count > group.maxChoices()) {
				throw new ConflictException("Escolha no máximo " + group.maxChoices() + " opções de " + group.name()
						+ " em " + product.name() + ".");
			}
		}
		String notes = item.notes() == null || item.notes().isBlank() ? null : item.notes().trim();
		return new PricedLine(product.id(), product.name(), unit, item.quantity(), notes, priced);
	}

}
