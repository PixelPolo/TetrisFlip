package dev.pixelpolo.tetrisflip.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.pixelpolo.tetrisflip.auth.SecurityConfig;
import dev.pixelpolo.tetrisflip.auth.UserRepository;
import dev.pixelpolo.tetrisflip.score.Difficulty;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(GameController.class)
@Import(SecurityConfig.class)
class GameControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    UserRepository users;

    @Test
    void startingAGameRecordsItInTheSession() throws Exception {
        var session = new MockHttpSession();

        mvc.perform(post("/api/games")
                        .with(user("Ada"))
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"difficulty\":\"hard\"}"))
                .andExpect(status().isNoContent());

        var game = (ActiveGame) session.getAttribute(ActiveGame.SESSION_KEY);
        assertThat(game.difficulty()).isEqualTo(Difficulty.HARD);
    }

    @Test
    void rejectsAnUnknownDifficultyAndAnonymousPlayers() throws Exception {
        mvc.perform(post("/api/games")
                        .with(user("Ada"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"difficulty\":\"nightmare\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/games")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"difficulty\":\"easy\"}"))
                .andExpect(status().isUnauthorized());
    }
}
