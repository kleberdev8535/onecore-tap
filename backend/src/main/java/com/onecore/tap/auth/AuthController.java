package com.onecore.tap.auth;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.auth.AuthDtos.CsrfResponse;
import com.onecore.tap.auth.AuthDtos.ForgotPasswordRequest;
import com.onecore.tap.auth.AuthDtos.LoginRequest;
import com.onecore.tap.auth.AuthDtos.MeResponse;
import com.onecore.tap.auth.AuthDtos.ResetPasswordRequest;
import com.onecore.tap.auth.AuthDtos.RestaurantSummary;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@Tag(name = "Autenticação")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

	private final PasswordResetService passwordResetService;

	private final RestaurantRepository restaurants;

	private final com.onecore.tap.plans.PlanFeatures planFeatures;

	public AuthController(AuthService authService, PasswordResetService passwordResetService,
			RestaurantRepository restaurants, com.onecore.tap.plans.PlanFeatures planFeatures) {
		this.planFeatures = planFeatures;
		this.authService = authService;
		this.passwordResetService = passwordResetService;
		this.restaurants = restaurants;
	}

	@Operation(summary = "Emite o token CSRF (também gravado no cookie XSRF-TOKEN)")
	@GetMapping("/csrf")
	public CsrfResponse csrf(CsrfToken token) {
		return new CsrfResponse(token.getHeaderName(), token.getToken());
	}

	@Operation(summary = "Login por e-mail e senha; cria a sessão em cookie HttpOnly")
	@PostMapping("/login")
	public MeResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request,
			HttpServletResponse response) {
		AuthenticatedUser user = authService.login(body.email(), body.password(), request, response);
		return toMe(user);
	}

	@Operation(summary = "Usuário da sessão atual")
	@GetMapping("/me")
	@Transactional(readOnly = true)
	public MeResponse me() {
		return toMe(CurrentUser.require());
	}

	@Operation(summary = "Solicita link de redefinição de senha")
	@PostMapping("/password/forgot")
	@ResponseStatus(HttpStatus.ACCEPTED)
	public void forgot(@Valid @RequestBody ForgotPasswordRequest body, HttpServletRequest request) {
		passwordResetService.requestReset(body.email(), request);
	}

	@Operation(summary = "Define nova senha a partir do token recebido por e-mail")
	@PostMapping("/password/reset")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void reset(@Valid @RequestBody ResetPasswordRequest body, HttpServletRequest request) {
		passwordResetService.resetPassword(body.token(), body.newPassword(), request);
	}

	@ExceptionHandler(LoginFailedException.class)
	ProblemDetail loginFailed(LoginFailedException ex, HttpServletResponse response) {
		ProblemDetail pd = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
		pd.setTitle(ex.getStatus().getReasonPhrase());
		return pd;
	}

	private MeResponse toMe(AuthenticatedUser user) {
		RestaurantSummary restaurant = user.restaurantId() == null ? null
				: restaurants.findById(user.restaurantId())
					.map(r -> new RestaurantSummary(r.getId(), r.getTradeName(), r.getSlug(), r.getStatus().name(),
							r.getLogoUrl(), r.getPrimaryColor()))
					.orElse(null);
		List<String> permissions = user.role().permissions().stream().map(Enum::name).sorted().toList();
		List<String> modules = user.restaurantId() == null ? List.of()
				: planFeatures.modulesOf(user.restaurantId()).stream().map(Enum::name).sorted().toList();
		return new MeResponse(user.id(), user.name(), user.email(), user.role(), permissions, restaurant, modules);
	}

}
