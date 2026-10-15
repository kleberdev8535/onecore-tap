package com.onecore.tap.products;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.categories.Category;
import com.onecore.tap.categories.CategoryRepository;
import com.onecore.tap.common.ConflictException;
import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.products.MenuDtos.AddonGroupRequest;
import com.onecore.tap.products.MenuDtos.AddonGroupView;
import com.onecore.tap.products.MenuDtos.AddonOptionRequest;
import com.onecore.tap.products.MenuDtos.AddonOptionView;
import com.onecore.tap.products.MenuDtos.CategoryRequest;
import com.onecore.tap.products.MenuDtos.CategoryView;
import com.onecore.tap.products.MenuDtos.ProductRequest;
import com.onecore.tap.products.MenuDtos.ProductView;

/**
 * Cardápio do restaurante logado: categorias, produtos, adicionais e variações.
 *
 * Nenhum método recebe restaurantId: todas as entidades usam @TenantId, então leituras e escritas acontecem
 * sempre no restaurante da sessão. Um ID de outro restaurante simplesmente não é encontrado (404).
 */
@Service
public class MenuService {

	private final CategoryRepository categories;

	private final ProductRepository products;

	private final AddonGroupRepository groups;

	private final AddonOptionRepository options;

	private final ProductAddonLinkRepository links;

	MenuService(CategoryRepository categories, ProductRepository products, AddonGroupRepository groups,
			AddonOptionRepository options, ProductAddonLinkRepository links) {
		this.categories = categories;
		this.products = products;
		this.groups = groups;
		this.options = options;
		this.links = links;
	}

	// ------------------------------------------------------------------ Categorias

	@Transactional(readOnly = true)
	public List<CategoryView> listCategories() {
		Map<UUID, Long> counts = toCountMap(products.countByCategory());
		return categories.findAllByOrderByPositionAscNameAsc()
			.stream()
			.map(c -> CategoryView.of(c, counts.getOrDefault(c.getId(), 0L)))
			.toList();
	}

	@Transactional(readOnly = true)
	public CategoryView getCategory(UUID id) {
		Category c = category(id);
		return CategoryView.of(c, products.countByCategoryId(id));
	}

	@Transactional
	public CategoryView createCategory(CategoryRequest req) {
		String name = clean(req.name());
		if (categories.existsByNameIgnoreCase(name)) {
			throw new ConflictException("Já existe uma categoria com este nome.");
		}
		Category c = new Category(name, categories.findMaxPosition() + 1);
		c.update(name, blank(req.description()), req.active() == null || req.active());
		return CategoryView.of(categories.saveAndFlush(c), 0);
	}

	@Transactional
	public CategoryView updateCategory(UUID id, CategoryRequest req) {
		Category c = category(id);
		String name = clean(req.name());
		if (!name.equalsIgnoreCase(c.getName()) && categories.existsByNameIgnoreCase(name)) {
			throw new ConflictException("Já existe uma categoria com este nome.");
		}
		c.update(name, blank(req.description()), req.active() == null ? c.isActive() : req.active());
		categories.flush();
		return CategoryView.of(c, products.countByCategoryId(id));
	}

	@Transactional
	public Category deleteCategory(UUID id) {
		Category c = category(id);
		long count = products.countByCategoryId(id);
		if (count > 0) {
			throw new ConflictException("Esta categoria tem " + count + (count == 1 ? " produto" : " produtos")
					+ ". Mova ou exclua os produtos antes de excluir a categoria.");
		}
		categories.delete(c);
		categories.flush();
		return c;
	}

	@Transactional
	public List<CategoryView> reorderCategories(List<UUID> ids) {
		List<Category> all = categories.findAllByOrderByPositionAscNameAsc();
		applyOrder(all, ids, Category::getId, Category::moveTo, "categorias");
		categories.flush();
		return listCategories();
	}

	// ------------------------------------------------------------------ Produtos

	@Transactional(readOnly = true)
	public List<ProductView> listProducts() {
		List<Product> all = products.findAllOrdered();
		Map<UUID, List<UUID>> groupsByProduct = groupIdsByProduct(all.stream().map(Product::getId).toList());
		return all.stream().map(p -> ProductView.of(p, groupsByProduct.getOrDefault(p.getId(), List.of()))).toList();
	}

	@Transactional(readOnly = true)
	public ProductView getProduct(UUID id) {
		return view(product(id));
	}

	@Transactional
	public ProductView createProduct(ProductRequest req) {
		Category target = category(req.categoryId());
		String name = clean(req.name());
		if (products.existsByCategoryIdAndNameIgnoreCase(target.getId(), name)) {
			throw new ConflictException("Já existe um produto com este nome em " + target.getName() + ".");
		}
		List<UUID> groupIds = validGroupIds(req.addonGroupIds());
		Product p = new Product(target.getId(), products.findMaxPosition(target.getId()) + 1);
		p.update(target.getId(), name, blank(req.description()), req.priceCents(), blank(req.imageUrl()), req.active(),
				req.available(), req.featured());
		products.saveAndFlush(p);
		replaceLinks(p.getId(), groupIds);
		return view(p);
	}

	@Transactional
	public ProductView updateProduct(UUID id, ProductRequest req) {
		Product p = product(id);
		Category target = category(req.categoryId());
		String name = clean(req.name());
		if (products.existsByCategoryIdAndNameIgnoreCaseAndIdNot(target.getId(), name, id)) {
			throw new ConflictException("Já existe um produto com este nome em " + target.getName() + ".");
		}
		List<UUID> groupIds = validGroupIds(req.addonGroupIds());
		if (!target.getId().equals(p.getCategoryId())) {
			// Ao trocar de categoria, o produto vai para o fim da nova lista.
			p.moveTo(products.findMaxPosition(target.getId()) + 1);
		}
		p.update(target.getId(), name, blank(req.description()), req.priceCents(), blank(req.imageUrl()), req.active(),
				req.available(), req.featured());
		products.flush();
		replaceLinks(p.getId(), groupIds);
		return view(p);
	}

	@Transactional
	public ProductView setAvailability(UUID id, boolean available) {
		Product p = product(id);
		p.setAvailable(available);
		products.flush();
		return view(p);
	}

	@Transactional
	public Product deleteProduct(UUID id) {
		Product p = product(id);
		products.delete(p);
		products.flush();
		return p;
	}

	@Transactional
	public List<ProductView> reorderProducts(UUID categoryId, List<UUID> ids) {
		category(categoryId);
		List<Product> inCategory = products.findByCategoryIdOrderByPositionAsc(categoryId);
		applyOrder(inCategory, ids, Product::getId, Product::moveTo, "produtos da categoria");
		products.flush();
		return listProducts();
	}

	// ------------------------------------------------------------------ Adicionais e variações

	@Transactional(readOnly = true)
	public List<AddonGroupView> listAddonGroups() {
		List<AddonGroup> all = groups.findAllOrdered();
		Map<UUID, List<AddonOptionView>> optionsByGroup = options
			.findByGroupIdInOrderByPositionAsc(all.stream().map(AddonGroup::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(AddonOption::getGroupId,
					Collectors.mapping(AddonOptionView::of, Collectors.toList())));
		Map<UUID, Long> usage = toCountMap(links.countByGroup());
		return all.stream()
			.map(g -> new AddonGroupView(g.getId(), g.getName(), g.getMinChoices(), g.getMaxChoices(), g.getPosition(),
					optionsByGroup.getOrDefault(g.getId(), List.of()), usage.getOrDefault(g.getId(), 0L)))
			.toList();
	}

	@Transactional
	public AddonGroupView createAddonGroup(AddonGroupRequest req) {
		String name = clean(req.name());
		if (groups.existsByNameIgnoreCase(name)) {
			throw new ConflictException("Já existe um grupo de adicionais com este nome.");
		}
		validateChoices(req);
		AddonGroup g = new AddonGroup(groups.findMaxPosition() + 1);
		g.update(name, req.minChoices(), req.maxChoices());
		groups.saveAndFlush(g);
		syncOptions(g.getId(), req.options());
		return groupView(g.getId());
	}

	@Transactional
	public AddonGroupView updateAddonGroup(UUID id, AddonGroupRequest req) {
		AddonGroup g = group(id);
		String name = clean(req.name());
		if (groups.existsByNameIgnoreCaseAndIdNot(name, id)) {
			throw new ConflictException("Já existe um grupo de adicionais com este nome.");
		}
		validateChoices(req);
		g.update(name, req.minChoices(), req.maxChoices());
		groups.flush();
		syncOptions(id, req.options());
		return groupView(id);
	}

	/** Opções e vínculos com produtos são removidos em cascata pelo banco. */
	@Transactional
	public AddonGroup deleteAddonGroup(UUID id) {
		AddonGroup g = group(id);
		groups.delete(g);
		groups.flush();
		return g;
	}

	// ------------------------------------------------------------------ Cardápio público e catálogo de preços

	public record PublicOption(UUID id, String name, int priceCents, boolean available) {
	}

	public record PublicGroup(UUID id, String name, int minChoices, int maxChoices, List<PublicOption> options) {
	}

	public record PublicProduct(UUID id, String name, String description, int priceCents, String imageUrl,
			boolean available, boolean featured, List<UUID> addonGroupIds) {
	}

	public record PublicCategory(UUID id, String name, String description, List<PublicProduct> products) {
	}

	public record PublicMenu(List<PublicCategory> categories, List<PublicGroup> addonGroups) {
	}

	/**
	 * Cardápio visto pelo cliente: somente categorias e produtos ativos. Produtos esgotados aparecem como
	 * indisponíveis. Chamado no contexto do restaurante resolvido pela plaquinha.
	 */
	@Transactional(readOnly = true)
	public PublicMenu publicMenu() {
		List<Product> all = products.findAllOrdered().stream().filter(Product::isActive).toList();
		Map<UUID, List<UUID>> groupsByProduct = groupIdsByProduct(all.stream().map(Product::getId).toList());
		List<PublicCategory> sections = categories.findAllByOrderByPositionAscNameAsc()
			.stream()
			.filter(Category::isActive)
			.map(c -> new PublicCategory(c.getId(), c.getName(), c.getDescription(), all.stream()
				.filter(p -> p.getCategoryId().equals(c.getId()))
				.map(p -> new PublicProduct(p.getId(), p.getName(), p.getDescription(), p.getPriceCents(),
						p.getImageUrl(), p.isAvailable(), p.isFeatured(),
						groupsByProduct.getOrDefault(p.getId(), List.of())))
				.toList()))
			.filter(c -> !c.products().isEmpty())
			.toList();
		Set<UUID> usedGroups = sections.stream()
			.flatMap(c -> c.products().stream())
			.flatMap(p -> p.addonGroupIds().stream())
			.collect(Collectors.toSet());
		List<PublicGroup> groupViews = groupsWithOptions(usedGroups).values()
			.stream()
			.map(g -> new PublicGroup(g.id(), g.name(), g.minChoices(), g.maxChoices(),
					g.options().stream().map(o -> new PublicOption(o.id(), o.name(), o.priceCents(), o.available())).toList()))
			.toList();
		return new PublicMenu(sections, groupViews);
	}

	public record CatalogOption(UUID id, String name, int priceCents, boolean available) {
	}

	public record CatalogGroup(UUID id, String name, int minChoices, int maxChoices, List<CatalogOption> options) {
	}

	/** Produto como o servidor o enxerga para precificar um pedido. orderable = ativo, disponível e em categoria visível. */
	public record CatalogProduct(UUID id, String name, int priceCents, boolean orderable, List<CatalogGroup> groups) {
	}

	/** Dados atuais de preço e regras de escolha dos produtos pedidos. Nunca usa valores enviados pelo navegador. */
	@Transactional(readOnly = true)
	public Map<UUID, CatalogProduct> catalog(java.util.Collection<UUID> productIds) {
		if (productIds.isEmpty()) {
			return Map.of();
		}
		List<Product> found = products.findAllById(productIds);
		Set<UUID> visibleCategories = categories.findAllById(found.stream().map(Product::getCategoryId).toList())
			.stream()
			.filter(Category::isActive)
			.map(Category::getId)
			.collect(Collectors.toSet());
		Map<UUID, List<UUID>> groupsByProduct = groupIdsByProduct(found.stream().map(Product::getId).toList());
		Map<UUID, CatalogGroup> groupsById = groupsWithOptions(
				groupsByProduct.values().stream().flatMap(List::stream).collect(Collectors.toSet()));
		Map<UUID, CatalogProduct> result = new HashMap<>();
		for (Product p : found) {
			List<CatalogGroup> productGroups = groupsByProduct.getOrDefault(p.getId(), List.of())
				.stream()
				.map(groupsById::get)
				.filter(java.util.Objects::nonNull)
				.toList();
			boolean orderable = p.isActive() && p.isAvailable() && visibleCategories.contains(p.getCategoryId());
			result.put(p.getId(), new CatalogProduct(p.getId(), p.getName(), p.getPriceCents(), orderable, productGroups));
		}
		return result;
	}

	private Map<UUID, CatalogGroup> groupsWithOptions(Set<UUID> groupIds) {
		if (groupIds.isEmpty()) {
			return Map.of();
		}
		Map<UUID, List<CatalogOption>> optionsByGroup = options.findByGroupIdInOrderByPositionAsc(groupIds)
			.stream()
			.collect(Collectors.groupingBy(AddonOption::getGroupId, Collectors.mapping(
					o -> new CatalogOption(o.getId(), o.getName(), o.getPriceCents(), o.isAvailable()),
					Collectors.toList())));
		Map<UUID, CatalogGroup> result = new java.util.LinkedHashMap<>();
		groups.findAllById(groupIds)
			.stream()
			.sorted(java.util.Comparator.comparingInt(AddonGroup::getPosition))
			.forEach(g -> result.put(g.getId(), new CatalogGroup(g.getId(), g.getName(), g.getMinChoices(),
					g.getMaxChoices(), optionsByGroup.getOrDefault(g.getId(), List.of()))));
		return result;
	}

	// ------------------------------------------------------------------ Apoio

	private static void validateChoices(AddonGroupRequest req) {
		if (req.minChoices() > req.maxChoices()) {
			throw new ConflictException("O mínimo de escolhas não pode ser maior que o máximo.");
		}
		if (req.maxChoices() > req.options().size()) {
			throw new ConflictException("O máximo de escolhas (" + req.maxChoices()
					+ ") não pode passar do número de opções (" + req.options().size() + ").");
		}
		Set<String> names = new HashSet<>();
		for (AddonOptionRequest o : req.options()) {
			if (!names.add(clean(o.name()).toLowerCase(Locale.ROOT))) {
				throw new ConflictException("A opção \"" + clean(o.name()) + "\" está repetida.");
			}
		}
	}

	/**
	 * Mantém as opções existentes (pelo id), cria as novas e remove as que saíram. As remoções são gravadas antes
	 * das inclusões para que uma opção excluída e recriada com o mesmo nome não viole o índice único.
	 */
	private void syncOptions(UUID groupId, List<AddonOptionRequest> requested) {
		Map<UUID, AddonOption> current = options.findByGroupId(groupId)
			.stream()
			.collect(Collectors.toMap(AddonOption::getId, Function.identity()));
		Set<UUID> kept = requested.stream()
			.map(AddonOptionRequest::id)
			.filter(current::containsKey)
			.collect(Collectors.toSet());
		List<AddonOption> removed = current.values().stream().filter(o -> !kept.contains(o.getId())).toList();
		if (!removed.isEmpty()) {
			options.deleteAll(removed);
			options.flush();
		}
		int position = 0;
		for (AddonOptionRequest o : requested) {
			AddonOption option = o.id() != null && current.containsKey(o.id()) ? current.get(o.id())
					: new AddonOption(groupId);
			option.update(clean(o.name()), o.priceCents(), o.available(), position++);
			options.save(option);
		}
		options.flush();
	}

	private AddonGroupView groupView(UUID id) {
		return listAddonGroups().stream()
			.filter(g -> g.id().equals(id))
			.findFirst()
			.orElseThrow(() -> new NotFoundException("Grupo de adicionais não encontrado."));
	}

	private List<UUID> validGroupIds(List<UUID> requested) {
		if (requested == null || requested.isEmpty()) {
			return List.of();
		}
		List<UUID> unique = new ArrayList<>(new LinkedHashSet<>(requested));
		// findAllById é filtrado pelo tenant: IDs de outro restaurante não voltam.
		if (groups.findAllById(unique).size() != unique.size()) {
			throw new NotFoundException("Grupo de adicionais não encontrado.");
		}
		return unique;
	}

	private void replaceLinks(UUID productId, List<UUID> groupIds) {
		links.deleteByProduct(productId);
		links.flush();
		for (int i = 0; i < groupIds.size(); i++) {
			links.save(new ProductAddonLink(productId, groupIds.get(i), i));
		}
		links.flush();
	}

	private Map<UUID, List<UUID>> groupIdsByProduct(List<UUID> productIds) {
		if (productIds.isEmpty()) {
			return Map.of();
		}
		return links.findByProductIdInOrderByPositionAsc(productIds)
			.stream()
			.collect(Collectors.groupingBy(ProductAddonLink::getProductId,
					Collectors.mapping(ProductAddonLink::getAddonGroupId, Collectors.toList())));
	}

	private ProductView view(Product p) {
		return ProductView.of(p, groupIdsByProduct(List.of(p.getId())).getOrDefault(p.getId(), List.of()));
	}

	private static <T> void applyOrder(List<T> current, List<UUID> ids, Function<T, UUID> idOf,
			java.util.function.ObjIntConsumer<T> move, String label) {
		Map<UUID, T> byId = new HashMap<>();
		current.forEach(item -> byId.put(idOf.apply(item), item));
		if (ids.size() != current.size() || !byId.keySet().equals(new HashSet<>(ids))) {
			throw new ConflictException("A lista de " + label + " mudou. Recarregue a página e tente novamente.");
		}
		for (int i = 0; i < ids.size(); i++) {
			move.accept(byId.get(ids.get(i)), i);
		}
	}

	private static Map<UUID, Long> toCountMap(List<Object[]> rows) {
		Map<UUID, Long> map = new HashMap<>();
		rows.forEach(r -> map.put((UUID) r[0], ((Number) r[1]).longValue()));
		return map;
	}

	private Category category(UUID id) {
		return categories.findById(id).orElseThrow(() -> new NotFoundException("Categoria não encontrada."));
	}

	private Product product(UUID id) {
		return products.findById(id).orElseThrow(() -> new NotFoundException("Produto não encontrado."));
	}

	private AddonGroup group(UUID id) {
		return groups.findById(id).orElseThrow(() -> new NotFoundException("Grupo de adicionais não encontrado."));
	}

	private static String clean(String value) {
		return value.trim().replaceAll("\\s+", " ");
	}

	private static String blank(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
