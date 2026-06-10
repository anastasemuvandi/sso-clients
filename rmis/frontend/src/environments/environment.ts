export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8085/api',
  // [GoR-SSO] Full-page entry point that kicks off Spring Security's OIDC login.
  // [GoR-SSO] Lives at the backend root (NOT under /api): /oauth2/authorization/{registrationId}.
  ssoLoginUrl: 'http://127.0.0.1:8085/oauth2/authorization/gor',
  // [GoR-SSO] RP-initiated (single) logout. Browser-facing endpoint on the WRAPPER
  // [GoR-SSO] (:8000), like authorize — NOT the backend. logout() appends id_token_hint +
  // [GoR-SSO] post_logout_redirect_uri and does a full-page redirect here.
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',
  // [GoR-SSO] OIDC client id of this app (rmis-portal). The wrapper REQUIRES client_id
  // [GoR-SSO] on /oauth2/logout whenever post_logout_redirect_uri is supplied.
  ssoClientId: 'rmis-portal',
  // [GoR-SSO] Where the wrapper bounces the browser back after ending the SSO session.
  // [GoR-SSO] MUST be registered on the rmis-portal client (post_logout_redirect_uris).
  // [GoR-SSO] The SPA is served by nginx at http://localhost (:80), so the login page
  // [GoR-SSO] is http://localhost/login — match this exactly to the registered value.
  postLogoutRedirectUri: 'http://localhost/login'
};
