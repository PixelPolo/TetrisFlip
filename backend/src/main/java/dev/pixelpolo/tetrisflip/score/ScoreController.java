package dev.pixelpolo.tetrisflip.score;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scores")
class ScoreController {

    private final ScoreRepository repository;

    ScoreController(ScoreRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    List<ScoreResponse> top() {
        return repository.findTop10ByOrderByScoreDescCreatedAtAsc().stream()
                .map(ScoreResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ScoreResponse submit(@Valid @RequestBody ScoreRequest request) {
        var saved = repository.save(new Score(
                null, request.name().strip(), request.score(), request.lines(), request.level(), Instant.now()));
        return ScoreResponse.from(saved);
    }
}
