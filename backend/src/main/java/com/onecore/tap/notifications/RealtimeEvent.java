package com.onecore.tap.notifications;

import java.util.Map;
import java.util.UUID;

/**
 * Aviso para o painel do restaurante. Tipos: order.created, order.updated, request.created, request.resolved,
 * table.updated. Contém somente identificadores e rótulos operacionais (número, mesa, status), sem dados pessoais.
 */
public record RealtimeEvent(UUID restaurantId, String type, Map<String, Object> data) {

}
