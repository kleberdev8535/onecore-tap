package com.onecore.tap.dashboard;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.plates.PlateDtos.InventoryCounts;
import com.onecore.tap.plates.PlateService;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.users.UserRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Indicadores globais da OneCore Business. Somente métricas que já existem no banco sao retornadas; receita,
 * assinaturas e plaquinhas entram quando esses módulos forem implementados (Fases 2 e 5).
 */
@Tag(name = "Super Admin - Visão geral")
@RestController
@RequestMapping("/api/admin/overview")
public class AdminOverviewController {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Sao_Paulo");

	private final RestaurantRepository restaurants;

	private final UserRepository users;

	private final PlateService plates;

	private final Clock clock;

	public AdminOverviewController(RestaurantRepository restaurants, UserRepository users, PlateService plates,
			Clock clock) {
		this.restaurants = restaurants;
		this.users = users;
		this.plates = plates;
		this.clock = clock;
	}

	public record RestaurantCounts(long total, long onboarding, long trial, long active, long suspended,
			long cancelled, long createdThisMonth) {
	}

	public record OverviewResponse(RestaurantCounts restaurants, long restaurantUsers, InventoryCounts plates,
			Instant generatedAt) {
	}

	@Operation(summary = "Indicadores globais da plataforma")
	@GetMapping
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	@Transactional(readOnly = true)
	public OverviewResponse overview() {
		Instant monthStart = ZonedDateTime.now(clock.withZone(BUSINESS_ZONE))
			.withDayOfMonth(1)
			.toLocalDate()
			.atStartOfDay(BUSINESS_ZONE)
			.toInstant();
		RestaurantCounts counts = new RestaurantCounts(restaurants.count(),
				restaurants.countByStatus(RestaurantStatus.ONBOARDING), restaurants.countByStatus(RestaurantStatus.TRIAL),
				restaurants.countByStatus(RestaurantStatus.ACTIVE),
				restaurants.countByStatus(RestaurantStatus.SUSPENDED),
				restaurants.countByStatus(RestaurantStatus.CANCELLED), restaurants.countByCreatedAtGreaterThanEqual(monthStart));
		return new OverviewResponse(counts, users.countByRestaurantIdIsNotNull(), plates.counts(), clock.instant());
	}

}
