package com.onecore.tap.plates;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.config.AppProperties;
import com.onecore.tap.plates.PlateDtos.Action;
import com.onecore.tap.plates.PlateDtos.BatchView;
import com.onecore.tap.plates.PlateDtos.EventView;
import com.onecore.tap.plates.PlateDtos.InventoryCounts;
import com.onecore.tap.plates.PlateDtos.PlateDetail;
import com.onecore.tap.plates.PlateDtos.PlateView;
import com.onecore.tap.plates.PlateDtos.Ref;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.tables.RestaurantTable;
import com.onecore.tap.tables.RestaurantTableRepository;

/**
 * Inventario e vinculacao das plaquinhas. Operacoes administrativas (Super Admin, tenant ROOT).
 * Cada mudanca trava a linha da plaquinha (SELECT ... FOR UPDATE) e grava um evento no historico.
 */
@Service
public class PlateService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Sao_Paulo");

	private final PlateRepository plates;

	private final PlateBatchRepository batches;

	private final PlateEventRepository events;

	private final RestaurantRepository restaurants;

	private final RestaurantTableRepository tables;

	private final AppProperties props;

	private final Clock clock;

	public PlateService(PlateRepository plates, PlateBatchRepository batches, PlateEventRepository events,
			RestaurantRepository restaurants, RestaurantTableRepository tables, AppProperties props, Clock clock) {
		this.plates = plates;
		this.batches = batches;
		this.events = events;
		this.restaurants = restaurants;
		this.tables = tables;
		this.props = props;
		this.clock = clock;
	}

	public String publicUrl(String token) {
		return props.plates().publicBaseUrl() + token;
	}

	// ---------------------------------------------------------------- Lotes

	@Transactional
	public PlateBatch createBatch(String code, LocalDate manufacturedOn, int quantity, String notes,
			String actorEmail) {
		Instant now = clock.instant();
		String batchCode = code == null || code.isBlank()
				? "LOTE-" + DateTimeFormatter.ofPattern("yyyyMMdd").withZone(BUSINESS_ZONE).format(now) + "-"
						+ PlateTokenGenerator.next().substring(0, 4)
				: code.trim().toUpperCase(Locale.ROOT);
		if (batches.existsByCode(batchCode)) {
			throw new ConflictException("Já existe um lote com o código " + batchCode + ".");
		}
		PlateBatch batch = batches.save(new PlateBatch(batchCode, manufacturedOn, quantity, blankToNull(notes)));
		for (int i = 0; i < quantity; i++) {
			Plate plate = plates.save(new Plate("OCT-%06d".formatted(plates.nextSerial()), uniqueToken(), batch.getId()));
			events.save(new PlateEvent(plate.getId(), PlateEvent.Type.CREATED, null, PlateStatus.AVAILABLE, null, null,
					actorEmail, "Lote " + batchCode, now));
		}
		plates.flush();
		return batch;
	}

	@Transactional(readOnly = true)
	public List<BatchView> listBatches() {
		return batches.findAllByOrderByCreatedAtDesc().stream().map(b -> {
			List<Plate> items = plates.findAllByBatchIdOrderBySerial(b.getId());
			long available = items.stream().filter(p -> p.getStatus() == PlateStatus.AVAILABLE).count();
			long inUse = items.stream().filter(p -> p.getStatus().isBound()).count();
			return new BatchView(b.getId(), b.getCode(), b.getManufacturedOn(), b.getQuantity(), b.getNotes(),
					b.getCreatedAt(), available, inUse);
		}).toList();
	}

	@Transactional(readOnly = true)
	public PlateBatch getBatch(UUID id) {
		return batches.findById(id).orElseThrow(() -> new NotFoundException("Lote não encontrado."));
	}

	@Transactional(readOnly = true)
	public List<Plate> platesOfBatch(UUID batchId) {
		return plates.findAllByBatchIdOrderBySerial(batchId);
	}

	// ---------------------------------------------------------------- Consulta

	@Transactional(readOnly = true)
	public Page<PlateView> search(String search, PlateStatus status, UUID batchId, UUID restaurantId,
			Pageable pageable) {
		Specification<Plate> spec = (root, q, cb) -> cb.conjunction();
		if (status != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
		}
		if (batchId != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("batchId"), batchId));
		}
		if (restaurantId != null) {
			spec = spec.and((root, q, cb) -> cb.equal(root.get("restaurantId"), restaurantId));
		}
		if (search != null && !search.isBlank()) {
			String term = "%" + search.trim().toUpperCase(Locale.ROOT) + "%";
			spec = spec.and((root, q, cb) -> cb.or(cb.like(root.get("serial"), term),
					cb.like(root.get("publicToken"), term)));
		}
		Page<Plate> page = plates.findAll(spec, pageable);
		Map<UUID, Ref> refs = resolveRefs(page.getContent());
		return page.map(p -> toView(p, refs));
	}

	@Transactional(readOnly = true)
	public PlateDetail detail(UUID id) {
		Plate plate = plates.findById(id).orElseThrow(() -> new NotFoundException("Plaquinha não encontrada."));
		List<PlateEvent> history = events.findAllByPlateIdOrderBySeqDesc(id);
		List<Plate> forRefs = new ArrayList<>(List.of(plate));
		Map<UUID, Ref> refs = resolveRefs(forRefs);
		refs.putAll(resolveRefIds(history.stream().map(PlateEvent::getRestaurantId).collect(Collectors.toSet()),
				history.stream().map(PlateEvent::getTableId).collect(Collectors.toSet())));
		List<EventView> views = history.stream()
			.map(e -> new EventView(e.getId(), e.getEvent(), e.getFromStatus(), e.getToStatus(),
					refs.get(e.getRestaurantId()), refs.get(e.getTableId()), e.getActorEmail(), e.getReason(),
					e.getCreatedAt()))
			.toList();
		return new PlateDetail(toView(plate, refs), views);
	}

	@Transactional(readOnly = true)
	public Plate get(UUID id) {
		return plates.findById(id).orElseThrow(() -> new NotFoundException("Plaquinha não encontrada."));
	}

	@Transactional(readOnly = true)
	public InventoryCounts counts() {
		return new InventoryCounts(plates.countByStatus(PlateStatus.AVAILABLE),
				plates.countByStatus(PlateStatus.RESERVED), plates.countByStatus(PlateStatus.ACTIVE),
				plates.countByStatus(PlateStatus.SUSPENDED), plates.countByStatus(PlateStatus.DAMAGED),
				plates.countByStatus(PlateStatus.DEACTIVATED));
	}

	/** Plaquinha em uso por mesa (ativa ou suspensa) de um restaurante, para o painel do próprio restaurante. */
	public record TablePlate(UUID tableId, String serial, PlateStatus status, String publicUrl) {
	}

	@Transactional(readOnly = true)
	public List<TablePlate> platesOnTablesOf(UUID restaurantId) {
		return plates.findAll((Specification<Plate>) (root, q, cb) -> cb.and(cb.equal(root.get("restaurantId"), restaurantId),
				root.get("status").in(PlateStatus.ACTIVE, PlateStatus.SUSPENDED)))
			.stream()
			.map(p -> new TablePlate(p.getTableId(), p.getSerial(), p.getStatus(), publicUrl(p.getPublicToken())))
			.toList();
	}

	@Transactional(readOnly = true)
	public long activeCountOf(UUID restaurantId) {
		return plates.countByRestaurantIdAndStatus(restaurantId, PlateStatus.ACTIVE);
	}

	// ---------------------------------------------------------------- Mudancas de status

	@Transactional
	public PlateEvent change(UUID plateId, Action action, UUID restaurantId, UUID tableId, String reason,
			String actorEmail) {
		Plate plate = plates.findForUpdate(plateId)
			.orElseThrow(() -> new NotFoundException("Plaquinha não encontrada."));
		PlateStatus from = plate.getStatus();
		UUID previousTable = plate.getTableId();
		Instant now = clock.instant();
		PlateEvent.Type type;
		String cleanReason = blankToNull(reason);

		switch (action) {
			case BIND -> {
				validateBinding(plate, restaurantId, tableId);
				type = tableId == null ? PlateEvent.Type.RESERVED
						: (from == PlateStatus.ACTIVE ? PlateEvent.Type.TRANSFERRED : PlateEvent.Type.ASSIGNED);
				plate.bind(restaurantId, tableId, now);
			}
			case RELEASE -> {
				requireReason(cleanReason, "desvincular");
				plate.release();
				type = PlateEvent.Type.RELEASED;
			}
			case SUSPEND -> {
				requireReason(cleanReason, "suspender");
				plate.suspend();
				type = PlateEvent.Type.SUSPENDED;
			}
			case REACTIVATE -> {
				plate.reactivate();
				type = PlateEvent.Type.REACTIVATED;
			}
			case DAMAGE -> {
				requireReason(cleanReason, "marcar como danificada");
				plate.markDamaged();
				type = PlateEvent.Type.DAMAGED;
			}
			case RESTORE -> {
				plate.restoreToStock();
				type = PlateEvent.Type.RESTORED;
			}
			case DEACTIVATE -> {
				requireReason(cleanReason, "desativar");
				plate.deactivate();
				type = PlateEvent.Type.DEACTIVATED;
			}
			default -> throw new IllegalStateException(action.name());
		}
		plates.flush();
		UUID eventRestaurant = plate.getRestaurantId() != null ? plate.getRestaurantId() : restaurantId;
		UUID eventTable = plate.getTableId() != null ? plate.getTableId() : previousTable;
		return events.save(new PlateEvent(plate.getId(), type, from, plate.getStatus(), eventRestaurant, eventTable,
				actorEmail, cleanReason, now));
	}

	private void validateBinding(Plate plate, UUID restaurantId, UUID tableId) {
		if (restaurantId == null) {
			throw new ConflictException("Selecione o restaurante.");
		}
		Restaurant restaurant = restaurants.findById(restaurantId)
			.orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
		if (restaurant.getStatus() == RestaurantStatus.CANCELLED) {
			throw new ConflictException("Não é possível vincular plaquinhas a um restaurante cancelado.");
		}
		if (tableId == null) {
			return;
		}
		RestaurantTable table = tables.findById(tableId)
			.orElseThrow(() -> new NotFoundException("Mesa não encontrada."));
		if (!table.getRestaurantId().equals(restaurantId)) {
			throw new ConflictException("A mesa selecionada não pertence a este restaurante.");
		}
		if (!table.isActive()) {
			throw new ConflictException("A mesa " + table.getLabel() + " está desativada.");
		}
		plates.findInUseByTable(tableId)
			.filter(other -> !other.getId().equals(plate.getId()))
			.ifPresent(other -> {
				throw new ConflictException(
						"A mesa " + table.getLabel() + " já usa a plaquinha " + other.getSerial() + ". Desvincule-a antes.");
			});
	}

	private static void requireReason(String reason, String action) {
		if (reason == null) {
			throw new ConflictException("Informe o motivo para " + action + " a plaquinha.");
		}
	}

	// ---------------------------------------------------------------- Auxiliares

	private String uniqueToken() {
		for (int attempt = 0; attempt < 10; attempt++) {
			String token = PlateTokenGenerator.next();
			if (!plates.existsByPublicToken(token)) {
				return token;
			}
		}
		throw new IllegalStateException("Não foi possível gerar um token único para a plaquinha");
	}

	private PlateView toView(Plate p, Map<UUID, Ref> refs) {
		return new PlateView(p.getId(), p.getSerial(), p.getPublicToken(), publicUrl(p.getPublicToken()),
				p.getStatus(), refs.get(p.getBatchId()), refs.get(p.getRestaurantId()), refs.get(p.getTableId()),
				p.getActivatedAt(), p.getUpdatedAt());
	}

	private Map<UUID, Ref> resolveRefs(List<Plate> items) {
		Map<UUID, Ref> refs = resolveRefIds(
				items.stream().map(Plate::getRestaurantId).collect(Collectors.toSet()),
				items.stream().map(Plate::getTableId).collect(Collectors.toSet()));
		Set<UUID> batchIds = items.stream().map(Plate::getBatchId).collect(Collectors.toSet());
		batches.findAllById(batchIds).forEach(b -> refs.put(b.getId(), new Ref(b.getId(), b.getCode())));
		return refs;
	}

	private Map<UUID, Ref> resolveRefIds(Set<UUID> restaurantIds, Set<UUID> tableIds) {
		restaurantIds.remove(null);
		tableIds.remove(null);
		Map<UUID, Ref> refs = new HashMap<>();
		restaurants.findAllById(restaurantIds)
			.forEach(r -> refs.put(r.getId(), new Ref(r.getId(), r.getTradeName())));
		tables.findAllById(tableIds).forEach(t -> refs.put(t.getId(), new Ref(t.getId(), t.getLabel())));
		return refs;
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}


}
