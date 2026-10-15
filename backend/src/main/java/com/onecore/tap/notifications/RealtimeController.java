package com.onecore.tap.notifications;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;

@Tag(name = "Restaurante - Tempo real")
@RestController
@RequestMapping("/api/restaurant/events")
public class RealtimeController {

	private final RealtimeHub hub;

	public RealtimeController(RealtimeHub hub) {
		this.hub = hub;
	}

	@Operation(summary = "Fluxo de eventos (Server-Sent Events) do restaurante da sessão")
	@GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	@PreAuthorize("hasAuthority('PERM_ORDERS_VIEW')")
	public SseEmitter stream(HttpServletResponse response) {
		// Evita que proxies acumulem o fluxo em buffer.
		response.setHeader("Cache-Control", "no-cache, no-transform");
		response.setHeader("X-Accel-Buffering", "no");
		return hub.connect(CurrentUser.requireRestaurantId());
	}

}
