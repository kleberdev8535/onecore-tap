package com.onecore.tap.dashboard;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.onecore.tap.common.NotFoundException;
import com.onecore.tap.plans.PlanRepository;
import com.onecore.tap.restaurants.OpeningHours;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantRepository;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Indicadores do restaurante logado: vendas e pedidos reais por período, cardápio, mesas, equipe e o checklist
 * de configuração. Nada é simulado; pedidos de teste da implantação ficam fora das vendas.
 *
 * As contagens usam SQL direto sempre filtrado pelo restaurant_id da sessão.
 */
@Tag(name = "Restaurante - Dashboard")
@RestController
@RequestMapping("/api/restaurant/dashboard")
public class RestaurantDashboardController {

	private final JdbcTemplate jdbc;

	private final RestaurantRepository restaurants;

	private final PlanRepository plans;

	private final Clock clock;

	public RestaurantDashboardController(JdbcTemplate jdbc, RestaurantRepository restaurants, PlanRepository plans,
			Clock clock) {
		this.jdbc = jdbc;
		this.restaurants = restaurants;
		this.plans = plans;
		this.clock = clock;
	}

	public record PlanSummary(String name, Integer maxTables, Integer maxUsers) {
	}

	public record MenuCounts(long categories, long activeCategories, long products, long activeProducts,
			long unavailableProducts, long featuredProducts, long productsWithoutImage, long addonGroups,
			List<String> emptyCategories) {
	}

	public record TableCounts(long total, long active, long withPlate) {
	}

	public record StaffCounts(long total, long active, long pendingInvites) {
	}

	public record SetupStep(String key, String label, boolean done, String hint) {
	}

	public record PeriodTotals(long revenueCents, long orders, long averageTicketCents, long cancelled) {
	}

	public record LiveCounts(long awaitingConfirmation, long newOrders, long inPreparation, long ready,
			long occupiedTables, long openRequests) {
	}

	public record TopProduct(String name, long quantity, long revenueCents) {
	}

	public record DayPoint(LocalDate day, long revenueCents, long orders) {
	}

	public record HourPoint(int hour, long orders) {
	}

	public record Sales(String period, LocalDate from, LocalDate to, PeriodTotals current, PeriodTotals previous,
			LiveCounts live, List<TopProduct> topProducts, List<DayPoint> daily, List<HourPoint> hourly,
			long testOrders) {
	}

	public record DashboardResponse(String tradeName, RestaurantStatus status, Instant trialEndsAt, PlanSummary plan,
			MenuCounts menu, TableCounts tables, StaffCounts staff, List<SetupStep> setup,
			boolean ordersModuleAvailable, Sales sales, Instant generatedAt) {
	}

	@Operation(summary = "Indicadores e checklist de configuração do restaurante")
	@GetMapping
	@PreAuthorize("hasAuthority('PERM_DASHBOARD_VIEW')")
	@Transactional(readOnly = true)
	public DashboardResponse get(@RequestParam(defaultValue = "today") String period) {
		UUID id = CurrentUser.requireRestaurantId();
		Restaurant r = restaurants.findById(id).orElseThrow(() -> new NotFoundException("Restaurante não encontrado."));
		PlanSummary plan = r.getPlanId() == null ? null
				: plans.findById(r.getPlanId())
					.map(p -> new PlanSummary(p.getName(), p.getMaxTables(), p.getMaxUsers()))
					.orElse(null);

		MenuCounts menu = new MenuCounts(count("select count(*) from categories where restaurant_id = ?", id),
				count("select count(*) from categories where restaurant_id = ? and active", id),
				count("select count(*) from products where restaurant_id = ?", id),
				count("select count(*) from products where restaurant_id = ? and active", id),
				count("select count(*) from products where restaurant_id = ? and active and not available", id),
				count("select count(*) from products where restaurant_id = ? and active and featured", id),
				count("select count(*) from products where restaurant_id = ? and active and image_url is null", id),
				count("select count(*) from addon_groups where restaurant_id = ?", id),
				jdbc.queryForList("""
						select c.name from categories c
						where c.restaurant_id = ? and c.active
						  and not exists (select 1 from products p where p.category_id = c.id and p.active)
						order by c.position limit 5""", String.class, id));

		TableCounts tables = new TableCounts(count("select count(*) from restaurant_tables where restaurant_id = ?", id),
				count("select count(*) from restaurant_tables where restaurant_id = ? and active", id),
				count("select count(distinct table_id) from plates where restaurant_id = ? and status = 'ACTIVE'", id));

		StaffCounts staff = new StaffCounts(count("select count(*) from users where restaurant_id = ?", id),
				count("select count(*) from users where restaurant_id = ? and active", id),
				count("select count(*) from users where restaurant_id = ? and active and last_login_at is null", id));

		long hours = count("select count(*) from restaurant_opening_hours where restaurant_id = ?", id);
		List<SetupStep> setup = List.of(
				new SetupStep("branding", "Identidade visual", r.getBrandingConfiguredAt() != null,
						"Logotipo e cores aplicados ao cardápio"),
				new SetupStep("hours", "Horário de funcionamento", hours > 0, "Exibido no cardápio público"),
				new SetupStep("categories", "Categorias", menu.activeCategories() > 0, "Organize o cardápio por seções"),
				new SetupStep("products", "Produtos", menu.activeProducts() > 0, "Cadastre ao menos um produto ativo"),
				new SetupStep("tables", "Mesas", tables.active() > 0, "Mesas que receberão as plaquinhas"),
				new SetupStep("plates", "Plaquinhas vinculadas", tables.withPlate() > 0,
						"Feito pela OneCore Business na implantação"));

		return new DashboardResponse(r.getTradeName(), r.getStatus(), r.getTrialEndsAt(), plan, menu, tables, staff,
				setup, true, sales(id, period), Instant.now());
	}

	/**
	 * Vendas = pedidos não cancelados e que não são de teste, no fuso do restaurante. Pagamentos são registrados no
	 * módulo financeiro (Fase 5); aqui o valor é o total dos pedidos.
	 */
	private Sales sales(UUID id, String rawPeriod) {
		ZoneId zone = OpeningHours.BUSINESS_ZONE;
		LocalDate today = LocalDate.now(clock.withZone(zone));
		String period = switch (rawPeriod) {
			case "7d", "30d" -> rawPeriod;
			default -> "today";
		};
		int days = switch (period) {
			case "7d" -> 7;
			case "30d" -> 30;
			default -> 1;
		};
		LocalDate from = today.minusDays(days - 1L);
		Instant start = from.atStartOfDay(zone).toInstant();
		Instant end = today.plusDays(1).atStartOfDay(zone).toInstant();
		Instant prevStart = from.minusDays(days).atStartOfDay(zone).toInstant();

		LiveCounts live = new LiveCounts(
				count("select count(*) from orders where restaurant_id = ? and status = 'AWAITING_CONFIRMATION'", id),
				count("select count(*) from orders where restaurant_id = ? and status = 'NEW'", id),
				count("select count(*) from orders where restaurant_id = ? and status = 'IN_PREPARATION'", id),
				count("select count(*) from orders where restaurant_id = ? and status = 'READY'", id),
				count("select count(*) from table_sessions where restaurant_id = ? and closed_at is null", id),
				count("select count(*) from service_requests where restaurant_id = ? and status = 'OPEN'", id));

		List<TopProduct> top = jdbc.query("""
				select i.product_name, sum(i.quantity) as qty, sum(i.total_cents) as revenue
				from order_items i join orders o on o.id = i.order_id
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test
				  and o.created_at >= ? and o.created_at < ?
				group by i.product_name order by qty desc, revenue desc limit 5""",
				(rs, n) -> new TopProduct(rs.getString(1), rs.getLong(2), rs.getLong(3)), id, ts(start), ts(end));

		List<DayPoint> daily = jdbc.query("""
				select (o.created_at at time zone ?)::date as day, coalesce(sum(o.total_cents), 0), count(*)
				from orders o
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test
				  and o.created_at >= ? and o.created_at < ?
				group by day order by day""",
				(rs, n) -> new DayPoint(rs.getObject(1, LocalDate.class), rs.getLong(2), rs.getLong(3)), zone.getId(),
				id, ts(start), ts(end));

		long[] byHour = new long[24];
		jdbc.query("""
				select extract(hour from o.created_at at time zone ?)::int, count(*)
				from orders o
				where o.restaurant_id = ? and o.status <> 'CANCELLED' and not o.is_test
				  and o.created_at >= ? and o.created_at < ?
				group by 1""", (RowCallbackHandler) rs -> byHour[rs.getInt(1)] = rs.getLong(2), zone.getId(), id,
				ts(start), ts(end));
		List<HourPoint> hourly = new ArrayList<>();
		for (int h = 0; h < 24; h++) {
			hourly.add(new HourPoint(h, byHour[h]));
		}

		Long tests = jdbc.queryForObject(
				"select count(*) from orders where restaurant_id = ? and is_test and created_at >= ? and created_at < ?",
				Long.class, id, ts(start), ts(end));
		return new Sales(period, from, today, totals(id, start, end), totals(id, prevStart, start), live, top, daily,
				hourly, tests == null ? 0 : tests);
	}

	private PeriodTotals totals(UUID id, Instant start, Instant end) {
		return jdbc.queryForObject("""
				select coalesce(sum(total_cents) filter (where status <> 'CANCELLED'), 0),
				       count(*) filter (where status <> 'CANCELLED'),
				       count(*) filter (where status = 'CANCELLED')
				from orders where restaurant_id = ? and not is_test and created_at >= ? and created_at < ?""",
				(rs, n) -> {
					long revenue = rs.getLong(1);
					long orders = rs.getLong(2);
					return new PeriodTotals(revenue, orders, orders == 0 ? 0 : Math.round((double) revenue / orders),
							rs.getLong(3));
				}, id, ts(start), ts(end));
	}

	private static Timestamp ts(Instant instant) {
		return Timestamp.from(instant);
	}

	private long count(String sql, UUID restaurantId) {
		Long value = jdbc.queryForObject(sql, Long.class, restaurantId);
		return value == null ? 0 : value;
	}

}
