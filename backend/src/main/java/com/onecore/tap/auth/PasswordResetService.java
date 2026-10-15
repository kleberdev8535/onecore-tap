package com.onecore.tap.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.config.AppProperties;
import com.onecore.tap.security.IpRateLimiter;
import com.onecore.tap.users.User;
import com.onecore.tap.users.UserRepository;

import jakarta.servlet.http.HttpServletRequest;

@Service
public class PasswordResetService {

	private static final SecureRandom RANDOM = new SecureRandom();

	private static final java.time.Duration INVITE_TTL = java.time.Duration.ofHours(72);

	private final UserRepository users;

	private final PasswordResetTokenRepository tokens;

	private final PasswordEncoder passwordEncoder;

	private final MailGateway mail;

	private final AuditService audit;

	private final AppProperties props;

	private final IpRateLimiter ipLimiter;

	private final Clock clock;

	public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens,
			PasswordEncoder passwordEncoder, MailGateway mail, AuditService audit, AppProperties props,
			IpRateLimiter loginRateLimiter, Clock clock) {
		this.users = users;
		this.tokens = tokens;
		this.passwordEncoder = passwordEncoder;
		this.mail = mail;
		this.audit = audit;
		this.props = props;
		this.ipLimiter = loginRateLimiter;
		this.clock = clock;
	}

	/** Resposta sempre identica, exista ou não o e-mail, para não revelar contas cadastradas. */
	@Transactional
	public void requestReset(String email, HttpServletRequest request) {
		if (!ipLimiter.tryAcquire("reset:" + request.getRemoteAddr())) {
			throw new LoginFailedException(HttpStatus.TOO_MANY_REQUESTS,
					"Muitas solicitações. Aguarde alguns minutos e tente novamente.");
		}
		users.findByEmail(email.trim()).filter(User::isActive).ifPresent(user -> {
			String rawToken = newToken();
			tokens.save(new PasswordResetToken(user.getId(), sha256(rawToken),
					clock.instant().plus(props.security().passwordResetTtl())));
			String link = props.appUrl() + "/redefinir-senha?token=" + rawToken;
			mail.send(user.getEmail(), "OneCore Tap - redefinição de senha", """
					Olá, %s.

					Recebemos um pedido para redefinir a sua senha na OneCore Tap.
					Use o link abaixo em até %d minutos:

					%s

					Se você não fez este pedido, ignore este e-mail.
					""".formatted(user.getName(), props.security().passwordResetTtl().toMinutes(), link));
			audit.recordAnonymous(AuditAction.PASSWORD_RESET_REQUESTED, user.getEmail(), request, null);
		});
	}

	@Transactional
	public void resetPassword(String rawToken, String newPassword, HttpServletRequest request) {
		Instant now = clock.instant();
		PasswordResetToken token = tokens.findByTokenHash(sha256(rawToken))
			.filter(t -> t.isUsable(now))
			.orElseThrow(() -> new LoginFailedException(HttpStatus.BAD_REQUEST,
					"Este link de redefinição é inválido ou expirou. Solicite um novo."));
		User user = users.findById(token.getUserId())
			.orElseThrow(() -> new LoginFailedException(HttpStatus.BAD_REQUEST, "Link inválido."));
		user.changePassword(passwordEncoder.encode(newPassword));
		tokens.invalidateAllForUser(user.getId(), now);
		audit.recordAnonymous(token.isInvite() ? AuditAction.INVITE_ACCEPTED : AuditAction.PASSWORD_RESET_COMPLETED,
				user.getEmail(), request, null);
	}

	public record Invite(String link, Instant expiresAt) {
	}

	/**
	 * Convite de primeiro acesso: link de uso unico (72h) para o usuario criar a propria senha. Convites
	 * anteriores do mesmo usuario sao invalidados. O link e devolvido ao Super Admin porque o envio de e-mail
	 * ainda depende de um provedor configurado.
	 */
	@Transactional
	public Invite issueInvite(User user, String restaurantName) {
		Instant now = clock.instant();
		tokens.invalidateAllForUser(user.getId(), now);
		String rawToken = newToken();
		Instant expiresAt = now.plus(INVITE_TTL);
		tokens.save(new PasswordResetToken(user.getId(), sha256(rawToken), expiresAt, "INVITE"));
		String link = props.appUrl() + "/redefinir-senha?convite=1&token=" + rawToken;
		mail.send(user.getEmail(), "Seu acesso à OneCore Tap", """
				Olá, %s.

				Você recebeu acesso ao painel de %s na OneCore Tap.
				Crie sua senha pelo link abaixo (válido por 72 horas):

				%s
				""".formatted(user.getName(), restaurantName, link));
		return new Invite(link, expiresAt);
	}

	static String newToken() {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	static String sha256(String value) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException(ex);
		}
	}

}
