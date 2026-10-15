package com.onecore.tap.plates;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class PlateDtos {

	private PlateDtos() {
	}

	public enum Action {
		BIND, RELEASE, SUSPEND, REACTIVATE, DAMAGE, RESTORE, DEACTIVATE
	}

	public record CreateBatchRequest(
			@Pattern(regexp = "^[A-Za-z0-9-]{3,40}$", message = "Use de 3 a 40 letras, números ou hífens") String code,
			LocalDate manufacturedOn,
			@NotNull(message = "Informe a quantidade") @Min(value = 1, message = "Mínimo de 1") @Max(value = 500, message = "Máximo de 500 por lote") Integer quantity,
			@Size(max = 300) String notes) {
	}

	public record ChangeRequest(@NotNull(message = "Informe a ação") Action action, UUID restaurantId, UUID tableId,
			@Size(max = 300) String reason) {
	}

	public record Ref(UUID id, String name) {
	}

	public record PlateView(UUID id, String serial, String publicToken, String publicUrl, PlateStatus status,
			Ref batch, Ref restaurant, Ref table, Instant activatedAt, Instant updatedAt) {
	}

	public record EventView(UUID id, PlateEvent.Type event, PlateStatus fromStatus, PlateStatus toStatus,
			Ref restaurant, Ref table, String actorEmail, String reason, Instant createdAt) {
	}

	public record PlateDetail(PlateView plate, List<EventView> history) {
	}

	public record BatchView(UUID id, String code, LocalDate manufacturedOn, int quantity, String notes,
			Instant createdAt, long available, long inUse) {
	}

	public record InventoryCounts(long available, long reserved, long active, long suspended, long damaged,
			long deactivated) {

		public long inStock() {
			return available;
		}

		public long bound() {
			return reserved + active + suspended;
		}
	}

}
