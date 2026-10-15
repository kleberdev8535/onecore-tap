package com.onecore.tap.plates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;
import com.onecore.tap.common.ConflictException;
import com.onecore.tap.plates.PlateDtos.Action;
import com.onecore.tap.restaurants.Restaurant;
import com.onecore.tap.restaurants.RestaurantStatus;
import com.onecore.tap.security.AuthenticatedUser;
import com.onecore.tap.support.IntegrationTest;
import com.onecore.tap.tables.RestaurantTable;
import com.onecore.tap.tables.TableService;
import com.onecore.tap.users.Role;
import com.onecore.tap.users.User;

class PlateIntegrationTest extends IntegrationTest {

	@Autowired
	PlateService plates;

	@Autowired
	PlateRepository plateRepository;

	@Autowired
	TableService tableService;

	MockHttpSession admin;

	User adminUser;

	@BeforeEach
	void setUp() throws Exception {
		adminUser = createUser(null, Role.SUPER_ADMIN);
		admin = login(adminUser);
	}

	@Test
	void batchCreatesPlatesWithUniqueRandomTokensAndSerials() {
		PlateBatch batch = plates.createBatch(null, null, 40, null, "teste");
		List<Plate> items = plates.platesOfBatch(batch.getId());

		assertThat(items).hasSize(40);
		Set<String> tokens = new HashSet<>();
		items.forEach(p -> {
			assertThat(PlateTokenGenerator.isWellFormed(p.getPublicToken())).isTrue();
			assertThat(p.getStatus()).isEqualTo(PlateStatus.AVAILABLE);
			assertThat(p.getSerial()).matches("OCT-\\d{6}");
			tokens.add(p.getPublicToken());
		});
		assertThat(tokens).hasSize(40);
	}

	@Test
	void plateLifecycleKeepsTheSamePermanentUrlAndRecordsHistory() throws Exception {
		Restaurant a = createRestaurant("Burger House");
		Restaurant b = createRestaurant("Pizzaria Bella");
		RestaurantTable tableA = tableService.create(a.getId(), List.of("05"), 4).getFirst();
		RestaurantTable tableB = tableService.create(b.getId(), List.of("12"), 4).getFirst();
		Plate plate = newPlate();
		String token = plate.getPublicToken();

		change(plate.getId(), Action.BIND, a.getId(), tableA.getId(), null);
		assertThat(reload(plate).getStatus()).isEqualTo(PlateStatus.ACTIVE);

		// Transferencia para outro restaurante: o token (URL gravada no NFC/QR) nao muda.
		change(plate.getId(), Action.BIND, b.getId(), tableB.getId(), null);
		Plate transferred = reload(plate);
		assertThat(transferred.getRestaurantId()).isEqualTo(b.getId());
		assertThat(transferred.getPublicToken()).isEqualTo(token);

		change(plate.getId(), Action.SUSPEND, null, null, "Mesa em reforma");
		change(plate.getId(), Action.REACTIVATE, null, null, null);
		change(plate.getId(), Action.RELEASE, null, null, "Fim do contrato");
		assertThat(reload(plate).getStatus()).isEqualTo(PlateStatus.AVAILABLE);
		assertThat(reload(plate).getRestaurantId()).isNull();

		mvc.perform(get("/api/admin/plates/" + plate.getId()).session(admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.plate.publicUrl").value(org.hamcrest.Matchers.endsWith("/t/" + token)))
			.andExpect(jsonPath("$.history.length()").value(6))
			.andExpect(jsonPath("$.history[0].event").value("RELEASED"))
			.andExpect(jsonPath("$.history[4].event").value("ASSIGNED"));
	}

	@Test
	void invalidTransitionsAreRejected() {
		Restaurant r = createRestaurant("Cafe Aurora");
		RestaurantTable table = tableService.create(r.getId(), List.of("1"), null).getFirst();
		Plate plate = newPlate();

		assertThatThrownBy(() -> change(plate.getId(), Action.SUSPEND, null, null, "x"))
			.isInstanceOf(ConflictException.class);
		assertThatThrownBy(() -> change(plate.getId(), Action.RELEASE, null, null, null))
			.isInstanceOf(ConflictException.class)
			.hasMessageContaining("motivo");

		change(plate.getId(), Action.DEACTIVATE, null, null, "Defeito de fabricação");
		assertThatThrownBy(() -> change(plate.getId(), Action.BIND, r.getId(), table.getId(), null))
			.isInstanceOf(ConflictException.class);
	}

	@Test
	void tableFromAnotherRestaurantIsRejected() {
		Restaurant a = createRestaurant("Bar A");
		Restaurant b = createRestaurant("Bar B");
		RestaurantTable tableOfB = tableService.create(b.getId(), List.of("3"), null).getFirst();
		Plate plate = newPlate();

		assertThatThrownBy(() -> change(plate.getId(), Action.BIND, a.getId(), tableOfB.getId(), null))
			.isInstanceOf(ConflictException.class)
			.hasMessageContaining("não pertence");
	}

	@Test
	void aTableAcceptsOnlyOnePlateEvenUnderConcurrency() throws Exception {
		Restaurant r = createRestaurant("Sushi Kai");
		RestaurantTable table = tableService.create(r.getId(), List.of("7"), null).getFirst();
		Plate first = newPlate();
		Plate second = newPlate();

		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			List<Callable<Boolean>> attempts = List.of(bindAs(first.getId(), r.getId(), table.getId()),
					bindAs(second.getId(), r.getId(), table.getId()));
			int successes = 0;
			for (Future<Boolean> f : pool.invokeAll(attempts)) {
				successes += f.get() ? 1 : 0;
			}
			assertThat(successes).isEqualTo(1);
		}
		finally {
			pool.shutdown();
		}
		assertThat(plateRepository.findInUseByTable(table.getId())).isPresent();
	}

	@Test
	void publicLookupOnlyWorksForActivePlatesOfLiveRestaurants() throws Exception {
		Restaurant r = createRestaurant("Hamburgueria Central");
		RestaurantTable table = tableService.create(r.getId(), List.of("08"), 4).getFirst();
		Plate plate = newPlate();
		change(plate.getId(), Action.BIND, r.getId(), table.getId(), null);

		// Restaurante ainda em implantacao: indisponivel para o publico.
		mvc.perform(get("/api/public/plates/" + plate.getPublicToken())).andExpect(status().isNotFound());

		r.changeStatus(RestaurantStatus.ACTIVE);
		restaurants.saveAndFlush(r);
		mvc.perform(get("/api/public/plates/" + plate.getPublicToken().toLowerCase()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.tableLabel").value("08"))
			.andExpect(jsonPath("$.restaurant.tradeName").value("Hamburgueria Central"))
			.andExpect(jsonPath("$.restaurant.id").doesNotExist())
			.andExpect(jsonPath("$.restaurantId").doesNotExist());

		change(plate.getId(), Action.SUSPEND, null, null, "Teste");
		mvc.perform(get("/api/public/plates/" + plate.getPublicToken())).andExpect(status().isNotFound());

		mvc.perform(get("/api/public/plates/NAOEXISTE")).andExpect(status().isNotFound());
		mvc.perform(get("/api/public/plates/../../etc")).andExpect(status().is4xxClientError());
	}

	@Test
	void qrCodeExportsAreReadableAndPointToThePermanentUrl() throws Exception {
		Plate plate = newPlate();
		String url = plates.publicUrl(plate.getPublicToken());

		byte[] png = mvc.perform(get("/api/admin/plates/" + plate.getId() + "/qr.png").session(admin))
			.andExpect(status().isOk())
			.andExpect(content().contentType(MediaType.IMAGE_PNG))
			.andReturn()
			.getResponse()
			.getContentAsByteArray();
		var image = ImageIO.read(new ByteArrayInputStream(png));
		String decoded = new QRCodeReader()
			.decode(new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(image))))
			.getText();
		assertThat(decoded).isEqualTo(url);

		mvc.perform(get("/api/admin/plates/" + plate.getId() + "/qr.svg").session(admin))
			.andExpect(status().isOk())
			.andExpect(content().string(org.hamcrest.Matchers.startsWith("<svg")));

		mvc.perform(get("/api/admin/plate-batches/" + plate.getBatchId() + "/labels.pdf").session(admin))
			.andExpect(status().isOk())
			.andExpect(content().contentType(MediaType.APPLICATION_PDF))
			.andExpect(result -> assertThat(new String(result.getResponse().getContentAsByteArray(), 0, 5))
				.isEqualTo("%PDF-"));
	}

	@Test
	void batchCreationEndpointIsAuditedAndRestricted() throws Exception {
		mvc.perform(post("/api/admin/plate-batches").with(csrf())
			.session(admin)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"quantity\":3,\"code\":\"LT-%s\"}".formatted(suffix())))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.quantity").value(3))
			.andExpect(jsonPath("$.available").value(3));

		Restaurant r = createRestaurant("Cantina");
		MockHttpSession owner = login(createUser(r.getId(), Role.RESTAURANT_OWNER));
		mvc.perform(get("/api/admin/plates").session(owner)).andExpect(status().isForbidden());
		mvc.perform(post("/api/admin/plate-batches").with(csrf())
			.session(owner)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"quantity\":3}")).andExpect(status().isForbidden());
	}

	// ---------------------------------------------------------------- auxiliares

	private Plate newPlate() {
		PlateBatch batch = plates.createBatch("T-" + suffix(), null, 1, null, "teste");
		return plates.platesOfBatch(batch.getId()).getFirst();
	}

	private Plate reload(Plate plate) {
		return plateRepository.findById(plate.getId()).orElseThrow();
	}

	/** Executa como Super Admin (tenant ROOT), como faria o controller. */
	private void change(UUID plateId, Action action, UUID restaurantId, UUID tableId, String reason) {
		asSuperAdmin();
		try {
			plates.change(plateId, action, restaurantId, tableId, reason, adminUser.getEmail());
		}
		finally {
			SecurityContextHolder.clearContext();
		}
	}

	private Callable<Boolean> bindAs(UUID plateId, UUID restaurantId, UUID tableId) {
		return () -> {
			asSuperAdmin();
			try {
				plates.change(plateId, Action.BIND, restaurantId, tableId, null, adminUser.getEmail());
				return true;
			}
			catch (RuntimeException ex) {
				return false;
			}
			finally {
				SecurityContextHolder.clearContext();
			}
		};
	}

	private void asSuperAdmin() {
		AuthenticatedUser principal = new AuthenticatedUser(adminUser.getId(), null, adminUser.getEmail(),
				adminUser.getName(), Role.SUPER_ADMIN, null, true, false);
		SecurityContextHolder.getContext()
			.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(principal, null,
					principal.getAuthorities()));
	}


}
