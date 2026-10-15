package com.onecore.tap.tables;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.orders.OrderDtos.TableActivity;
import com.onecore.tap.orders.OrderDtos.TableState;
import com.onecore.tap.orders.OrderService;
import com.onecore.tap.plates.PlateService;
import com.onecore.tap.plates.PlateService.TablePlate;
import com.onecore.tap.plates.PlateStatus;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Mesas do restaurante logado. A vinculação das plaquinhas continua com a OneCore Business (Super Admin); aqui
 * o restaurante vê qual plaquinha está em cada mesa.
 */
@Tag(name = "Restaurante - Mesas")
@RestController
@RequestMapping("/api/restaurant/tables")
public class RestaurantTableController {

	private final TableService tableService;

	private final RestaurantTableRepository tables;

	private final PlateService plates;

	private final OrderService orders;

	private final AuditService audit;

	public RestaurantTableController(TableService tableService, RestaurantTableRepository tables, PlateService plates,
			OrderService orders, AuditService audit) {
		this.tableService = tableService;
		this.tables = tables;
		this.plates = plates;
		this.orders = orders;
		this.audit = audit;
	}

	/** publicUrl: link permanente gravado no NFC e no QR Code da plaquinha desta mesa. */
	public record PlateRef(String serial, PlateStatus status, String publicUrl) {
	}

	/** state, openedAt e openTotalCents vêm do atendimento real (pedidos e chamados). */
	public record TableView(UUID id, String label, Integer capacity, boolean active, PlateRef plate, TableState state,
			java.time.Instant openedAt, int openTotalCents, int openOrders, int activeOrders) {
	}

	public record CreateTablesRequest(@Size(max = 200) List<@Size(max = 20) String> labels,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 999, message = "Máximo 999") Integer from,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 999, message = "Máximo 999") Integer to,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 100, message = "Máximo 100") Integer capacity) {
	}

	public record UpdateTableRequest(@NotBlank(message = "Informe o nome da mesa") @Size(max = 20) String label,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 100, message = "Máximo 100") Integer capacity,
			@NotNull(message = "Informe se a mesa está ativa") Boolean active) {
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_TABLES_VIEW')")
	@Transactional(readOnly = true)
	public List<TableView> list() {
		UUID restaurantId = CurrentUser.requireRestaurantId();
		Map<UUID, TablePlate> byTable = plateByTable(restaurantId);
		Map<UUID, TableActivity> activity = orders.tableActivity();
		return tables.findAllOfRestaurant(restaurantId).stream().map(t -> view(t, byTable, activity)).toList();
	}

	@Operation(summary = "Cadastra mesas por nome ou intervalo numérico, respeitando o limite do plano")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_TABLES_MANAGE')")
	public List<TableView> create(@Valid @RequestBody CreateTablesRequest b, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		List<RestaurantTable> created = tableService.create(actor.restaurantId(),
				TableService.expand(b.labels(), b.from(), b.to()), b.capacity());
		Map<String, Object> details = new HashMap<>();
		details.put("count", created.size());
		details.put("labels", created.stream().map(RestaurantTable::getLabel).toList());
		audit.record(AuditAction.TABLE_CREATED, actor, "restaurant", actor.restaurantId(), request, details);
		return created.stream().map(t -> view(t, Map.of(), Map.of())).toList();
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_TABLES_MANAGE')")
	public TableView update(@PathVariable UUID id, @Valid @RequestBody UpdateTableRequest b,
			HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		RestaurantTable t = tableService.update(id, b.label(), b.capacity(), b.active());
		audit.record(AuditAction.TABLE_UPDATED, actor, "table", id, request,
				Map.of("label", t.getLabel(), "active", t.isActive()));
		return view(t, plateByTable(actor.restaurantId()), orders.tableActivity());
	}

	@Operation(summary = "Encerra o atendimento da mesa (pedidos entregues são concluídos; chamados resolvidos)")
	@PostMapping("/{id}/close")
	@PreAuthorize("hasAuthority('PERM_ORDERS_MANAGE')")
	public TableView close(@PathVariable UUID id, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		RestaurantTable t = tables.findById(id).orElseThrow(() -> new com.onecore.tap.common.NotFoundException("Mesa não encontrada."));
		orders.closeTable(id, actor);
		audit.record(AuditAction.TABLE_SESSION_CLOSED, actor, "table", id, request, Map.of("label", t.getLabel()));
		return view(t, plateByTable(actor.restaurantId()), orders.tableActivity());
	}

	private Map<UUID, TablePlate> plateByTable(UUID restaurantId) {
		return plates.platesOnTablesOf(restaurantId)
			.stream()
			.collect(Collectors.toMap(TablePlate::tableId, Function.identity(), (a, b) -> a));
	}

	private static TableView view(RestaurantTable t, Map<UUID, TablePlate> byTable,
			Map<UUID, TableActivity> activity) {
		TablePlate plate = byTable.get(t.getId());
		TableActivity a = activity.get(t.getId());
		TableState state = !t.isActive() ? TableState.UNAVAILABLE : a == null ? TableState.FREE : a.state();
		return new TableView(t.getId(), t.getLabel(), t.getCapacity(), t.isActive(),
				plate == null ? null : new PlateRef(plate.serial(), plate.status(), plate.publicUrl()), state,
				a == null ? null : a.openedAt(), a == null ? 0 : a.openTotalCents(), a == null ? 0 : a.openOrders(),
				a == null ? 0 : a.activeOrders());
	}

}
