package dev.pixelpolo.tetrisflip.auth;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/** A player account. The password is only ever stored as an Argon2id hash. */
@Document("users")
public record User(
        @Id String id,
        String username,
        // Lower-case copy of the username: unique, so "Ada" and "ada" cannot both register.
        @Indexed(unique = true) String usernameLower,
        String passwordHash,
        Instant createdAt) {
}
