package com.onecore.tap.common;

import jakarta.servlet.http.HttpServletRequest;

public record RequestInfo(String ipAddress, String userAgent) {

	public static RequestInfo from(HttpServletRequest request) {
		String ua = request.getHeader("User-Agent");
		if (ua != null && ua.length() > 300) {
			ua = ua.substring(0, 300);
		}
		// getRemoteAddr já considera X-Forwarded-For quando forward-headers-strategy=framework
		return new RequestInfo(request.getRemoteAddr(), ua);
	}

}
