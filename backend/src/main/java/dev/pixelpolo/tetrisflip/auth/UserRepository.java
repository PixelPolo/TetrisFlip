package dev.pixelpolo.tetrisflip.auth;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByUsernameLower(String usernameLower);
}
