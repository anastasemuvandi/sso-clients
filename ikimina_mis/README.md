# Ikimina MIS

Authentication service for the Ikimina Management Information System.

**Features:** registration, login with mandatory email-based two-factor
authentication (2FA), password reset, and user profile / password updates.

**Stack:** Spring Boot 3.2.5 (Java 17) · Angular 17 · PostgreSQL 16 · Docker.
Authentication is local (email + password + JWT) — there is no external SSO.

---

## Architecture

```
ikimina_mis/
├── backend/        Spring Boot REST API (JWT auth, JPA, Spring Mail)
├── frontend/       Angular 17 SPA (standalone components)
└── docker-compose.yml   postgres + mailhog + backend + frontend
```

Primary keys are UUIDs. Passwords are BCrypt-hashed. 2FA / reset codes are
6-digit, single-use, and expire after 10 minutes (configurable).

## Run with Docker (recommended)

```bash
cd ikimina_mis
docker compose up --build
```

| Service        | URL                                   |
|----------------|---------------------------------------|
| Frontend (SPA) | http://localhost:8180                 |
| Backend API    | http://localhost:8186/api             |
| MailHog inbox  | http://localhost:8126                 |
| PostgreSQL     | localhost:5437 (db `ikimina_db`)      |

> Emails (2FA + reset codes) are captured by MailHog — open
> **http://localhost:8126** to read the code, no real mailbox required.

## Run locally (without Docker)

**Backend** (needs a Postgres reachable at `jdbc:postgresql://localhost:5432/ikimina_db`,
or override `spring.datasource.url`):

```bash
cd backend
mvn spring-boot:run
```

**Frontend** (dev server on :4200, talks to backend on :8186):

```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

## Authentication flow

1. **Register** — `POST /api/auth/register` creates the account.
2. **Login (step 1)** — `POST /api/auth/login` checks the password and emails a
   6-digit code. No token is returned yet.
3. **Login (step 2)** — `POST /api/auth/verify-2fa` validates the code and
   returns the JWT.
4. Authenticated requests send `Authorization: Bearer <jwt>`.

## API reference

### Public — `/api/auth`

| Method | Path                | Body                                        |
|--------|---------------------|---------------------------------------------|
| POST   | `/register`         | `{ email, password, fullName, phoneNumber? }` |
| POST   | `/login`            | `{ email, password }` → emails 2FA code     |
| POST   | `/verify-2fa`       | `{ email, code }` → `{ token, email, fullName }` |
| POST   | `/forgot-password`  | `{ email }` → emails reset code             |
| POST   | `/reset-password`   | `{ email, code, newPassword }`              |

### Authenticated — `/api/user` (Bearer token)

| Method | Path        | Body                                  |
|--------|-------------|---------------------------------------|
| GET    | `/me`       | —                                     |
| PUT    | `/profile`  | `{ email, fullName, phoneNumber? }` → new token |
| PUT    | `/password` | `{ currentPassword, newPassword }`    |

## Configuration

Backend settings live in `backend/src/main/resources/application.properties` and
are overridable via environment variables (see `.env.example`). For real email,
set `MAIL_HOST`/`MAIL_PORT`/`MAIL_USERNAME`/`MAIL_PASSWORD` and enable
`MAIL_SMTP_AUTH` / `MAIL_SMTP_STARTTLS`.
