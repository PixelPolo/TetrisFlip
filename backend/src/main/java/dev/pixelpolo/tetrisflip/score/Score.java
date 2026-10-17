package dev.pixelpolo.tetrisflip.score;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/** A finished game on the leaderboard. */
@Document("scores")
@CompoundIndex(name = "difficulty_score", def = "{'difficulty': 1, 'score': -1}")
public record Score(
        @Id String id,
        String name,
        Difficulty difficulty,
        int score,
        int lines,
        int level,
        Instant createdAt) {
}
