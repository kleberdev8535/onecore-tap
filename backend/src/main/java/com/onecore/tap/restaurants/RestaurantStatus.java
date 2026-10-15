package com.onecore.tap.restaurants;

public enum RestaurantStatus {

	/** Cadastro em implantação: ainda não recebe pedidos publicos. */
	ONBOARDING,
	/** Período de teste. */
	TRIAL, ACTIVE, SUSPENDED, CANCELLED;

	public boolean allowsStaffLogin() {
		return this != SUSPENDED && this != CANCELLED;
	}

}
