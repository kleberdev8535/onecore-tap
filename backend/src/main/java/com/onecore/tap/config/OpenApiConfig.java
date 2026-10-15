package com.onecore.tap.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	@Bean
	OpenAPI oneCoreTapOpenApi() {
		return new OpenAPI().info(new Info().title("OneCore Tap API")
			.version("v1")
			.description("API da plataforma OneCore Tap. Autenticação por cookie de sessão + token CSRF (header X-XSRF-TOKEN)."));
	}

}
