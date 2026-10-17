package dev.pixelpolo.tetrisflip.score;

import java.util.Locale;

/** Easy games show the ghost piece, hard games do not. Each has its own leaderboard. */
public enum Difficulty {
    EASY,
    HARD;

    /** Parses "easy" or "hard" (any case), or returns {@code null} for anything else. */
    public static Difficulty parse(String value) {
        if (value == null) {
            return null;
        }
        try {
            return valueOf(value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }
}
