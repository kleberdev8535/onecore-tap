package com.onecore.tap.auth;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.IpRateLimiter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Service
public class AuthService {

	static final String INVALID_CREDENTIALS = "E-mail ou senha inválidos.";

	private final AuthenticationManager authenticationManager;

	private final SecurityContextRepository contextRepository;

	private final LoginAttemptService attempts;

	private final IpRateLimiter ipLimiter;

	private final AuditService audit;

	public AuthService(AuthenticationManager authenticationManager, SecurityContextRepository contextRepository,
			LoginAttemptService attempts, IpRateLimiter loginRateLimiter, AuditService audit) {
		this.authenticationManager = authenticationManager;
		this.contextRepository = contextRepository;
		this.attempts = attempts;
		this.ipLimiter = loginRateLimiter;
		this.audit = audit;
	}

	public AuthenticatedUser login(String email, String password, HttpServletRequest request,
			HttpServletResponse response) {
		String normalizedEmail = email.trim().toLowerCase();
		if (!ipLimiter.tryAcquire("login:" + request.getRemoteAddr())) {
			audit.recordAnonymous(AuditAction.LOGIN_BLOCKED, normalizedEmail, request, Map.of("reason", "ip_rate_limit"));
			throw new LoginFailedException(HttpStatus.TOO_MANY_REQUESTS,
					"Muitas tentativas a partir desta rede. Aguarde alguns minutos e tente novamente.");
		}

		Authentication authentication;
		try {
			authentication = authenticationManager
				.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(normalizedEmail, password));
		}
		catch (LockedException ex) {
			audit.recordAnonymous(AuditAction.LOGIN_BLOCKED, normalizedEmail, request, Map.of("reason", "account_locked"));
			throw new LoginFailedException(HttpStatus.TOO_MANY_REQUESTS,
					"Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente mais tarde ou redefina sua senha.");
		}
		catch (DisabledException ex) {
			audit.recordAnonymous(AuditAction.LOGIN_FAILED, normalizedEmail, request, Map.of("reason", "disabled"));
			throw new LoginFailedException(HttpStatus.FORBIDDEN,
					"Este acesso está desativado. Fale com o responsável pelo estabelecimento.");
		}
		catch (BadCredentialsException ex) {
			attempts.registerFailure(normalizedEmail);
			audit.recordAnonymous(AuditAction.LOGIN_FAILED, normalizedEmail, request, Map.of("reason", "bad_credentials"));
			throw new LoginFailedException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
		}

		AuthenticatedUser user = ((AuthenticatedUser) authentication.getPrincipal()).withoutCredentials();
		Authentication sessionAuth = UsernamePasswordAuthenticationToken.authenticated(user, null,
				user.getAuthorities());

		// Nova sessão a cada login (proteção contra session fixation).
		if (request.getSession(false) != null) {
			request.changeSessionId();
		}
		SecurityContext context = SecurityContextHolder.createEmptyContext();
		context.setAuthentication(sessionAuth);
		SecurityContextHolder.setContext(context);
		contextRepository.saveContext(context, request, response);

		attempts.registerSuccess(user.id());
		audit.record(AuditAction.LOGIN_SUCCEEDED, user, "user", user.id(), request);
		return user;
	}

}
