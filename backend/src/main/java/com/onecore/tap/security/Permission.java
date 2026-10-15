package com.onecore.tap.security;

/**
 * Permissoes granulares. Os endpoints checam permissoes, não perfis, assim os perfis podem evoluir sem espalhar
 * regras pelo código.
 */
public enum Permission {

	// Plataforma (OneCore Business)
	PLATFORM_VIEW, PLATFORM_RESTAURANTS_MANAGE, PLATFORM_PLATES_MANAGE, PLATFORM_PLANS_MANAGE, PLATFORM_AUDIT_VIEW,
	PLATFORM_BILLING_MANAGE,

	// Restaurante
	DASHBOARD_VIEW, ORDERS_VIEW, ORDERS_MANAGE, KITCHEN_OPERATE, MENU_VIEW, MENU_MANAGE, TABLES_VIEW, TABLES_MANAGE,
	STAFF_MANAGE, FINANCE_VIEW, PAYMENTS_REGISTER, SETTINGS_MANAGE;

	public String authority() {
		return "PERM_" + name();
	}

}
