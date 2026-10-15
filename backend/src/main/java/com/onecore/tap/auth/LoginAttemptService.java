package com.onecore.tap.auth;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.config.AppProperties;
import com.onecore.tap.users.UserRepository;

/** Controle de bloqueio por conta, persistido no banco (vale para todas as instancias do backend). */
@Service
public class LoginAttemptService {

	private final UserRepository users;

	private final AppProperties props;

	private final Clock clock;

	public LoginAttemptService(UserRepository users, AppProperties props, Clock clock) {
		this.users = users;
		this.props = props;
		this.clock = clock;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void registerFailure(String email) {
		Instant now = clock.instant();
		users.findByEmail(email.trim()).ifPresent(user -> user.registerFailedLogin(
				props.security().maxFailedLogins(), now.plus(props.security().lockoutDuration())));
	}

	@Transactional
	public void registerSuccess(java.util.UUID userId) {
		users.findById(userId).ifPresent(user -> user.registerSuccessfulLogin(clock.instant()));
	}

}
