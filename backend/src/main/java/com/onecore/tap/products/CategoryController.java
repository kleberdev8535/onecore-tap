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
import com.onecore.tap.categories.Category;
import com.onecore.tap.products.MenuDtos.CategoryRequest;
import com.onecore.tap.products.MenuDtos.CategoryView;
import com.onecore.tap.products.MenuDtos.ReorderRequest;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@Tag(name = "Restaurante - Categorias")
@RestController
@RequestMapping("/api/restaurant/categories")
public class CategoryController {

	private final MenuService menu;

	private final AuditService audit;

	public CategoryController(MenuService menu, AuditService audit) {
		this.menu = menu;
		this.audit = audit;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_MENU_VIEW')")
	public List<CategoryView> list() {
		return menu.listCategories();
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_MENU_VIEW')")
	public CategoryView get(@PathVariable UUID id) {
		return menu.getCategory(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public CategoryView create(@Valid @RequestBody CategoryRequest body, HttpServletRequest request) {
		CategoryView saved = menu.createCategory(body);
		audit.record(AuditAction.CATEGORY_CREATED, CurrentUser.require(), "category", saved.id(), request,
				Map.of("name", saved.name()));
		return saved;
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public CategoryView update(@PathVariable UUID id, @Valid @RequestBody CategoryRequest body,
			HttpServletRequest request) {
		CategoryView saved = menu.updateCategory(id, body);
		audit.record(AuditAction.CATEGORY_UPDATED, CurrentUser.require(), "category", id, request,
				Map.of("name", saved.name(), "active", saved.active()));
		return saved;
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public void delete(@PathVariable UUID id, HttpServletRequest request) {
		Category deleted = menu.deleteCategory(id);
		audit.record(AuditAction.CATEGORY_DELETED, CurrentUser.require(), "category", id, request,
				Map.of("name", deleted.getName()));
	}

	@PutMapping("/order")
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public List<CategoryView> reorder(@Valid @RequestBody ReorderRequest body, HttpServletRequest request) {
		List<CategoryView> result = menu.reorderCategories(body.ids());
		audit.record(AuditAction.CATEGORIES_REORDERED, CurrentUser.require(), "category", null, request);
		return result;
	}

}
