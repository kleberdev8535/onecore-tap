package com.onecore.tap.billing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Executa a rotina de cobrança todo dia às 06:00 (horário de Brasília). Desligável por onecore.billing.job-enabled. */
@Component
@ConditionalOnProperty(name = "onecore.billing.job-enabled", havingValue = "true", matchIfMissing = true)
class BillingJob {

	private static final Logger log = LoggerFactory.getLogger(BillingJob.class);

	private final BillingService billing;

	BillingJob(BillingService billing) {
		this.billing = billing;
	}

	@Scheduled(cron = "${onecore.billing.cron:0 0 6 * * *}", zone = "America/Sao_Paulo")
	void run() {
		try {
			billing.runCycle();
		}
		catch (RuntimeException ex) {
			log.error("Falha na rotina de cobrança", ex);
		}
	}

}
