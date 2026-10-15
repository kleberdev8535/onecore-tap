package com.onecore.tap.orders;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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
import com.onecore.tap.orders.OrderDtos.Board;
import com.onecore.tap.orders.OrderDtos.OrderDetail;
import com.onecore.tap.orders.OrderDtos.OrderView;
import com.onecore.tap.orders.OrderDtos.ServiceRequestView;
import com.onecore.tap.orders.OrderDtos.TransitionRequest;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@Tag(name = "Restaurante - Pedidos")
@RestController
@RequestMapping("/api/restaurant/orders")
public class RestaurantOrderController {

	private final OrderService orders;

	private final AuditService audit;

	private final com.onecore.tap.plans.PlanFeatures planFeatures;

	public RestaurantOrderController(OrderService orders, AuditService audit,
			com.onecore.tap.plans.PlanFeatures planFeatures) {
		this.orders = orders;
		this.planFeatures = planFeatures;
		this.audit = audit;
	}

	@Operation(summary = "Quadro operacional: pedidos em andamento, finalizados nas últimas horas e chamados abertos")
	@GetMapping("/board")
	@PreAuthorize("hasAuthority('PERM_ORDERS_VIEW')")
	public Board board() {
		return orders.board();
	}

	@Operation(summary = "Histórico de pedidos com filtros (paginado)")
	@GetMapping
	@PreAuthorize("hasAuthority('PERM_ORDERS_VIEW')")
	public PageResponse<OrderView> history(@RequestParam(required = false) OrderStatus status,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
			@RequestParam(required = false) String search, @RequestParam(defaultValue = "0") int page) {
		var result = orders.history(status, from, to, search, page);
		return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(), result.getTotalElements(),
				result.getTotalPages());
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_ORDERS_VIEW')")
	public OrderDetail detail(@PathVariable UUID id) {
		return orders.detail(id);
	}

	@Operation(summary = "Move o pedido de etapa. O servidor valida a transição, o perfil e conflitos de edição")
	@PostMapping("/{id}/transition")
	@PreAuthorize("hasAnyAuthority('PERM_ORDERS_MANAGE', 'PERM_KITCHEN_OPERATE')")
	public OrderView transition(@PathVariable UUID id, @Valid @RequestBody TransitionRequest body,
			HttpServletRequest request) {
		AuthenticatedUser actor = CurrentUser.require();
		// Quem só opera a cozinha depende do módulo Cozinha do plano.
		if (!actor.role().permissions().contains(com.onecore.tap.security.Permission.ORDERS_MANAGE)) {
			planFeatures.require(com.onecore.tap.plans.PlanModule.KITCHEN);
		}
		OrderView result = orders.transition(id, body.from(), body.to(), body.reason(), actor);
		if (body.to() == OrderStatus.CANCELLED) {
			audit.record(AuditAction.ORDER_CANCELLED, actor, "order", id, request,
					Map.of("number", result.number(), "reason", result.cancelReason(), "totalCents", result.totalCents()));
		}
		return result;
	}

	@GetMapping("/requests")
	@PreAuthorize("hasAuthority('PERM_ORDERS_VIEW')")
	public List<ServiceRequestView> requests() {
		return orders.openRequests();
	}

	@PostMapping("/requests/{id}/resolve")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@PreAuthorize("hasAuthority('PERM_ORDERS_MANAGE')")
	public void resolve(@PathVariable UUID id) {
		orders.resolveRequest(id, CurrentUser.require());
	}

}
