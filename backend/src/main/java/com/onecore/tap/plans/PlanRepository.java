package com.onecore.tap.plans;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlanRepository extends JpaRepository<Plan, UUID> {

	boolean existsByCode(String code);

	List<Plan> findAllByOrderByMonthlyPriceCentsAsc();

	@Query("select count(r) from Restaurant r where r.planId = :planId")
	long countRestaurants(UUID planId);

}
