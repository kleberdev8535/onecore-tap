package com.onecore.tap.payments;

import java.io.IOException;
import java.io.Writer;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.restaurants.OpeningHours;

/**
 * Indicadores financeiros e relatórios do restaurante. Mesma definição do dashboard: vendas = pedidos não
 * cancelados e que não são de teste, por data de criação no fuso do restaurante. Pagamentos por método vêm dos
 * registros não estornados, pela data do registro. O restaurant_id é sempre o da sessão.
 */
@Service
public class FinanceService {

	static final int MAX_DAYS = 366;

	private static final ZoneId ZONE = OpeningHours.BUSINESS_ZONE;

	private final JdbcTemplate jdbc;

	public FinanceService(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public record Totals(long soldCents, long orders, long averageTicketCents, long paidCents, long paidOrders,
			long pendingCents, long pendingOrders, long cancelledOrders, long cancelledCents) {
	}

	public record Row(String name, long quantity, long totalCents) {
	}

	public record MethodRow(PaymentMethod method, String label, long payments, long totalCents) {
	}

	public record DayRow(LocalDate day, long soldCents, long paidCents, long orders) {
	}

	public record Summary(LocalDate from, LocalDate to, LocalDate previousFrom, LocalDate previousTo, Totals current,
			Totals previous, List<MethodRow> byMethod, List<Row> byProduct, List<Row> byCategory, List<Row> byTable,
			List<DayRow> daily, long testOrdersExcluded, long voidedPayments) {
	}

	/** Período [from, to] inclusivo, comparado com o período imediatamente anterior de mesma duração. */
	@Transactional(readOnly = true)
	public Summary summary(UUID restaurantId, LocalDate from, LocalDate to) {
		validate(from, to);
		long days = ChronoUnit.DAYS.between(from, to) + 1;
		LocalDate prevTo = from.minusDays(1);
		LocalDate prevFrom = prevTo.minusDays(days - 1);
		Timestamp start = start(from);
		Timestamp end = end(to);

		List<MethodRow> byMethod = jdbc.query("""
				select e.method, count(distinct p.id), coalesce(sum(e.amount_cents), 0)
				from payment_entries e join payments p on p.id = e.payment_id
				where p.restaurant_id = ? and p.voided_at is null and p.created_at >= ? and p.created_at < ?
				group by e.method order by 3 desc""", (rs, n) -> {
			PaymentMethod m = PaymentMethod.valueOf(rs.getString(1));
			return new MethodRow(m, m.label(), rs.getLong(2), rs.getLong(3));
		}, restaurantId, start, end);

		List<Row> byProduct = jdbc.query("""
				select i.product_name, sum(i.quantity), sum(i.total_cents)
				from order_items i join orders o on o.id = i.order_id
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test and o.created_at >= ? and o.created_at < ?
				group by i.product_name order by 3 desc, 2 desc limit 15""", FinanceService::row, restaurantId, start, end);

		List<Row> byCategory = jdbc.query("""
				select coalesce(c.name, 'Sem categoria'), sum(i.quantity), sum(i.total_cents)
				from order_items i join orders o on o.id = i.order_id
				left join products p on p.id = i.product_id
				left join categories c on c.id = p.category_id
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test and o.created_at >= ? and o.created_at < ?
				group by 1 order by 3 desc""", FinanceService::row, restaurantId, start, end);

		List<Row> byTable = jdbc.query("""
				select o.table_label, count(*), sum(o.total_cents)
				from orders o
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test and o.created_at >= ? and o.created_at < ?
				group by o.table_label order by 3 desc limit 20""", FinanceService::row, restaurantId, start, end);

		List<DayRow> daily = jdbc.query("""
				select (o.created_at at time zone ?)::date as day,
				       coalesce(sum(o.total_cents), 0),
				       coalesce(sum(o.total_cents) filter (where o.payment_status = 'PAID'), 0),
				       count(*)
				from orders o
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test and o.created_at >= ? and o.created_at < ?
				group by day order by day""",
				(rs, n) -> new DayRow(rs.getObject(1, LocalDate.class), rs.getLong(2), rs.getLong(3), rs.getLong(4)),
				ZONE.getId(), restaurantId, start, end);

		long tests = count("select count(*) from orders where restaurant_id = ? and is_test and created_at >= ? and created_at < ?",
				restaurantId, start, end);
		long voided = count("select count(*) from payments where restaurant_id = ? and voided_at is not null and created_at >= ? and created_at < ?",
				restaurantId, start, end);
		return new Summary(from, to, prevFrom, prevTo, totals(restaurantId, start, end),
				totals(restaurantId, start(prevFrom), end(prevTo)), byMethod, byProduct, byCategory, byTable, daily, tests,
				voided);
	}

	private Totals totals(UUID restaurantId, Timestamp start, Timestamp end) {
		return jdbc.queryForObject("""
				select coalesce(sum(total_cents) filter (where status <> 'CANCELLED'), 0),
				       count(*) filter (where status <> 'CANCELLED'),
				       coalesce(sum(total_cents) filter (where status <> 'CANCELLED' and payment_status = 'PAID'), 0),
				       count(*) filter (where status <> 'CANCELLED' and payment_status = 'PAID'),
				       coalesce(sum(total_cents) filter (where status <> 'CANCELLED' and payment_status = 'UNPAID'), 0),
				       count(*) filter (where status <> 'CANCELLED' and payment_status = 'UNPAID'),
				       count(*) filter (where status = 'CANCELLED'),
				       coalesce(sum(total_cents) filter (where status = 'CANCELLED'), 0)
				from orders where restaurant_id = ? and not is_test and created_at >= ? and created_at < ?""",
				(rs, n) -> {
					long sold = rs.getLong(1);
					long orders = rs.getLong(2);
					return new Totals(sold, orders, orders == 0 ? 0 : Math.round((double) sold / orders), rs.getLong(3),
							rs.getLong(4), rs.getLong(5), rs.getLong(6), rs.getLong(7), rs.getLong(8));
				}, restaurantId, start, end);
	}

	// ---------------------------------------------------------------- CSV

	/** Um pedido por linha. Separador ";" e vírgula decimal (padrão do Excel em português). */
	@Transactional(readOnly = true)
	public void writeOrdersCsv(UUID restaurantId, LocalDate from, LocalDate to, Writer out) throws IOException {
		validate(from, to);
		out.write('﻿');
		out.write("Pedido;Data;Hora;Mesa;Status;Pagamento;Métodos;Total (R$);Motivo do cancelamento\n");
		DateTimeFormatter date = DateTimeFormatter.ofPattern("dd/MM/yyyy");
		DateTimeFormatter time = DateTimeFormatter.ofPattern("HH:mm");
		jdbc.query("""
				select o.number, o.created_at, o.table_label, o.status, o.payment_status, o.total_cents, o.cancel_reason,
				       (select string_agg(distinct e.method, ',') from payment_entries e where e.payment_id = o.payment_id)
				from orders o
				where o.restaurant_id = ? and not o.is_test and o.created_at >= ? and o.created_at < ?
				order by o.created_at""", rs -> {
			try {
				var at = rs.getTimestamp(2).toInstant().atZone(ZONE);
				out.write(String.join(";", "#" + "%04d".formatted(rs.getInt(1)), at.format(date), at.format(time),
						cell(rs.getString(3)), statusLabel(rs.getString(4)),
						"PAID".equals(rs.getString(5)) ? "Pago" : "Pendente", methods(rs.getString(8)),
						reais(rs.getLong(6)), cell(rs.getString(7))));
				out.write('\n');
			}
			catch (IOException ex) {
				throw new java.io.UncheckedIOException(ex);
			}
		}, restaurantId, start(from), end(to));
	}

	/** Vendas por produto (itens de pedidos não cancelados). */
	@Transactional(readOnly = true)
	public void writeItemsCsv(UUID restaurantId, LocalDate from, LocalDate to, Writer out) throws IOException {
		validate(from, to);
		out.write('﻿');
		out.write("Produto;Categoria;Quantidade;Total (R$)\n");
		jdbc.query("""
				select i.product_name, coalesce(c.name, 'Sem categoria'), sum(i.quantity), sum(i.total_cents)
				from order_items i join orders o on o.id = i.order_id
				left join products p on p.id = i.product_id
				left join categories c on c.id = p.category_id
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test and o.created_at >= ? and o.created_at < ?
				group by 1, 2 order by 4 desc""", rs -> {
			try {
				out.write(String.join(";", cell(rs.getString(1)), cell(rs.getString(2)), String.valueOf(rs.getLong(3)),
						reais(rs.getLong(4))));
				out.write('\n');
			}
			catch (IOException ex) {
				throw new java.io.UncheckedIOException(ex);
			}
		}, restaurantId, start(from), end(to));
	}

	// ---------------------------------------------------------------- apoio

	static void validate(LocalDate from, LocalDate to) {
		if (from == null || to == null) {
			throw new ConflictException("Informe o período.");
		}
		if (to.isBefore(from)) {
			throw new ConflictException("A data final precisa ser igual ou posterior à inicial.");
		}
		if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
			throw new ConflictException("Escolha um período de até " + MAX_DAYS + " dias.");
		}
	}

	/**
	 * Célula de texto segura: aspas quando necessário e prefixo contra injeção de fórmula ao abrir no Excel
	 * (valores que começam com =, +, - ou @ vindos de nomes digitados por usuários).
	 */
	static String cell(String value) {
		if (value == null) {
			return "";
		}
		String v = value.replace("\r", " ").replace("\n", " ");
		if (!v.isEmpty() && "=+-@\t".indexOf(v.charAt(0)) >= 0) {
			v = "'" + v;
		}
		if (v.contains(";") || v.contains("\"")) {
			v = "\"" + v.replace("\"", "\"\"") + "\"";
		}
		return v;
	}

	static String reais(long cents) {
		return "%d,%02d".formatted(cents / 100, Math.abs(cents % 100));
	}

	private static String methods(String codes) {
		if (codes == null) {
			return "";
		}
		return String.join(" + ", java.util.Arrays.stream(codes.split(",")).map(c -> PaymentMethod.valueOf(c).label()).toList());
	}

	private static String statusLabel(String status) {
		return com.onecore.tap.orders.OrderStatus.valueOf(status).label();
	}

	private static Row row(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
		return new Row(rs.getString(1), rs.getLong(2), rs.getLong(3));
	}

	private long count(String sql, Object... args) {
		Long v = jdbc.queryForObject(sql, Long.class, args);
		return v == null ? 0 : v;
	}

	private static Timestamp start(LocalDate day) {
		return Timestamp.from(day.atStartOfDay(ZONE).toInstant());
	}

	private static Timestamp end(LocalDate day) {
		return Timestamp.from(day.plusDays(1).atStartOfDay(ZONE).toInstant());
	}

	static Instant startInstant(LocalDate day) {
		return day.atStartOfDay(ZONE).toInstant();
	}

	static Instant endInstant(LocalDate day) {
		return day.plusDays(1).atStartOfDay(ZONE).toInstant();
	}

}
