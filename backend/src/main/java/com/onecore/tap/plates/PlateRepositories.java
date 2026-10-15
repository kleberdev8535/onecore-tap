package com.onecore.tap.plates;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

interface PlateRepository extends JpaRepository<Plate, UUID>, JpaSpecificationExecutor<Plate> {

	Optional<Plate> findByPublicToken(String publicToken);

	boolean existsByPublicToken(String publicToken);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Plate p where p.id = :id")
	Optional<Plate> findForUpdate(UUID id);

	@Query("select p from Plate p where p.tableId = :tableId and p.status in ('ACTIVE', 'SUSPENDED')")
	Optional<Plate> findInUseByTable(UUID tableId);

	long countByStatus(PlateStatus status);

	long countByRestaurantIdAndStatus(UUID restaurantId, PlateStatus status);

	List<Plate> findAllByBatchIdOrderBySerial(UUID batchId);

	List<Plate> findAllByRestaurantIdOrderBySerial(UUID restaurantId);

	@Query(value = "select nextval('plate_serial_seq')", nativeQuery = true)
	long nextSerial();

}

interface PlateBatchRepository extends JpaRepository<PlateBatch, UUID> {

	boolean existsByCode(String code);

	List<PlateBatch> findAllByOrderByCreatedAtDesc();

}

interface PlateEventRepository extends JpaRepository<PlateEvent, UUID> {

	List<PlateEvent> findAllByPlateIdOrderBySeqDesc(UUID plateId);

}
