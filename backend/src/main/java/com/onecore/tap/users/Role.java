package com.onecore.tap.users;

import static com.onecore.tap.security.Permission.*;

import java.util.EnumSet;
import java.util.Set;

import com.onecore.tap.security.Permission;

public enum Role {

	SUPER_ADMIN(EnumSet.of(PLATFORM_VIEW, PLATFORM_RESTAURANTS_MANAGE, PLATFORM_PLATES_MANAGE, PLATFORM_PLANS_MANAGE,
			PLATFORM_AUDIT_VIEW, PLATFORM_BILLING_MANAGE)),

	RESTAURANT_OWNER(EnumSet.of(DASHBOARD_VIEW, ORDERS_VIEW, ORDERS_MANAGE, KITCHEN_OPERATE, MENU_VIEW, MENU_MANAGE,
			TABLES_VIEW, TABLES_MANAGE, STAFF_MANAGE, FINANCE_VIEW, PAYMENTS_REGISTER, SETTINGS_MANAGE)),

	RESTAURANT_MANAGER(EnumSet.of(DASHBOARD_VIEW, ORDERS_VIEW, ORDERS_MANAGE, KITCHEN_OPERATE, MENU_VIEW, MENU_MANAGE,
			TABLES_VIEW, TABLES_MANAGE, FINANCE_VIEW, PAYMENTS_REGISTER)),

	CASHIER(EnumSet.of(ORDERS_VIEW, TABLES_VIEW, MENU_VIEW, FINANCE_VIEW, PAYMENTS_REGISTER)),

	WAITER(EnumSet.of(ORDERS_VIEW, ORDERS_MANAGE, TABLES_VIEW, MENU_VIEW)),

	KITCHEN(EnumSet.of(ORDERS_VIEW, KITCHEN_OPERATE));

	private final Set<Permission> permissions;

	Role(Set<Permission> permissions) {
		this.permissions = permissions;
	}

	public Set<Permission> permissions() {
		return permissions;
	}

	public boolean isPlatform() {
		return this == SUPER_ADMIN;
	}

}
