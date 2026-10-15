package com.onecore.tap.billing;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

	Optional<Subscription> findByRestaurantId(UUID restaurantId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Subscription s where s.restaurantId = :restaurantId")
	Optional<Subscription> findByRestaurantIdForUpdate(UUID restaurantId);

	@Query("select s from Subscription s where s.status = 'TRIALING' and s.trialEndsAt <= :now")
	List<Subscription> findTrialsEndedBy(Instant now);

	@Query("select s from Subscription s where s.status in ('ACTIVE', 'PAST_DUE') and s.currentPeriodEnd <= :today")
	List<Subscription> findDueForRenewal(LocalDate today);

	List<Subscription> findByStatusIn(Collection<Subscription.Status> statuses);

	List<Subscription> findAllByOrderByCreatedAtDesc();

}

interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

	boolean existsBySubscriptionIdAndPeriodStart(UUID subscriptionId, LocalDate periodStart);

	List<Invoice> findByRestaurantIdOrderByPeriodStartDesc(UUID restaurantId);

	@Query("select i from Invoice i where i.subscriptionId = :subscriptionId and i.status = 'OPEN' order by i.dueDate")
	List<Invoice> findOpen(UUID subscriptionId);

	@Query("select i from Invoice i where i.status = 'OPEN' order by i.dueDate")
	List<Invoice> findAllOpen();

}

interface PlateSaleRepository extends JpaRepository<PlateSale, UUID> {

	List<PlateSale> findByRestaurantIdOrderByCreatedAtDesc(UUID restaurantId);

}
