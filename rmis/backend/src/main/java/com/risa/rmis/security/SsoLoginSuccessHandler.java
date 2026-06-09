package com.risa.rmis.security;

// [GoR-SSO] ENTIRE FILE IS NEW. Spring Security calls this AFTER a successful SSO login.
// [GoR-SSO] Its job is the "bridge": map the SSO identity to a local RMIS user and mint
// [GoR-SSO] OUR OWN RMIS JWT, so the rest of the app (guard, interceptor, dashboard)
// [GoR-SSO] keeps working exactly as it does for local username/password login.

import com.risa.rmis.entity.User;                                                       // [GoR-SSO]
import com.risa.rmis.repository.UserRepository;                                         // [GoR-SSO]
import jakarta.servlet.http.HttpServletRequest;                                         // [GoR-SSO]
import jakarta.servlet.http.HttpServletResponse;                                        // [GoR-SSO]
import lombok.RequiredArgsConstructor;                                                  // [GoR-SSO]
import org.springframework.beans.factory.annotation.Value;                             // [GoR-SSO]
import org.springframework.security.core.Authentication;                                // [GoR-SSO]
import org.springframework.security.core.userdetails.UserDetails;                       // [GoR-SSO]
import org.springframework.security.core.userdetails.UserDetailsService;                // [GoR-SSO]
import org.springframework.security.crypto.password.PasswordEncoder;                    // [GoR-SSO]
import org.springframework.security.oauth2.core.oidc.user.OidcUser;                     // [GoR-SSO]
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;    // [GoR-SSO]
import org.springframework.stereotype.Component;                                        // [GoR-SSO]
import org.springframework.web.util.UriComponentsBuilder;                               // [GoR-SSO]

import java.io.IOException;                                                             // [GoR-SSO]
import java.util.UUID;                                                                  // [GoR-SSO]

@Component                                                                              // [GoR-SSO]
@RequiredArgsConstructor                                                                // [GoR-SSO]
public class SsoLoginSuccessHandler implements AuthenticationSuccessHandler {           // [GoR-SSO]

    private final UserRepository userRepository;                                        // [GoR-SSO]
    private final PasswordEncoder passwordEncoder;                                      // [GoR-SSO]
    private final JwtTokenProvider jwtTokenProvider;                                    // [GoR-SSO]
    private final UserDetailsService userDetailsService;                                // [GoR-SSO]

    // [GoR-SSO] Where to send the browser once we've issued the RMIS token.
    @Value("${app.frontend.url}")                                                       // [GoR-SSO]
    private String frontendUrl;                                                         // [GoR-SSO]

    @Override                                                                           // [GoR-SSO]
    public void onAuthenticationSuccess(HttpServletRequest request,                     // [GoR-SSO]
                                        HttpServletResponse response,                   // [GoR-SSO]
                                        Authentication authentication) throws IOException { // [GoR-SSO]
        // [GoR-SSO] With "openid" scope the principal is an OidcUser carrying the claims.
        OidcUser oidcUser = (OidcUser) authentication.getPrincipal();                   // [GoR-SSO]

        // [GoR-SSO] Find-or-create the local account, then issue the RMIS JWT.
        User user = findOrCreate(oidcUser);                                             // [GoR-SSO]
        UserDetails details = userDetailsService.loadUserByUsername(user.getUsername());// [GoR-SSO]
        String rmisToken = jwtTokenProvider.generateToken(details);                     // [GoR-SSO]

        // [GoR-SSO] Hand the token to the SPA via the URL fragment (fragments are not
        // [GoR-SSO] sent to servers nor written to access logs as query params).
        String target = UriComponentsBuilder.fromUriString(frontendUrl)                 // [GoR-SSO]
                .path("/sso/callback")                                                  // [GoR-SSO]
                .fragment("token=" + rmisToken)                                         // [GoR-SSO]
                .build().toUriString();                                                 // [GoR-SSO]
        response.sendRedirect(target);                                                  // [GoR-SSO]
    }                                                                                   // [GoR-SSO]

    // [GoR-SSO] Link the SSO identity to a local row: by stable "sub" first, then by
    // [GoR-SSO] email (link a pre-existing account), otherwise create a fresh user.
    private User findOrCreate(OidcUser oidc) {                                          // [GoR-SSO]
        String sub = oidc.getSubject();                                                 // [GoR-SSO]
        String username = firstNonBlank(claim(oidc, "username"), oidc.getPreferredUsername(), sub); // [GoR-SSO]
        String email    = firstNonBlank(claim(oidc, "email"), oidc.getEmail(), username + "@sso.local"); // [GoR-SSO]
        String name = (nz(claim(oidc, "first_name")) + " " + nz(claim(oidc, "last_name"))).trim();       // [GoR-SSO]
        String fullName = name.isBlank() ? username : name;     // [GoR-SSO] single assignment -> lambda-capturable

        return userRepository.findBySsoSubject(sub)                                     // [GoR-SSO] (1) already linked
                .or(() -> userRepository.findByEmail(email).map(u -> {                  // [GoR-SSO] (2) link by email
                    u.setSsoSubject(sub);                                               // [GoR-SSO]
                    return userRepository.save(u);                                      // [GoR-SSO]
                }))                                                                     // [GoR-SSO]
                .orElseGet(() -> {                                                      // [GoR-SSO] (3) brand-new SSO user
                    String uname = username;                                            // [GoR-SSO]
                    if (userRepository.existsByUsername(uname)) {                       // [GoR-SSO] avoid clashing a local account
                        uname = uname + "_" + sub.substring(0, Math.min(8, sub.length())); // [GoR-SSO]
                    }                                                                   // [GoR-SSO]
                    return userRepository.save(User.builder()                           // [GoR-SSO]
                            .username(uname)                                            // [GoR-SSO]
                            .email(email)                                               // [GoR-SSO]
                            .fullName(fullName)                                         // [GoR-SSO]
                            .ssoSubject(sub)                                            // [GoR-SSO]
                            .password(passwordEncoder.encode(UUID.randomUUID().toString())) // [GoR-SSO] unusable local pwd
                            .build());                                                  // [GoR-SSO]
                });                                                                     // [GoR-SSO]
    }                                                                                   // [GoR-SSO]

    // [GoR-SSO] Read a claim from the id_token first, then fall back to the userinfo
    // [GoR-SSO] payload (where the wrapper's extra fields like first_name actually live).
    private static String claim(OidcUser u, String name) {                             // [GoR-SSO]
        Object v = u.getClaims().get(name);                                             // [GoR-SSO]
        if (isBlank(v) && u.getUserInfo() != null) v = u.getUserInfo().getClaims().get(name); // [GoR-SSO]
        if (isBlank(v)) v = u.getAttributes().get(name);                                // [GoR-SSO]
        return v == null ? null : String.valueOf(v);                                    // [GoR-SSO]
    }                                                                                   // [GoR-SSO]

    private static boolean isBlank(Object v) { return v == null || String.valueOf(v).isBlank(); } // [GoR-SSO]
    private static String nz(String s) { return s == null ? "" : s; }                  // [GoR-SSO]
    private static String firstNonBlank(String... values) {                            // [GoR-SSO]
        for (String v : values) if (v != null && !v.isBlank()) return v;               // [GoR-SSO]
        return null;                                                                    // [GoR-SSO]
    }                                                                                   // [GoR-SSO]
}                                                                                       // [GoR-SSO]
