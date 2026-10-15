package com.onecore.tap.tables;

import java.util.UUID;

import org.hibernate.annotations.TenantId;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "restaurant_tables")
public class RestaurantTable extends BaseEntity {

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(nullable = false, length = 20)
	private String label;

	private Integer capacity;

	@Column(nullable = false)
	private boolean active = true;

	protected RestaurantTable() {
	}

	public RestaurantTable(String label, Integer capacity) {
		this.label = label;
		this.capacity = capacity;
	}

	public void update(String label, Integer capacity, boolean active) {
		this.label = label;
		this.capacity = capacity;
		this.active = active;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public String getLabel() {
		return label;
	}

	public Integer getCapacity() {
		return capacity;
	}

	public boolean isActive() {
		return active;
	}

}
