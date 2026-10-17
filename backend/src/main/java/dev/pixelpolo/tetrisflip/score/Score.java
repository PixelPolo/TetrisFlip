package dev.pixelpolo.tetrisflip.score;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/** A finished game on the leaderboard. */
@Document("scores")
// Matches the leaderboard query (score DESC, createdAt ASC) so the top 10 never scans the collection.
@CompoundIndex(name = "score_createdAt", def = "{'score': -1, 'createdAt': 1}")
public record Score(
        @Id String id,
        String name,
        int score,
        int lines,
        int level,
        Instant createdAt) {
}
