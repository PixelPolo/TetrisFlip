package dev.pixelpolo.tetrisflip.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.concurrent.Semaphore;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
class AuthController {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final SlidingWindowLimiter loginFailuresByUser;
    private final SlidingWindowLimiter loginFailuresByIp;
    private final SlidingWindowLimiter registrationsByIp;
    /** Argon2 uses ~19 MiB per hash: cap concurrent hashes and fail fast instead of queueing. */
    private final Semaphore hashing = new Semaphore(4);
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    AuthController(
            UserRepository users,
            PasswordEncoder encoder,
            AuthenticationManager authenticationManager,
            SecurityContextRepository contextRepository,
            SlidingWindowLimiter loginFailuresByUser,
            SlidingWindowLimiter loginFailuresByIp,
            SlidingWindowLimiter registrationsByIp) {
        this.users = users;
        this.encoder = encoder;
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.loginFailuresByUser = loginFailuresByUser;
        this.loginFailuresByIp = loginFailuresByIp;
        this.registrationsByIp = registrationsByIp;
    }

    @PostMapping("/register")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    UserResponse register(
            @Valid @RequestBody RegisterRequest body, HttpServletRequest request, HttpServletResponse response) {
        if (!registrationsByIp.tryAcquire(request.getRemoteAddr())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many sign-ups, try again later");
        }
        var user = new User(
                null,
                body.username(),
                body.username().toLowerCase(),
                withHashingSlot(() -> encoder.encode(body.password())),
                Instant.now());
        try {
            users.save(user);
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "username already taken");
        }
        signIn(body.username(), body.password(), request, response);
        return new UserResponse(user.username());
    }

    @PostMapping("/login")
    UserResponse login(
            @Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        var userKey = body.username().toLowerCase();
        var ipKey = request.getRemoteAddr();
        // Reserve the attempts before hashing, atomically, so parallel requests cannot exceed the cap.
        // A successful login gives them back; only failures stay counted.
        if (!loginFailuresByUser.tryAcquire(userKey)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many attempts, try again later");
        }
        if (!loginFailuresByIp.tryAcquire(ipKey)) {
            loginFailuresByUser.refund(userKey);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many attempts, try again later");
        }
        try {
            var authentication = withHashingSlot(() -> signIn(body.username(), body.password(), request, response));
            loginFailuresByUser.reset(userKey);
            loginFailuresByIp.refund(ipKey);
            return new UserResponse(authentication.getName());
        } catch (AuthenticationException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "wrong username or password");
        } catch (ResponseStatusException e) {
            // Server too busy to hash: not the player's fault, so the attempt does not count.
            loginFailuresByUser.refund(userKey);
            loginFailuresByIp.refund(ipKey);
            throw e;
        }
    }

    private <T> T withHashingSlot(java.util.function.Supplier<T> work) {
        if (!hashing.tryAcquire()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "busy, try again");
        }
        try {
            return work.get();
        } finally {
            hashing.release();
        }
    }

    /** 200 with the player when signed in, 401 otherwise. Also hands out the CSRF cookie. */
    @GetMapping("/me")
    UserResponse me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null || "anonymousUser".equals(authentication.getName())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return new UserResponse(authentication.getName());
    }

    private Authentication signIn(
            String username, String password, HttpServletRequest request, HttpServletResponse response) {
        var authentication =
                authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(username, password));
        // New session id after login: blocks session fixation.
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        var context = contextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        contextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        return authentication;
    }
}
