package dev.pixelpolo.tetrisflip.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class SlidingWindowLimiterTest {

    /** A clock the test can move forward. */
    static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T00:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public java.time.ZoneId getZone() {
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
    void blocksOnceTheAllowanceIsUsedAndFreesItAfterTheWindow() {
        var clock = new MutableClock();
        var limiter = new SlidingWindowLimiter(2, Duration.ofMinutes(1), 100, clock);

        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("a")).isFalse();
        assertThat(limiter.tryAcquire("b")).isTrue();

        clock.advance(Duration.ofSeconds(61));
        assertThat(limiter.isBlocked("a")).isFalse();
        assertThat(limiter.tryAcquire("a")).isTrue();
    }

    @Test
    void resetClearsAKey() {
        var limiter = new SlidingWindowLimiter(1, Duration.ofMinutes(1), 100);
        limiter.record("a");
        assertThat(limiter.isBlocked("a")).isTrue();
        limiter.reset("a");
        assertThat(limiter.isBlocked("a")).isFalse();
    }

    @Test
    void floodingFreshKeysCannotEvictALiveThrottle() {
        var clock = new MutableClock();
        var limiter = new SlidingWindowLimiter(1, Duration.ofMinutes(1), 2, clock);
        assertThat(limiter.tryAcquire("victim")).isTrue();
        assertThat(limiter.tryAcquire("b")).isTrue();

        // Table full of live keys: new keys are refused (fail closed) and "victim" stays throttled.
        assertThat(limiter.tryAcquire("c")).isFalse();
        assertThat(limiter.isBlocked("victim")).isTrue();

        // Once the old entries expire, room is made again.
        clock.advance(Duration.ofSeconds(61));
        assertThat(limiter.tryAcquire("c")).isTrue();
    }

    @Test
    void refundGivesBackTheLastEvent() {
        var limiter = new SlidingWindowLimiter(1, Duration.ofMinutes(1), 10);
        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("a")).isFalse();
        limiter.refund("a");
        assertThat(limiter.tryAcquire("a")).isTrue();
    }
}
