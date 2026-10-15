package com.onecore.tap.products;

import java.util.UUID;

import org.hibernate.annotations.TenantId;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Grupo de adicionais ou de variação. Variação (ex.: Tamanho) é um grupo de escolha obrigatória e única
 * (min = max = 1); adicionais (ex.: Bacon, Queijo extra) têm mínimo zero.
 */
@Entity
@Table(name = "addon_groups")
public class AddonGroup extends BaseEntity {

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(nullable = false, length = 80)
	private String name;

	@Column(name = "min_choices", nullable = false)
	private int minChoices;

	@Column(name = "max_choices", nullable = false)
	private int maxChoices = 1;

	@Column(nullable = false)
	private int position;

	protected AddonGroup() {
	}

	public AddonGroup(int position) {
		this.position = position;
	}

	public void update(String name, int minChoices, int maxChoices) {
		this.name = name;
		this.minChoices = minChoices;
		this.maxChoices = maxChoices;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public String getName() {
		return name;
	}

	public int getMinChoices() {
		return minChoices;
	}

	public int getMaxChoices() {
		return maxChoices;
	}

	public int getPosition() {
		return position;
	}

}
