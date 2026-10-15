package com.onecore.tap.products;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/**
 * Repositórios do cardápio. Todas as consultas já chegam filtradas pelo tenant da sessão (@TenantId) e nunca
 * recebem restaurantId como parâmetro.
 */
final class MenuRepositories {

	private MenuRepositories() {
	}

}

interface ProductRepository extends JpaRepository<Product, UUID> {

	@Query("select p from Product p order by p.position, lower(p.name)")
	List<Product> findAllOrdered();

	List<Product> findByCategoryIdOrderByPositionAsc(UUID categoryId);

	long countByCategoryId(UUID categoryId);

	@Query("select p.categoryId, count(p) from Product p group by p.categoryId")
	List<Object[]> countByCategory();

	boolean existsByCategoryIdAndNameIgnoreCase(UUID categoryId, String name);

	boolean existsByCategoryIdAndNameIgnoreCaseAndIdNot(UUID categoryId, String name, UUID id);

	@Query("select coalesce(max(p.position), -1) from Product p where p.categoryId = :categoryId")
	int findMaxPosition(UUID categoryId);

}

interface AddonGroupRepository extends JpaRepository<AddonGroup, UUID> {

	@Query("select g from AddonGroup g order by g.position, lower(g.name)")
	List<AddonGroup> findAllOrdered();

	boolean existsByNameIgnoreCase(String name);

	boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

	@Query("select coalesce(max(g.position), -1) from AddonGroup g")
	int findMaxPosition();

}

interface AddonOptionRepository extends JpaRepository<AddonOption, UUID> {

	List<AddonOption> findByGroupIdInOrderByPositionAsc(Collection<UUID> groupIds);

	List<AddonOption> findByGroupId(UUID groupId);

}

interface ProductAddonLinkRepository extends JpaRepository<ProductAddonLink, UUID> {

	List<ProductAddonLink> findByProductIdInOrderByPositionAsc(Collection<UUID> productIds);

	@Query("select l.addonGroupId, count(l) from ProductAddonLink l group by l.addonGroupId")
	List<Object[]> countByGroup();

	@Modifying
	@Query("delete from ProductAddonLink l where l.productId = :productId")
	void deleteByProduct(UUID productId);

}
