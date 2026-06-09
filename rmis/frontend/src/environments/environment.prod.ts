export const environment = {
  production: true,
  apiUrl: '/api',
  // [GoR-SSO] Absolute URL to the backend's host port (8085). The browser hits the
  // [GoR-SSO] backend DIRECTLY for SSO so Spring derives redirect_uri = this host, and
  // [GoR-SSO] nginx doesn't need to proxy /oauth2 and /login. /api still goes via nginx.
  ssoLoginUrl: 'http://localhost:8085/oauth2/authorization/gor'
};
