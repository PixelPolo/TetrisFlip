package dev.pixelpolo.tetrisflip.score;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ScoreRepository extends MongoRepository<Score, String> {

    List<Score> findTop10ByDifficultyOrderByScoreDescCreatedAtAsc(Difficulty difficulty);
}
