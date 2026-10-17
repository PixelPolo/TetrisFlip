package dev.pixelpolo.tetrisflip.score;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/scores}. */
public record ScoreRequest(
        // No control or invisible format characters (bidi overrides, zero-width) and no angle brackets.
        @NotBlank @Size(max = 16) @Pattern(regexp = "^[^\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}<>]+$") String name,
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
