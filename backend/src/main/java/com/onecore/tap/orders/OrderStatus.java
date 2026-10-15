package com.onecore.tap.orders;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static java.util.Map.entry;

/**
 * Etapas do pedido. O backend é a fonte de verdade: só as transições listadas aqui são aceitas, não importa o que a
 * interface tenha movido.
 */
public enum OrderStatus {

	/** Feito pelo cardápio e aguardando a equipe confirmar (QR Code pode ter sido fotografado). */
	AWAITING_CONFIRMATION,
	/** Confirmado, na fila da cozinha. */
	NEW, IN_PREPARATION, READY, DELIVERED, COMPLETED, CANCELLED;

	private static final Map<OrderStatus, Set<OrderStatus>> NEXT = Map.ofEntries(
			entry(AWAITING_CONFIRMATION, EnumSet.of(NEW, CANCELLED)),
			entry(NEW, EnumSet.of(IN_PREPARATION, CANCELLED)),
			entry(IN_PREPARATION, EnumSet.of(READY, CANCELLED)),
			entry(READY, EnumSet.of(DELIVERED, CANCELLED)),
			entry(DELIVERED, EnumSet.of(COMPLETED, CANCELLED)),
			entry(COMPLETED, EnumSet.noneOf(OrderStatus.class)),
			entry(CANCELLED, EnumSet.noneOf(OrderStatus.class)));

	public boolean canMoveTo(OrderStatus target) {
		return NEXT.get(this).contains(target);
	}

	public boolean isFinal() {
		return this == COMPLETED || this == CANCELLED;
	}

	/** Etapas da cozinha: a equipe da cozinha só movimenta NEW -> IN_PREPARATION -> READY. */
	public boolean isKitchenStep(OrderStatus target) {
		return (this == NEW && target == IN_PREPARATION) || (this == IN_PREPARATION && target == READY);
	}

	public String label() {
		return switch (this) {
			case AWAITING_CONFIRMATION -> "Aguardando confirmação";
			case NEW -> "Novo";
			case IN_PREPARATION -> "Em preparo";
			case READY -> "Pronto";
			case DELIVERED -> "Entregue";
			case COMPLETED -> "Concluído";
			case CANCELLED -> "Cancelado";
		};
	}

}
