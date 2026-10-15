package com.onecore.tap.restaurants;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/** Regras de "aberto agora" a partir das faixas de funcionamento. Sem faixas cadastradas, o restaurante é tratado como aberto. */
public final class OpeningHours {

	public static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Sao_Paulo");

	public record Range(int weekday, LocalTime opensAt, LocalTime closesAt) {
	}

	private OpeningHours() {
	}

	public static boolean isOpen(List<Range> ranges, ZonedDateTime now) {
		if (ranges.isEmpty()) {
			return true;
		}
		ZonedDateTime local = now.withZoneSameInstant(BUSINESS_ZONE);
		int today = local.getDayOfWeek().getValue();
		int yesterday = today == 1 ? 7 : today - 1;
		LocalTime t = local.toLocalTime();
		for (Range r : ranges) {
			boolean overnight = !r.closesAt().isAfter(r.opensAt());
			if (r.weekday() == today) {
				if (!t.isBefore(r.opensAt()) && (overnight || t.isBefore(r.closesAt()))) {
					return true;
				}
			}
			// Faixa de ontem que passa da meia-noite (ex.: sábado 18:00 às 02:00, agora domingo 01:00).
			if (overnight && r.weekday() == yesterday && t.isBefore(r.closesAt())) {
				return true;
			}
		}
		return false;
	}

}
