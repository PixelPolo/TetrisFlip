package dev.pixelpolo.tetrisflip.auth;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/auth/login}. Lengths are capped so a huge password is never hashed. */
public record LoginRequest(
        @NotNull @Size(min = 1, max = 16) String username,
        @NotNull @Size(min = 1, max = 128) String password) {
}
