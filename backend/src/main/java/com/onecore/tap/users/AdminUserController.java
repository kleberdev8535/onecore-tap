package com.onecore.tap.users;

import java.time.Instant;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.auth.PasswordResetService;
import com.onecore.tap.auth.PasswordResetService.Invite;
import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.common.PageResponse;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

@Tag(name = "Super Admin - Usuários")
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

	private final UserRepository users;

	private final RestaurantRepository restaurants;

	private final PasswordResetService passwords;

	private final AuditService audit;

	public AdminUserController(UserRepository users, RestaurantRepository restaurants, PasswordResetService passwords,
			AuditService audit) {
		this.users = users;
		this.restaurants = restaurants;
		this.passwords = passwords;
		this.audit = audit;
	}

	public record UserView(UUID id, String name, String email, Role role, boolean active, UUID restaurantId,
			String restaurantName, Instant lastLoginAt, Instant createdAt) {
	}

	public record InviteResponse(UserView user, String inviteLink, Instant expiresAt) {
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	@Transactional(readOnly = true)
	public PageResponse<UserView> list(@RequestParam(required = false) String search,
			@RequestParam(required = false) Role role, @RequestParam(required = false) UUID restaurantId,
			@RequestParam(required = false) Boolean active, @RequestParam(defaultValue = "0") int page) {
		Specification<User> spec = (root, q, cb) -> cb.conjunction();
		if (role != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("role"), role));
		}
		if (restaurantId != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("restaurantId"), restaurantId));
		}
		if (active != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("active"), active));
		}
		if (search != null && !search.isBlank()) {
			String term = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
			spec = spec.and((root, q, cb) -> cb.or(cb.like(cb.lower(root.get("name")), term),
					cb.like(cb.lower(root.get("email")), term)));
		}
		Page<User> result = users.findAll(spec,
				PageRequest.of(Math.max(page, 0), 25, Sort.by(Sort.Direction.DESC, "createdAt")));
		Map<UUID, String> names = restaurantNames(
				result.getContent().stream().map(User::getRestaurantId).collect(Collectors.toSet()));
		return PageResponse.of(result, u -> toView(u, names.get(u.getRestaurantId())));
	}

	@PostMapping("/{id}/invite")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	@Transactional
	public InviteResponse resendInvite(@PathVariable UUID id, HttpServletRequest request) {
		User user = users.findById(id).orElseThrow(() -> new NotFoundException("Usuário não encontrado."));
		if (user.getRole().isPlatform()) {
			throw new ConflictException("Acessos da OneCore Business não são gerenciados por convite.");
		}
		if (!user.isActive()) {
			throw new ConflictException("Reative o usuário antes de enviar um novo convite.");
		}
		String restaurantName = restaurants.findById(user.getRestaurantId()).map(Restaurant::getTradeName).orElse("");
		Invite invite = passwords.issueInvite(user, restaurantName);
		audit.record(AuditAction.INVITE_RESENT, CurrentUser.require(), "user", user.getId(), request,
				Map.of("email", user.getEmail()));
		return new InviteResponse(toView(user, restaurantName), invite.link(), invite.expiresAt());
	}

	@PostMapping("/{id}/deactivate")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	@Transactional
	public UserView deactivate(@PathVariable UUID id, HttpServletRequest request) {
		return setActive(id, false, request);
	}

	@PostMapping("/{id}/activate")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_RESTAURANTS_MANAGE')")
	@Transactional
	public UserView activate(@PathVariable UUID id, HttpServletRequest request) {
		return setActive(id, true, request);
	}

	private UserView setActive(UUID id, boolean active, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		User user = users.findById(id).orElseThrow(() -> new NotFoundException("Usuário não encontrado."));
		if (user.getId().equals(actor.id())) {
			throw new ConflictException("Você não pode desativar o seu próprio acesso.");
		}
		if (user.getRole().isPlatform()) {
			throw new ConflictException("Acessos de Super Admin não podem ser alterados por esta tela.");
		}
		user.setActive(active);
		users.flush();
		audit.record(active ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED, actor, "user", user.getId(),
				request, Map.of("email", user.getEmail()));
		return toView(user, restaurants.findById(user.getRestaurantId()).map(Restaurant::getTradeName).orElse(null));
	}

	private Map<UUID, String> restaurantNames(Set<UUID> ids) {
		ids.remove(null);
		Map<UUID, String> names = new HashMap<>();
		restaurants.findAllById(ids).forEach(r -> names.put(r.getId(), r.getTradeName()));
		return names;
	}

	static UserView toView(User u, String restaurantName) {
		return new UserView(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isActive(), u.getRestaurantId(),
				restaurantName, u.getLastLoginAt(), u.getCreatedAt());
	}

}
