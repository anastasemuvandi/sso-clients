# IRMIS — Spring Boot + Angular (local, no Docker)

A small login / logout / register portal integrated with the **Government SSO**
(OIDC on Keycloak via the SSO wrapper). Local username/password accounts use a
JWT minted by this app; the "Sign in with GoR SSO" button drives the standard
OIDC code flow and maps the SSO identity onto a local account.

- **Backend:** Spring Boot 3.2, Java 17, **H2 in-memory** database (zero install).
- **Frontend:** Angular 17 standalone components, dev server on **:8201**.
- Backend listens on **:8200**.

> The SSO wiring follows the repo runbook
> [`../SSO_INTEGRATION_SPRINGBOOT_ANGULAR.md`](../SSO_INTEGRATION_SPRINGBOOT_ANGULAR.md).

---

## Prerequisites

- JDK 17+ and Maven 3.9+ (`mvn -v`)
- Node 18+ and npm (`node -v`)

## 1. Run the backend

```bash
cd irmis/backend
mvn spring-boot:run
```

It starts on <http://localhost:8200>. The H2 DB is created fresh on every boot
and a known local account is seeded automatically:

| Email                | Password       |
|----------------------|----------------|
| `admin@risa.gov.rw`  | `Password@123` |

H2 web console (optional): <http://localhost:8200/h2-console> — JDBC URL
`jdbc:h2:mem:irmisdb`, user `sa`, empty password.

> To persist data between runs, change `spring.datasource.url` in
> `src/main/resources/application.properties` to
> `jdbc:h2:file:./data/irmisdb`.

## 2. Run the frontend

```bash
cd irmis/frontend
npm install
npm start          # ng serve --port 8201
```

Open <http://localhost:8201>. Register a new account or sign in with the seeded
admin, then land on the dashboard. **Logout** clears the local session (and, for
SSO sessions, ends the Keycloak session too).

---

## 3. Government SSO

Local login works out of the box. To enable the **Sign in with GoR SSO** button
you must (a) register an `irmis-portal` client in Keycloak and (b) give the
backend its client secret.

### a. Register the client (realm `government-internal`)

Set the **redirect URI** (Spring's convention) — add **both** host variants:

```
http://localhost:8200/login/oauth2/code/gor
http://127.0.0.1:8200/login/oauth2/code/gor
```

Set the **Valid post logout redirect URI** (for RP-initiated logout):

```
http://localhost:8201/login
```

PKCE is required by the wrapper — the backend already enables it.

### b. Provide the client secret

```bash
cp .env.example .env          # then edit CLIENT_SECRET
```

`.env` is gitignored. Export the values before starting the backend (PowerShell
example):

```powershell
$env:CLIENT_ID = "irmis-portal"
$env:CLIENT_SECRET = "<secret-from-keycloak>"
mvn spring-boot:run
```

(or bash: `CLIENT_ID=irmis-portal CLIENT_SECRET=... mvn spring-boot:run`)

The SSO endpoints default to the local stack — wrapper on `:8000`, Keycloak on
`:8080`. Override `SSO_*` env vars (see `.env.example`) to point elsewhere.

### Where things point

| Setting | Value |
|---|---|
| `ssoLoginUrl` (browser → backend) | `http://127.0.0.1:8200/oauth2/authorization/gor` |
| `authorization-uri` (browser → wrapper) | `http://localhost:8000/oauth2/authorize` |
| `token-uri` / `userinfo-uri` (server → wrapper) | `http://localhost:8000/...` |
| `jwk-set-uri` (server → Keycloak) | `http://localhost:8080/realms/government-internal/protocol/openid-connect/certs` |
| `issuer-uri` (compared to `iss`) | `http://localhost:8080/realms/government-internal` |
| post-login redirect (backend → SPA) | `http://localhost:8201/sso/callback` |

---

## API

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/auth/register` | public | `{ email, password, fullName, phoneNumber? }` |
| POST | `/api/auth/login` | public | `{ email, password }` → `{ token, email, fullName }` |
| GET  | `/api/user/me` | Bearer JWT | — |
| GET  | `/oauth2/authorization/gor` | public | starts the SSO flow |

Logout is client-side (the SPA drops the token); SSO logout additionally hits the
wrapper's `/oauth2/logout`.
