package com.onecore.tap.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "onecore")
public record AppProperties(String appUrl, Cors cors, Security security, Bootstrap bootstrap, Plates plates,
		Orders orders) {

	/** publicBaseUrl termina com "/"; a URL da plaquinha e publicBaseUrl + token. */
	public record Plates(String publicBaseUrl, int publicLookupLimitPerMinute) {
	}

	/** Limites do cardápio público: pedidos por IP (janela de 5 min), por plaquinha (10 min) e chamados por IP. */
	public record Orders(int ordersPerIp, int ordersPerPlate, int requestsPerIp) {
	}

	public record Cors(List<String> allowedOrigins) {
	}

	public record Security(int maxFailedLogins, Duration lockoutDuration, int ipLoginLimit, Duration ipLoginWindow,
			Duration passwordResetTtl) {
	}

	public record Bootstrap(SuperAdmin superAdmin) {
	}

	public record SuperAdmin(String email, String password, String name) {
	}

}
