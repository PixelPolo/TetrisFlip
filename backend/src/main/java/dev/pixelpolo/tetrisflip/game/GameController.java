package dev.pixelpolo.tetrisflip.game;

import dev.pixelpolo.tetrisflip.score.Difficulty;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games")
class GameController {

    /** Called when a signed-in player starts a game. Starting again replaces the previous game. */
    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void start(@Valid @RequestBody StartGameRequest request, HttpSession session) {
        session.setAttribute(
                ActiveGame.SESSION_KEY, new ActiveGame(Difficulty.parse(request.difficulty()), Instant.now()));
    }
}
