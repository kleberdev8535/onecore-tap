package com.onecore.tap.plates;

public enum PlateStatus {

	/** Em estoque, sem vinculo. */
	AVAILABLE,
	/** Separada para um restaurante, ainda sem mesa. */
	RESERVED,
	/** Vinculada a restaurante + mesa: o cardapio abre por ela. */
	ACTIVE,
	/** Vinculo mantido, mas o acesso publico esta bloqueado. */
	SUSPENDED,
	/** Fisicamente danificada; fora de uso ate inspecao. */
	DAMAGED,
	/** Baixa definitiva. Estado final. */
	DEACTIVATED;

	public boolean isBound() {
		return this == RESERVED || this == ACTIVE || this == SUSPENDED;
	}

}
