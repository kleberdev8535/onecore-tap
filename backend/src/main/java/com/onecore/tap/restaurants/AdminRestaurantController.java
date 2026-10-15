package com.onecore.tap.restaurants;

import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.common.PageResponse;
import com.onecore.tap.restaurants.RestaurantDtos.CreateRestaurantRequest;
import com.onecore.tap.restaurants.RestaurantDtos.RestaurantDetail;
import com.onecore.tap.restaurants.RestaurantDtos.RestaurantListItem;
import com.onecore.tap.security.CurrentUser;
import com.onecore.tap.users.UserRepository;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@Tag(name = "Super Admin - Restaurantes")
@RestController
@RequestMapping("/api/admin/restaurants")
public class AdminRestaurantController {

	private final RestaurantService service;

	private final UserRepository users;

	private final AuditService audit;

	public AdminRestaurantController(RestaurantService service, UserRepository users, AuditService audit) {
		this.service = service;
		this.users = users;
		this.audit = audit;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public PageResponse<RestaurantListItem> list(@RequestParam(required = false) String search,
			@RequestParam(required = false) RestaurantStatus status, @RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100),
				Sort.by(Sort.Direction.DESC, "createdAt"));
		return PageResponse.of(service.search(search, status, pageable), RestaurantListItem::of);
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public RestaurantDetail get(@PathVariable UUID id) {
		Restaurant restaurant = service.get(id);
		return RestaurantDetail.of(restaurant, users.countByRestaurantId(id));
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	public RestaurantDetail create(@Valid @RequestBody CreateRestaurantRequest body, HttpServletRequest request) {
		Restaurant created = service.create(body);
		audit.record(AuditAction.RESTAURANT_CREATED, CurrentUser.require(), "restaurant", created.getId(), request,
				java.util.Map.of("tradeName", created.getTradeName(), "slug", created.getSlug()));
		return RestaurantDetail.of(created, 0);
	}

}
