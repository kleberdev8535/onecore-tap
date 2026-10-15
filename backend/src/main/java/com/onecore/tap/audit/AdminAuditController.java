package com.onecore.tap.audit;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.common.PageResponse;
import com.onecore.tap.restaurants.RestaurantRepository;

import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Super Admin - Auditoria")
@RestController
@RequestMapping("/api/admin/audit")
public class AdminAuditController {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Sao_Paulo");

	private final AuditLogRepository logs;

	private final RestaurantRepository restaurants;

	public AdminAuditController(AuditLogRepository logs, RestaurantRepository restaurants) {
		this.logs = logs;
		this.restaurants = restaurants;
	}

	public record AuditView(UUID id, AuditAction action, String actorEmail, UUID restaurantId, String restaurantName,
			String entityType, String entityId, String ipAddress, String details, Instant createdAt) {
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_PLATFORM_AUDIT_VIEW')")
	@Transactional(readOnly = true)
	public PageResponse<AuditView> list(@RequestParam(required = false) AuditAction action,
			@RequestParam(required = false) String actor, @RequestParam(required = false) UUID restaurantId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
			@RequestParam(defaultValue = "0") int page) {
		Specification<AuditLog> spec = (root, q, cb) -> cb.conjunction();
		if (action != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("action"), action));
		}
		if (actor != null && !actor.isBlank()) {
			String term = "%" + actor.trim().toLowerCase(Locale.ROOT) + "%";
			spec = spec.and((root, q, cb) -> cb.like(cb.lower(root.get("actorEmail")), term));
		}
		if (restaurantId != null) {
			spec = spec.and((root, q, cb) -> cb.or(cb.equal(root.get("restaurantId"), restaurantId),
					cb.equal(root.get("entityId"), restaurantId.toString())));
		}
		if (from != null) {
			Instant start = from.atStartOfDay(BUSINESS_ZONE).toInstant();
			spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), start));
		}
		if (to != null) {
			Instant end = to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
			spec = spec.and((root, q, cb) -> cb.lessThan(root.get("createdAt"), end));
		}
		Page<AuditLog> result = logs.findAll(spec,
				PageRequest.of(Math.max(page, 0), 50, Sort.by(Sort.Direction.DESC, "createdAt")));
		Set<UUID> ids = result.getContent().stream().map(AuditLog::getRestaurantId).collect(Collectors.toSet());
		ids.remove(null);
		Map<UUID, String> names = new HashMap<>();
		restaurants.findAllById(ids).forEach(r -> names.put(r.getId(), r.getTradeName()));
		return PageResponse.of(result,
				l -> new AuditView(l.getId(), l.getAction(), l.getActorEmail(), l.getRestaurantId(),
						names.get(l.getRestaurantId()), l.getEntityType(), l.getEntityId(), l.getIpAddress(),
						l.getDetails(), l.getCreatedAt()));
	}

}
