package dev.pixelpolo.tetrisflip.score;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/** A finished game on the leaderboard. */
@Document("scores")
public record Score(
        @Id String id,
        String name,
        @Indexed(direction = IndexDirection.DESCENDING) int score,
        int lines,
        int level,
        Instant createdAt) {
}
