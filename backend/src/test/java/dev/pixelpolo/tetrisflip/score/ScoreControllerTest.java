package dev.pixelpolo.tetrisflip.score;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ScoreController.class)
class ScoreControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    ScoreRepository repository;

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
    void savesAValidScore() throws Exception {
        when(repository.save(any(Score.class))).thenAnswer(call -> call.getArgument(0));

        mvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Ada \",\"difficulty\":\"easy\",\"score\":4200,\"lines\":30,\"level\":4}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Ada"))
                .andExpect(jsonPath("$.difficulty").value("easy"));

        verify(repository).save(any(Score.class));
    }

    @Test
    void rejectsInvalidScores() throws Exception {
        var invalid = List.of(
                "{\"name\":\"\",\"difficulty\":\"easy\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"name\":\"This name is far too long\",\"difficulty\":\"easy\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"name\":\"<b>Ada</b>\",\"difficulty\":\"easy\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"name\":\"Ada\\u202Eevil\",\"difficulty\":\"easy\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"name\":\"Ada\\nroot\",\"difficulty\":\"easy\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"name\":\"Ada\",\"difficulty\":\"easy\",\"score\":-5,\"lines\":1,\"level\":1}",
                "{\"name\":\"Ada\",\"difficulty\":\"easy\",\"score\":999999999,\"lines\":1,\"level\":1}",
                "{\"name\":\"Ada\",\"difficulty\":\"medium\",\"score\":10,\"lines\":1,\"level\":1}",
                "not json");

        for (var body : invalid) {
            mvc.perform(post("/api/scores").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(repository);
    }
}
