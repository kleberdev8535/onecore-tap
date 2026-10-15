package com.onecore.tap.billing;

/**
 * Porta para um provedor de cobrança (ex.: Mercado Pago). Ainda não há implementação: enquanto nenhuma existir,
 * os recebimentos são registrados manualmente pela OneCore Business e nada é marcado como pago automaticamente.
 *
 * Contrato previsto para a integração:
 * - createCharge: gera a cobrança no provedor (Pix/boleto/cartão) e devolve o identificador externo, gravado em
 *   subscription_invoices.provider_payment_id.
 * - O provedor confirma o pagamento por webhook assinado; o backend consulta o pagamento na API do provedor
 *   (nunca confia só no corpo do webhook) e então chama BillingService.registerInvoicePayment.
 */
public interface BillingGateway {

	record Charge(String providerPaymentId, String paymentUrl) {
	}

	Charge createCharge(Invoice invoice, String payerEmail);

}
