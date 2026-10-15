package com.onecore.tap.plates;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.audit.AuditAction;
import com.onecore.tap.audit.AuditService;
import com.onecore.tap.common.PageResponse;
import com.onecore.tap.plates.PlateDtos.BatchView;
import com.onecore.tap.plates.PlateDtos.ChangeRequest;
import com.onecore.tap.plates.PlateDtos.CreateBatchRequest;
import com.onecore.tap.plates.PlateDtos.InventoryCounts;
import com.onecore.tap.plates.PlateDtos.PlateDetail;
import com.onecore.tap.plates.PlateDtos.PlateView;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@Tag(name = "Super Admin - Plaquinhas")
@RestController
@RequestMapping("/api/admin")
public class AdminPlateController {

	private final PlateService service;

	private final PlateQrService qr;

	private final AuditService audit;

	public AdminPlateController(PlateService service, PlateQrService qr, AuditService audit) {
		this.service = service;
		this.qr = qr;
		this.audit = audit;
	}

	@GetMapping("/plates")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public PageResponse<PlateView> list(@RequestParam(required = false) String search,
			@RequestParam(required = false) PlateStatus status, @RequestParam(required = false) UUID batchId,
			@RequestParam(required = false) UUID restaurantId, @RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "25") int size) {
		PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100), Sort.by("serial"));
		var result = service.search(search, status, batchId, restaurantId, pageable);
		return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
				result.getTotalElements(), result.getTotalPages());
	}

	@GetMapping("/plates/counts")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public InventoryCounts counts() {
		return service.counts();
	}

	@GetMapping("/plates/{id}")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public PlateDetail detail(@PathVariable UUID id) {
		return service.detail(id);
	}

	@PostMapping("/plates/{id}/changes")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_PLATES_MANAGE')")
	public PlateDetail change(@PathVariable UUID id, @Valid @RequestBody ChangeRequest body,
			HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		PlateEvent event = service.change(id, body.action(), body.restaurantId(), body.tableId(), body.reason(),
				actor.email());
		Map<String, Object> details = new HashMap<>();
		details.put("event", event.getEvent().name());
		details.put("from", String.valueOf(event.getFromStatus()));
		details.put("to", event.getToStatus().name());
		if (event.getRestaurantId() != null) {
			details.put("restaurantId", event.getRestaurantId().toString());
		}
		if (event.getTableId() != null) {
			details.put("tableId", event.getTableId().toString());
		}
		if (event.getReason() != null) {
			details.put("reason", event.getReason());
		}
		audit.record(AuditAction.PLATE_STATUS_CHANGED, actor, "plate", id, request, details);
		return service.detail(id);
	}

	@GetMapping(value = "/plates/{id}/qr.svg", produces = "image/svg+xml")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public ResponseEntity<String> qrSvg(@PathVariable UUID id) {
		Plate plate = service.get(id);
		return download(qr.svg(service.publicUrl(plate.getPublicToken())), "image/svg+xml",
				plate.getSerial() + ".svg");
	}

	@GetMapping(value = "/plates/{id}/qr.png", produces = MediaType.IMAGE_PNG_VALUE)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public ResponseEntity<byte[]> qrPng(@PathVariable UUID id, @RequestParam(defaultValue = "1024") int size) {
		Plate plate = service.get(id);
		return download(qr.png(service.publicUrl(plate.getPublicToken()), Math.clamp(size, 256, 4096)),
				MediaType.IMAGE_PNG_VALUE, plate.getSerial() + ".png");
	}

	@GetMapping("/plate-batches")
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public List<BatchView> batches() {
		return service.listBatches();
	}

	@PostMapping("/plate-batches")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_PLATES_MANAGE')")
	public BatchView createBatch(@Valid @RequestBody CreateBatchRequest body, HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		PlateBatch batch = service.createBatch(body.code(), body.manufacturedOn(), body.quantity(), body.notes(),
				actor.email());
		audit.record(AuditAction.PLATE_BATCH_CREATED, actor, "plate_batch", batch.getId(), request,
				Map.of("code", batch.getCode(), "quantity", batch.getQuantity()));
		return service.listBatches().stream().filter(b -> b.id().equals(batch.getId())).findFirst().orElseThrow();
	}

	@GetMapping(value = "/plate-batches/{id}/labels.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
	@PreAuthorize("hasAuthority('PERM_PLATFORM_VIEW')")
	public ResponseEntity<byte[]> labels(@PathVariable UUID id) {
		PlateBatch batch = service.getBatch(id);
		byte[] pdf = qr.labelsPdf(batch.getCode(), service.platesOfBatch(id), service::publicUrl);
		return download(pdf, MediaType.APPLICATION_PDF_VALUE, "onecore-tap-" + batch.getCode() + ".pdf");
	}

	private static <T> ResponseEntity<T> download(T body, String contentType, String filename) {
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(contentType))
			.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
			.header(HttpHeaders.CACHE_CONTROL, "no-store")
			.body(body);
	}

}
