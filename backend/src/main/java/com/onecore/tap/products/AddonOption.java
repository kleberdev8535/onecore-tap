package com.onecore.tap.products;

import java.util.UUID;

import org.hibernate.annotations.TenantId;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "addon_options")
public class AddonOption extends BaseEntity {

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(name = "group_id", nullable = false, updatable = false)
	private UUID groupId;

	@Column(nullable = false, length = 80)
	private String name;

	@Column(name = "price_cents", nullable = false)
	private int priceCents;

	@Column(nullable = false)
	private boolean available = true;

	@Column(nullable = false)
	private int position;

	protected AddonOption() {
	}

	public AddonOption(UUID groupId) {
		this.groupId = groupId;
	}

	public void update(String name, int priceCents, boolean available, int position) {
		this.name = name;
		this.priceCents = priceCents;
		this.available = available;
		this.position = position;
	}

	public UUID getGroupId() {
		return groupId;
	}

	public String getName() {
		return name;
	}

	public int getPriceCents() {
		return priceCents;
	}

	public boolean isAvailable() {
		return available;
	}

	public int getPosition() {
		return position;
	}

}
