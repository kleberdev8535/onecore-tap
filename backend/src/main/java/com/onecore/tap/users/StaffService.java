package com.onecore.tap.users;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.auth.PasswordResetService;
import com.onecore.tap.auth.PasswordResetService.Invite;
import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.plans.PlanRepository;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.restaurants.RestaurantStatus;

/**
 * Equipe do restaurante, gerenciada pelo proprietário. Usuários não têm @TenantId (o login precisa achá-los antes
 * de conhecer o restaurante), por isso toda consulta aqui filtra explicitamente pelo restaurante da sessão,
 * recebido do controller a partir do usuário autenticado e nunca do cliente.
 */
@Service
public class StaffService {

	/** Perfis que o proprietário pode atribuir. O proprietário é criado somente pela OneCore Business. */
	public static final Set<Role> ASSIGNABLE = EnumSet.of(Role.RESTAURANT_MANAGER, Role.CASHIER, Role.WAITER,
			Role.KITCHEN);

	public record StaffInvite(User user, Invite invite) {
	}

	private final UserRepository users;

	private final RestaurantRepository restaurants;

	private final PlanRepository plans;

	private final PasswordResetService passwords;

	private final PasswordEncoder passwordEncoder;

	StaffService(UserRepository users, RestaurantRepository restaurants, PlanRepository plans,
			PasswordResetService passwords, PasswordEncoder passwordEncoder) {
		this.users = users;
		this.restaurants = restaurants;
		this.plans = plans;
		this.passwords = passwords;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional(readOnly = true)
	public List<User> list(UUID restaurantId) {
		return users.findByRestaurantIdOrderByCreatedAtAsc(restaurantId);
	}

	@Transactional(readOnly = true)
	public User get(UUID restaurantId, UUID userId) {
		return member(restaurantId, userId);
	}

	@Transactional
	public StaffInvite invite(UUID restaurantId, String name, String email, Role role) {
		requireAssignable(role);
		Restaurant restaurant = restaurant(restaurantId);
		if (restaurant.getStatus() == RestaurantStatus.CANCELLED) {
			throw new ConflictException("Restaurante cancelado não recebe novos acessos.");
		}
		if (users.existsByEmailIgnoreCase(email.trim())) {
			throw new ConflictException("Este e-mail já está em uso por outro acesso.");
		}
		requireSeat(restaurant);
		User user = users.saveAndFlush(new User(restaurantId, name.trim(), email,
				passwordEncoder.encode(UnusablePassword.random()), role));
		return new StaffInvite(user, passwords.issueInvite(user, restaurant.getTradeName()));
	}

	/** Mudar o perfil encerra as sessões abertas da pessoa (revalidação a cada requisição). */
	@Transactional
	public User update(UUID restaurantId, UUID actorId, UUID userId, String name, Role role) {
		User user = editable(restaurantId, actorId, userId);
		requireAssignable(role);
		user.rename(name.trim());
		user.changeRole(role);
		users.flush();
		return user;
	}

	@Transactional
	public User setActive(UUID restaurantId, UUID actorId, UUID userId, boolean active) {
		User user = editable(restaurantId, actorId, userId);
		if (active && !user.isActive()) {
			requireSeat(restaurant(restaurantId));
		}
		user.setActive(active);
		users.flush();
		return user;
	}

	@Transactional
	public StaffInvite resendInvite(UUID restaurantId, UUID actorId, UUID userId) {
		User user = editable(restaurantId, actorId, userId);
		if (!user.isActive()) {
			throw new ConflictException("Reative o acesso antes de enviar um novo convite.");
		}
		return new StaffInvite(user, passwords.issueInvite(user, restaurant(restaurantId).getTradeName()));
	}

	private User editable(UUID restaurantId, UUID actorId, UUID userId) {
		User user = member(restaurantId, userId);
		if (user.getId().equals(actorId)) {
			throw new ConflictException("Você não pode alterar o seu próprio acesso por esta tela.");
		}
		if (user.getRole() == Role.RESTAURANT_OWNER) {
			throw new ConflictException("O acesso do proprietário é gerenciado pela OneCore Business.");
		}
		return user;
	}

	private void requireSeat(Restaurant restaurant) {
		if (restaurant.getPlanId() == null) {
			return;
		}
		plans.findById(restaurant.getPlanId()).ifPresent(plan -> {
			long active = users.countByRestaurantIdAndActiveTrue(restaurant.getId());
			if (plan.getMaxUsers() != null && active >= plan.getMaxUsers()) {
				throw new ConflictException("O plano " + plan.getName() + " permite até " + plan.getMaxUsers()
						+ " usuários ativos. Desative um acesso ou fale com a OneCore Business para mudar de plano.");
			}
		});
	}

	private static void requireAssignable(Role role) {
		if (!ASSIGNABLE.contains(role)) {
			throw new ConflictException("Perfil não permitido para funcionários.");
		}
	}

	/** Usuário de outro restaurante responde como inexistente. */
	private User member(UUID restaurantId, UUID userId) {
		return users.findByIdAndRestaurantId(userId, restaurantId)
			.orElseThrow(() -> new NotFoundException("Funcionário não encontrado."));
	}

	private Restaurant restaurant(UUID id) {
		return restaurants.findById(id).orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
	}

}
