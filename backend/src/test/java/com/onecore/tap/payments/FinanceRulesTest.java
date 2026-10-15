package com.onecore.tap.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.onecore.tap.common.ConflictException;
import com.onecore.tap.payments.PaymentDtos.EntryInput;

class FinanceRulesTest {

	@Test
	void csvCellsAreSafeForSpreadsheets() {
		assertThat(FinanceService.cell("=HYPERLINK(\"x\")")).isEqualTo("\"'=HYPERLINK(\"\"x\"\")\"");
		assertThat(FinanceService.cell("+55 11")).isEqualTo("'+55 11");
		assertThat(FinanceService.cell("Varanda; fundo")).isEqualTo("\"Varanda; fundo\"");
		assertThat(FinanceService.cell("linha\nquebrada")).isEqualTo("linha quebrada");
		assertThat(FinanceService.cell(null)).isEmpty();
		assertThat(FinanceService.reais(123456)).isEqualTo("1234,56");
		assertThat(FinanceService.reais(5)).isEqualTo("0,05");
	}

	@Test
	void splitMustMatchTheTotal() {
		PaymentService.validateParts(List.of(new EntryInput(PaymentMethod.PIX, 700, null),
				new EntryInput(PaymentMethod.CASH, 300, 500)), 1000);
		assertThatThrownBy(() -> PaymentService.validateParts(List.of(new EntryInput(PaymentMethod.PIX, 700, null)), 1000))
			.isInstanceOf(ConflictException.class);
		assertThatThrownBy(() -> PaymentService.validateParts(List.of(), 1000)).isInstanceOf(ConflictException.class);
		assertThatThrownBy(() -> PaymentService.validateParts(
				List.of(new EntryInput(PaymentMethod.CASH, 1000, 900)), 1000)).isInstanceOf(ConflictException.class);
	}

	@Test
	void periodsAreValidated() {
		LocalDate d = LocalDate.of(2026, 10, 1);
		FinanceService.validate(d, d.plusDays(30));
		assertThatThrownBy(() -> FinanceService.validate(d, d.minusDays(1))).isInstanceOf(ConflictException.class);
		assertThatThrownBy(() -> FinanceService.validate(d, d.plusDays(400))).isInstanceOf(ConflictException.class);
	}

}
