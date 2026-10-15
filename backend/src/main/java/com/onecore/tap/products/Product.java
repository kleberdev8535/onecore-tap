package com.onecore.tap.products;

import java.util.UUID;

import org.hibernate.annotations.TenantId;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Item do cardápio. O preço guardado aqui é a referência atual; os pedidos (Fase 4) gravam o preço praticado no
 * momento da compra e nunca confiam no valor enviado pelo navegador.
 */
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

	@TenantId
	@Column(name = "restaurant_id", nullable = false, updatable = false)
	private UUID restaurantId;

	@Column(name = "category_id", nullable = false)
	private UUID categoryId;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(length = 500)
	private String description;

	@Column(name = "price_cents", nullable = false)
	private int priceCents;

	@Column(name = "image_url", length = 500)
	private String imageUrl;

	/** Visível no cardápio. */
	@Column(nullable = false)
	private boolean active = true;

	/** false = esgotado: continua visível, mas não pode ser pedido. */
	@Column(nullable = false)
	private boolean available = true;

	@Column(nullable = false)
	private boolean featured;

	@Column(nullable = false)
	private int position;

	protected Product() {
	}

	public Product(UUID categoryId, int position) {
		this.categoryId = categoryId;
		this.position = position;
	}

	public void update(UUID categoryId, String name, String description, int priceCents, String imageUrl,
			boolean active, boolean available, boolean featured) {
		this.categoryId = categoryId;
		this.name = name;
		this.description = description;
		this.priceCents = priceCents;
		this.imageUrl = imageUrl;
		this.active = active;
		this.available = available;
		this.featured = featured;
	}

	public void setAvailable(boolean available) {
		this.available = available;
	}

	public void moveTo(int position) {
		this.position = position;
	}

	public UUID getRestaurantId() {
		return restaurantId;
	}

	public UUID getCategoryId() {
		return categoryId;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public int getPriceCents() {
		return priceCents;
	}

	public String getImageUrl() {
		return imageUrl;
	}

	public boolean isActive() {
		return active;
	}

	public boolean isAvailable() {
		return available;
	}

	public boolean isFeatured() {
		return featured;
	}

	public int getPosition() {
		return position;
	}

}
