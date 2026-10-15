package com.onecore.tap.tenancy;

import java.util.UUID;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;

import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

/**
 * Ponto unico de resolucao do tenant para o Hibernate. Toda entidade com @TenantId tem as consultas filtradas e
 * os inserts preenchidos automaticamente com o valor retornado aqui.
 *
 * Ordem: TenantContext explicito -> restaurante do usuário autenticado -> ROOT para Super Admin -> NONE.
 * NONE e um UUID que não corresponde a nenhum restaurante, entao consultas sem contexto não retornam nada e
 * inserts falham na chave estrangeira.
 */
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<UUID> {

	public static final UUID NONE = new UUID(0L, 0L);

	public static final UUID ROOT = new UUID(-1L, -1L);

	@Override
	public UUID resolveCurrentTenantIdentifier() {
		UUID override = TenantContext.override();
		if (override != null) {
			return override;
		}
		return CurrentUser.find().map(TenantIdentifierResolver::tenantOf).orElse(NONE);
	}

	private static UUID tenantOf(AuthenticatedUser user) {
		if (user.restaurantId() != null) {
			return user.restaurantId();
		}
		return user.role().isPlatform() ? ROOT : NONE;
	}

	@Override
	public boolean validateExistingCurrentSessions() {
		return true;
	}

	@Override
	public boolean isRoot(UUID tenantId) {
		return ROOT.equals(tenantId);
	}

}
