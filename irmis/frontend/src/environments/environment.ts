export const environment = {
  production: false,
  // Dev: Angular dev server on :8201 talks to the backend's host port (8200).
  apiUrl: 'http://127.0.0.1:8200/api',
  // Browser hits the backend's /oauth2/authorization/<id> directly.
  ssoLoginUrl: 'http://127.0.0.1:8200/oauth2/authorization/gor',
  // Wrapper's browser-facing logout endpoint.
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',
  // Where to land after logout — must be registered on the Keycloak client.
  postLogoutRedirectUri: 'http://localhost:8201/login',
  // Keycloak client id (required by the wrapper on /oauth2/logout).
  ssoClientId: 'irmis-portal',
};
