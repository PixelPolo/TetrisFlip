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
        when(repository.findTop10ByOrderByScoreDescCreatedAtAsc())
                .thenReturn(List.of(new Score("1", "Ada", 4200, 30, 4, Instant.now())));

        mvc.perform(get("/api/scores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Ada"))
                .andExpect(jsonPath("$[0].score").value(4200))
                .andExpect(jsonPath("$[0].id").doesNotExist());
    }

    @Test
    void savesAValidScore() throws Exception {
        when(repository.save(any(Score.class))).thenAnswer(call -> call.getArgument(0));

        mvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Ada \",\"score\":4200,\"lines\":30,\"level\":4}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Ada"));

        verify(repository).save(any(Score.class));
    }

    @Test
    void rejectsInvalidScores() throws Exception {
        var invalid = List.of(
                "{\"name\":\"\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"name\":\"This name is far too long\",\"score\":10,\"lines\":1,\"level\":1}",
                "{\"name\":\"Ada\",\"score\":-5,\"lines\":1,\"level\":1}",
                "{\"name\":\"Ada\",\"score\":999999999,\"lines\":1,\"level\":1}",
                "not json");

        for (var body : invalid) {
            mvc.perform(post("/api/scores").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(repository);
    }
}
