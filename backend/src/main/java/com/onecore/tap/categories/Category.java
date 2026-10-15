package com.onecore.tap.categories;

import java.util.UUID;

import org.hibernate.annotations.TenantId;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "categories")
public class Category extends BaseEntity {

	/** Preenchido e filtrado pelo Hibernate a partir do tenant da sessão. Nunca atribuido manualmente. */
	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(nullable = false, length = 80)
	private String name;

	@Column(length = 200)
	private String description;

	@Column(nullable = false)
	private int position;

	@Column(nullable = false)
	private boolean active = true;

	protected Category() {
	}

	public Category(String name, int position) {
		this.name = name;
		this.position = position;
	}

	public void update(String name, String description, boolean active) {
		this.name = name;
		this.description = description;
		this.active = active;
	}

	public void moveTo(int position) {
		this.position = position;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public int getPosition() {
		return position;
	}

	public boolean isActive() {
		return active;
	}

}
