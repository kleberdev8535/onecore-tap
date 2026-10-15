package com.onecore.tap.security;

import java.time.Clock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.config.AppProperties;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.users.UserRepository;
import com.onecore.tap.users.Role;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

	private static final String[] RESTAURANT_ROLES = { Role.RESTAURANT_OWNER.name(), Role.RESTAURANT_MANAGER.name(),
			Role.CASHIER.name(), Role.WAITER.name(), Role.KITCHEN.name() };

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityContextRepository contextRepository,
			AuditService audit, @Value("${server.servlet.session.cookie.secure:false}") boolean secureCookies,
			UserRepository users, RestaurantRepository restaurants)
			throws Exception {
		// Cookie XSRF-TOKEN legivel pelo SPA, enviado de volta no header X-XSRF-TOKEN.
		CookieCsrfTokenRepository csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
		csrfRepository.setCookieCustomizer(cookie -> cookie.secure(secureCookies).sameSite("Lax"));
		http.csrf(csrf -> csrf.csrfTokenRepository(csrfRepository).spa())
			.cors(cors -> {
			})
			.securityContext(ctx -> ctx.securityContextRepository(contextRepository))
			.addFilterAfter(new SessionRevalidationFilter(users, restaurants, audit), SecurityContextHolderFilter.class)
			.sessionManagement(session -> session.sessionFixation(fix -> fix.changeSessionId()))
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.authorizeHttpRequests(auth -> auth
				// Respostas assíncronas (fluxo de eventos) e páginas de erro já foram autorizadas na requisição original.
				.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ASYNC, jakarta.servlet.DispatcherType.ERROR)
				.permitAll()
				.requestMatchers("/api/auth/login", "/api/auth/csrf", "/api/auth/password/**")
				.permitAll()
				.requestMatchers("/api/public/**")
				.permitAll()
				.requestMatchers("/actuator/health/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
				.permitAll()
				.requestMatchers("/api/admin/**")
				.hasAuthority(Permission.PLATFORM_VIEW.authority())
				.requestMatchers("/api/restaurant/**")
				.hasAnyRole(RESTAURANT_ROLES)
				.anyRequest()
				.authenticated())
			.exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
				.accessDeniedHandler((req, res, e) -> res.sendError(HttpStatus.FORBIDDEN.value())))
			.logout(logout -> logout.logoutUrl("/api/auth/logout")
				.addLogoutHandler((req, res, auth) -> {
					if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
						audit.record(AuditAction.LOGOUT, user, null, null, req);
					}
				})
				.deleteCookies("OCTAP_SESSION")
				.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
			.headers(headers -> headers
				.contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
				.referrerPolicy(ref -> ref.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
				.frameOptions(frame -> frame.deny()));
		return http.build();
	}

	/** Swagger UI precisa de CSP própria; liberada apenas nas rotas da documentacao. */
	@Bean
	@org.springframework.core.annotation.Order(0)
	SecurityFilterChain docsFilterChain(HttpSecurity http) throws Exception {
		http.securityMatcher("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**")
			.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
			.csrf(AbstractHttpConfigurer::disable)
			.headers(h -> h.frameOptions(f -> f.deny()));
		return http.build();
	}

	@Bean
	SecurityContextRepository securityContextRepository() {
		return new HttpSessionSecurityContextRepository();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		// Delegating encoder: BCrypt hoje, com prefixo {bcrypt} que permite migrar o algoritmo no futuro.
		return PasswordEncoderFactories.createDelegatingPasswordEncoder();
	}

	@Bean
	AuthenticationManager authenticationManager(AppUserDetailsService userDetailsService,
			PasswordEncoder passwordEncoder) {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
		provider.setPasswordEncoder(passwordEncoder);
		ProviderManager manager = new ProviderManager(provider);
		manager.setEraseCredentialsAfterAuthentication(true);
		return manager;
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOrigins(props.cors().allowedOrigins());
		config.addAllowedMethod("*");
		config.addAllowedHeader("*");
		config.setAllowCredentials(true);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", config);
		return source;
	}

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}

	@Bean
	IpRateLimiter loginRateLimiter(AppProperties props, Clock clock) {
		return new IpRateLimiter(props.security().ipLoginLimit(), props.security().ipLoginWindow(), clock);
	}

}
