# Adding a Spring Boot + Angular app to the Government SSO

A reusable, end‑to‑end runbook for connecting a **Spring Boot backend** and an
**Angular SPA** to the Government SSO platform (OpenID Connect on top of
Keycloak, fronted by the SSO *wrapper*). It captures the exact steps **and the
non‑obvious gotchas** we hit while integrating the RMIS app, so the next app on
the same stack can be added by following along and substituting a few values.

> Worked example throughout: **RMIS** — backend on host `:8085` (container
> `:8080`), frontend (nginx) on host `:80`, OIDC registration id `gor`,
> Keycloak client `rmis-portal` in realm `government-internal`.

---

## 0. How the platform is shaped (read this first)

The SSO platform is **not** a vanilla Keycloak. It is a *split‑host* topology,
and that single fact drives almost every decision below:

| Concern | Who serves it | Example URL |
|---|---|---|
| `id_token` **issuer** (the `iss` claim) | Keycloak | `http://localhost:8080/realms/government-internal` |
| **JWKS** (signing keys) | Keycloak | `…:8080/realms/government-internal/protocol/openid-connect/certs` |
| **authorize** endpoint | Wrapper | `http://localhost:8000/oauth2/authorize` |
| **token** endpoint | Wrapper | `http://localhost:8000/oauth2/token` |
| **userinfo** endpoint (enriched!) | Wrapper | `http://localhost:8000/auth/userinfo` |

Two consequences:

1. **Discovery (`issuer-uri` auto‑config) does not work.** The wrapper's
   `/.well-known/openid-configuration` advertises an `issuer` that does **not**
   match the host you fetch it from, so Spring's `fromIssuerLocation()` /
   `issuer-uri` will fail the issuer‑match check. We configure the client
   **manually** and split "issuer to *compare*" from "JWKS/endpoints to *fetch*".
2. The wrapper's `/auth/userinfo` returns **enriched claims** (agencies, client
   roles) that plain Keycloak does not. That's *why* we route through the
   wrapper instead of pointing straight at Keycloak.

**Why not use an SDK?** The Node/Python SDKs wrap the SSO *management* API
(creating clients/users/roles), **not** the end‑user login flow. There is no
Java SDK. Login is standard OIDC over HTTP, so Spring Security's
`oauth2-client` is the right tool — no SDK needed for sign‑in.

---

## 1. Register your client in the SSO

Each app is a confidential OIDC client in the `government-internal` realm.
The **redirect URI must follow Spring's convention**:

```
http://<backend-host>:<port>/login/oauth2/code/<registrationId>
# RMIS: http://localhost:8085/login/oauth2/code/gor
```

Register it via the admin UI, the SSO management API, or directly against
Keycloak's admin API. Example using Keycloak admin (local dev `admin`/`admin`):

```bash
# get an admin token, find the client, append the redirect URI, PUT it back
# (see scripts; the key field is the client's "redirectUris" array)
```

Add **both** `localhost` and `127.0.0.1` variants if you might use either.
Read the client secret from the client's detail page (or the management API).
Keep the old redirect URI(s) too — a client can have many.

> The login flow **requires PKCE** even for confidential clients (see §2.4).

---

## 2. Backend — Spring Boot

Spring Security's `oauth2-client` drives PKCE, state, the code→token exchange,
and the userinfo call. You write ~3 small pieces: a client registration, a
success handler (the "bridge"), and a security‑config tweak.

> **Where the backend code lives.** All paths below are relative to the app's
> backend module (RMIS: `rmis/backend/`). Java classes live under
> `src/main/java/<base-package>/…` — for RMIS the base package is
> `com.risa.rmis`, so the folder is `src/main/java/com/risa/rmis/`. Substitute
> your own package/folder. Config lives in `src/main/resources/`.

### 2.1 Dependency — **file:** `backend/pom.xml`

Add inside the existing `<dependencies>` block:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-oauth2-client</artifactId>
</dependency>
```

### 2.2 Config — **file:** `backend/src/main/resources/application.properties`

Append these to the existing properties file. Split the **issuer** (compared,
never fetched) from the **jwk‑set / endpoints** (fetched server‑side). All
overridable by env so the same jar works on host and in Docker:

```properties
# COMPARED to id_token "iss" — stays localhost:8080 even inside Docker
app.sso.issuer-uri=${SSO_ISSUER_URI:http://localhost:8080/realms/government-internal}
# FETCHED to verify signatures — must be reachable from where the backend runs
app.sso.jwk-set-uri=${SSO_JWK_SET_URI:http://localhost:8080/realms/government-internal/protocol/openid-connect/certs}
# browser-facing (the 302 target)
app.sso.authorization-uri=${SSO_AUTH_URI:http://localhost:8000/oauth2/authorize}
# server-side calls -> wrapper (enriched userinfo)
app.sso.token-uri=${SSO_TOKEN_URI:http://localhost:8000/oauth2/token}
app.sso.userinfo-uri=${SSO_USERINFO_URI:http://localhost:8000/auth/userinfo}
app.sso.client-id=${CLIENT_ID:rmis-portal}
app.sso.client-secret=${CLIENT_SECRET:}
# where to bounce the browser after login (your SPA)
app.frontend.url=${FRONTEND_URL:http://localhost:4200}
```

### 2.3 Client registration — **new file:** `backend/src/main/java/<base-package>/config/SsoClientConfig.java`

(RMIS: `backend/src/main/java/com/risa/rmis/config/SsoClientConfig.java`.)
Build it **manually** (not `fromIssuerLocation`) so issuer and JWKS can differ:

```java
@Configuration
public class SsoClientConfig {
  // @Value fields for the app.sso.* properties …

  @Bean
  public ClientRegistrationRepository clientRegistrationRepository() {
    ClientRegistration gor = ClientRegistration.withRegistrationId("gor")
        .clientId(clientId)
        .clientSecret(clientSecret)
        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
        .scope("openid", "profile", "email")
        .issuerUri(issuerUri)              // expected "iss" (compared only)
        .jwkSetUri(jwkSetUri)              // where to fetch signing keys
        .authorizationUri(authorizationUri)// browser -> wrapper
        .tokenUri(tokenUri)                // server  -> wrapper
        .userInfoUri(userInfoUri)          // server  -> wrapper (enriched)
        .userNameAttributeName("sub")
        .build();
    return new InMemoryClientRegistrationRepository(gor);
  }
}
```

No network call at startup — JWKS is fetched lazily on first token validation.

### 2.4 Security config — **file:** `backend/src/main/java/<base-package>/config/SecurityConfig.java`

(RMIS: `backend/src/main/java/com/risa/rmis/config/SecurityConfig.java`.) Edit
your existing `securityFilterChain` bean — add the PKCE resolver and the
`.oauth2Login(...)` block.

> **Merge into your existing chain — do NOT add a second `securityFilterChain`
> bean.** A local-auth app already has one (typically `STATELESS`, a
> `DaoAuthenticationProvider`, a CORS bean, and a JWT filter). Two beans of this
> type make Spring fail at startup with *"a bean of type SecurityFilterChain …
> already defined"*. So edit the method you have:
> - **Add** `SsoLoginSuccessHandler successHandler` and
>   `ClientRegistrationRepository clients` as **method parameters** (not
>   constructor fields — that creates a cycle: `SecurityConfig` → handler →
>   `passwordEncoder()` → `SecurityConfig`; see Gotchas).
> - **Change** `SessionCreationPolicy.STATELESS` → `IF_REQUIRED` — the OAuth2
>   login redirect round-trip stores `state`/PKCE in the session; `STATELESS`
>   drops it and the callback fails with *"authorization request not found"*.
>   (Your JWT filter still makes API calls effectively stateless — no session is
>   created unless the login flow needs one.)
> - **Add** `/oauth2/**` and `/login/oauth2/**` to the `permitAll()` matchers
>   (alongside your existing `/api/auth/**`).
> - **Add** the PKCE resolver and the `.oauth2Login(...)` block below.
> - **Keep** your `DaoAuthenticationProvider`, `PasswordEncoder`,
>   `AuthenticationManager`, CORS, and 401 entry-point beans/wiring as-is.

```java
@Bean
public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        SsoLoginSuccessHandler successHandler,            // method param: avoids a bean cycle (see Gotchas)
        ClientRegistrationRepository clients) throws Exception {

  // PKCE is REQUIRED by the wrapper, but Spring skips it for confidential
  // clients by default — re-enable it on the authorize request:
  var pkceResolver = new DefaultOAuth2AuthorizationRequestResolver(clients, "/oauth2/authorization");
  pkceResolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());

  http
    .csrf(c -> c.disable())
    .cors(Customizer.withDefaults())
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)) // login round-trip needs a session
    .authorizeHttpRequests(a -> a
        .requestMatchers("/api/auth/**", "/oauth2/**", "/login/oauth2/**").permitAll()
        .anyRequest().authenticated())
    // API stays a resource server: 401, NOT a redirect to the IdP
    .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
    .oauth2Login(o -> o
        .authorizationEndpoint(a -> a.authorizationRequestResolver(pkceResolver))
        .successHandler(successHandler)
        .failureHandler((req, res, ex) -> res.sendRedirect(frontendUrl + "/login?sso_error=sso_login_failed")))
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
  return http.build();
}
```

### 2.5 The bridge — **new file:** `backend/src/main/java/<base-package>/security/SsoLoginSuccessHandler.java`

(RMIS: `backend/src/main/java/com/risa/rmis/security/SsoLoginSuccessHandler.java`.)
Maps the SSO identity to a **local** user and issues **your app's own JWT**, so
the rest of the app (guard, interceptor, dashboard) is unchanged:

```java
@Component
@RequiredArgsConstructor
public class SsoLoginSuccessHandler implements AuthenticationSuccessHandler {
  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;
  private final JwtTokenProvider jwt;
  private final UserDetailsService uds;
  @Value("${app.frontend.url}") private String frontendUrl;

  public void onAuthenticationSuccess(HttpServletRequest req, HttpServletResponse res, Authentication auth)
      throws IOException {
    OidcUser oidc = (OidcUser) auth.getPrincipal();
    User user = findOrCreate(oidc);                       // by "sub", link by email, collision-safe username
    String token = jwt.generateToken(uds.loadUserByUsername(user.getUsername()));
    res.sendRedirect(UriComponentsBuilder.fromUriString(frontendUrl)
        .path("/sso/callback").fragment("token=" + token).build().toUriString());
  }
}
```

`findOrCreate`: (1) by `ssoSubject` = Keycloak `sub`; (2) else link a row with
the same email; (3) else create with a random unusable local password. Read
`first_name`/`last_name`/`email` from the **userinfo** (`oidc.getUserInfo()`),
not just the id‑token.

### 2.6 User model — **files:** `entity/User.java` + `repository/UserRepository.java`

(RMIS: `backend/src/main/java/com/risa/rmis/entity/User.java` and
`backend/src/main/java/com/risa/rmis/repository/UserRepository.java`.) Add a
stable link column to the entity and a finder to the repository:

```java
// in entity/User.java
@Column(name = "sso_subject", unique = true) private String ssoSubject;   // entity
// in repository/UserRepository.java
Optional<User> findBySsoSubject(String ssoSubject);                       // repository
```

---

## 3. Frontend — Angular

> **Where the frontend code lives.** All paths below are relative to the app's
> Angular project (RMIS: `rmis/frontend/`). Components live under
> `src/app/<component>/`, shared services under `src/app/services/`, and
> build/env config at the project root and `src/environments/`.

### 3.1 Login button — **file:** `frontend/src/app/login/login.component.ts`

**Two parts — both required.** Adding the handler alone does nothing visible;
you must also place a button in the template that calls it, or there's no way to
start SSO from the UI.

**(a) The handler** (class method):

```ts
loginWithSso(): void {
  // FULL-PAGE navigation (not XHR) — the browser must travel to the IdP and back.
  window.location.href = environment.ssoLoginUrl;
}
```

(Make sure `environment` is imported:
`import { environment } from '../../environments/environment';`.)

**(b) The button** — add it to the component's `template`, *outside* the
`<form>` so it isn't a submit (use `type="button"` and `(click)`, not the form's
`ngSubmit`):

```html
<!-- after the local sign-in <form>…</form> -->
<div class="auth-divider"><span>or</span></div>
<button type="button" class="btn-sso" (click)="loginWithSso()">
  Sign in with GoR SSO
</button>
```

> If your styles don't already have `.btn-sso` / `.auth-divider`, add them (or
> reuse an existing button class) — without a rule the button still works, it
> just looks unstyled.

### 3.2 Environments — **files:** `frontend/src/environments/environment.ts` + `environment.prod.ts`

Add **all four** SSO keys to **both** environment files (the last three are
required by the §3.6 logout). `ssoLoginUrl` points the browser at the backend's
`/oauth2/authorization/<id>`; `ssoLogoutUrl` is the wrapper's browser-facing
logout; `postLogoutRedirectUri` is the SPA page to land on after logout (**must
be registered on the Keycloak client**, §3.6); `ssoClientId` is your Keycloak
client id.

```ts
// environment.ts (dev) — browser hits the backend's published host port directly
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8085/api',
  ssoLoginUrl: 'http://127.0.0.1:8085/oauth2/authorization/gor',
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',   // wrapper, browser-facing
  postLogoutRedirectUri: 'http://localhost:4200/login',  // where to land after logout
  ssoClientId: 'rmis-portal',                            // your Keycloak client id
};
```

```ts
// environment.prod.ts — same keys; values match where the SPA is actually served
export const environment = {
  production: true,
  apiUrl: '/api',
  ssoLoginUrl: 'http://localhost:8085/oauth2/authorization/gor',
  ssoLogoutUrl: 'http://localhost:8000/oauth2/logout',
  postLogoutRedirectUri: 'http://localhost/login',       // nginx-served SPA (host :80)
  ssoClientId: 'rmis-portal',
};
```

> Keep the key set **identical** across both files or the prod build fails to
> type-check. `postLogoutRedirectUri` differs per environment because the SPA is
> served from a different origin (dev `:4200` vs prod nginx) — register **each**
> value you use on the client (§3.6).

### 3.3 Callback component + route (reusable across apps)

**New file:** `frontend/src/app/sso-callback/sso-callback.component.ts`

```ts
// /sso/callback — backend redirects here with #token=<jwt>
ngOnInit(): void {
  const frag = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = frag.get('token');
  if (!token) { this.router.navigate(['/login'], { queryParams: { sso_error: 'missing_token' } }); return; }
  this.auth.loginWithSsoToken(token);                 // store session
  history.replaceState(null, '', window.location.pathname); // scrub token from URL/history
  this.router.navigate(['/dashboard']);               // APP-SPECIFIC post-login route
}
```

**Register the route** in `frontend/src/app/app.routes.ts`:

```ts
// app.routes.ts — public route (user isn't "logged in" until this runs)
{ path: 'sso/callback',
  loadComponent: () => import('./sso-callback/sso-callback.component').then(m => m.SsoCallbackComponent) }
```

### 3.4 AuthService — store a session from a token — **file:** `frontend/src/app/services/auth.service.ts`

Add this method to your existing `AuthService`:

```ts
loginWithSsoToken(token: string): void {
  const c = this.decodeJwt(token);                    // base64url decode payload (display only)
  this.saveSession({ token,
    username: c?.sub ?? c?.preferred_username ?? '',
    email: c?.email ?? '', fullName: c?.name ?? '' });
}
```

> The minted JWT only carries what your `JwtTokenProvider` puts in it (RMIS:
> just `sub`). Add `email`/`name` claims there if you want them on the SPA.

### 3.5 Production build picks the prod env — **file:** `frontend/angular.json`

Under `projects.<app>.architect.build.configurations`:

```json
"production": {
  "fileReplacements": [
    { "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts" }
  ]
}
```

---

## 3.6 Logout — RP-initiated (single) sign-out

A local logout (clear the SPA token, route to `/login`) signs the user out of
*this* app only. The **Keycloak SSO session stays alive**, so the next visit
silently SSOs them back in, and they remain logged in to every other ministry
app. To actually end the session everywhere, do **RP-initiated logout**.

The platform is stateless after login (the SPA holds a minted app JWT, not a
server session), so capture the **id_token at token-exchange time** and hand it
to the SPA — mirroring how the app JWT is passed.

**Backend** — in the success handler
(`backend/src/main/java/<base-package>/security/SsoLoginSuccessHandler.java`,
the §2.5 file), add the id_token to the callback fragment:

```java
String idToken = oidc.getIdToken().getTokenValue();   // returned at code->token exchange
res.sendRedirect(UriComponentsBuilder.fromUriString(frontendUrl)
    .path("/sso/callback")
    .fragment("token=" + appToken + "&id_token=" + idToken)  // JWTs are base64url-safe
    .build().toUriString());
```

**Frontend** — in `frontend/src/app/services/auth.service.ts` (the §3.4 file):
store the id_token when the callback runs, then **replace your existing
`logout()`** with the version below (don't add a second `logout()` — TypeScript
rejects two methods with the same name). This single method first clears the
local session, then — only if an id_token was stored — redirects to the
wrapper's `/oauth2/logout` (browser-facing, like authorize → `:8000`):

```ts
private readonly ID_TOKEN_KEY = 'id_token';   // add alongside TOKEN_KEY / USER_KEY

// store this in your loginWithSsoToken()/callback when the fragment has id_token:
//   if (idToken) localStorage.setItem(this.ID_TOKEN_KEY, idToken);

logout(): void {
  const idToken = localStorage.getItem(this.ID_TOKEN_KEY);
  // clear the local session FIRST (token, user, id_token)
  localStorage.removeItem(this.TOKEN_KEY);
  localStorage.removeItem(this.USER_KEY);
  localStorage.removeItem(this.ID_TOKEN_KEY);
  this.currentUser$.next(null);                // if you expose a current-user subject

  if (idToken) {
    window.location.href = `${environment.ssoLogoutUrl}`             // http://localhost:8000/oauth2/logout
      + `?post_logout_redirect_uri=${encodeURIComponent(environment.postLogoutRedirectUri)}`
      + `&client_id=${encodeURIComponent(environment.ssoClientId)}`  // REQUIRED by the wrapper (see note)
      + `&id_token_hint=${encodeURIComponent(idToken)}`;             // full-page nav
    return;
  }
  this.router.navigate(['/login']);   // local login: nothing to end remotely
}
```

> Add `ssoLogoutUrl`, `postLogoutRedirectUri`, and `ssoClientId` to both
> environment files (§3.2). The `if (idToken)` branch only fires when the SSO
> callback actually stored an id_token — so the same `logout()` works for both
> local and SSO sessions.
```

> **`client_id` is mandatory on the wrapper's `/oauth2/logout`** whenever
> `post_logout_redirect_uri` is present — omit it and the wrapper rejects the
> request with `400: client_id is required when post_logout_redirect_uri is
> provided` (it never reaches Keycloak). Add `ssoClientId` to your environments
> (RMIS: `ssoClientId: 'rmis-portal'`) and pass it on the logout URL. This is in
> addition to Keycloak validating the `post_logout_redirect_uri` itself.

> **`post_logout_redirect_uri` MUST be registered** on the client
> (`post_logout_redirect_uris`), exactly — scheme, host, port, path. RMIS's SPA
> is served by nginx at `http://localhost` (:80), so register
> `http://localhost/login`. An unregistered value is rejected/ignored and the
> user is stranded on the IdP. (Add `127.0.0.1`/other host variants only if you
> actually serve the SPA there.)

### Registering the post-logout redirect URI (Keycloak admin UI)

The wrapper proxies logout to Keycloak's `end_session`, so the URI is validated
against the client's **Valid post logout redirect URIs** in Keycloak:

1. Open the Keycloak admin console (local dev: `http://localhost:8080`, login
   `admin`/`admin`) and select the **`government-internal`** realm.
2. **Clients → `rmis-portal` → Settings** tab.
3. Under **Access settings**, find **Valid post logout redirect URIs** (it sits
   just below *Valid redirect URIs*).
4. Add `http://localhost/login` and click the **+** to add more rows if needed.
   - Shortcut: the literal value **`+`** tells Keycloak to reuse the *Valid
     redirect URIs* list — but those are the `…/login/oauth2/code/gor` callback
     URLs, **not** the SPA login page, so prefer the explicit `http://localhost/login`.
5. **Save**. No client restart needed; it takes effect immediately.

> Same as redirect URIs, you can also set this via the SSO management API or
> Keycloak admin API (`PUT` the client with the `attributes
> ["post.logout.redirect.uris"]` / `post.logout.redirect.uris` field). The admin
> UI is the quickest for a one-off.

---

## 4. Docker & networking (the part that bites)

If the backend runs **in a container** (RMIS does), `localhost` inside the
container is the container itself — not the host. So:

- **Container port:** keep `server.port=8080` and map it in compose
  (`"8085:8080"`). Do **not** set it to the host port.
- **`issuer-uri` stays `localhost:8080`** — it's only *compared* to the token's
  `iss`, never fetched.
- **`jwk-set-uri`, `token-uri`, `userinfo-uri` use `host.docker.internal`** —
  they're fetched server‑side and must reach the host‑published ports.
- **`authorization-uri` stays `localhost:8000`** — it's browser‑facing.
- Add `extra_hosts: ["host.docker.internal:host-gateway"]` (needed on Linux;
  automatic on Docker Desktop).

**File:** `rmis/docker-compose.yml` (the `backend` service's `environment:`):

```yaml
backend:
  ports: ["8085:8080"]
  extra_hosts: ["host.docker.internal:host-gateway"]
  environment:
    CLIENT_ID: rmis-portal
    CLIENT_SECRET: ${CLIENT_SECRET:?CLIENT_SECRET must be set (see rmis/.env)}
    SSO_ISSUER_URI:   http://localhost:8080/realms/government-internal
    SSO_JWK_SET_URI:  http://host.docker.internal:8080/realms/government-internal/protocol/openid-connect/certs
    SSO_AUTH_URI:     http://localhost:8000/oauth2/authorize
    SSO_TOKEN_URI:    http://host.docker.internal:8000/oauth2/token
    SSO_USERINFO_URI: http://host.docker.internal:8000/auth/userinfo
    FRONTEND_URL:     http://localhost
```

The SPA's nginx proxies `/api/` → `backend:8080`; SSO bypasses nginx by hitting
the backend's host port directly (`ssoLoginUrl`), so Spring derives the right
`redirect_uri` and you don't have to proxy `/oauth2` and `/login`.

---

## 5. Secrets

- Never commit the client secret. Pass it via a **gitignored** `.env` next to
  the compose file (**file:** `rmis/.env`, containing `CLIENT_SECRET=…`) that
  compose substitutes: `CLIENT_SECRET: ${CLIENT_SECRET:?…}` in
  `rmis/docker-compose.yml`.
- The repo-root `.gitignore` (`clients/.gitignore`) should cover `**/.env`,
  `**/target/`, `**/node_modules/`, `*.class`, `.idea/`.

---

## 6. Test it

The whole login is scriptable over HTTP (cookie jar + form POST), so you can
verify the backend chain without a browser:

```
GET  <backend>/oauth2/authorization/<id>   → 302 to wrapper authorize (must contain code_challenge)
     → Keycloak login page → POST credentials
     → 302 <backend>/login/oauth2/code/<id>?code=…   (callback)
     → 302 <frontend>/sso/callback#token=<jwt>        ✅
```

Confirm a row was written: `select username, sso_subject from users …`.
Then click the button in the browser for the full SPA path.

---

## 7. Gotchas we actually hit (troubleshooting)

| Symptom | Cause | Fix |
|---|---|---|
| `422 … "code_challenge" Field required` from wrapper | Spring omits PKCE for confidential clients | `DefaultOAuth2AuthorizationRequestResolver` + `OAuth2AuthorizationRequestCustomizers.withPkce()` (§2.4) |
| `id_token` validation fails / issuer mismatch | Wrapper discovery advertises a non‑matching issuer | Don't use `fromIssuerLocation`; set `issuerUri` (compare) and `jwkSetUri` (fetch) separately (§2.3) |
| `APPLICATION FAILED TO START … bean cycle` | `SecurityConfig` defines `PasswordEncoder`, and the handler it injects needs it | Inject the success handler as a **method param** of `securityFilterChain`, not a field (§2.4) |
| Backend unreachable on host port in Docker | `server.port` set to the host port | Keep `8080`; map `"8085:8080"` (§4) |
| `Connection refused` to `localhost:8080/8000` from container | `localhost` = the container | Use `host.docker.internal` for fetched URLs + `extra_hosts` (§4) |
| API calls redirect to IdP instead of `401` | `oauth2Login` installs a redirecting entry point | `HttpStatusEntryPoint(UNAUTHORIZED)` (§2.4) |
| Login loops / "authorization request not found" | `SessionCreationPolicy.STATELESS` drops the OAuth state | use `IF_REQUIRED` (§2.4) |
| `redirect_uri` rejected by Keycloak | Not registered, or `localhost` vs `127.0.0.1` mismatch | Register the exact `…/login/oauth2/code/<id>` (both host variants) (§1) |
| Logout signs out of this app only / user is silently SSO'd back in | Local logout doesn't end the Keycloak session | RP-initiated logout: redirect to wrapper `/oauth2/logout` with `id_token_hint` + registered `post_logout_redirect_uri` (§3.6) |
| `400: client_id is required when post_logout_redirect_uri is provided` | Logout URL omits `client_id` | Add `&client_id=<client>` to the wrapper `/oauth2/logout` URL whenever you pass `post_logout_redirect_uri` (§3.6) |
| `invalid post logout redirect uri` after logout | URI not registered on the client | Register the exact `post_logout_redirect_uri` (scheme/host/port/path) (§3.6) |

---

## 8. New‑app checklist

Paths shown for RMIS (`rmis/`, base package `com.risa.rmis`); substitute yours.

- [ ] Register client; redirect URI `…/login/oauth2/code/<id>` (both host variants)
- [ ] Backend:
  - [ ] `backend/pom.xml` — add `oauth2-client` dep (§2.1)
  - [ ] `backend/src/main/resources/application.properties` — `app.sso.*` props (§2.2)
  - [ ] `backend/src/main/java/com/risa/rmis/config/SsoClientConfig.java` — **new** (§2.3)
  - [ ] `backend/src/main/java/com/risa/rmis/config/SecurityConfig.java` — PKCE + 401 + IF_REQUIRED (§2.4)
  - [ ] `backend/src/main/java/com/risa/rmis/security/SsoLoginSuccessHandler.java` — **new** (§2.5)
  - [ ] `backend/src/main/java/com/risa/rmis/entity/User.java` — `ssoSubject` column; `…/repository/UserRepository.java` — finder (§2.6)
- [ ] Frontend:
  - [ ] `frontend/src/app/login/login.component.ts` — button → `ssoLoginUrl` (§3.1)
  - [ ] `frontend/src/environments/environment.ts` + `environment.prod.ts` — SSO URLs (§3.2)
  - [ ] `frontend/src/app/sso-callback/sso-callback.component.ts` — **new** + route in `frontend/src/app/app.routes.ts` (§3.3)
  - [ ] `frontend/src/app/services/auth.service.ts` — `loginWithSsoToken` (§3.4)
  - [ ] `frontend/angular.json` — `fileReplacements` (§3.5)
- [ ] Logout (§3.6): `SsoLoginSuccessHandler.java` captures `id_token` → SPA;
      `auth.service.ts` `logout()` → wrapper `/oauth2/logout` with `id_token_hint`
      + `client_id` + `post_logout_redirect_uri`; register that redirect URI on the client
- [ ] Docker (`rmis/docker-compose.yml`): `server.port=8080`, `host.docker.internal`
      for fetched URLs, `extra_hosts`, SSO env, secret via gitignored `rmis/.env`
- [ ] Test the scripted flow → row written → browser click
