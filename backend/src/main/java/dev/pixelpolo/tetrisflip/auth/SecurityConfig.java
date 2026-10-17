package dev.pixelpolo.tetrisflip.auth;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Session-cookie authentication for a same-origin single page app:
 * HttpOnly + SameSite cookie for the session, double-submit cookie for CSRF.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf
                        // The SPA reads this cookie and echoes it in the X-XSRF-TOKEN header.
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        // Error pages carry the real status code (409, 429, ...) instead of a masked 401.
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
                        .requestMatchers("/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/scores").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                        // Answers 401 on its own when nobody is signed in, but must set the CSRF cookie.
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout", "/api/games", "/api/scores").authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, denied) ->
                                response.sendError(HttpStatus.FORBIDDEN.value())))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT))
                        .deleteCookies("TF_SESSION"))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .requestCache(cache -> cache.disable())
                .headers(Customizer.withDefaults());
        return http.build();
    }

    /** Argon2id with the parameters recommended by Spring Security (OWASP minimums or better). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return // 19 MiB, 2 passes, 1 lane: the OWASP minimum for Argon2id.
        new Argon2PasswordEncoder(16, 32, 1, 19_456, 2);
    }

    @Bean
    UserDetailsService userDetailsService(UserRepository users) {
        return username -> users.findByUsernameLower(username.toLowerCase())
                .map(user -> org.springframework.security.core.userdetails.User
                        .withUsername(user.username())
                        .password(user.passwordHash())
                        .authorities(List.of())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("unknown user"));
    }

    /** Wrong user and wrong password give the same error, and unknown users still cost a hash. */
    @Bean
    AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder encoder) {
        var provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SlidingWindowLimiter loginFailuresByUser() {
        return new SlidingWindowLimiter(5, Duration.ofMinutes(15), 10_000);
    }

    @Bean
    SlidingWindowLimiter loginFailuresByIp() {
        return new SlidingWindowLimiter(20, Duration.ofMinutes(15), 10_000);
    }

    @Bean
    SlidingWindowLimiter registrationsByIp() {
        return new SlidingWindowLimiter(10, Duration.ofHours(1), 10_000);
    }

    @Bean
    SlidingWindowLimiter scoreSubmissionsByUser() {
        return new SlidingWindowLimiter(30, Duration.ofHours(1), 10_000);
    }

    /** Makes sure the XSRF-TOKEN cookie is written, since Spring Security 6+ loads tokens lazily. */
    static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            var token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (token != null) {
                token.getToken();
            }
            chain.doFilter(request, response);
        }
    }
}
