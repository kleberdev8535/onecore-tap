package com.onecore.tap.restaurants;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RestaurantRepository extends JpaRepository<Restaurant, UUID> {

	boolean existsBySlug(String slug);

	boolean existsByCnpj(String cnpj);

	long countByStatus(RestaurantStatus status);

	long countByCreatedAtGreaterThanEqual(java.time.Instant instant);

	/** search já deve chegar em minúsculas e com curingas, ex: "%burger%". */
	@Query("""
			select r from Restaurant r
			where (:status is null or r.status = :status)
			  and (:search is null or lower(r.tradeName) like :search or r.slug like :search or r.cnpj like :search)
			""")
	Page<Restaurant> search(String search, RestaurantStatus status, Pageable pageable);

}
