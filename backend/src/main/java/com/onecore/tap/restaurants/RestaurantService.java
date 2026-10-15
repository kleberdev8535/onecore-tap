package com.onecore.tap.restaurants;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.restaurants.RestaurantDtos.CreateRestaurantRequest;

@Service
public class RestaurantService {

	private final RestaurantRepository restaurants;

	public RestaurantService(RestaurantRepository restaurants) {
		this.restaurants = restaurants;
	}

	@Transactional(readOnly = true)
	public Page<Restaurant> search(String search, RestaurantStatus status, Pageable pageable) {
		String term = search == null || search.isBlank() ? null : "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
		return restaurants.search(term, status, pageable);
	}

	@Transactional(readOnly = true)
	public Restaurant get(UUID id) {
		return restaurants.findById(id).orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
	}

	@Transactional
	public Restaurant create(CreateRestaurantRequest req) {
		String slug = req.slug() == null || req.slug().isBlank() ? uniqueSlug(slugify(req.tradeName())) : req.slug();
		if (restaurants.existsBySlug(slug)) {
			throw new ConflictException("Já existe um restaurante com o identificador '" + slug + "'.");
		}
		if (req.cnpj() != null && restaurants.existsByCnpj(req.cnpj())) {
			throw new ConflictException("Já existe um restaurante com este CNPJ.");
		}
		Restaurant restaurant = new Restaurant(slug, req.tradeName().trim());
		restaurant.updateDetails(blankToNull(req.legalName()), req.cnpj(), blankToNull(req.email()), req.phone(),
				blankToNull(req.addressLine()), blankToNull(req.city()), req.state(), req.postalCode());
		return restaurants.save(restaurant);
	}

	private String uniqueSlug(String base) {
		String candidate = base.isEmpty() ? "restaurante" : base;
		int suffix = 2;
		while (restaurants.existsBySlug(candidate)) {
			candidate = base + "-" + suffix++;
		}
		return candidate;
	}

	static String slugify(String value) {
		String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
		String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
		return slug.length() > 70 ? slug.substring(0, 70).replaceAll("-$", "") : slug;
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
