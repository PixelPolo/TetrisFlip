package dev.pixelpolo.tetrisflip.auth;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.HashMap;
import java.util.Map;

/**
 * Counts events per key over a sliding time window, in memory.
 * The number of tracked keys is capped so an attacker cannot exhaust memory with fresh keys.
 */
public class SlidingWindowLimiter {

    private final int maxEvents;
    private final Duration window;
    private final Clock clock;
    private final int maxKeys;
    private final Map<String, Deque<Long>> events;

    public SlidingWindowLimiter(int maxEvents, Duration window, int maxKeys, Clock clock) {
        this.maxEvents = maxEvents;
        this.window = window;
        this.clock = clock;
        this.maxKeys = maxKeys;
        this.events = new HashMap<>();
    }

    public SlidingWindowLimiter(int maxEvents, Duration window, int maxKeys) {
        this(maxEvents, window, maxKeys, Clock.systemUTC());
    }

    /** True when the key already used up its allowance in the current window. */
    public synchronized boolean isBlocked(String key) {
        var queue = events.get(key);
        if (queue == null) {
            return false;
        }
        prune(queue);
        return queue.size() >= maxEvents;
    }

    /** Records one event for the key. */
    public synchronized void record(String key) {
        var queue = queueFor(key);
        if (queue == null) {
            return;
        }
        prune(queue);
        queue.addLast(clock.millis());
    }

    /** Records one event only if the key is not blocked. Returns false when blocked. */
    public synchronized boolean tryAcquire(String key) {
        if (isBlocked(key) || queueFor(key) == null) {
            return false;
        }
        record(key);
        return true;
    }

    /** Gives back the most recent event of the key (an attempt that turned out fine). */
    public synchronized void refund(String key) {
        var queue = events.get(key);
        if (queue != null) {
            queue.pollLast();
            if (queue.isEmpty()) {
                events.remove(key);
            }
        }
    }

    public synchronized void reset(String key) {
        events.remove(key);
    }

    /**
     * The queue of a key, created on demand. Only expired keys are ever dropped to make room, so
     * flooding with fresh keys cannot push a live throttle out; when the table is full of live keys
     * a new key gets no queue and {@link #tryAcquire} fails closed.
     */
    private Deque<Long> queueFor(String key) {
        var queue = events.get(key);
        if (queue != null) {
            return queue;
        }
        if (events.size() >= maxKeys) {
            events.values().removeIf(q -> {
                prune(q);
                return q.isEmpty();
            });
            if (events.size() >= maxKeys) {
                return null;
            }
        }
        queue = new ArrayDeque<>();
        events.put(key, queue);
        return queue;
    }

    private void prune(Deque<Long> queue) {
        long oldest = clock.millis() - window.toMillis();
        Iterator<Long> it = queue.iterator();
        while (it.hasNext() && it.next() < oldest) {
            it.remove();
        }
    }
}
