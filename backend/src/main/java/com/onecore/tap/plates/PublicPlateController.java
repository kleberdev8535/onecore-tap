package com.onecore.tap.plates;

import java.time.Clock;
import java.time.Duration;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.common.TooManyRequestsException;
import com.onecore.tap.config.AppProperties;
import com.onecore.tap.plates.PlateResolver.ResolvedPlate;
import com.onecore.tap.security.IpRateLimiter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolução pública da URL da plaquinha (/t/{token}). Sem autenticação e sem conceder qualquer permissão: devolve
 * apenas o necessário para abrir o cardápio daquela mesa. Não expõe IDs internos, dados financeiros ou pessoais.
 *
 * Abrir a URL NÃO prova presença física na mesa (o QR pode ser fotografado); por isso os pedidos aguardam a
 * confirmação do restaurante por padrão.
 */
@Tag(name = "Publico - Plaquinhas")
@RestController
@RequestMapping("/api/public/plates")
public class PublicPlateController {

	private final PlateResolver resolver;

	private final IpRateLimiter limiter;

	public PublicPlateController(PlateResolver resolver, AppProperties props, Clock clock) {
		this.resolver = resolver;
		this.limiter = new IpRateLimiter(props.plates().publicLookupLimitPerMinute(), Duration.ofMinutes(1), clock);
	}

	public record PublicRestaurant(String tradeName, String slug, String logoUrl, String primaryColor,
			String accentColor) {
	}

	public record PublicPlate(String token, String tableLabel, boolean preview, PublicRestaurant restaurant) {
	}

	@Operation(summary = "Resolve a plaquinha: restaurante e mesa vinculados")
	@GetMapping("/{token}")
	public ResponseEntity<PublicPlate> resolve(@PathVariable String token, HttpServletRequest request) {
		if (!limiter.tryAcquire("plate:" + request.getRemoteAddr())) {
			throw new TooManyRequestsException("Muitas consultas em pouco tempo. Aguarde um instante.");
		}
		ResolvedPlate plate = resolver.resolve(token);
		var r = plate.restaurant();
		PublicPlate body = new PublicPlate(plate.token(), plate.table().getLabel(), plate.preview(),
				new PublicRestaurant(r.getTradeName(), r.getSlug(), r.getLogoUrl(), r.getPrimaryColor(),
						r.getAccentColor()));
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
	}

}
