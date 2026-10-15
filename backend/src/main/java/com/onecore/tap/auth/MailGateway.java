package com.onecore.tap.auth;

/** Porta de saida para e-mails transacionais. Um provedor real (SMTP, Resend, SES...) será plugado aqui. */
public interface MailGateway {

	void send(String to, String subject, String textBody);

}
