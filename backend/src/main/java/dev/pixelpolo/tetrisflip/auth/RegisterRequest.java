package dev.pixelpolo.tetrisflip.auth;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/auth/register}. */
public record RegisterRequest(
        // Letters, digits, "_" and "-" only: safe to show on the leaderboard and in logs.
        @NotNull @Pattern(regexp = "^[A-Za-z0-9_-]{3,16}$", message = "3 to 16 letters, digits, _ or -") String username,
        @NotNull @Size(min = 10, max = 128, message = "10 to 128 characters") String password) {

    @AssertTrue(message = "the password must not contain the username")
    boolean isPasswordDifferentFromUsername() {
        return username == null || password == null || !password.toLowerCase().contains(username.toLowerCase());
    }
}
