package com.onecore.tap.orders;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

/**
 * Repositórios de pedidos. Todos filtrados pelo tenant (@TenantId): o restaurante vem da sessão da equipe ou, no
 * cardápio público, da plaquinha resolvida pelo backend (TenantContext).
 */
final class OrderRepositories {

	private OrderRepositories() {
	}

}

interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {

	Optional<Order> findByTrackingToken(String trackingToken);

	@Query("select o from Order o where o.status not in ('COMPLETED', 'CANCELLED') or o.updatedAt >= :since order by o.createdAt")
	List<Order> findBoard(Instant since);

	List<Order> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);

	List<Order> findBySessionIdInOrderByCreatedAtAsc(Collection<UUID> sessionIds);

	List<Order> findBySessionIdAndClientTokenOrderByCreatedAtDesc(UUID sessionId, String clientToken);

}

interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

	List<OrderItem> findByOrderIdInOrderByPositionAsc(Collection<UUID> orderIds);

}

interface OrderItemOptionRepository extends JpaRepository<OrderItemOption, UUID> {

	List<OrderItemOption> findByOrderItemIdIn(Collection<UUID> itemIds);

}

interface OrderEventRepository extends JpaRepository<OrderEvent, UUID> {

	List<OrderEvent> findByOrderIdOrderBySeqAsc(UUID orderId);

}

interface TableSessionRepository extends JpaRepository<TableSession, UUID> {

	@Query("select s from TableSession s where s.tableId = :tableId and s.closedAt is null")
	Optional<TableSession> findOpen(UUID tableId);

	@Query("select s from TableSession s where s.closedAt is null")
	List<TableSession> findAllOpen();

}

interface ServiceRequestRepository extends JpaRepository<ServiceRequest, UUID> {

	@Query("select r from ServiceRequest r where r.status = 'OPEN' order by r.createdAt")
	List<ServiceRequest> findOpen();

	@Query("select r from ServiceRequest r where r.status = 'OPEN' and r.tableId = :tableId and r.type = :type")
	Optional<ServiceRequest> findOpen(UUID tableId, ServiceRequest.Type type);

	@Query("select r from ServiceRequest r where r.status = 'OPEN' and r.tableId = :tableId")
	List<ServiceRequest> findOpenOfTable(UUID tableId);

}
