package dev.pixelpolo.tetrisflip.score;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ScorePlausibilityTest {

    @Test
    void acceptsAnHonestGame() {
        // 40 lines in 4 minutes at level 5.
        assertThat(ScorePlausibility.check(18_000, 40, 5, 240)).isNull();
    }

    @Test
    void rejectsALevelThatDoesNotMatchTheLines() {
        assertThat(ScorePlausibility.check(100, 5, 9, 60)).contains("level");
    }

    @Test
    void rejectsGamesThatAreTooShort() {
        assertThat(ScorePlausibility.check(100, 0, 1, 1)).contains("short");
    }

    @Test
    void rejectsImpossibleLineRates() {
        assertThat(ScorePlausibility.check(1000, 50, 6, 10)).contains("lines");
    }

    @Test
    void rejectsScoresFarAboveWhatTheRulesAllow() {
        // The kind of value a forged request would send.
        assertThat(ScorePlausibility.check(99_999_999, 4, 1, 60)).contains("score");
    }
}
