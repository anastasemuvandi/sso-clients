package com.risa.rmis.config;

// [GoR-SSO] ENTIRE FILE IS NEW. It declares the single OIDC client registration
// [GoR-SSO] ("gor") that Spring Security uses to talk to the Government SSO platform.
// [GoR-SSO] Spring then drives PKCE, state, the code->token exchange and the
// [GoR-SSO] userinfo call for us — none of that is hand-written anymore.
// [GoR-SSO]
// [GoR-SSO] We build the registration MANUALLY (not via ClientRegistrations.fromIssuer
// [GoR-SSO] Location) because this platform splits hosts: Keycloak stamps the id_token
// [GoR-SSO] "iss" as http://localhost:8080/... (a value we only COMPARE), while the JWKS
// [GoR-SSO] and the wrapper endpoints must be FETCHED over a network-reachable host.
// [GoR-SSO] fromIssuerLocation() would conflate the two and fail.

import org.springframework.beans.factory.annotation.Value;                                  // [GoR-SSO]
import org.springframework.context.annotation.Bean;                                         // [GoR-SSO]
import org.springframework.context.annotation.Configuration;                                // [GoR-SSO]
import org.springframework.security.oauth2.client.registration.ClientRegistration;          // [GoR-SSO]
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;// [GoR-SSO]
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository; // [GoR-SSO]
import org.springframework.security.oauth2.core.AuthorizationGrantType;                     // [GoR-SSO]
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;                 // [GoR-SSO]

@Configuration                                                                              // [GoR-SSO]
public class SsoClientConfig {                                                              // [GoR-SSO]

    @Value("${app.sso.issuer-uri}")        private String issuerUri;        // [GoR-SSO] COMPARED to id_token "iss"
    @Value("${app.sso.jwk-set-uri}")       private String jwkSetUri;        // [GoR-SSO] FETCHED to verify signatures
    @Value("${app.sso.authorization-uri}") private String authorizationUri; // [GoR-SSO] browser-facing (302 target)
    @Value("${app.sso.token-uri}")         private String tokenUri;         // [GoR-SSO] server-side -> wrapper
    @Value("${app.sso.userinfo-uri}")      private String userInfoUri;      // [GoR-SSO] server-side -> wrapper (rich)
    @Value("${app.sso.client-id}")         private String clientId;         // [GoR-SSO]
    @Value("${app.sso.client-secret}")     private String clientSecret;     // [GoR-SSO] confidential client

    // [GoR-SSO] No network call here at startup — the JWKS is fetched lazily on the
    // [GoR-SSO] first id_token validation, so the backend boots even if Keycloak is slow.
    @Bean                                                                                   // [GoR-SSO]
    public ClientRegistrationRepository clientRegistrationRepository() {                    // [GoR-SSO]
        ClientRegistration gor = ClientRegistration.withRegistrationId("gor")               // [GoR-SSO] id in login/callback URLs
                .clientId(clientId)                             // [GoR-SSO]
                .clientSecret(clientSecret)                     // [GoR-SSO]
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)  // [GoR-SSO]
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)          // [GoR-SSO]
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")                // [GoR-SSO] Spring's standard callback
                .scope("openid", "profile", "email")            // [GoR-SSO]
                .issuerUri(issuerUri)                           // [GoR-SSO] expected "iss" (compared only)
                .jwkSetUri(jwkSetUri)                           // [GoR-SSO] where to fetch signing keys
                .authorizationUri(authorizationUri)             // [GoR-SSO] browser -> wrapper :8000
                .tokenUri(tokenUri)                             // [GoR-SSO] server -> wrapper
                .userInfoUri(userInfoUri)                       // [GoR-SSO] server -> wrapper (enriched)
                .userNameAttributeName("sub")                   // [GoR-SSO] stable principal key
                .build();                                       // [GoR-SSO]
        return new InMemoryClientRegistrationRepository(gor);   // [GoR-SSO]
    }                                                           // [GoR-SSO]
}                                                               // [GoR-SSO]
