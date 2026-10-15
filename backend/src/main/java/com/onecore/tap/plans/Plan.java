package com.onecore.tap.plans;

import java.util.Arrays;
import java.util.List;

import com.onecore.tap.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Plano de assinatura configuravel pelo Super Admin. Nenhum preco fica fixo no codigo. */
@Entity
@Table(name = "plans")
public class Plan extends BaseEntity {

	@Column(nullable = false, length = 40, updatable = false)
	private String code;

	@Column(nullable = false, length = 80)
	private String name;

	@Column(length = 300)
	private String description;

	@Column(name = "monthly_price_cents", nullable = false)
	private int monthlyPriceCents;

	@Column(name = "max_tables")
	private Integer maxTables;

	@Column(name = "max_users")
	private Integer maxUsers;

	@Column(name = "trial_days", nullable = false)
	private int trialDays;

	/** Funcionalidades em texto, uma por linha. */
	@Column(nullable = false)
	private String features = "";

	/** Módulos liberados (códigos de PlanModule separados por vírgula). */
	@Column(nullable = false, length = 200)
	private String modules = PlanModule.ALL_CODES;

	@Column(nullable = false)
	private boolean active = true;

	protected Plan() {
	}

	public Plan(String code) {
		this.code = code;
	}

	public void update(String name, String description, int monthlyPriceCents, Integer maxTables, Integer maxUsers,
			int trialDays, List<String> features, boolean active) {
		this.name = name;
		this.description = description;
		this.monthlyPriceCents = monthlyPriceCents;
		this.maxTables = maxTables;
		this.maxUsers = maxUsers;
		this.trialDays = trialDays;
		this.features = String.join("\n", features.stream().map(String::trim).filter(f -> !f.isEmpty()).toList());
		this.active = active;
	}

	public void changeModules(java.util.Set<PlanModule> enabled) {
		this.modules = PlanModule.encode(enabled);
	}

	public java.util.Set<PlanModule> moduleSet() {
		return PlanModule.decode(modules);
	}

	public boolean includes(PlanModule module) {
		return moduleSet().contains(module);
	}

	public List<String> featureList() {
		return features.isBlank() ? List.of() : Arrays.stream(features.split("\n")).toList();
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public int getMonthlyPriceCents() {
		return monthlyPriceCents;
	}

	public Integer getMaxTables() {
		return maxTables;
	}

	public Integer getMaxUsers() {
		return maxUsers;
	}

	public int getTrialDays() {
		return trialDays;
	}

	public boolean isActive() {
		return active;
	}

}
