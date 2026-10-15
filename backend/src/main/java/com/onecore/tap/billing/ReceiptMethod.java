package com.onecore.tap.billing;

/** Como a OneCore Business recebeu (registro manual de recebimento confirmado). */
public enum ReceiptMethod {

	PIX("Pix"), BOLETO("Boleto"), CARD("Cartão"), TRANSFER("Transferência"), CASH("Dinheiro"), OTHER("Outro");

	private final String label;

	ReceiptMethod(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}

}
