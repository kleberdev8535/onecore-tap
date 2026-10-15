package com.onecore.tap.audit;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {

	List<AuditLog> findByActorEmailOrderByCreatedAtDesc(String actorEmail);

	/** Ações feitas pelo funcionário e ações feitas sobre o acesso dele, sempre dentro do restaurante informado. */
	@Query("""
			select a from AuditLog a
			where a.restaurantId = :restaurantId
			  and (a.actorUserId = :userId or (a.entityType = 'user' and a.entityId = :userIdText))
			order by a.createdAt desc""")
	List<AuditLog> findStaffActivity(UUID restaurantId, UUID userId, String userIdText, Pageable pageable);

}
