export const environment = {
  production: true,
  // Prod: served by nginx, which proxies /api to the backend container.
  apiUrl: '/api',
  // Browser hits the backend's published host port directly (no nginx proxy for /oauth2).
  ssoLoginUrl: 'http://localhost:8180/oauth2/authorization/gor',
  // Wrapper's browser-facing logout endpoint.
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',
  // Where to land after logout — the nginx-served SPA (host :8180). Must be
  // registered on the Keycloak client.
  postLogoutRedirectUri: 'http://localhost:8180/login',
  // Keycloak client id (required by the wrapper on /oauth2/logout).
  ssoClientId: 'ikimina-portal',
};
