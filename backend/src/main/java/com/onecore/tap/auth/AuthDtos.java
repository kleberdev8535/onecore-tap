package com.onecore.tap.auth;

import java.util.List;
import java.util.UUID;

import com.onecore.tap.users.Role;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

	private AuthDtos() {
	}

	public record LoginRequest(@NotBlank(message = "Informe o e-mail") @Email(message = "E-mail inválido") String email,
			@NotBlank(message = "Informe a senha") @Size(max = 128) String password) {
	}

	public record ForgotPasswordRequest(
			@NotBlank(message = "Informe o e-mail") @Email(message = "E-mail invalido") String email) {
	}

	public record ResetPasswordRequest(@NotBlank @Size(max = 128) String token,
			@NotBlank(message = "Informe a nova senha") @Size(min = 10, max = 128,
					message = "A senha precisa ter entre 10 e 128 caracteres") @Pattern(
							regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
							message = "A senha precisa ter letras e números") String newPassword) {
	}

	public record RestaurantSummary(UUID id, String tradeName, String slug, String status, String logoUrl,
			String primaryColor) {
	}

	/** modules: módulos opcionais liberados pelo plano do restaurante (vazio para o Super Admin). */
	public record MeResponse(UUID id, String name, String email, Role role, List<String> permissions,
			RestaurantSummary restaurant, List<String> modules) {
	}

	public record CsrfResponse(String headerName, String token) {
	}

}
