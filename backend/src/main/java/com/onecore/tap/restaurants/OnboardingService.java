package com.onecore.tap.restaurants;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.auth.PasswordResetService;
import com.onecore.tap.auth.PasswordResetService.Invite;
import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.plans.Plan;
import com.onecore.tap.plans.PlanRepository;
import com.onecore.tap.plates.PlateService;
import com.onecore.tap.users.Role;
import com.onecore.tap.users.UnusablePassword;
import com.onecore.tap.users.User;
import com.onecore.tap.users.UserRepository;

/**
 * Implantacao de um restaurante pela OneCore Business: dados, identidade, plano, proprietario e ativacao.
 * O checklist e calculado a partir dos dados reais, nunca marcado manualmente.
 */
@Service
public class OnboardingService {

	public enum StatusAction {
		ACTIVATE, START_TRIAL, SUSPEND, CANCEL
	}

	public record Step(String key, String label, boolean done, boolean available, String detail) {
	}

	public record PlanRef(UUID id, String name, int monthlyPriceCents, Integer maxTables, int trialDays) {
	}

	public record OwnerRef(UUID id, String name, String email, boolean active, Instant lastLoginAt) {
	}

	public record Onboarding(List<Step> steps, int done, int total, boolean readyToActivate, List<String> missing,
			PlanRef plan, OwnerRef owner, long tableCount, long activePlateCount, long categoryCount,
			long productCount, Instant trialEndsAt, Instant activatedAt, String statusReason) {
	}

	private final RestaurantRepository restaurants;

	private final PlanRepository plans;

	private final UserRepository users;

	private final PlateService plates;

	private final PasswordResetService passwords;

	private final PasswordEncoder passwordEncoder;

	private final JdbcTemplate jdbc;

	private final Clock clock;

	/** Assinatura acompanha o ciclo de vida do restaurante (teste, ativação, troca de plano, cancelamento). */
	private final com.onecore.tap.billing.BillingService billing;

	public OnboardingService(RestaurantRepository restaurants, PlanRepository plans, UserRepository users,
			PlateService plates, PasswordResetService passwords, PasswordEncoder passwordEncoder, JdbcTemplate jdbc,
			Clock clock, com.onecore.tap.billing.BillingService billing) {
		this.billing = billing;
		this.restaurants = restaurants;
		this.plans = plans;
		this.users = users;
		this.plates = plates;
		this.passwords = passwords;
		this.passwordEncoder = passwordEncoder;
		this.jdbc = jdbc;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public Onboarding onboarding(UUID restaurantId) {
		Restaurant r = get(restaurantId);
		PlanRef plan = r.getPlanId() == null ? null
				: plans.findById(r.getPlanId())
					.map(p -> new PlanRef(p.getId(), p.getName(), p.getMonthlyPriceCents(), p.getMaxTables(),
							p.getTrialDays()))
					.orElse(null);
		OwnerRef owner = users.findFirstByRestaurantIdAndRoleOrderByCreatedAtAsc(restaurantId, Role.RESTAURANT_OWNER)
			.map(u -> new OwnerRef(u.getId(), u.getName(), u.getEmail(), u.isActive(), u.getLastLoginAt()))
			.orElse(null);
		// Contagens via SQL direto por restaurant_id: o Super Admin opera com tenant ROOT.
		long tableCount = count("select count(*) from restaurant_tables where restaurant_id = ? and active", restaurantId);
		long categoryCount = count("select count(*) from categories where restaurant_id = ?", restaurantId);
		long orderCount = count("select count(*) from orders where restaurant_id = ?", restaurantId);
		long productCount = count("select count(*) from products where restaurant_id = ? and active", restaurantId);
		long activePlates = plates.activeCountOf(restaurantId);
		boolean live = r.getStatus() == RestaurantStatus.ACTIVE || r.getStatus() == RestaurantStatus.TRIAL;

		List<Step> steps = List.of(new Step("details", "Dados comerciais", true, true, null),
				new Step("branding", "Identidade visual", r.getBrandingConfiguredAt() != null, true, null),
				new Step("plan", "Plano", plan != null, true, plan == null ? null : plan.name()),
				new Step("owner", "Usuário proprietário", owner != null, true, owner == null ? null : owner.email()),
				new Step("tables", "Mesas", tableCount > 0, true, tableCount + " cadastradas"),
				new Step("menu", "Cardápio", productCount > 0, true,
						categoryCount + " categorias, " + productCount + " produtos ativos"),
				new Step("plates", "Plaquinhas vinculadas", activePlates > 0, true, activePlates + " ativas"),
				new Step("test_order", "Pedido de teste", orderCount > 0, true,
						orderCount > 0 ? orderCount + " pedidos registrados" : "Abra a URL de uma plaquinha logado e faça um pedido"),
				new Step("activation", "Ativação", live, true, null));

		List<String> missing = new ArrayList<>();
		if (plan == null) {
			missing.add("Defina um plano.");
		}
		if (owner == null) {
			missing.add("Convide o usuário proprietário.");
		}
		if (tableCount == 0) {
			missing.add("Cadastre ao menos uma mesa.");
		}
		if (activePlates == 0) {
			missing.add("Vincule ao menos uma plaquinha a uma mesa.");
		}
		int done = (int) steps.stream().filter(Step::done).count();
		return new Onboarding(steps, done, steps.size(), missing.isEmpty(), missing, plan, owner, tableCount,
				activePlates, categoryCount, productCount, r.getTrialEndsAt(), r.getActivatedAt(), r.getStatusReason());
	}

	@Transactional
	public Restaurant updateDetails(UUID id, String tradeName, String legalName, String cnpj, String email,
			String phone, String addressLine, String city, String state, String postalCode) {
		Restaurant r = get(id);
		if (cnpj != null && !cnpj.equals(r.getCnpj()) && restaurants.existsByCnpj(cnpj)) {
			throw new ConflictException("Já existe um restaurante com este CNPJ.");
		}
		r.updateTradeName(tradeName.trim());
		r.updateDetails(blank(legalName), cnpj, blank(email), phone, blank(addressLine), blank(city), state, postalCode);
		restaurants.flush();
		return r;
	}

	@Transactional
	public Restaurant updateBranding(UUID id, String logoUrl, String primaryColor, String accentColor) {
		Restaurant r = get(id);
		r.updateBranding(blank(logoUrl), primaryColor.toUpperCase(Locale.ROOT), accentColor.toUpperCase(Locale.ROOT),
				clock.instant());
		restaurants.flush();
		return r;
	}

	@Transactional
	public Plan assignPlan(UUID id, UUID planId) {
		Restaurant r = get(id);
		Plan plan = plans.findById(planId).orElseThrow(() -> new NotFoundException("Plano não encontrado."));
		if (!plan.isActive()) {
			throw new ConflictException("O plano " + plan.getName() + " está inativo.");
		}
		long tables = count("select count(*) from restaurant_tables where restaurant_id = ? and active", id);
		if (plan.getMaxTables() != null && tables > plan.getMaxTables()) {
			throw new ConflictException("O restaurante tem " + tables + " mesas e o plano " + plan.getName()
					+ " permite " + plan.getMaxTables() + ".");
		}
		long activeUsers = users.countByRestaurantIdAndActiveTrue(id);
		if (plan.getMaxUsers() != null && activeUsers > plan.getMaxUsers()) {
			throw new ConflictException("O restaurante tem " + activeUsers + " usuários ativos e o plano permite "
					+ plan.getMaxUsers() + ".");
		}
		r.assignPlan(plan.getId());
		restaurants.flush();
		billing.onPlanChanged(id, plan, com.onecore.tap.security.CurrentUser.find().orElse(null));
		return plan;
	}

	public record OwnerInvite(User user, Invite invite) {
	}

	@Transactional
	public OwnerInvite inviteOwner(UUID id, String name, String email) {
		Restaurant r = get(id);
		if (r.getStatus() == RestaurantStatus.CANCELLED) {
			throw new ConflictException("Restaurante cancelado não recebe novos acessos.");
		}
		if (users.findFirstByRestaurantIdAndRoleOrderByCreatedAtAsc(id, Role.RESTAURANT_OWNER).isPresent()) {
			throw new ConflictException("Este restaurante já tem um proprietário. Reenvie o convite pela tela de usuários.");
		}
		if (users.existsByEmailIgnoreCase(email.trim())) {
			throw new ConflictException("Este e-mail já está em uso por outro acesso.");
		}
		// Senha aleatoria descartada: o acesso so e liberado quando o proprietario define a senha pelo convite.
		String unusable = passwordEncoder.encode(UnusablePassword.random());
		User owner = users.saveAndFlush(new User(id, name.trim(), email, unusable, Role.RESTAURANT_OWNER));
		return new OwnerInvite(owner, passwords.issueInvite(owner, r.getTradeName()));
	}

	@Transactional
	public Restaurant changeStatus(UUID id, StatusAction action, String reason) {
		Restaurant r = get(id);
		Instant now = clock.instant();
		String cleanReason = blank(reason);
		RestaurantStatus current = r.getStatus();
		switch (action) {
			case ACTIVATE -> {
				require(current == RestaurantStatus.ONBOARDING || current == RestaurantStatus.TRIAL
						|| current == RestaurantStatus.SUSPENDED, current, "ativar");
				requireReady(id);
				r.changeStatus(RestaurantStatus.ACTIVE, null, now);
				r.clearBillingSuspension();
				billing.onActivated(r, current);
			}
			case START_TRIAL -> {
				require(current == RestaurantStatus.ONBOARDING, current, "iniciar o teste de");
				requireReady(id);
				Plan plan = plans.findById(r.getPlanId()).orElseThrow();
				if (plan.getTrialDays() == 0) {
					throw new ConflictException("O plano " + plan.getName() + " não tem período de teste.");
				}
				r.startTrial(now.plus(Duration.ofDays(plan.getTrialDays())));
				billing.onTrialStarted(r, r.getTrialEndsAt());
			}
			case SUSPEND -> {
				require(current == RestaurantStatus.ACTIVE || current == RestaurantStatus.TRIAL, current, "suspender");
				requireReason(cleanReason);
				r.changeStatus(RestaurantStatus.SUSPENDED, cleanReason, now);
			}
			case CANCEL -> {
				require(current != RestaurantStatus.CANCELLED, current, "cancelar");
				requireReason(cleanReason);
				r.changeStatus(RestaurantStatus.CANCELLED, cleanReason, now);
				r.clearBillingSuspension();
				billing.onCancelled(id, cleanReason);
			}
			default -> throw new IllegalStateException(action.name());
		}
		restaurants.flush();
		return r;
	}

	private void requireReady(UUID id) {
		Onboarding o = onboarding(id);
		if (!o.readyToActivate()) {
			throw new ConflictException("Implantação incompleta: " + String.join(" ", o.missing()));
		}
	}

	private static void require(boolean ok, RestaurantStatus current, String action) {
		if (!ok) {
			throw new ConflictException("Não é possível " + action + " um restaurante com status " + current + ".");
		}
	}

	private static void requireReason(String reason) {
		if (reason == null) {
			throw new ConflictException("Informe o motivo.");
		}
	}

	private Restaurant get(UUID id) {
		return restaurants.findById(id).orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
	}

	private long count(String sql, UUID restaurantId) {
		Long value = jdbc.queryForObject(sql, Long.class, restaurantId);
		return value == null ? 0 : value;
	}

	private static String blank(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
