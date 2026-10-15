package com.onecore.tap.notifications;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Canal em tempo real do painel (Server-Sent Events), separado por restaurante: um evento só chega às conexões do
 * restaurante a que pertence.
 *
 * Os eventos são avisos ("o pedido 12 mudou"), não a fonte de verdade: o painel recarrega os dados pela API ao
 * receber um evento e também ao reconectar, então nada se perde se a internet oscilar. Os eventos só saem depois
 * do commit da transação, nunca para uma alteração desfeita.
 *
 * As conexões expiram a cada poucos minutos e o navegador reconecta sozinho; cada reconexão passa de novo pela
 * autenticação e pela revalidação da sessão (usuário desativado deixa de receber eventos).
 *
 * Limitação conhecida: o registro é em memória, por instância. Com mais de uma instância do backend será preciso
 * distribuir os eventos (ex.: PostgreSQL LISTEN/NOTIFY ou Redis).
 */
@Component
public class RealtimeHub {

	private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);

	static final Duration CONNECTION_TTL = Duration.ofMinutes(5);

	private final Map<UUID, Set<SseEmitter>> byRestaurant = new ConcurrentHashMap<>();

	private final AtomicLong sequence = new AtomicLong();

	/** Abre uma conexão para o restaurante informado (sempre o da sessão autenticada). */
	public SseEmitter connect(UUID restaurantId) {
		SseEmitter emitter = new SseEmitter(CONNECTION_TTL.toMillis());
		Set<SseEmitter> set = byRestaurant.computeIfAbsent(restaurantId, k -> ConcurrentHashMap.newKeySet());
		set.add(emitter);
		Runnable remove = () -> set.remove(emitter);
		emitter.onCompletion(remove);
		emitter.onTimeout(remove);
		emitter.onError(e -> remove.run());
		send(emitter, set, "ready", Map.of("connectedAt", System.currentTimeMillis()));
		return emitter;
	}

	/** Publicado pelos serviços dentro da transação; entregue somente após o commit. */
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
	public void onEvent(RealtimeEvent event) {
		Set<SseEmitter> set = byRestaurant.get(event.restaurantId());
		if (set == null || set.isEmpty()) {
			return;
		}
		Map<String, Object> payload = new java.util.HashMap<>(event.data());
		payload.put("type", event.type());
		for (SseEmitter emitter : set) {
			send(emitter, set, event.type(), payload);
		}
	}

	/** Comentário periódico mantém a conexão aberta em proxies que encerram conexões ociosas. */
	@Scheduled(fixedDelay = 25_000)
	void heartbeat() {
		byRestaurant.forEach((restaurantId, set) -> set.forEach(emitter -> {
			try {
				emitter.send(SseEmitter.event().comment("ping"));
			}
			catch (IOException | IllegalStateException ex) {
				set.remove(emitter);
			}
		}));
	}

	int connections(UUID restaurantId) {
		Set<SseEmitter> set = byRestaurant.get(restaurantId);
		return set == null ? 0 : set.size();
	}

	private void send(SseEmitter emitter, Set<SseEmitter> set, String name, Object data) {
		try {
			emitter.send(SseEmitter.event()
				.id(Long.toString(sequence.incrementAndGet()))
				.name(name)
				.data(data, MediaType.APPLICATION_JSON));
		}
		catch (IOException | IllegalStateException ex) {
			log.debug("Conexão em tempo real encerrada: {}", ex.getMessage());
			set.remove(emitter);
		}
	}

}
