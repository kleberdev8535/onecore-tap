package com.onecore.tap.plates;

import java.security.SecureRandom;

/**
 * Tokens publicos das plaquinhas: 8 caracteres aleatorios (SecureRandom) de um alfabeto sem simbolos
 * ambiguos (sem 0/O, 1/I/L). 31^8 = ~8,5 x 10^11 combinacoes; com o limite de requisicoes do endpoint
 * publico, varrer tokens validos e inviavel. Nunca derivado do serial ou de sequencias.
 */
final class PlateTokenGenerator {

	static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

	static final int LENGTH = 8;

	private static final SecureRandom RANDOM = new SecureRandom();

	private PlateTokenGenerator() {
	}

	static String next() {
		StringBuilder sb = new StringBuilder(LENGTH);
		for (int i = 0; i < LENGTH; i++) {
			sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
		}
		return sb.toString();
	}

	static boolean isWellFormed(String token) {
		if (token == null || token.length() != LENGTH) {
			return false;
		}
		for (char c : token.toCharArray()) {
			if (ALPHABET.indexOf(c) < 0) {
				return false;
			}
		}
		return true;
	}

}
