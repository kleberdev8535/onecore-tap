package com.onecore.tap.orders;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class OrderDtos {

	private OrderDtos() {
	}

	// ------------------------------------------------------------------ Cliente (cardápio público)

	public record PlaceItem(@NotNull UUID productId,
			@Min(value = 1, message = "Quantidade mínima 1") @Max(value = 50, message = "Quantidade máxima 50") int quantity,
			@Size(max = 200, message = "Use até 200 caracteres na observação") String notes,
			@Size(max = 40) List<@NotNull UUID> optionIds) {
	}

	/** Só escolhas: nenhum preço é aceito do navegador. */
	public record PlaceOrderRequest(
			@NotBlank @Pattern(regexp = "^[A-Za-z0-9_-]{16,64}$", message = "Identificador inválido") String clientToken,
			@Size(max = 60, message = "Use até 60 caracteres no nome") String customerName,
			@Size(max = 300, message = "Use até 300 caracteres na observação") String notes,
			@NotEmpty(message = "O pedido está vazio") @Size(max = 30, message = "Envie no máximo 30 itens")
			List<@Valid PlaceItem> items) {
	}

	public record ServiceRequestBody(@NotNull(message = "Informe o tipo") ServiceRequest.Type type) {
	}

	public record OptionView(String groupName, String optionName, int priceCents) {
	}

	public record ItemView(String productName, int quantity, int unitPriceCents, int totalCents, String notes,
			List<OptionView> options) {
	}

	/** O que o cliente vê do próprio pedido: sem IDs internos, sem dados de outros clientes. */
	public record PublicOrderView(String trackingToken, int number, String tableLabel, OrderStatus status,
			String statusLabel, int totalCents, boolean test, Instant createdAt, Instant updatedAt,
			List<ItemView> items) {
	}

	public record PublicSession(String tableLabel, boolean open, Instant openedAt, int tableTotalCents,
			int tableOrders, List<PublicOrderView> myOrders, List<ServiceRequest.Type> openRequests) {
	}

	// ------------------------------------------------------------------ Equipe

	public record TransitionRequest(@NotNull(message = "Informe a etapa atual") OrderStatus from,
			@NotNull(message = "Informe a nova etapa") OrderStatus to,
			@Size(max = 300, message = "Use até 300 caracteres") String reason) {
	}

	public record OrderView(UUID id, int number, UUID tableId, String tableLabel, OrderStatus status,
			String paymentStatus, String customerName, String notes, int totalCents, boolean test, Instant createdAt,
			Instant confirmedAt, Instant preparingAt, Instant readyAt, Instant deliveredAt, Instant completedAt,
			Instant cancelledAt, String cancelReason, List<ItemView> items) {
	}

	public record EventView(OrderStatus fromStatus, OrderStatus toStatus, String actorName, String reason,
			Instant createdAt) {
	}

	public record OrderDetail(OrderView order, List<EventView> history) {
	}

	public record ServiceRequestView(UUID id, UUID tableId, String tableLabel, ServiceRequest.Type type,
			Instant createdAt) {
	}

	public record Board(List<OrderView> orders, List<ServiceRequestView> requests, Instant generatedAt) {
	}

	/** Situação da mesa derivada do atendimento real (pedidos e chamados), nunca da leitura do QR Code. */
	public enum TableState {
		FREE, OCCUPIED, AWAITING_SERVICE, AWAITING_BILL, UNAVAILABLE
	}

	public record TableActivity(UUID tableId, TableState state, Instant openedAt, int openTotalCents, int openOrders,
			int activeOrders) {
	}

}
