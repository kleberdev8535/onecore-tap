package com.onecore.tap.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.config.AppProperties;

/**
 * Cria o primeiro Super Admin a partir de SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD quando ainda não existe nenhum.
 * Depois disso as variaveis sao ignoradas; nunca sobrescreve um Super Admin existente.
 */
@Component
class SuperAdminBootstrap implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrap.class);

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final AppProperties props;

	private final AuditService audit;

	SuperAdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder, AppProperties props,
			AuditService audit) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.props = props;
		this.audit = audit;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (users.existsByRole(Role.SUPER_ADMIN)) {
			return;
		}
		AppProperties.SuperAdmin cfg = props.bootstrap().superAdmin();
		if (cfg == null || isBlank(cfg.email()) || isBlank(cfg.password())) {
			log.warn("Nenhum Super Admin cadastrado. Defina SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD para criar o primeiro acesso.");
			return;
		}
		if (cfg.password().length() < 12) {
			throw new IllegalStateException("SUPERADMIN_PASSWORD precisa ter ao menos 12 caracteres.");
		}
		User admin = users.save(new User(null, isBlank(cfg.name()) ? "OneCore Business" : cfg.name(), cfg.email(),
				passwordEncoder.encode(cfg.password()), Role.SUPER_ADMIN));
		audit.recordAnonymous(AuditAction.SUPER_ADMIN_BOOTSTRAPPED, admin.getEmail(), null, null);
		log.info("Super Admin inicial criado para {}", admin.getEmail());
	}

	private static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

}
