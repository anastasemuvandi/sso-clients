# IRMIS — Government SSO Integration (Angular + Spring Boot, no Docker)

How the IRMIS portal wires its **Angular** frontend and **Spring Boot** backend
into the **Government SSO** (OIDC on Keycloak, fronted by the SSO *wrapper*),
running everything **directly on the host — no Docker** for the client.

This is the concrete, code-level companion to the repo runbook
[`../SSO_INTEGRATION_SPRINGBOOT_ANGULAR.md`](../SSO_INTEGRATION_SPRINGBOOT_ANGULAR.md).
It documents what the code in *this* app actually does and how to run it.

---

## 1. The big picture

The backend is the OIDC **client** (confidential, with PKCE). The browser never
talks OIDC directly — it only ever hits the **backend**, which performs the code
exchange server-side and then hands the SPA *this app's own JWT*. After login the
whole app runs on the local JWT, exactly as it does for username/password users.

```
 Browser (Angular :8201)        Backend (Spring Boot :8200)      SSO wrapper :8000 / Keycloak :8080
 ───────────────────────        ───────────────────────────      ──────────────────────────────────
  click "Sign in with GoR SSO"
        │  full-page nav
        ▼
  GET /oauth2/authorization/gor ───────────►  302 to wrapper /oauth2/authorize  ──►  login at Keycloak
                                                  (state + PKCE saved in session)
                                                                                        │
  ◄──────────────────────────────────────────  302 back: /login/oauth2/code/gor?code  ◄┘
                                              │
                                              │  server→wrapper: POST /oauth2/token   (code + PKCE verifier)
                                              │  server→wrapper: GET  /auth/userinfo  (enriched profile)
                                              │  server→Keycloak: GET JWKS            (verify id_token sig)
                                              ▼
                                   SsoLoginSuccessHandler:
                                     find-or-create local user, mint app JWT
                                              │  302 to SPA
        ┌─────────────────────────────────────┘
        ▼
  /sso/callback#token=<appJWT>&id_token=<oidcJWT>
        │  store token, scrub URL
        ▼
  /dashboard   (all API calls now send  Authorization: Bearer <appJWT>)
```

**Key design choices**

- **Split issuer vs. endpoints.** The wrapper advertises an `iss` that doesn't
  match the host it's fetched from, so we *don't* use `fromIssuerLocation()`. The
  `issuer-uri` is only *compared* to the `id_token`'s `iss`; JWKS and the OAuth
  endpoints are configured explicitly. See `SsoClientConfig.java`.
- **PKCE is required** by the wrapper. Spring skips PKCE for confidential clients
  by default, so it's re-enabled explicitly on the authorize request.
- **Session is `IF_REQUIRED`, not `STATELESS`.** The OAuth2 login round-trip needs
  a session to hold `state`/PKCE. Once logged in, the stateless JWT filter handles
  every API call.
- **SSO bridges to a local account.** An SSO identity is mapped to a row in the
  `users` table (by `sub`, else linked by email, else created), so the rest of the
  app is identical for local and SSO users.

---

## 2. Backend (Spring Boot)

### 2.1 Dependencies

The OIDC client lives in `spring-boot-starter-oauth2-client` (already in
`pom.xml`), alongside `spring-boot-starter-security`.

### 2.2 Client registration — `config/SsoClientConfig.java`

A hand-built `ClientRegistration` (registration id **`gor`**), *not*
`fromIssuerLocation`:

| Property | Purpose | Default |
|---|---|---|
| `clientId` / `clientSecret` | confidential client creds | `irmis-portal` / *(empty — must be set)* |
| `clientAuthenticationMethod` | `CLIENT_SECRET_POST` | — |
| `authorizationGrantType` | `AUTHORIZATION_CODE` | — |
| `redirectUri` | `{baseUrl}/login/oauth2/code/{registrationId}` | → `/login/oauth2/code/gor` |
| `scope` | `openid`, `profile`, `email` | — |
| `issuerUri` | **compared** to `id_token` `iss` (never fetched) | `http://localhost:8080/realms/government-internal` |
| `jwkSetUri` | **fetched** server-side to verify signatures | `…/protocol/openid-connect/certs` |
| `authorizationUri` | browser → wrapper (the 302 target) | `http://localhost:8000/oauth2/authorize` |
| `tokenUri` | server → wrapper (code exchange) | `http://localhost:8000/oauth2/token` |
| `userInfoUri` | server → wrapper (enriched profile) | `http://localhost:8000/auth/userinfo` |
| `userNameAttributeName` | `sub` | — |

### 2.3 Security chain — `config/SecurityConfig.java`

- CSRF disabled (token auth, no cookies for the API), CORS from
  `app.cors.allowed-origins`, `allowCredentials=true`.
- Public paths: `/api/auth/**`, `/oauth2/**`, `/login/oauth2/**`, `/h2-console/**`.
  Everything else requires auth.
- **PKCE resolver** on the authorization endpoint
  (`OAuth2AuthorizationRequestCustomizers.withPkce()`).
- `oauth2Login`:
  - **success** → `SsoLoginSuccessHandler`
  - **failure** → `302 {frontendUrl}/login?sso_error=sso_login_failed`
- Unauthenticated API hits get a clean **401** (`HttpStatusEntryPoint`), never a
  redirect to the IdP — so XHR calls fail predictably instead of following a 302.
- `JwtAuthenticationFilter` runs before `UsernamePasswordAuthenticationFilter`.

### 2.4 Bridging SSO → local account — `security/SsoLoginSuccessHandler.java`

On success:
1. Read the `OidcUser` (`sub`, `email`, `fullName`).
2. **Find-or-create** the local user:
   1. by `ssoSubject` (`sub`), else
   2. link an existing row with the same email (set its `ssoSubject`), else
   3. create a new user with a random *unusable* local password (SSO-only).
3. Mint **this app's** JWT via `JwtTokenProvider`.
4. Redirect the browser to the SPA:
   `{frontendUrl}/sso/callback#token=<appJWT>&id_token=<oidcJWT>`
   — the `id_token` is forwarded so the SPA can later do RP-initiated logout.

> Tokens travel in the **URL fragment** (`#…`), not the query string, so they're
> never sent to the server in logs and the SPA scrubs them after reading.

### 2.5 Configuration — `application.properties` / env vars

Everything is overridable via environment variables (defaults target the local
stack). Only **`CLIENT_SECRET`** is required for SSO to work; local login needs
nothing.

```properties
app.sso.issuer-uri        = ${SSO_ISSUER_URI:http://localhost:8080/realms/government-internal}
app.sso.jwk-set-uri       = ${SSO_JWK_SET_URI:.../protocol/openid-connect/certs}
app.sso.authorization-uri = ${SSO_AUTH_URI:http://localhost:8000/oauth2/authorize}
app.sso.token-uri         = ${SSO_TOKEN_URI:http://localhost:8000/oauth2/token}
app.sso.userinfo-uri      = ${SSO_USERINFO_URI:http://localhost:8000/auth/userinfo}
app.sso.client-id         = ${CLIENT_ID:irmis-portal}
app.sso.client-secret     = ${CLIENT_SECRET:}
app.frontend.url          = ${FRONTEND_URL:http://localhost:8201}
app.cors.allowed-origins  = ${CORS_ORIGINS:http://localhost:8201,http://127.0.0.1:8201}
server.port               = ${SERVER_PORT:8200}
```

---

## 3. Frontend (Angular)

The SPA does **not** speak OIDC. It only (a) sends the browser to the backend to
start the flow, (b) receives the minted JWT on a callback route, and (c) attaches
that JWT to API calls.

### 3.1 Config — `src/environments/environment.ts`

```ts
apiUrl:               'http://127.0.0.1:8200/api',
ssoLoginUrl:          'http://127.0.0.1:8200/oauth2/authorization/gor', // backend, not the IdP
ssoLogoutUrl:         'http://localhost:8000/oauth2/logout',            // wrapper, browser-facing
postLogoutRedirectUri:'http://localhost:8201/login',                   // must be registered on the client
ssoClientId:          'irmis-portal',                                  // required by the wrapper on logout
```

### 3.2 Starting login — `login/login.component.ts`

The **"Sign in with GoR SSO"** button does a **full-page navigation** (not XHR) —
the browser must physically travel to the IdP and back:

```ts
loginWithSso(): void { window.location.href = environment.ssoLoginUrl; }
```

The login page also reads `?sso_error=…` to show a friendly failure banner.

### 3.3 The callback route — `sso-callback/sso-callback.component.ts`

Registered as the **public** route `sso/callback` (`app.routes.ts`). It parses the
URL fragment, stores the session, scrubs the token from history, then routes to
`/dashboard`:

```ts
const frag = new URLSearchParams(window.location.hash.replace(/^#/, ''));
this.auth.loginWithSsoToken(frag.get('token'), frag.get('id_token'));
history.replaceState(null, '', window.location.pathname);   // remove token from URL
this.router.navigate(['/dashboard']);
```

### 3.4 Session + logout — `services/auth.service.ts`

- `loginWithSsoToken(token, idToken)` stores the app JWT (`irmis_token`), a display
  user decoded from the JWT, and the OIDC `id_token` (`irmis_id_token`).
- **Logout** clears local storage, then — only for SSO sessions — performs
  **RP-initiated logout** so Keycloak doesn't silently sign the user back in:

  ```
  {ssoLogoutUrl}?post_logout_redirect_uri={…/login}
                &client_id={irmis-portal}        // required by the wrapper
                &id_token_hint={id_token}
  ```

  Local (password) sessions just route to `/login`.

### 3.5 Attaching the token — `services/auth.interceptor.ts`

Every outgoing HTTP request gets `Authorization: Bearer <appJWT>` when a token is
present. The `authGuard` protects `/dashboard`.

---

## 4. Register the client in Keycloak

Realm **`government-internal`**, client **`irmis-portal`** (confidential, PKCE).

**Valid redirect URIs** (Spring's convention — add *both* host variants):

```
http://localhost:8200/login/oauth2/code/gor
http://127.0.0.1:8200/login/oauth2/code/gor
```

**Valid post-logout redirect URI** (RP-initiated logout):

```
http://localhost:8201/login
```

Then copy the client **secret** into the backend (next section). PKCE is already
enabled on the backend; ensure the client allows/requires it to match.

---

## 5. Run it (no Docker)

Prerequisites: JDK 17+, Maven 3.9+, Node 18+, npm. The SSO wrapper (`:8000`) and
Keycloak (`:8080`) must be reachable.

### 5.1 Provide the client secret

```bash
cp .env.example .env     # then edit CLIENT_SECRET
```

### 5.2 Start the backend (`:8200`)

PowerShell:

```powershell
$env:CLIENT_ID = "irmis-portal"
$env:CLIENT_SECRET = "<secret-from-keycloak>"
cd backend
mvn spring-boot:run
```

bash:

```bash
cd backend
CLIENT_ID=irmis-portal CLIENT_SECRET=<secret-from-keycloak> mvn spring-boot:run
```

### 5.3 Start the frontend (`:8201`)

```bash
cd frontend
npm install
npm start        # ng serve --port 8201
```

Open <http://localhost:8201>, click **Sign in with GoR SSO**, authenticate at
Keycloak, and you land on the dashboard.

> Local login works **without** any SSO config: `admin@risa.gov.rw` /
> `Password@123` (seeded fresh into the in-memory H2 DB on every boot).

---

## 6. Endpoint reference

| Where | URL | Who calls it |
|---|---|---|
| Start SSO | `http://127.0.0.1:8200/oauth2/authorization/gor` | browser → backend |
| Authorize | `http://localhost:8000/oauth2/authorize` | browser → wrapper |
| Redirect back | `http://localhost:8200/login/oauth2/code/gor` | wrapper → backend |
| Token | `http://localhost:8000/oauth2/token` | backend → wrapper |
| Userinfo | `http://localhost:8000/auth/userinfo` | backend → wrapper |
| JWKS | `http://localhost:8080/realms/government-internal/protocol/openid-connect/certs` | backend → Keycloak |
| Issuer (`iss` compare) | `http://localhost:8080/realms/government-internal` | *(compared only)* |
| Post-login → SPA | `http://localhost:8201/sso/callback#token=…&id_token=…` | backend → browser |
| Logout | `http://localhost:8000/oauth2/logout` | browser → wrapper |

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Redirected to `/login?sso_error=sso_login_failed` | code exchange / signature verify failed | check `CLIENT_SECRET`, that `jwk-set-uri` is reachable from the backend, and that `issuer-uri` matches the `id_token` `iss` |
| `invalid redirect_uri` at Keycloak | redirect URI not registered | add **both** `localhost` and `127.0.0.1` variants of `/login/oauth2/code/gor` |
| Browser silently signs straight back in after logout | RP-initiated logout didn't run | ensure the SPA stored the `id_token` and that `post_logout_redirect_uri` is registered on the client |
| API calls return 401 after SSO login | `Authorization` header missing | confirm `authInterceptor` is wired and a token is in `localStorage` (`irmis_token`) |
| CORS error from the SPA | origin not allowed | add the dev origin to `CORS_ORIGINS` / `app.cors.allowed-origins` |
| PKCE error at the wrapper | PKCE not sent | backend already enables it; verify the `pkceResolver` wiring in `SecurityConfig` and that the client allows PKCE |
| `host mismatch` on token/JWKS calls | `localhost` vs `127.0.0.1` confusion | keep browser-facing URLs and server-side URLs consistent with the client registration |

---

## 8. Production notes

- Replace `app.jwt.secret` and the H2 in-memory DB (switch to a file/real DB).
- Update **both** `environment.ts` *and* `environment.prod.ts` with the real
  SPA/backend/wrapper hosts and the registered redirect/post-logout URIs.
- Serve the SPA and backend over HTTPS; update redirect URIs in Keycloak to match.
- Keep `CLIENT_SECRET` out of source control (`.env` is gitignored).
