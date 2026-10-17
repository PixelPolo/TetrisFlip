package dev.pixelpolo.tetrisflip.game;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import dev.pixelpolo.tetrisflip.score.Difficulty;

/** Body of {@code POST /api/games}. */
public record StartGameRequest(@NotBlank String difficulty) {

    @AssertTrue(message = "difficulty must be easy or hard")
    boolean isDifficultyValid() {
        return Difficulty.parse(difficulty) != null;
    }
}
