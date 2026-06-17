package com.risa.irmis.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

/**
 * Manually-built OIDC client for the Government SSO. We do NOT use
 * {@code fromIssuerLocation()} because the wrapper advertises an issuer that
 * doesn't match the host it's fetched from — so we split the issuer (compared
 * to the id_token "iss") from the JWKS/endpoints (fetched server-side).
 */
@Configuration
public class SsoClientConfig {

    @Value("${app.sso.client-id}")          private String clientId;
    @Value("${app.sso.client-secret}")      private String clientSecret;
    @Value("${app.sso.issuer-uri}")         private String issuerUri;
    @Value("${app.sso.jwk-set-uri}")        private String jwkSetUri;
    @Value("${app.sso.authorization-uri}")  private String authorizationUri;
    @Value("${app.sso.token-uri}")          private String tokenUri;
    @Value("${app.sso.userinfo-uri}")       private String userInfoUri;

    @Bean
    public ClientRegistrationRepository clientRegistrationRepository() {
        ClientRegistration gor = ClientRegistration.withRegistrationId("gor")
                .clientId(clientId)
                .clientSecret(clientSecret)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .scope("openid", "profile", "email")
                .issuerUri(issuerUri)               // expected "iss" (compared only)
                .jwkSetUri(jwkSetUri)               // where to fetch signing keys
                .authorizationUri(authorizationUri) // browser -> wrapper
                .tokenUri(tokenUri)                 // server  -> wrapper
                .userInfoUri(userInfoUri)           // server  -> wrapper (enriched)
                .userNameAttributeName("sub")
                .build();
        return new InMemoryClientRegistrationRepository(gor);
    }
}
