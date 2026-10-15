package com.onecore.tap.categories;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Consultas já chegam filtradas pelo tenant via @TenantId; não recebem restaurantId como parametro. */
public interface CategoryRepository extends JpaRepository<Category, UUID> {

	List<Category> findAllByOrderByPositionAscNameAsc();

	boolean existsByNameIgnoreCase(String name);

	@Query("select coalesce(max(c.position), -1) from Category c")
	int findMaxPosition();

}
