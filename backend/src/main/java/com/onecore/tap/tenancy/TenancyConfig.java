package com.onecore.tap.tenancy;

import org.hibernate.cfg.MultiTenancySettings;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TenancyConfig {

	@Bean
	HibernatePropertiesCustomizer tenantResolverCustomizer() {
		TenantIdentifierResolver resolver = new TenantIdentifierResolver();
		return props -> props.put(MultiTenancySettings.MULTI_TENANT_IDENTIFIER_RESOLVER, resolver);
	}

}
