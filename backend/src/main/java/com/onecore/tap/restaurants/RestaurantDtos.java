package com.onecore.tap.restaurants;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class RestaurantDtos {

	private RestaurantDtos() {
	}

	public record CreateRestaurantRequest(
			@NotBlank(message = "Informe o nome comercial") @Size(max = 120) String tradeName,
			@Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$",
					message = "Use apenas letras minúsculas, números e hífens") @Size(max = 80) String slug,
			@Size(max = 160) String legalName,
			@Pattern(regexp = "^[0-9]{14}$", message = "CNPJ deve ter 14 digitos") String cnpj,
			@Email(message = "E-mail invalido") @Size(max = 160) String email,
			@Pattern(regexp = "^[0-9]{10,11}$", message = "Telefone deve ter DDD + numero") String phone,
			@Size(max = 200) String addressLine, @Size(max = 100) String city,
			@Pattern(regexp = "^[A-Z]{2}$", message = "UF invalida") String state,
			@Pattern(regexp = "^[0-9]{8}$", message = "CEP deve ter 8 digitos") String postalCode) {
	}

	public record RestaurantListItem(UUID id, String tradeName, String slug, String city, String state,
			RestaurantStatus status, Instant createdAt) {

		static RestaurantListItem of(Restaurant r) {
			return new RestaurantListItem(r.getId(), r.getTradeName(), r.getSlug(), r.getCity(), r.getState(),
					r.getStatus(), r.getCreatedAt());
		}
	}

	public record RestaurantDetail(UUID id, String tradeName, String slug, String legalName, String cnpj, String email,
			String phone, String addressLine, String city, String state, String postalCode, String logoUrl,
			String primaryColor, String accentColor, RestaurantStatus status, long userCount, Instant createdAt) {

		static RestaurantDetail of(Restaurant r, long userCount) {
			return new RestaurantDetail(r.getId(), r.getTradeName(), r.getSlug(), r.getLegalName(), r.getCnpj(),
					r.getEmail(), r.getPhone(), r.getAddressLine(), r.getCity(), r.getState(), r.getPostalCode(),
					r.getLogoUrl(), r.getPrimaryColor(), r.getAccentColor(), r.getStatus(), userCount,
					r.getCreatedAt());
		}
	}

}
