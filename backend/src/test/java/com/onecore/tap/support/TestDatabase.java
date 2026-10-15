package com.onecore.tap.support;

import java.io.IOException;
import java.io.UncheckedIOException;

import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * PostgreSQL real e compartilhado por todos os testes de integração.
 *
 * Usa Testcontainers quando ha Docker (CI e maquinas com Docker). Sem Docker, sobe um PostgreSQL embarcado
 * (binarios oficiais via zonky). Forcar um modo: -Donecore.test.db=docker|embedded.
 */
final class TestDatabase {

	record Connection(String url, String username, String password, String engine) {
	}

	static final Connection CONNECTION = start();

	private TestDatabase() {
	}

	private static Connection start() {
		String mode = System.getProperty("onecore.test.db", "auto");
		boolean useDocker = switch (mode) {
			case "docker" -> true;
			case "embedded" -> false;
			default -> dockerAvailable();
		};
		if (useDocker) {
			PostgreSQLContainer container = new PostgreSQLContainer("postgres:17-alpine");
			container.start();
			return new Connection(container.getJdbcUrl(), container.getUsername(), container.getPassword(),
					"testcontainers");
		}
		try {
			EmbeddedPostgres pg = EmbeddedPostgres.builder().start();
			Runtime.getRuntime().addShutdownHook(new Thread(() -> {
				try {
					pg.close();
				}
				catch (IOException ignored) {
					// encerrando a JVM
				}
			}));
			return new Connection(pg.getJdbcUrl("postgres", "postgres"), "postgres", "postgres", "embedded");
		}
		catch (IOException ex) {
			throw new UncheckedIOException("Não foi possível iniciar o PostgreSQL embarcado", ex);
		}
	}

	private static boolean dockerAvailable() {
		try {
			return DockerClientFactory.instance().isDockerAvailable();
		}
		catch (RuntimeException ex) {
			return false;
		}
	}

}
