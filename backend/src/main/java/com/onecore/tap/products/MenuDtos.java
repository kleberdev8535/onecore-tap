package com.onecore.tap.products;

import java.util.List;
import java.util.UUID;

import com.onecore.tap.categories.Category;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class MenuDtos {

	private MenuDtos() {
	}

	static final String HTTPS_URL = "^(https://\\S+)?$";

	// ------------------------------------------------------------------ Categorias

	public record CategoryRequest(@NotBlank(message = "Informe o nome da categoria") @Size(max = 80) String name,
			@Size(max = 200, message = "Use até 200 caracteres") String description, Boolean active) {
	}

	public record CategoryView(UUID id, String name, String description, int position, boolean active,
			long productCount) {

		static CategoryView of(Category c, long productCount) {
			return new CategoryView(c.getId(), c.getName(), c.getDescription(), c.getPosition(), c.isActive(),
					productCount);
		}
	}

	public record ReorderRequest(@NotEmpty(message = "Informe a nova ordem") @Size(max = 500) List<@NotNull UUID> ids) {
	}

	// ------------------------------------------------------------------ Produtos

	public record ProductRequest(@NotNull(message = "Selecione a categoria") UUID categoryId,
			@NotBlank(message = "Informe o nome do produto") @Size(max = 120) String name,
			@Size(max = 500, message = "Use até 500 caracteres") String description,
			@NotNull(message = "Informe o preço") @Min(value = 0, message = "O preço não pode ser negativo")
			@Max(value = 10_000_000, message = "Preço acima do permitido") Integer priceCents,
			@Size(max = 500) @Pattern(regexp = HTTPS_URL, message = "Use um endereço https://") String imageUrl,
			boolean active, boolean available, boolean featured,
			@Size(max = 20, message = "Use até 20 grupos de adicionais") List<@NotNull UUID> addonGroupIds) {
	}

	public record AvailabilityRequest(@NotNull(message = "Informe a disponibilidade") Boolean available) {
	}

	public record ProductView(UUID id, UUID categoryId, String name, String description, int priceCents,
			String imageUrl, boolean active, boolean available, boolean featured, int position,
			List<UUID> addonGroupIds) {

		static ProductView of(Product p, List<UUID> addonGroupIds) {
			return new ProductView(p.getId(), p.getCategoryId(), p.getName(), p.getDescription(), p.getPriceCents(),
					p.getImageUrl(), p.isActive(), p.isAvailable(), p.isFeatured(), p.getPosition(), addonGroupIds);
		}
	}

	// ------------------------------------------------------------------ Adicionais e variações

	public record AddonOptionRequest(UUID id,
			@NotBlank(message = "Informe o nome da opção") @Size(max = 80) String name,
			@NotNull(message = "Informe o preço") @Min(value = 0, message = "O preço não pode ser negativo")
			@Max(value = 1_000_000, message = "Preço acima do permitido") Integer priceCents,
			boolean available) {
	}

	public record AddonGroupRequest(@NotBlank(message = "Informe o nome do grupo") @Size(max = 80) String name,
			@Min(value = 0, message = "Mínimo 0") @Max(value = 20, message = "Máximo 20") int minChoices,
			@Min(value = 1, message = "Mínimo 1") @Max(value = 20, message = "Máximo 20") int maxChoices,
			@NotEmpty(message = "Cadastre ao menos uma opção") @Size(max = 50, message = "Use até 50 opções")
			List<@Valid AddonOptionRequest> options) {
	}

	public record AddonOptionView(UUID id, String name, int priceCents, boolean available) {

		static AddonOptionView of(AddonOption o) {
			return new AddonOptionView(o.getId(), o.getName(), o.getPriceCents(), o.isAvailable());
		}
	}

	public record AddonGroupView(UUID id, String name, int minChoices, int maxChoices, int position,
			List<AddonOptionView> options, long productCount) {
	}

}
