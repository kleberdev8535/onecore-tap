package com.onecore.tap.billing;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.billing.BillingService.SubscriptionDetail;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;

/** O proprietário consulta a própria assinatura e cobranças (somente leitura). */
@Tag(name = "Restaurante - Assinatura")
@RestController
@RequestMapping("/api/restaurant/subscription")
public class RestaurantSubscriptionController {

	private final BillingService billing;

	public RestaurantSubscriptionController(BillingService billing) {
		this.billing = billing;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_SETTINGS_MANAGE')")
	public ResponseEntity<SubscriptionDetail> mine() {
		return billing.detail(CurrentUser.requireRestaurantId())
			.map(ResponseEntity::ok)
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

}
