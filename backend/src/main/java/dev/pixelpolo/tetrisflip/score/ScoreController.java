package dev.pixelpolo.tetrisflip.score;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/scores")
class ScoreController {

    private final ScoreRepository repository;

    ScoreController(ScoreRepository repository) {
        this.repository = repository;
    }

    /** Top 10 of one leaderboard: {@code ?difficulty=easy} or {@code ?difficulty=hard}. */
    @GetMapping
    List<ScoreResponse> top(@RequestParam String difficulty) {
        var parsed = Difficulty.parse(difficulty);
        if (parsed == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "difficulty must be easy or hard");
        }
        return repository.findTop10ByDifficultyOrderByScoreDescCreatedAtAsc(parsed).stream()
                .map(ScoreResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ScoreResponse submit(@Valid @RequestBody ScoreRequest request) {
        var saved = repository.save(new Score(
                null,
                request.name().strip(),
                Difficulty.parse(request.difficulty()),
                request.score(),
                request.lines(),
                request.level(),
                Instant.now()));
        return ScoreResponse.from(saved);
    }
}
