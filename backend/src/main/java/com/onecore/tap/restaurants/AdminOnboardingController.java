package com.onecore.tap.restaurants;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.plans.Plan;
import com.onecore.tap.restaurants.OnboardingService.OwnerInvite;
import com.onecore.tap.restaurants.OnboardingService.StatusAction;
import com.onecore.tap.restaurants.RestaurantDtos.RestaurantDetail;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;
import com.onecore.tap.tables.RestaurantTable;
import com.onecore.tap.tables.RestaurantTableRepository;
import com.onecore.tap.tables.TableService;
import com.onecore.tap.users.UserRepository;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Tag(name = "Super Admin - Implantação")
@RestController
@RequestMapping("/api/admin/restaurants/{id}")
public class AdminOnboardingController {

	private static final String HEX = "^#[0-9A-Fa-f]{6}$";

	private final OnboardingService onboarding;

	private final TableService tableService;

	private final RestaurantTableRepository tables;

	private final UserRepository users;

	private final AuditService audit;

	public AdminOnboardingController(OnboardingService onboarding, TableService tableService,
			RestaurantTableRepository tables, UserRepository users, AuditService audit) {
		this.onboarding = onboarding;
		this.tableService = tableService;
		this.tables = tables;
		this.users = users;
		this.audit = audit;
	}

	public record UpdateDetailsRequest(@NotBlank(message = "Informe o nome comercial") @Size(max = 120) String tradeName,
			@Size(max = 160) String legalName,
			@Pattern(regexp = "^[0-9]{14}$", message = "CNPJ deve ter 14 dígitos") String cnpj,
			@Email(message = "E-mail inválido") @Size(max = 160) String email,
			@Pattern(regexp = "^[0-9]{10,11}$", message = "Telefone deve ter DDD + número") String phone,
			@Size(max = 200) String addressLine, @Size(max = 100) String city,
			@Pattern(regexp = "^[A-Z]{2}$", message = "UF inválida") String state,
			@Pattern(regexp = "^[0-9]{8}$", message = "CEP deve ter 8 dígitos") String postalCode) {
	}

	public record BrandingRequest(
			@Size(max = 500) @Pattern(regexp = "^(https://\\S+)?$", message = "Use um endereço https://") String logoUrl,
			@NotBlank @Pattern(regexp = HEX, message = "Cor inválida") String primaryColor,
			@NotBlank @Pattern(regexp = HEX, message = "Cor inválida") String accentColor) {
	}

	public record PlanRequest(@NotNull(message = "Selecione um plano") UUID planId) {
	}

	public record OwnerRequest(@NotBlank(message = "Informe o nome") @Size(max = 120) String name,
			@NotBlank(message = "Informe o e-mail") @Email(message = "E-mail inválido") @Size(max = 160) String email) {
	}

	public record OwnerInviteResponse(UUID userId, String name, String email, String inviteLink,
			java.time.Instant expiresAt) {
	}

	public record TablesRequest(@Size(max = 200) List<@Size(max = 20) String> labels,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 999, message = "Máximo 999") Integer from,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 999, message = "Máximo 999") Integer to,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 100, message = "Máximo 100") Integer capacity) {
	}

	public record TableView(UUID id, String label, Integer capacity, boolean active) {

		static TableView of(RestaurantTable t) {
			return new TableView(t.getId(), t.getLabel(), t.getCapacity(), t.isActive());
		}
	}

	public record StatusRequest(@NotNull(message = "Informe a ação") StatusAction action,
			@Size(max = 300) String reason) {
	}

	@GetMapping("/onboarding")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public OnboardingService.Onboarding get(@PathVariable UUID id) {
		return onboarding.onboarding(id);
	}

	@PutMapping("/details")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	public RestaurantDetail updateDetails(@PathVariable UUID id, @Valid @RequestBody UpdateDetailsRequest b,
			HttpServletRequest request) {
		Restaurant r = onboarding.updateDetails(id, b.tradeName(), b.legalName(), b.cnpj(), b.email(), b.phone(),
				b.addressLine(), b.city(), b.state(), b.postalCode());
		audit.record(AuditAction.RESTAURANT_UPDATED, CurrentUser.require(), "restaurant", id, request,
				Map.of("tradeName", r.getTradeName()));
		return RestaurantDetail.of(r, users.countByRestaurantId(id));
	}

	@PutMapping("/branding")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	public RestaurantDetail updateBranding(@PathVariable UUID id, @Valid @RequestBody BrandingRequest b,
			HttpServletRequest request) {
		Restaurant r = onboarding.updateBranding(id, b.logoUrl(), b.primaryColor(), b.accentColor());
		audit.record(AuditAction.RESTAURANT_BRANDING_UPDATED, CurrentUser.require(), "restaurant", id, request,
				Map.of("primaryColor", r.getPrimaryColor(), "accentColor", r.getAccentColor()));
		return RestaurantDetail.of(r, users.countByRestaurantId(id));
	}

	@PutMapping("/plan")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	public OnboardingService.Onboarding assignPlan(@PathVariable UUID id, @Valid @RequestBody PlanRequest b,
			HttpServletRequest request) {
		Plan plan = onboarding.assignPlan(id, b.planId());
		audit.record(AuditAction.RESTAURANT_PLAN_CHANGED, CurrentUser.require(), "restaurant", id, request,
				Map.of("plan", plan.getCode()));
		return onboarding.onboarding(id);
	}

	@PostMapping("/owner")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	public OwnerInviteResponse inviteOwner(@PathVariable UUID id, @Valid @RequestBody OwnerRequest b,
			HttpServletRequest request) {
		OwnerInvite result = onboarding.inviteOwner(id, b.name(), b.email());
		audit.record(AuditAction.OWNER_INVITED, CurrentUser.require(), "user", result.user().getId(), request,
				Map.of("restaurantId", id.toString(), "email", result.user().getEmail()));
		return new OwnerInviteResponse(result.user().getId(), result.user().getName(), result.user().getEmail(),
				result.invite().link(), result.invite().expiresAt());
	}

	@GetMapping("/tables")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	@Transactional(readOnly = true)
	public List<TableView> listTables(@PathVariable UUID id) {
		return tables.findAllOfRestaurant(id).stream().map(TableView::of).toList();
	}

	/** Aceita uma lista de nomes ou um intervalo numerico (ex.: de 1 a 12). Sem @Transactional: usa TenantContext. */
	@PostMapping("/tables")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	public List<TableView> createTables(@PathVariable UUID id, @Valid @RequestBody TablesRequest b,
			HttpServletRequest request) {
		List<String> labels = TableService.expand(b.labels(), b.from(), b.to());
		List<RestaurantTable> created = tableService.create(id, labels, b.capacity());
		AuthenticatedUser actor = CurrentUser.require();
		Map<String, Object> details = new HashMap<>();
		details.put("count", created.size());
		details.put("labels", created.stream().map(RestaurantTable::getLabel).toList());
		audit.record(AuditAction.TABLE_CREATED, actor, "restaurant", id, request, details);
		return created.stream().map(TableView::of).toList();
	}

	@PostMapping("/status")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	public RestaurantDetail changeStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest b,
			HttpServletRequest request) {
		Restaurant r = onboarding.changeStatus(id, b.action(), b.reason());
		Map<String, Object> details = new HashMap<>();
		details.put("action", b.action().name());
		details.put("status", r.getStatus().name());
		if (b.reason() != null && !b.reason().isBlank()) {
			details.put("reason", b.reason().trim());
		}
		audit.record(AuditAction.RESTAURANT_STATUS_CHANGED, CurrentUser.require(), "restaurant", id, request, details);
		return RestaurantDetail.of(r, users.countByRestaurantId(id));
	}

}
