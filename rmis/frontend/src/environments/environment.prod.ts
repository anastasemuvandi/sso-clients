export const environment = {
  production: true,
  apiUrl: '/api',
  // [GoR-SSO] Absolute URL to the backend's host port (8085). The browser hits the
  // [GoR-SSO] backend DIRECTLY for SSO so Spring derives redirect_uri = this host, and
  // [GoR-SSO] nginx doesn't need to proxy /oauth2 and /login. /api still goes via nginx.
  ssoLoginUrl: 'http://localhost:8085/oauth2/authorization/gor',
  // [GoR-SSO] RP-initiated (single) logout. Browser-facing endpoint on the WRAPPER
  // [GoR-SSO] (:8000), like authorize — NOT the backend. logout() appends id_token_hint +
  // [GoR-SSO] post_logout_redirect_uri and does a full-page redirect here.
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',
  // [GoR-SSO] OIDC client id of this app (rmis-portal). The wrapper REQUIRES client_id
  // [GoR-SSO] on /oauth2/logout whenever post_logout_redirect_uri is supplied.
  ssoClientId: 'rmis-portal',
  // [GoR-SSO] Where the wrapper bounces the browser back after ending the SSO session.
  // [GoR-SSO] MUST be registered on the rmis-portal client. Prod SPA is served by nginx
  // [GoR-SSO] on :80, so this is the bare host (no :4200).
  postLogoutRedirectUri: 'http://localhost/login'
};
