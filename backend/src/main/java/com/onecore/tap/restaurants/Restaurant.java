package com.onecore.tap.restaurants;

import java.time.Instant;
import java.util.UUID;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "restaurants")
public class Restaurant extends BaseEntity {

	@Column(nullable = false, length = 80)
	private String slug;

	@Column(name = "trade_name", nullable = false, length = 120)
	private String tradeName;

	@Column(name = "legal_name", length = 160)
	private String legalName;

	@Column(length = 14)
	private String cnpj;

	@Column(length = 160)
	private String email;

	@Column(length = 20)
	private String phone;

	@Column(name = "address_line", length = 200)
	private String addressLine;

	@Column(length = 100)
	private String city;

	@Column(length = 2)
	private String state;

	@Column(name = "postal_code", length = 8)
	private String postalCode;

	@Column(name = "logo_url", length = 500)
	private String logoUrl;

	@Column(name = "primary_color", nullable = false, length = 7)
	private String primaryColor = "#16A36B";

	@Column(name = "accent_color", nullable = false, length = 7)
	private String accentColor = "#0B0F0E";

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private RestaurantStatus status = RestaurantStatus.ONBOARDING;

	@Column(name = "plan_id")
	private UUID planId;

	@Column(name = "branding_configured_at")
	private Instant brandingConfiguredAt;

	@Column(name = "trial_ends_at")
	private Instant trialEndsAt;

	@Column(name = "activated_at")
	private Instant activatedAt;

	@Column(name = "status_reason", length = 300)
	private String statusReason;

	/** Suspensão aplicada pela rotina de cobrança: só esta é desfeita automaticamente ao quitar. */
	@Column(name = "suspended_by_billing", nullable = false)
	private boolean suspendedByBilling;

	@Column(length = 300)
	private String description;

	@Column(name = "cover_image_url", length = 500)
	private String coverImageUrl;

	/** Pedidos do cardápio aguardam confirmação do restaurante antes de seguir para a cozinha. */
	@Column(name = "require_order_confirmation", nullable = false)
	private boolean requireOrderConfirmation = true;

	protected Restaurant() {
	}

	public Restaurant(String slug, String tradeName) {
		this.slug = slug;
		this.tradeName = tradeName;
	}

	public void updateDetails(String legalName, String cnpj, String email, String phone, String addressLine,
			String city, String state, String postalCode) {
		this.legalName = legalName;
		this.cnpj = cnpj;
		this.email = email;
		this.phone = phone;
		this.addressLine = addressLine;
		this.city = city;
		this.state = state;
		this.postalCode = postalCode;
	}

	public void changeStatus(RestaurantStatus status) {
		this.status = status;
	}

	public void changeStatus(RestaurantStatus status, String reason, Instant now) {
		this.status = status;
		this.statusReason = reason;
		if (status == RestaurantStatus.ACTIVE && activatedAt == null) {
			activatedAt = now;
		}
	}

	public void suspendByBilling(String reason, Instant now) {
		changeStatus(RestaurantStatus.SUSPENDED, reason, now);
		this.suspendedByBilling = true;
	}

	/** Reativação automática após quitar: só desfaz suspensão aplicada pela cobrança. */
	public void reactivateAfterBilling(Instant now) {
		changeStatus(RestaurantStatus.ACTIVE, null, now);
		this.suspendedByBilling = false;
	}

	public void clearBillingSuspension() {
		this.suspendedByBilling = false;
	}

	public boolean isSuspendedByBilling() {
		return suspendedByBilling;
	}

	public void startTrial(Instant endsAt) {
		this.status = RestaurantStatus.TRIAL;
		this.trialEndsAt = endsAt;
		this.statusReason = null;
	}

	public void updateBranding(String logoUrl, String primaryColor, String accentColor, Instant now) {
		this.logoUrl = logoUrl;
		this.primaryColor = primaryColor;
		this.accentColor = accentColor;
		this.brandingConfiguredAt = now;
	}

	/** Dados de contato editáveis pelo próprio restaurante. Nome, razão social e CNPJ ficam com a OneCore. */
	public void updateContact(String email, String phone, String addressLine, String city, String state,
			String postalCode, String description) {
		this.email = email;
		this.phone = phone;
		this.addressLine = addressLine;
		this.city = city;
		this.state = state;
		this.postalCode = postalCode;
		this.description = description;
	}

	public void updateCover(String coverImageUrl) {
		this.coverImageUrl = coverImageUrl;
	}

	public void setRequireOrderConfirmation(boolean requireOrderConfirmation) {
		this.requireOrderConfirmation = requireOrderConfirmation;
	}

	public String getDescription() {
		return description;
	}

	public String getCoverImageUrl() {
		return coverImageUrl;
	}

	public boolean isRequireOrderConfirmation() {
		return requireOrderConfirmation;
	}

	public void updateTradeName(String tradeName) {
		this.tradeName = tradeName;
	}

	public void assignPlan(UUID planId) {
		this.planId = planId;
	}

	public UUID getPlanId() {
		return planId;
	}

	public Instant getBrandingConfiguredAt() {
		return brandingConfiguredAt;
	}

	public Instant getTrialEndsAt() {
		return trialEndsAt;
	}

	public Instant getActivatedAt() {
		return activatedAt;
	}

	public String getStatusReason() {
		return statusReason;
	}

	public String getSlug() {
		return slug;
	}

	public String getTradeName() {
		return tradeName;
	}

	public String getLegalName() {
		return legalName;
	}

	public String getCnpj() {
		return cnpj;
	}

	public String getEmail() {
		return email;
	}

	public String getPhone() {
		return phone;
	}

	public String getAddressLine() {
		return addressLine;
	}

	public String getCity() {
		return city;
	}

	public String getState() {
		return state;
	}

	public String getPostalCode() {
		return postalCode;
	}

	public String getLogoUrl() {
		return logoUrl;
	}

	public String getPrimaryColor() {
		return primaryColor;
	}

	public String getAccentColor() {
		return accentColor;
	}

	public RestaurantStatus getStatus() {
		return status;
	}

}
