package com.onecore.tap.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limitador de janela deslizante em memoria, por chave (ex.: "login:203.0.113.4").
 *
 * Limitacao conhecida: o estado e por instancia. Com mais de uma instancia do backend, cada uma aplica o limite
 * separadamente; o bloqueio por conta (persistido no banco) continua valendo globalmente.
 */
public class IpRateLimiter {

	private static final int MAX_TRACKED_KEYS = 50_000;

	private final int limit;

	private final Duration window;

	private final Clock clock;

	private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

	public IpRateLimiter(int limit, Duration window, Clock clock) {
		this.limit = limit;
		this.window = window;
		this.clock = clock;
	}

	/** Registra uma tentativa e retorna false quando a chave excedeu o limite na janela. */
	public boolean tryAcquire(String key) {
		if (hits.size() > MAX_TRACKED_KEYS) {
			evictExpired();
		}
		Instant now = clock.instant();
		Deque<Instant> deque = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
		synchronized (deque) {
			Instant cutoff = now.minus(window);
			while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
				deque.pollFirst();
			}
			if (deque.size() >= limit) {
				return false;
			}
			deque.addLast(now);
			return true;
		}
	}

	public void reset(String key) {
		hits.remove(key);
	}

	private void evictExpired() {
		Instant cutoff = clock.instant().minus(window);
		hits.entrySet().removeIf(e -> {
			synchronized (e.getValue()) {
				Instant last = e.getValue().peekLast();
				return last == null || last.isBefore(cutoff);
			}
		});
	}

}
