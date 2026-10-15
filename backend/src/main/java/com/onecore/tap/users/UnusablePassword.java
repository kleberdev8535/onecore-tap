package com.onecore.tap.users;

import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Senha aleatória descartada, usada ao criar acessos por convite: o login só é liberado quando a pessoa define a
 * própria senha pelo link.
 */
public final class UnusablePassword {

	private static final SecureRandom RANDOM = new SecureRandom();

	private UnusablePassword() {
	}

	public static String random() {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		return HexFormat.of().formatHex(bytes);
	}

}
