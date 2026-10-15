package com.onecore.tap.products;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import com.onecore.tap.products.MenuDtos.AvailabilityRequest;
import com.onecore.tap.products.MenuDtos.ProductRequest;
import com.onecore.tap.products.MenuDtos.ProductView;
import com.onecore.tap.products.MenuDtos.ReorderRequest;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@Tag(name = "Restaurante - Produtos")
@RestController
@RequestMapping("/api/restaurant/products")
public class ProductController {

	private final MenuService menu;

	private final AuditService audit;

	public ProductController(MenuService menu, AuditService audit) {
		this.menu = menu;
		this.audit = audit;
	}

	@Operation(summary = "Todos os produtos do restaurante, na ordem de exibição")
	@GetMapping
	@PreAuthorize("hasAuthority('PERM_MENU_VIEW')")
	public List<ProductView> list() {
		return menu.listProducts();
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_MENU_VIEW')")
	public ProductView get(@PathVariable UUID id) {
		return menu.getProduct(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public ProductView create(@Valid @RequestBody ProductRequest body, HttpServletRequest request) {
		ProductView saved = menu.createProduct(body);
		audit.record(AuditAction.PRODUCT_CREATED, CurrentUser.require(), "product", saved.id(), request,
				Map.of("name", saved.name(), "priceCents", saved.priceCents()));
		return saved;
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public ProductView update(@PathVariable UUID id, @Valid @RequestBody ProductRequest body,
			HttpServletRequest request) {
		ProductView saved = menu.updateProduct(id, body);
		audit.record(AuditAction.PRODUCT_UPDATED, CurrentUser.require(), "product", id, request,
				Map.of("name", saved.name(), "priceCents", saved.priceCents()));
		return saved;
	}

	@Operation(summary = "Marca o produto como disponível ou esgotado")
	@PutMapping("/{id}/availability")
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public ProductView availability(@PathVariable UUID id, @Valid @RequestBody AvailabilityRequest body,
			HttpServletRequest request) {
		ProductView saved = menu.setAvailability(id, body.available());
		audit.record(AuditAction.PRODUCT_AVAILABILITY_CHANGED, CurrentUser.require(), "product", id, request,
				Map.of("name", saved.name(), "available", saved.available()));
		return saved;
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public void delete(@PathVariable UUID id, HttpServletRequest request) {
		Product deleted = menu.deleteProduct(id);
		audit.record(AuditAction.PRODUCT_DELETED, CurrentUser.require(), "product", id, request,
				Map.of("name", deleted.getName()));
	}

	@Operation(summary = "Reordena os produtos de uma categoria")
	@PutMapping("/order/{categoryId}")
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public List<ProductView> reorder(@PathVariable UUID categoryId, @Valid @RequestBody ReorderRequest body,
			HttpServletRequest request) {
		List<ProductView> result = menu.reorderProducts(categoryId, body.ids());
		audit.record(AuditAction.PRODUCTS_REORDERED, CurrentUser.require(), "category", categoryId, request);
		return result;
	}

}
