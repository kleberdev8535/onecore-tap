package com.onecore.tap.orders;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalTime;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.common.TooManyRequestsException;
import com.onecore.tap.orders.OrderDtos.PlaceOrderRequest;
import com.onecore.tap.orders.OrderDtos.PublicOrderView;
import com.onecore.tap.orders.OrderDtos.PublicSession;
import com.onecore.tap.orders.OrderDtos.ServiceRequestBody;
import com.onecore.tap.orders.OrderDtos.ServiceRequestView;
import com.onecore.tap.plates.PlateResolver;
import com.onecore.tap.plates.PlateResolver.ResolvedPlate;
import com.onecore.tap.products.MenuService;
import com.onecore.tap.products.MenuService.PublicMenu;
import com.onecore.tap.restaurants.OpeningHours;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantSettingsService;
import com.onecore.tap.security.IpRateLimiter;
import com.onecore.tap.tenancy.TenantContext;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * Cardápio público, pedidos e chamados feitos pelo cliente na mesa. O restaurante e a mesa vêm sempre da
 * plaquinha; preços vêm do cardápio no banco. Sem login e com limites por IP e por plaquinha contra abuso.
 */
@Tag(name = "Publico - Cardápio e pedidos")
@RestController
@RequestMapping("/api/public")
public class PublicOrderController {

	private final PlateResolver resolver;

	private final MenuService menu;

	private final RestaurantSettingsService settings;

	private final OrderService orders;

	private final Clock clock;

	private final IpRateLimiter readLimiter;

	private final IpRateLimiter orderLimiter;

	private final IpRateLimiter plateOrderLimiter;

	private final IpRateLimiter requestLimiter;

	public PublicOrderController(PlateResolver resolver, MenuService menu, RestaurantSettingsService settings,
			OrderService orders, com.onecore.tap.config.AppProperties props, Clock clock) {
		this.resolver = resolver;
		this.menu = menu;
		this.settings = settings;
		this.orders = orders;
		this.clock = clock;
		this.readLimiter = new IpRateLimiter(120, Duration.ofMinutes(1), clock);
		this.orderLimiter = new IpRateLimiter(props.orders().ordersPerIp(), Duration.ofMinutes(5), clock);
		this.plateOrderLimiter = new IpRateLimiter(props.orders().ordersPerPlate(), Duration.ofMinutes(10), clock);
		this.requestLimiter = new IpRateLimiter(props.orders().requestsPerIp(), Duration.ofMinutes(5), clock);
	}

	public record MenuRestaurant(String tradeName, String description, String logoUrl, String coverImageUrl,
			String primaryColor, String accentColor, String phone, String addressLine, String city, String state) {
	}

	public record MenuHour(int weekday, LocalTime opensAt, LocalTime closesAt) {
	}

	public record MenuResponse(String token, String tableLabel, boolean preview, boolean openNow,
			boolean requireOrderConfirmation, MenuRestaurant restaurant, List<MenuHour> openingHours, PublicMenu menu) {
	}

	@Operation(summary = "Cardápio da mesa: identidade do restaurante, horários, categorias, produtos e adicionais")
	@GetMapping("/plates/{token}/menu")
	public ResponseEntity<MenuResponse> menu(@PathVariable String token, HttpServletRequest request) {
		limit(readLimiter, "read:" + request.getRemoteAddr());
		ResolvedPlate plate = resolver.resolve(token);
		Restaurant r = plate.restaurant();
		List<OpeningHours.Range> ranges = TenantContext.callAs(r.getId(), settings::ranges);
		PublicMenu content = TenantContext.callAs(r.getId(), menu::publicMenu);
		MenuResponse body = new MenuResponse(plate.token(), plate.table().getLabel(), plate.preview(),
				OpeningHours.isOpen(ranges, java.time.ZonedDateTime.now(clock)), r.isRequireOrderConfirmation(),
				new MenuRestaurant(r.getTradeName(), r.getDescription(), r.getLogoUrl(), r.getCoverImageUrl(),
						r.getPrimaryColor(), r.getAccentColor(), r.getPhone(), r.getAddressLine(), r.getCity(),
						r.getState()),
				ranges.stream().map(h -> new MenuHour(h.weekday(), h.opensAt(), h.closesAt())).toList(), content);
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
	}

	@Operation(summary = "Envia um pedido. O servidor calcula os preços a partir do cardápio atual")
	@PostMapping("/plates/{token}/orders")
	public ResponseEntity<PublicOrderView> place(@PathVariable String token, @Valid @RequestBody PlaceOrderRequest body,
			HttpServletRequest request) {
		limit(orderLimiter, "order:" + request.getRemoteAddr());
		ResolvedPlate plate = resolver.resolve(token);
		limit(plateOrderLimiter, "plate-order:" + plate.token());
		return ResponseEntity.status(HttpStatus.CREATED).body(orders.place(plate, body));
	}

	@Operation(summary = "Atendimento atual da mesa: valor parcial e pedidos feitos neste aparelho")
	@GetMapping("/plates/{token}/session")
	public ResponseEntity<PublicSession> session(@PathVariable String token,
			@RequestParam(required = false) String client, HttpServletRequest request) {
		limit(readLimiter, "read:" + request.getRemoteAddr());
		String clientToken = client != null && client.matches("^[A-Za-z0-9_-]{16,64}$") ? client : null;
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.body(orders.session(resolver.resolve(token), clientToken));
	}

	@Operation(summary = "Chamar garçom ou pedir a conta (não marca nada como pago)")
	@PostMapping("/plates/{token}/requests")
	public ResponseEntity<ServiceRequestView> serviceRequest(@PathVariable String token,
			@Valid @RequestBody ServiceRequestBody body, HttpServletRequest request) {
		limit(requestLimiter, "request:" + request.getRemoteAddr());
		return ResponseEntity.status(HttpStatus.CREATED)
			.body(orders.requestService(resolver.resolve(token), body.type()));
	}

	@Operation(summary = "Acompanhamento do pedido pelo cliente")
	@GetMapping("/orders/{trackingToken}")
	public ResponseEntity<PublicOrderView> track(@PathVariable String trackingToken, HttpServletRequest request) {
		limit(readLimiter, "read:" + request.getRemoteAddr());
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(orders.track(trackingToken));
	}

	private static void limit(IpRateLimiter limiter, String key) {
		if (!limiter.tryAcquire(key)) {
			throw new TooManyRequestsException("Muitas solicitações em pouco tempo. Aguarde um instante.");
		}
	}

}
