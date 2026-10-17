package dev.pixelpolo.tetrisflip.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
// The throttling limiters are singletons: a fresh context per test keeps their state isolated.
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class AuthControllerTest {

    private static final String PASSWORD = "correct horse battery";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    UserRepository users;

    /** A tiny in-memory stand-in for the users collection. */
    private final Map<String, User> store = new ConcurrentHashMap<>();

    @BeforeEach
    void fakeRepository() {
        when(users.findByUsernameLower(anyString()))
                .thenAnswer(call -> Optional.ofNullable(store.get(call.<String>getArgument(0))));
        when(users.save(any(User.class))).thenAnswer(call -> {
            User user = call.getArgument(0);
            if (store.putIfAbsent(user.usernameLower(), user) != null) {
                throw new DuplicateKeyException("duplicate");
            }
            return user;
        });
    }

    private static String json(String username, String password) {
        return "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password);
    }

    private org.springframework.test.web.servlet.ResultActions register(String username, String password)
            throws Exception {
        return mvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(username, password)));
    }

    private org.springframework.test.web.servlet.ResultActions login(String username, String password)
            throws Exception {
        return mvc.perform(post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(username, password)));
    }

    @Test
    void registrationStoresOnlyAnArgon2Hash() throws Exception {
        register("Ada", PASSWORD).andExpect(status().isCreated()).andExpect(jsonPath("$.username").value("Ada"));

        var saved = store.get("ada");
        assertThat(saved.passwordHash()).startsWith("$argon2id$").doesNotContain(PASSWORD);
    }

    @Test
    void registrationSignsThePlayerIn() throws Exception {
        var session = (MockHttpSession) register("Ada", PASSWORD).andReturn().getRequest().getSession();

        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("Ada"));
    }

    @Test
    void usernamesAreUniqueIgnoringCase() throws Exception {
        register("Ada", PASSWORD).andExpect(status().isCreated());
        register("ADA", PASSWORD).andExpect(status().isConflict());
    }

    @Test
    void rejectsWeakOrMalformedSignUps() throws Exception {
        register("ab", PASSWORD).andExpect(status().isBadRequest());
        register("a b", PASSWORD).andExpect(status().isBadRequest());
        register("<b>x</b>", PASSWORD).andExpect(status().isBadRequest());
        register("Ada", "short").andExpect(status().isBadRequest());
        register("Ada", "x".repeat(129)).andExpect(status().isBadRequest());
        register("Ada", "my-ada-password").andExpect(status().isBadRequest());
        assertThat(store).isEmpty();
    }

    @Test
    void logsInWithTheRightPasswordOnly() throws Exception {
        register("Ada", PASSWORD).andExpect(status().isCreated());

        login("ada", PASSWORD).andExpect(status().isOk()).andExpect(jsonPath("$.username").value("Ada"));
        login("ada", "wrong password!").andExpect(status().isUnauthorized());
        login("nobody", PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void locksAnAccountAfterTooManyFailures() throws Exception {
        register("Ada", PASSWORD).andExpect(status().isCreated());

        for (int i = 0; i < 5; i++) {
            login("ada", "wrong password " + i).andExpect(status().isUnauthorized());
        }
        // Even the right password is refused while the account is throttled.
        login("ada", PASSWORD).andExpect(status().isTooManyRequests());
    }

    @Test
    void meIsUnauthorizedWithoutASession() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        var session = (MockHttpSession) register("Ada", PASSWORD).andReturn().getRequest().getSession();

        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void stateChangingRequestsNeedACsrfToken() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("Ada", PASSWORD)))
                .andExpect(status().isForbidden());
        assertThat(store).isEmpty();
    }

    @Test
    void theCsrfCookieIsReadableByTheFrontend() throws Exception {
        var cookie = mvc.perform(get("/api/auth/me")).andReturn().getResponse().getCookie("XSRF-TOKEN");

        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isFalse();
    }
}
