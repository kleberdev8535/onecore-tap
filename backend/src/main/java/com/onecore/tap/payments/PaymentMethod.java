package com.onecore.tap.payments;

/** Método informado pela equipe. Cartão é só o método: nenhum dado do cartão é coletado ou guardado. */
public enum PaymentMethod {

	PIX("Pix"), CASH("Dinheiro"), CARD("Cartão");

	private final String label;

	PaymentMethod(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}

}
