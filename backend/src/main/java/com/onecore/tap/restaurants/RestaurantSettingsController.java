package com.onecore.tap.restaurants;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.plans.PlanRepository;
import com.onecore.tap.restaurants.RestaurantSettingsService.Hour;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

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

@Tag(name = "Restaurante - Personalização e configurações")
@RestController
@RequestMapping("/api/restaurant/settings")
public class RestaurantSettingsController {

	private static final String HEX = "^#[0-9A-Fa-f]{6}$";

	private static final String HTTPS_URL = "^(https://\\S+)?$";

	private final RestaurantSettingsService settings;

	private final PlanRepository plans;

	private final AuditService audit;

	public RestaurantSettingsController(RestaurantSettingsService settings, PlanRepository plans, AuditService audit) {
		this.settings = settings;
		this.plans = plans;
		this.audit = audit;
	}

	public record HourView(int weekday, LocalTime opensAt, LocalTime closesAt) {

		static HourView of(OpeningHour h) {
			return new HourView(h.getWeekday(), h.getOpensAt(), h.getClosesAt());
		}
	}

	public record PlanView(String name, Integer maxTables, Integer maxUsers) {
	}

	public record SettingsView(UUID id, String tradeName, String legalName, String cnpj, String slug,
			RestaurantStatus status, String email, String phone, String addressLine, String city, String state,
			String postalCode, String description, String logoUrl, String coverImageUrl, String primaryColor,
			String accentColor, boolean requireOrderConfirmation, List<HourView> openingHours, PlanView plan) {
	}

	public record ContactRequest(@Email(message = "E-mail inválido") @Size(max = 160) String email,
			@Pattern(regexp = "^[0-9]{10,11}$", message = "Telefone deve ter DDD + número") String phone,
			@Size(max = 200) String addressLine, @Size(max = 100) String city,
			@Pattern(regexp = "^[A-Z]{2}$", message = "UF inválida") String state,
			@Pattern(regexp = "^[0-9]{8}$", message = "CEP deve ter 8 dígitos") String postalCode,
			@Size(max = 300, message = "Use até 300 caracteres") String description) {
	}

	public record BrandingRequest(
			@Size(max = 500) @Pattern(regexp = HTTPS_URL, message = "Use um endereço https://") String logoUrl,
			@Size(max = 500) @Pattern(regexp = HTTPS_URL, message = "Use um endereço https://") String coverImageUrl,
			@NotBlank @Pattern(regexp = HEX, message = "Cor inválida") String primaryColor,
			@NotBlank @Pattern(regexp = HEX, message = "Cor inválida") String accentColor) {
	}

	public record HourRequest(@Min(value = 1, message = "Dia inválido") @Max(value = 7, message = "Dia inválido") int weekday,
			@NotNull(message = "Informe a abertura") LocalTime opensAt,
			@NotNull(message = "Informe o fechamento") LocalTime closesAt) {
	}

	public record HoursRequest(@NotNull @Size(max = 21, message = "Use até 21 faixas") List<@Valid HourRequest> hours) {
	}

	public record OperationRequest(@NotNull(message = "Informe a opção") Boolean requireOrderConfirmation) {
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_SETTINGS_MANAGE')")
	@Transactional(readOnly = true)
	public SettingsView get() {
		return view(settings.get(CurrentUser.requireRestaurantId()));
	}

	@PutMapping("/contact")
	@PreAuthorize("hasAuthority('PERM_SETTINGS_MANAGE')")
	public SettingsView updateContact(@Valid @RequestBody ContactRequest b, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		Restaurant r = settings.updateContact(actor.restaurantId(), b.email(), b.phone(), b.addressLine(), b.city(),
				b.state(), b.postalCode(), b.description());
		audit.record(AuditAction.RESTAURANT_SETTINGS_UPDATED, actor, "restaurant", r.getId(), request,
				Map.of("section", "contact"));
		return view(r);
	}

	@PutMapping("/branding")
	@PreAuthorize("hasAuthority('PERM_SETTINGS_MANAGE')")
	public SettingsView updateBranding(@Valid @RequestBody BrandingRequest b, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		Restaurant r = settings.updateBranding(actor.restaurantId(), b.logoUrl(), b.coverImageUrl(), b.primaryColor(),
				b.accentColor());
		audit.record(AuditAction.RESTAURANT_BRANDING_UPDATED, actor, "restaurant", r.getId(), request,
				Map.of("primaryColor", r.getPrimaryColor(), "accentColor", r.getAccentColor()));
		return view(r);
	}

	@PutMapping("/hours")
	@PreAuthorize("hasAuthority('PERM_SETTINGS_MANAGE')")
	public SettingsView updateHours(@Valid @RequestBody HoursRequest b, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		settings.replaceHours(b.hours().stream().map(h -> new Hour(h.weekday(), h.opensAt(), h.closesAt())).toList());
		audit.record(AuditAction.RESTAURANT_HOURS_UPDATED, actor, "restaurant", actor.restaurantId(), request,
				Map.of("ranges", b.hours().size()));
		return view(settings.get(actor.restaurantId()));
	}

	@PutMapping("/operation")
	@PreAuthorize("hasAuthority('PERM_SETTINGS_MANAGE')")
	public SettingsView updateOperation(@Valid @RequestBody OperationRequest b, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		Restaurant r = settings.updateOperation(actor.restaurantId(), b.requireOrderConfirmation());
		audit.record(AuditAction.RESTAURANT_SETTINGS_UPDATED, actor, "restaurant", r.getId(), request,
				Map.of("section", "operation", "requireOrderConfirmation", r.isRequireOrderConfirmation()));
		return view(r);
	}

	private SettingsView view(Restaurant r) {
		PlanView plan = r.getPlanId() == null ? null
				: plans.findById(r.getPlanId())
					.map(p -> new PlanView(p.getName(), p.getMaxTables(), p.getMaxUsers()))
					.orElse(null);
		return new SettingsView(r.getId(), r.getTradeName(), r.getLegalName(), r.getCnpj(), r.getSlug(),
				r.getStatus(), r.getEmail(), r.getPhone(), r.getAddressLine(), r.getCity(), r.getState(),
				r.getPostalCode(), r.getDescription(), r.getLogoUrl(), r.getCoverImageUrl(), r.getPrimaryColor(),
				r.getAccentColor(), r.isRequireOrderConfirmation(),
				settings.hours().stream().map(HourView::of).toList(), plan);
	}

}
