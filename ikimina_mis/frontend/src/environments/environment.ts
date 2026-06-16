export const environment = {
  production: false,
  // Dev: Angular dev server on :4200 talks to the backend's published host port (8186).
  apiUrl: 'http://127.0.0.1:8186/api',
  // Browser hits the backend's /oauth2/authorization/<id> directly (no nginx proxy).
  ssoLoginUrl: 'http://127.0.0.1:8186/oauth2/authorization/gor',
  // Wrapper's browser-facing logout endpoint.
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',
  // Where to land after logout — must be registered on the Keycloak client.
  postLogoutRedirectUri: 'http://localhost:4200/login',
  // Keycloak client id (required by the wrapper on /oauth2/logout).
  ssoClientId: 'ikimina-portal',
};
