package com.onecore.tap.restaurants;

import java.time.Clock;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;

/**
 * Personalização e configurações feitas pelo próprio restaurante. O restaurantId vem sempre da sessão; os
 * horários usam @TenantId e são filtrados automaticamente.
 */
@Service
public class RestaurantSettingsService {

	public record Hour(int weekday, LocalTime opensAt, LocalTime closesAt) {
	}

	private final RestaurantRepository restaurants;

	private final OpeningHourRepository hours;

	private final Clock clock;

	RestaurantSettingsService(RestaurantRepository restaurants, OpeningHourRepository hours, Clock clock) {
		this.restaurants = restaurants;
		this.hours = hours;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public Restaurant get(UUID restaurantId) {
		return restaurants.findById(restaurantId)
			.orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
	}

	@Transactional(readOnly = true)
	public List<OpeningHour> hours() {
		return hours.findAll()
			.stream()
			.sorted(Comparator.comparingInt(OpeningHour::getWeekday).thenComparing(OpeningHour::getOpensAt))
			.toList();
	}

	/** Faixas de funcionamento do restaurante do contexto atual (sessão ou plaquinha). */
	@Transactional(readOnly = true)
	public List<OpeningHours.Range> ranges() {
		return hours().stream().map(h -> new OpeningHours.Range(h.getWeekday(), h.getOpensAt(), h.getClosesAt())).toList();
	}

	@Transactional
	public Restaurant updateContact(UUID restaurantId, String email, String phone, String addressLine, String city,
			String state, String postalCode, String description) {
		Restaurant r = get(restaurantId);
		r.updateContact(blank(email), phone, blank(addressLine), blank(city), state, postalCode, blank(description));
		restaurants.flush();
		return r;
	}

	@Transactional
	public Restaurant updateBranding(UUID restaurantId, String logoUrl, String coverImageUrl, String primaryColor,
			String accentColor) {
		Restaurant r = get(restaurantId);
		r.updateBranding(blank(logoUrl), primaryColor.toUpperCase(Locale.ROOT), accentColor.toUpperCase(Locale.ROOT),
				clock.instant());
		r.updateCover(blank(coverImageUrl));
		restaurants.flush();
		return r;
	}

	@Transactional
	public Restaurant updateOperation(UUID restaurantId, boolean requireOrderConfirmation) {
		Restaurant r = get(restaurantId);
		r.setRequireOrderConfirmation(requireOrderConfirmation);
		restaurants.flush();
		return r;
	}

	/** Substitui todos os horários da semana. Lista vazia = horários não informados. */
	@Transactional
	public List<OpeningHour> replaceHours(List<Hour> requested) {
		validate(requested);
		hours.deleteAllInBatch(hours.findAll());
		hours.flush();
		List<OpeningHour> saved = new ArrayList<>();
		requested.forEach(h -> saved.add(hours.save(new OpeningHour(h.weekday(), h.opensAt(), h.closesAt()))));
		hours.flush();
		return hours();
	}

	static void validate(List<Hour> requested) {
		Map<Integer, List<Hour>> byDay = requested.stream().collect(Collectors.groupingBy(Hour::weekday));
		for (List<Hour> day : byDay.values()) {
			if (day.size() > 3) {
				throw new ConflictException("Use no máximo 3 faixas de horário por dia.");
			}
			List<Hour> sorted = day.stream().sorted(Comparator.comparing(Hour::opensAt)).toList();
			for (int i = 0; i < sorted.size(); i++) {
				Hour h = sorted.get(i);
				if (h.opensAt().equals(h.closesAt())) {
					throw new ConflictException("A abertura e o fechamento não podem ser no mesmo horário.");
				}
				boolean overnight = !h.closesAt().isAfter(h.opensAt());
				if (overnight && i < sorted.size() - 1) {
					throw new ConflictException("A faixa que vira a noite precisa ser a última do dia.");
				}
				if (i > 0 && sorted.get(i - 1).closesAt().isAfter(h.opensAt())) {
					throw new ConflictException("Há faixas de horário sobrepostas no mesmo dia.");
				}
			}
		}
	}

	private static String blank(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}

interface OpeningHourRepository extends JpaRepository<OpeningHour, UUID> {

}
