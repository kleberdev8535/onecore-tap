package com.onecore.tap.billing;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.common.ConflictException;

/**
 * Receita da OneCore Business: assinaturas e venda de plaquinhas. Consulta somente subscriptions,
 * subscription_invoices e plate_sales: o faturamento dos restaurantes (orders) nunca entra aqui.
 */
@Service
public class PlatformFinanceService {

	private final JdbcTemplate jdbc;

	private final BillingService billing;

	public PlatformFinanceService(JdbcTemplate jdbc, BillingService billing) {
		this.jdbc = jdbc;
		this.billing = billing;
	}

	public record Summary(LocalDate from, LocalDate to, long mrrCents, long payingSubscriptions, long trialing,
			long pastDue, long suspended, long receivedSubscriptionsCents, long receivedPlatesCents,
			long openInvoicesCents, long overdueCents, long overdueRestaurants, long platesReceivableCents,
			long platesSold, long newSubscriptions, long cancellations, double delinquencyRate, int platePriceCents,
			List<MonthPoint> months) {
	}

	public record MonthPoint(String month, long subscriptionsCents, long platesCents) {
	}

	@Transactional(readOnly = true)
	public Summary summary(LocalDate from, LocalDate to) {
		if (from == null || to == null || to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > 366) {
			throw new ConflictException("Período inválido (até 366 dias).");
		}
		LocalDate today = billing.today();
		Timestamp start = Timestamp.from(from.atStartOfDay(BillingService.ZONE).toInstant());
		Timestamp end = Timestamp.from(to.plusDays(1).atStartOfDay(BillingService.ZONE).toInstant());

		long mrr = count("select coalesce(sum(price_cents), 0) from subscriptions where status in ('ACTIVE', 'PAST_DUE')");
		long paying = count("select count(*) from subscriptions where status in ('ACTIVE', 'PAST_DUE')");
		long trialing = count("select count(*) from subscriptions where status = 'TRIALING'");
		long pastDue = count("select count(*) from subscriptions where status = 'PAST_DUE'");
		long suspended = count("select count(*) from subscriptions where status = 'SUSPENDED'");
		long receivedSubs = count("select coalesce(sum(amount_cents), 0) from subscription_invoices where status = 'PAID' and paid_at >= ? and paid_at < ?", start, end);
		long receivedPlates = count("select coalesce(sum(total_cents), 0) from plate_sales where status = 'PAID' and paid_at >= ? and paid_at < ?", start, end);
		long open = count("select coalesce(sum(amount_cents), 0) from subscription_invoices where status = 'OPEN'");
		long overdue = count("select coalesce(sum(amount_cents), 0) from subscription_invoices where status = 'OPEN' and due_date < ?", Date.valueOf(today));
		long overdueRestaurants = count("select count(distinct restaurant_id) from subscription_invoices where status = 'OPEN' and due_date < ?", Date.valueOf(today));
		long platesReceivable = count("select coalesce(sum(total_cents), 0) from plate_sales where status = 'OPEN'");
		long platesSold = count("select coalesce(sum(quantity), 0) from plate_sales where status <> 'VOID' and created_at >= ? and created_at < ?", start, end);
		long created = count("select count(*) from subscriptions where created_at >= ? and created_at < ?", start, end);
		long cancelled = count("select count(*) from subscriptions where cancelled_at >= ? and cancelled_at < ?", start, end);
		long base = paying + suspended;
		double rate = base == 0 ? 0 : (double) overdueRestaurants / base;

		List<MonthPoint> months = new ArrayList<>();
		YearMonth last = YearMonth.from(to);
		for (int i = 5; i >= 0; i--) {
			YearMonth m = last.minusMonths(i);
			Timestamp ms = Timestamp.from(m.atDay(1).atStartOfDay(BillingService.ZONE).toInstant());
			Timestamp me = Timestamp.from(m.plusMonths(1).atDay(1).atStartOfDay(BillingService.ZONE).toInstant());
			months.add(new MonthPoint(m.toString(),
					count("select coalesce(sum(amount_cents), 0) from subscription_invoices where status = 'PAID' and paid_at >= ? and paid_at < ?", ms, me),
					count("select coalesce(sum(total_cents), 0) from plate_sales where status = 'PAID' and paid_at >= ? and paid_at < ?", ms, me)));
		}
		return new Summary(from, to, mrr, paying, trialing, pastDue, suspended, receivedSubs, receivedPlates, open, overdue,
				overdueRestaurants, platesReceivable, platesSold, created, cancelled, rate, billing.platePrice(), months);
	}

	private long count(String sql, Object... args) {
		Long v = jdbc.queryForObject(sql, Long.class, args);
		return v == null ? 0 : v;
	}

}
