package dev.pixelpolo.tetrisflip.score;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/** A finished game on the leaderboard. */
@Document("scores")
// Matches the leaderboard query (difficulty, then score DESC, createdAt ASC) so the top 10 never scans the collection.
@CompoundIndex(name = "difficulty_score_createdAt", def = "{'difficulty': 1, 'score': -1, 'createdAt': 1}")
public record Score(
        @Id String id,
        String name,
        Difficulty difficulty,
        int score,
        int lines,
        int level,
        Instant createdAt) {
}
