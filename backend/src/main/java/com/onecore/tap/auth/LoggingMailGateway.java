package com.onecore.tap.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Implementacao provisoria enquanto nenhum provedor de e-mail esta configurado: NÃO envia e-mail.
 * Com onecore.mail.log-content=true (somente desenvolvimento) o conteúdo vai para o log, incluindo o link.
 */
@Component
class LoggingMailGateway implements MailGateway {

	private static final Logger log = LoggerFactory.getLogger(LoggingMailGateway.class);

	private final boolean logContent;

	LoggingMailGateway(@Value("${onecore.mail.log-content:false}") boolean logContent) {
		this.logContent = logContent;
	}

	@Override
	public void send(String to, String subject, String textBody) {
		if (logContent) {
			log.warn("[DEV] Provedor de e-mail não configurado. E-mail para {} | {}\n{}", to, subject, textBody);
		}
		else {
			log.warn("Provedor de e-mail não configurado: e-mail '{}' para {} NÃO foi enviado.", subject, to);
		}
	}

}
