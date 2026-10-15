package com.onecore.tap.plans;

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
import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Tag(name = "Super Admin - Planos")
@RestController
@RequestMapping("/api/admin/plans")
public class AdminPlanController {

	private final PlanRepository plans;

	private final AuditService audit;

	public AdminPlanController(PlanRepository plans, AuditService audit) {
		this.plans = plans;
		this.audit = audit;
	}

	public record PlanRequest(
			@Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "Use letras minúsculas, números e hífens") @Size(max = 40) String code,
			@NotBlank(message = "Informe o nome do plano") @Size(max = 80) String name,
			@Size(max = 300) String description,
			@NotNull(message = "Informe o valor mensal") @Min(value = 0, message = "Valor inválido") @Max(10_000_000) Integer monthlyPriceCents,
			@Min(value = 1, message = "Mínimo de 1 mesa") @Max(10_000) Integer maxTables,
			@Min(value = 1, message = "Mínimo de 1 usuário") @Max(10_000) Integer maxUsers,
			@NotNull @Min(0) @Max(value = 90, message = "Máximo de 90 dias") Integer trialDays,
			@Size(max = 20) List<@Size(max = 120) String> features, java.util.Set<PlanModule> modules, boolean active) {
	}

	public record PlanResponse(UUID id, String code, String name, String description, int monthlyPriceCents,
			Integer maxTables, Integer maxUsers, int trialDays, List<String> features, java.util.Set<PlanModule> modules,
			boolean active, long restaurantCount) {
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	@Transactional(readOnly = true)
	public List<PlanResponse> list() {
		return plans.findAllByOrderByMonthlyPriceCentsAsc().stream().map(this::toResponse).toList();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_PLANS_MANAGE')")
	@Transactional
	public PlanResponse create(@Valid @RequestBody PlanRequest body, HttpServletRequest request) {
		if (body.code() == null || body.code().isBlank()) {
			throw new ConflictException("Informe o código do plano.");
		}
		if (plans.existsByCode(body.code())) {
			throw new ConflictException("Já existe um plano com o código '" + body.code() + "'.");
		}
		Plan plan = new Plan(body.code());
		apply(plan, body);
		plans.saveAndFlush(plan);
		audit.record(AuditAction.PLAN_CREATED, CurrentUser.require(), "plan", plan.getId(), request,
				Map.of("code", plan.getCode(), "monthlyPriceCents", plan.getMonthlyPriceCents()));
		return toResponse(plan);
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_PLANS_MANAGE')")
	@Transactional
	public PlanResponse update(@PathVariable UUID id, @Valid @RequestBody PlanRequest body,
			HttpServletRequest request) {
		Plan plan = plans.findById(id).orElseThrow(() -> new NotFoundException("Plano não encontrado."));
		int previousPrice = plan.getMonthlyPriceCents();
		apply(plan, body);
		plans.flush();
		audit.record(AuditAction.PLAN_UPDATED, CurrentUser.require(), "plan", plan.getId(), request,
				Map.of("code", plan.getCode(), "previousPriceCents", previousPrice, "monthlyPriceCents",
						plan.getMonthlyPriceCents(), "active", plan.isActive()));
		return toResponse(plan);
	}

	private static void apply(Plan plan, PlanRequest body) {
		plan.update(body.name().trim(), blankToNull(body.description()), body.monthlyPriceCents(), body.maxTables(),
				body.maxUsers(), body.trialDays(), body.features() == null ? List.of() : body.features(), body.active());
		// Sem a lista, o plano mantém os módulos atuais (padrão: todos).
		if (body.modules() != null) {
			plan.changeModules(body.modules());
		}
	}

	private PlanResponse toResponse(Plan p) {
		return new PlanResponse(p.getId(), p.getCode(), p.getName(), p.getDescription(), p.getMonthlyPriceCents(),
				p.getMaxTables(), p.getMaxUsers(), p.getTrialDays(), p.featureList(), p.moduleSet(), p.isActive(),
				plans.countRestaurants(p.getId()));
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
