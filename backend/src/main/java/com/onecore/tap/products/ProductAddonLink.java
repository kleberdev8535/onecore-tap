package com.onecore.tap.products;

import java.util.UUID;

import org.hibernate.annotations.TenantId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Grupo de adicionais exibido em um produto, na ordem definida pelo restaurante. */
@Entity
@Table(name = "product_addon_groups")
public class ProductAddonLink {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(name = "product_id", nullable = false, updatable = false)
	private UUID productId;

	@Column(name = "addon_group_id", nullable = false, updatable = false)
	private UUID addonGroupId;

	@Column(nullable = false)
	private int position;

	protected ProductAddonLink() {
	}

	public ProductAddonLink(UUID productId, UUID addonGroupId, int position) {
		this.productId = productId;
		this.addonGroupId = addonGroupId;
		this.position = position;
	}

	public UUID getProductId() {
		return productId;
	}

	public UUID getAddonGroupId() {
		return addonGroupId;
	}

}
