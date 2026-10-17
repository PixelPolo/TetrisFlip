package dev.pixelpolo.tetrisflip.score;

import dev.pixelpolo.tetrisflip.auth.SlidingWindowLimiter;
import dev.pixelpolo.tetrisflip.game.ActiveGame;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.Duration;
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
import org.springframework.web.util.WebUtils;

@RestController
@RequestMapping("/api/scores")
class ScoreController {

    private static final double MAX_GAME_SECONDS = 1800;

    private final ScoreRepository repository;
    private final SlidingWindowLimiter submissionsByUser;

    ScoreController(ScoreRepository repository, SlidingWindowLimiter scoreSubmissionsByUser) {
        this.repository = repository;
        this.submissionsByUser = scoreSubmissionsByUser;
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

    /** Saves the score of the game the signed-in player started. One score per started game. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ScoreResponse submit(@Valid @RequestBody ScoreRequest request, Principal principal, HttpSession session) {
        ActiveGame game;
        // Atomic take: two parallel submits from one session cannot both claim the same game.
        synchronized (WebUtils.getSessionMutex(session)) {
            game = (ActiveGame) session.getAttribute(ActiveGame.SESSION_KEY);
            session.removeAttribute(ActiveGame.SESSION_KEY);
        }
        var difficulty = Difficulty.parse(request.difficulty());
        if (game == null || game.difficulty() != difficulty) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "no matching game in progress");
        }
        if (!submissionsByUser.tryAcquire(principal.getName())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many scores, try again later");
        }
        // Capped: waiting for hours must not buy an ever larger allowance.
        var elapsed = Math.min(Duration.between(game.startedAt(), Instant.now()).toMillis() / 1000.0, MAX_GAME_SECONDS);
        var problem = ScorePlausibility.check(request.score(), request.lines(), request.level(), elapsed);
        if (problem != null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, problem);
        }
        var saved = repository.save(new Score(
                null, principal.getName(), difficulty, request.score(), request.lines(), request.level(), Instant.now()));
        return ScoreResponse.from(saved);
    }
}
