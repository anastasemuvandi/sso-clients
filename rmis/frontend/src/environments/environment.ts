export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8085/api',
  // [GoR-SSO] Full-page entry point that kicks off Spring Security's OIDC login.
  // [GoR-SSO] Lives at the backend root (NOT under /api): /oauth2/authorization/{registrationId}.
  ssoLoginUrl: 'http://127.0.0.1:8085/oauth2/authorization/gor'
};
