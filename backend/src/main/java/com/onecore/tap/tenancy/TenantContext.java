package com.onecore.tap.tenancy;

import java.util.UUID;
import java.util.function.Supplier;

import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Permite executar um bloco no contexto de um restaurante especifico quando não ha usuário autenticado desse
 * restaurante, por exemplo no cardápio público (tenant resolvido pela plaquinha) ou em rotinas internas.
 *
 * Use somente com um restaurantId resolvido pelo próprio backend, nunca com um valor vindo do cliente.
 *
 * O Hibernate resolve o tenant ao abrir a sessão (início da transação), por isso callAs deve envolver a
 * transação, nunca ser chamado dentro dela. A chamada dentro de uma transação ativa é recusada.
 */
public final class TenantContext {

	private static final ThreadLocal<UUID> OVERRIDE = new ThreadLocal<>();

	private TenantContext() {
	}

	public static <T> T callAs(UUID restaurantId, Supplier<T> action) {
		if (restaurantId == null) {
			throw new IllegalArgumentException("restaurantId obrigatório");
		}
		if (TransactionSynchronizationManager.isActualTransactionActive()) {
			throw new IllegalStateException(
					"TenantContext.callAs deve envolver a transação: o tenant já foi resolvido para a transação atual.");
		}
		UUID previous = OVERRIDE.get();
		OVERRIDE.set(restaurantId);
		try {
			return action.get();
		}
		finally {
			if (previous == null) {
				OVERRIDE.remove();
			}
			else {
				OVERRIDE.set(previous);
			}
		}
	}

	static UUID override() {
		return OVERRIDE.get();
	}

}
