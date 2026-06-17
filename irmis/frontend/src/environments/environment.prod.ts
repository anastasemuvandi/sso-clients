export const environment = {
  production: true,
  // Prod build keeps the same key set as dev so the type-check passes. Adjust
  // these to wherever the SPA + backend are actually served in production.
  apiUrl: 'http://127.0.0.1:8200/api',
  ssoLoginUrl: 'http://127.0.0.1:8200/oauth2/authorization/gor',
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',
  postLogoutRedirectUri: 'http://localhost:8201/login',
  ssoClientId: 'irmis-portal',
};
