package dev.pixelpolo.tetrisflip.score;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/scores}. */
public record ScoreRequest(
        @NotBlank @Size(max = 16) String name,
        @NotBlank String difficulty,
        @Min(1) @Max(ScoreRequest.MAX_SCORE) int score,
        @Min(0) @Max(10_000) int lines,
        @Min(1) @Max(1_000) int level) {

    static final int MAX_SCORE = 100_000_000;

    @AssertTrue(message = "difficulty must be easy or hard")
    boolean isDifficultyValid() {
        return Difficulty.parse(difficulty) != null;
    }
}
