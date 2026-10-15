package com.onecore.tap.payments;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Consultas filtradas pelo tenant da sessão (@TenantId). */
interface PaymentRepository extends JpaRepository<Payment, UUID> {

	@Query("select p from Payment p where p.createdAt >= :from and p.createdAt < :to order by p.createdAt desc")
	Page<Payment> findInPeriod(java.time.Instant from, java.time.Instant to, Pageable pageable);

}

interface PaymentEntryRepository extends JpaRepository<PaymentEntry, UUID> {

	List<PaymentEntry> findByPaymentIdIn(Collection<UUID> paymentIds);

}
