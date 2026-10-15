package com.onecore.tap.users;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
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
import com.onecore.tap.audit.AuditLog;
import com.onecore.tap.audit.AuditLogRepository;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;
import com.onecore.tap.users.StaffService.StaffInvite;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Tag(name = "Restaurante - Funcionários")
@RestController
@RequestMapping("/api/restaurant/staff")
public class RestaurantStaffController {

	private final StaffService staff;

	private final AuditLogRepository auditLogs;

	private final AuditService audit;

	public RestaurantStaffController(StaffService staff, AuditLogRepository auditLogs, AuditService audit) {
		this.staff = staff;
		this.auditLogs = auditLogs;
		this.audit = audit;
	}

	public record StaffView(UUID id, String name, String email, Role role, boolean active, boolean pendingInvite,
			Instant lastLoginAt, Instant createdAt) {

		static StaffView of(User u) {
			return new StaffView(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isActive(),
					u.getLastLoginAt() == null, u.getLastLoginAt(), u.getCreatedAt());
		}
	}

	public record InviteRequest(@NotBlank(message = "Informe o nome") @Size(max = 120) String name,
			@NotBlank(message = "Informe o e-mail") @Email(message = "E-mail inválido") @Size(max = 160) String email,
			@NotNull(message = "Selecione o perfil") Role role) {
	}

	public record UpdateRequest(@NotBlank(message = "Informe o nome") @Size(max = 120) String name,
			@NotNull(message = "Selecione o perfil") Role role) {
	}

	public record InviteResponse(StaffView user, String inviteLink, Instant expiresAt) {
	}

	public record ActivityView(UUID id, AuditAction action, String actorEmail, String details, Instant createdAt) {

		static ActivityView of(AuditLog a) {
			return new ActivityView(a.getId(), a.getAction(), a.getActorEmail(), a.getDetails(), a.getCreatedAt());
		}
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_STAFF_MANAGE')")
	public List<StaffView> list() {
		return staff.list(CurrentUser.requireRestaurantId()).stream().map(StaffView::of).toList();
	}

	@Operation(summary = "Cria o acesso do funcionário e devolve o link de convite (72h, uso único)")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_STAFF_MANAGE')")
	public InviteResponse invite(@Valid @RequestBody InviteRequest b, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		StaffInvite result = staff.invite(actor.restaurantId(), b.name(), b.email(), b.role());
		audit.record(AuditAction.STAFF_INVITED, actor, "user", result.user().getId(), request,
				Map.of("email", result.user().getEmail(), "role", b.role().name()));
		return response(result);
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_STAFF_MANAGE')")
	public StaffView update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest b, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		Role before = staff.get(actor.restaurantId(), id).getRole();
		User user = staff.update(actor.restaurantId(), actor.id(), id, b.name(), b.role());
		if (before != user.getRole()) {
			audit.record(AuditAction.STAFF_ROLE_CHANGED, actor, "user", id, request,
					Map.of("email", user.getEmail(), "from", before.name(), "to", user.getRole().name()));
		}
		return StaffView.of(user);
	}

	@PostMapping("/{id}/deactivate")
	@PreAuthorize("hasAuthority('PERM_STAFF_MANAGE')")
	public StaffView deactivate(@PathVariable UUID id, HttpServletRequest request) {
		return setActive(id, false, request);
	}

	@PostMapping("/{id}/activate")
	@PreAuthorize("hasAuthority('PERM_STAFF_MANAGE')")
	public StaffView activate(@PathVariable UUID id, HttpServletRequest request) {
		return setActive(id, true, request);
	}

	@PostMapping("/{id}/invite")
	@PreAuthorize("hasAuthority('PERM_STAFF_MANAGE')")
	public InviteResponse resendInvite(@PathVariable UUID id, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		StaffInvite result = staff.resendInvite(actor.restaurantId(), actor.id(), id);
		audit.record(AuditAction.INVITE_RESENT, actor, "user", id, request, Map.of("email", result.user().getEmail()));
		return response(result);
	}

	@Operation(summary = "Últimas ações do funcionário e alterações no acesso dele")
	@GetMapping("/{id}/activity")
	@PreAuthorize("hasAuthority('PERM_STAFF_MANAGE')")
	@Transactional(readOnly = true)
	public List<ActivityView> activity(@PathVariable UUID id) {
		UUID restaurantId = CurrentUser.requireRestaurantId();
		staff.get(restaurantId, id);
		return auditLogs.findStaffActivity(restaurantId, id, id.toString(), PageRequest.of(0, 50))
			.stream()
			.map(ActivityView::of)
			.toList();
	}

	private StaffView setActive(UUID id, boolean active, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		User user = staff.setActive(actor.restaurantId(), actor.id(), id, active);
		audit.record(active ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED, actor, "user", id, request,
				Map.of("email", user.getEmail()));
		return StaffView.of(user);
	}

	private static InviteResponse response(StaffInvite result) {
		return new InviteResponse(StaffView.of(result.user()), result.invite().link(), result.invite().expiresAt());
	}

}
