package dev.pixelpolo.tetrisflip.score;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.pixelpolo.tetrisflip.auth.SecurityConfig;
import dev.pixelpolo.tetrisflip.auth.UserRepository;
import dev.pixelpolo.tetrisflip.game.ActiveGame;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(ScoreController.class)
@Import(SecurityConfig.class)
class ScoreControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    ScoreRepository repository;

    @MockitoBean
    UserRepository users;

    private static MockHttpSession gameStartedSecondsAgo(long seconds, Difficulty difficulty) {
        var session = new MockHttpSession();
        session.setAttribute(ActiveGame.SESSION_KEY, new ActiveGame(difficulty, Instant.now().minusSeconds(seconds)));
        return session;
    }

    private static MockHttpServletRequestBuilder submit(String body, MockHttpSession session) {
        return post("/api/scores")
                .with(user("Ada"))
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
    }

    @Test
    void listsTopScoresWithoutInternalFields() throws Exception {
        when(repository.findTop10ByDifficultyOrderByScoreDescCreatedAtAsc(Difficulty.HARD))
                .thenReturn(List.of(new Score("1", "Ada", Difficulty.HARD, 4200, 30, 4, Instant.now())));

        mvc.perform(get("/api/scores").param("difficulty", "hard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Ada"))
                .andExpect(jsonPath("$[0].difficulty").value("hard"))
                .andExpect(jsonPath("$[0].score").value(4200))
                .andExpect(jsonPath("$[0].id").doesNotExist());
    }

    @Test
    void rejectsAnUnknownLeaderboard() throws Exception {
        mvc.perform(get("/api/scores").param("difficulty", "medium")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/scores")).andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    @Test
    void savesAScoreUnderTheSignedInPlayersName() throws Exception {
        when(repository.save(any(Score.class))).thenAnswer(call -> call.getArgument(0));
        var session = gameStartedSecondsAgo(60, Difficulty.EASY);

        mvc.perform(submit("{\"difficulty\":\"easy\",\"score\":1200,\"lines\":8,\"level\":1}", session))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Ada"))
                .andExpect(jsonPath("$.difficulty").value("easy"));

        verify(repository).save(any(Score.class));
    }

    @Test
    void ignoresANameSentInTheBody() throws Exception {
        when(repository.save(any(Score.class))).thenAnswer(call -> call.getArgument(0));
        var session = gameStartedSecondsAgo(60, Difficulty.EASY);

        mvc.perform(submit(
                        "{\"name\":\"Somebody else\",\"difficulty\":\"easy\",\"score\":1200,\"lines\":8,\"level\":1}",
                        session))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Ada"));
    }

    @Test
    void aGameCanOnlyBeScoredOnce() throws Exception {
        when(repository.save(any(Score.class))).thenAnswer(call -> call.getArgument(0));
        var session = gameStartedSecondsAgo(60, Difficulty.EASY);
        var body = "{\"difficulty\":\"easy\",\"score\":1200,\"lines\":8,\"level\":1}";

        mvc.perform(submit(body, session)).andExpect(status().isCreated());
        mvc.perform(submit(body, session)).andExpect(status().isConflict());
    }

    @Test
    void needsAGameStartedOnTheServerWithTheSameDifficulty() throws Exception {
        var body = "{\"difficulty\":\"hard\",\"score\":1200,\"lines\":8,\"level\":1}";

        mvc.perform(submit(body, new MockHttpSession())).andExpect(status().isConflict());
        mvc.perform(submit(body, gameStartedSecondsAgo(60, Difficulty.EASY))).andExpect(status().isConflict());
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsImpossibleScores() throws Exception {
        var session = gameStartedSecondsAgo(60, Difficulty.EASY);

        mvc.perform(submit("{\"difficulty\":\"easy\",\"score\":99999999,\"lines\":4,\"level\":1}", session))
                .andExpect(status().isUnprocessableEntity());
        // Submitted right after the start: no human plays that fast.
        mvc.perform(submit(
                        "{\"difficulty\":\"easy\",\"score\":1200,\"lines\":8,\"level\":1}",
                        gameStartedSecondsAgo(0, Difficulty.EASY)))
                .andExpect(status().isUnprocessableEntity());
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsInvalidBodies() throws Exception {
        var invalid = List.of(
                "{\"difficulty\":\"easy\",\"score\":-5,\"lines\":1,\"level\":1}",
                "{\"difficulty\":\"easy\",\"score\":999999999,\"lines\":1,\"level\":1}",
                "{\"difficulty\":\"medium\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"score\":10,\"lines\":1,\"level\":1}",
                "not json");

        for (var body : invalid) {
            mvc.perform(submit(body, gameStartedSecondsAgo(60, Difficulty.EASY))).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(repository);
    }

    @Test
    void anonymousPlayersCannotSubmit() throws Exception {
        mvc.perform(post("/api/scores")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"difficulty\":\"easy\",\"score\":1200,\"lines\":8,\"level\":1}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(repository);
    }
}
