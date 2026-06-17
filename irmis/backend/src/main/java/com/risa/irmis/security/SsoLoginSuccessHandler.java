package com.risa.irmis.security;

import com.risa.irmis.entity.User;
import com.risa.irmis.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.UUID;

/**
 * Bridges an SSO sign-in to a local account: maps the OIDC identity to a row in
 * our {@code users} table, mints this app's own JWT, and redirects the browser
 * to the SPA's {@code /sso/callback} with the token (+ id_token for logout).
 * The rest of the app keeps working against the local JWT, unchanged.
 */
@Component
@RequiredArgsConstructor
public class SsoLoginSuccessHandler implements AuthenticationSuccessHandler {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwt;
    private final UserDetailsService uds;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest req, HttpServletResponse res, Authentication auth)
            throws IOException {
        OidcUser oidc = (OidcUser) auth.getPrincipal();
        User user = findOrCreate(oidc);

        // loadUserByUsername expects the login identifier — email, for this app.
        UserDetails userDetails = uds.loadUserByUsername(user.getEmail());
        String appToken = jwt.generateToken(userDetails);
        String idToken = oidc.getIdToken().getTokenValue();   // returned at code->token exchange

        String target = UriComponentsBuilder.fromUriString(frontendUrl)
                .path("/sso/callback")
                .fragment("token=" + appToken + "&id_token=" + idToken)  // JWTs are base64url-safe
                .build()
                .toUriString();
        res.sendRedirect(target);
    }

    /**
     * (1) by SSO subject, (2) else link an existing row with the same email,
     * (3) else create a fresh account with a random unusable local password.
     */
    private User findOrCreate(OidcUser oidc) {
        String subject = oidc.getSubject();
        String email = oidc.getEmail();
        String fullName = oidc.getFullName() != null ? oidc.getFullName() : email;

        return users.findBySsoSubject(subject)
                .orElseGet(() -> users.findByEmail(email)
                        .map(existing -> {            // (2) link the SSO identity to the local row
                            existing.setSsoSubject(subject);
                            return users.save(existing);
                        })
                        .orElseGet(() -> users.save(   // (3) brand-new SSO user
                                User.builder()
                                        .email(email)
                                        .fullName(fullName)
                                        // unusable local password: login is only ever via SSO
                                        .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                                        .ssoSubject(subject)
                                        .build())));
    }
}
