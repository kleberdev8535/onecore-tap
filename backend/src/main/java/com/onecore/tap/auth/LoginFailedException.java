package com.onecore.tap.auth;

import org.springframework.http.HttpStatus;

public class LoginFailedException extends RuntimeException {

	private final HttpStatus status;

	public LoginFailedException(HttpStatus status, String message) {
		super(message);
		this.status = status;
	}

	public HttpStatus getStatus() {
		return status;
	}

}
