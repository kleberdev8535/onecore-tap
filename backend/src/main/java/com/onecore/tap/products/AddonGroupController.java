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
import com.onecore.tap.products.MenuDtos.AddonGroupRequest;
import com.onecore.tap.products.MenuDtos.AddonGroupView;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@Tag(name = "Restaurante - Adicionais e variações")
@RestController
@RequestMapping("/api/restaurant/addon-groups")
public class AddonGroupController {

	private final MenuService menu;

	private final AuditService audit;

	public AddonGroupController(MenuService menu, AuditService audit) {
		this.menu = menu;
		this.audit = audit;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('PERM_MENU_VIEW')")
	public List<AddonGroupView> list() {
		return menu.listAddonGroups();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public AddonGroupView create(@Valid @RequestBody AddonGroupRequest body, HttpServletRequest request) {
		AddonGroupView saved = menu.createAddonGroup(body);
		audit.record(AuditAction.ADDON_GROUP_CREATED, CurrentUser.require(), "addon_group", saved.id(), request,
				Map.of("name", saved.name(), "options", saved.options().size()));
		return saved;
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public AddonGroupView update(@PathVariable UUID id, @Valid @RequestBody AddonGroupRequest body,
			HttpServletRequest request) {
		AddonGroupView saved = menu.updateAddonGroup(id, body);
		audit.record(AuditAction.ADDON_GROUP_UPDATED, CurrentUser.require(), "addon_group", id, request,
				Map.of("name", saved.name(), "options", saved.options().size()));
		return saved;
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@PreAuthorize("hasAuthority('PERM_MENU_MANAGE')")
	public void delete(@PathVariable UUID id, HttpServletRequest request) {
		AddonGroup deleted = menu.deleteAddonGroup(id);
		audit.record(AuditAction.ADDON_GROUP_DELETED, CurrentUser.require(), "addon_group", id, request,
				Map.of("name", deleted.getName()));
	}

}
