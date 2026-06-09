package com.risa.rmis.config;

import com.risa.rmis.security.JwtAuthenticationFilter;
// [GoR-SSO] success handler that bridges a finished SSO login into our own RMIS JWT
import com.risa.rmis.security.SsoLoginSuccessHandler;
// [GoR-SSO] used to return 401 (instead of an IdP redirect) for unauthenticated API calls
import org.springframework.http.HttpStatus;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
// [GoR-SSO] used to force PKCE on the authorize request (wrapper requires it)
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;
    // [GoR-SSO] NOTE: SsoLoginSuccessHandler is NOT injected here as a field — it needs the
    // [GoR-SSO] PasswordEncoder @Bean defined in this class, which would form a bean cycle.
    // [GoR-SSO] It is injected as a method parameter of securityFilterChain(...) instead.

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    // [GoR-SSO] SPA base URL to bounce back to when SSO login fails
    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   // [GoR-SSO] injected here (method params) to avoid the bean cycle
                                                   SsoLoginSuccessHandler ssoLoginSuccessHandler,
                                                   ClientRegistrationRepository clientRegistrationRepository) throws Exception {
        // [GoR-SSO] Force PKCE (code_challenge/S256) on the authorize request. rmis-portal is a
        // [GoR-SSO] CONFIDENTIAL client and Spring skips PKCE for those by default — but the SSO
        // [GoR-SSO] wrapper REQUIRES code_challenge, so we re-enable it with this resolver.
        DefaultOAuth2AuthorizationRequestResolver pkceResolver =
            new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
        pkceResolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // [GoR-SSO] was STATELESS — relaxed to IF_REQUIRED so Spring can persist the
            // [GoR-SSO] OAuth2 authorization request (state + PKCE) across the redirect.
            // [GoR-SSO] API requests are still authenticated statelessly by the JWT filter.
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                // [GoR-SSO] login-initiation + provider callback endpoints must be public
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                .anyRequest().authenticated()
            )
            // [GoR-SSO] keep the API a pure resource server: unauthenticated API calls get
            // [GoR-SSO] a 401, NOT a browser redirect to the IdP (the SPA starts SSO itself).
            .exceptionHandling(e -> e.authenticationEntryPoint(
                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            // [GoR-SSO] enable the OIDC login dance; on success mint the RMIS JWT, on
            // [GoR-SSO] failure bounce back to the SPA login page with an error flag.
            .oauth2Login(oauth -> oauth
                // [GoR-SSO] use the PKCE-forcing resolver built above
                .authorizationEndpoint(a -> a.authorizationRequestResolver(pkceResolver))
                .successHandler(ssoLoginSuccessHandler)
                .failureHandler((req, res, ex) ->
                    res.sendRedirect(frontendUrl + "/login?sso_error=sso_login_failed")))
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
