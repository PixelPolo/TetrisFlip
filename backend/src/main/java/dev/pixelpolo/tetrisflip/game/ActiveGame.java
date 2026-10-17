package dev.pixelpolo.tetrisflip.game;

import dev.pixelpolo.tetrisflip.score.Difficulty;
import java.io.Serializable;
import java.time.Instant;

/** A game the signed-in player started. A score can only be submitted for a started game, once. */
public record ActiveGame(Difficulty difficulty, Instant startedAt) implements Serializable {

    public static final String SESSION_KEY = "activeGame";
}
