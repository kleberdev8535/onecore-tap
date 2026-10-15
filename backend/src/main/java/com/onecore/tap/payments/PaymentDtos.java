package com.onecore.tap.payments;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.onecore.tap.orders.OrderStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class PaymentDtos {

	private PaymentDtos() {
	}

	public record EntryInput(@NotNull(message = "Informe o método") PaymentMethod method,
			@NotNull(message = "Informe o valor") @Min(value = 1, message = "Valor inválido") @Max(10_000_000) Integer amountCents,
			@Min(0) @Max(10_000_000) Integer receivedCents) {
	}

	public record RegisterRequest(@NotNull(message = "Informe o escopo") Payment.Scope scope,
			@Size(max = 50) List<UUID> orderIds, UUID tableId,
			@NotEmpty(message = "Informe ao menos um método") @Size(max = 4) List<@Valid EntryInput> entries,
			@Size(max = 300) String notes) {
	}

	public record VoidRequest(@Size(max = 300) String reason) {
	}

	public record EntryView(PaymentMethod method, int amountCents, Integer receivedCents, int changeCents) {
	}

	public record PaymentView(UUID id, Payment.Scope scope, String tableLabel, int totalCents, List<EntryView> entries,
			List<Integer> orderNumbers, String registeredBy, String notes, Instant createdAt, Instant voidedAt,
			String voidedBy, String voidReason) {
	}

	public record PendingOrder(UUID id, int number, OrderStatus status, int totalCents, Instant createdAt,
			boolean currentAttendance) {
	}

	public record PendingTable(UUID tableId, String tableLabel, boolean attendanceOpen, int totalCents,
			List<PendingOrder> orders) {
	}

}
