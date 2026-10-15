package com.onecore.tap.settings;

import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.config.AppProperties;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Parametros globais da plataforma. O preco da plaquinha nao fica fixo no codigo. */
@Tag(name = "Super Admin - Configurações")
@RestController
@RequestMapping("/api/admin/settings")
public class AdminSettingsController {

	static final String PLATE_PRICE = "plate_price_cents";

	static final String GRACE_DAYS = "billing_grace_days";

	private final JdbcTemplate jdbc;

	private final AppProperties props;

	private final AuditService audit;

	public AdminSettingsController(JdbcTemplate jdbc, AppProperties props, AuditService audit) {
		this.jdbc = jdbc;
		this.props = props;
		this.audit = audit;
	}

	public record SettingsView(int platePriceCents, String plateBaseUrl, int billingGraceDays) {
	}

	public record SettingsRequest(
			@NotNull(message = "Informe o preço") @Min(value = 0, message = "Valor inválido") @Max(value = 100_000, message = "Valor muito alto") Integer platePriceCents,
			@Min(value = 0, message = "Mínimo 0") @Max(value = 60, message = "Máximo 60 dias") Integer billingGraceDays) {
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	@Transactional(readOnly = true)
	public SettingsView get() {
		return new SettingsView(platePrice(), props.plates().publicBaseUrl(), graceDays());
	}

	@PutMapping
	@PreAuthorize("hasAuthority('PERM_PLATFORM_PLANS_MANAGE')")
	@Transactional
	public SettingsView update(@Valid @RequestBody SettingsRequest body, HttpServletRequest request) {
		int previous = platePrice();
		int previousGrace = graceDays();
		jdbc.update("update platform_settings set value = ?, updated_at = now() where key = ?",
				String.valueOf(body.platePriceCents()), PLATE_PRICE);
		int grace = body.billingGraceDays() == null ? previousGrace : body.billingGraceDays();
		jdbc.update("""
				insert into platform_settings (key, value) values (?, ?)
				on conflict (key) do update set value = excluded.value, updated_at = now()""", GRACE_DAYS, String.valueOf(grace));
		audit.record(AuditAction.SETTINGS_UPDATED, CurrentUser.require(), "settings", PLATE_PRICE, request,
				Map.of("previousPlatePriceCents", previous, "platePriceCents", body.platePriceCents(),
						"previousBillingGraceDays", previousGrace, "billingGraceDays", grace));
		return get();
	}

	private int graceDays() {
		String value = jdbc.query("select value from platform_settings where key = ?", rs -> rs.next() ? rs.getString(1) : null,
				GRACE_DAYS);
		return value == null ? 10 : Integer.parseInt(value);
	}

	private int platePrice() {
		String value = jdbc.queryForObject("select value from platform_settings where key = ?", String.class,
				PLATE_PRICE);
		return value == null ? 0 : Integer.parseInt(value);
	}

}
