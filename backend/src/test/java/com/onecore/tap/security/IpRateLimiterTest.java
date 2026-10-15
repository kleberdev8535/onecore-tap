package com.onecore.tap.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class IpRateLimiterTest {

	static class MutableClock extends Clock {

		Instant now = Instant.parse("2026-01-01T12:00:00Z");

		@Override
		public ZoneOffset getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(java.time.ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}

	}

	@Test
	void blocksAfterLimitAndReleasesAfterWindow() {
		MutableClock clock = new MutableClock();
		IpRateLimiter limiter = new IpRateLimiter(3, Duration.ofMinutes(15), clock);

		assertThat(limiter.tryAcquire("login:1.1.1.1")).isTrue();
		assertThat(limiter.tryAcquire("login:1.1.1.1")).isTrue();
		assertThat(limiter.tryAcquire("login:1.1.1.1")).isTrue();
		assertThat(limiter.tryAcquire("login:1.1.1.1")).isFalse();
		assertThat(limiter.tryAcquire("login:2.2.2.2")).isTrue();

		clock.now = clock.now.plus(Duration.ofMinutes(16));
		assertThat(limiter.tryAcquire("login:1.1.1.1")).isTrue();
	}

}
