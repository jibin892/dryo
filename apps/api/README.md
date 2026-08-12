# Dryo API (Go + PostgreSQL 18)

REST API for the Dryo cardamom curing-house ERP. Verifies Firebase ID tokens,
enforces account status + roles, and persists to Postgres.

## Run

```bash
go mod tidy
go run ./cmd/server      # reads .env, applies migrations, listens on :8080
```

## Layout

```
cmd/server/main.go          entrypoint (config, pool, migrate, server)
internal/config             env config
internal/database           pgx pool + startup migrator (embedded SQL)
internal/auth               Firebase ID-token verifier + middleware
internal/store              models + all SQL queries (pgx)
internal/httpapi            router, security middleware, handlers, responses
internal/httpapi/httperr    shared JSON error writer
migrations/*.sql            schema + seed (also runnable via `psql`)
```

## Endpoints (`/api/v1`)

| Method | Path | Access |
|---|---|---|
| GET | `/health` | public |
| GET | `/me` | any signed-in user (provisions the account) |
| GET | `/batches` · `/batches/{id}` | active user |
| POST | `/batches` · `/batches/{id}/advance` | active user |
| GET | `/chambers` · POST `/chambers/{id}/toggle` | active user |
| GET | `/intake` · POST `/intake` · POST `/intake/{id}/load` | active user |
| GET | `/inventory` | active user |
| GET/PATCH | `/members` · `/members/{uid}` | Owner/Manager (role change: Owner) |
| GET/POST/DELETE | `/invitations` · `/invitations/{id}` | Owner/Manager |

## Auth

- Each request needs `Authorization: Bearer <firebase-id-token>`.
- Tokens are verified against project `FIREBASE_PROJECT_ID` using Google's
  public keys — no service-account file required. To use a service account,
  set `GOOGLE_APPLICATION_CREDENTIALS`.
- `AUTH_DISABLED=true` bypasses verification for local curl testing only.

## Migrations

Applied automatically on startup when `RUN_MIGRATIONS=true`. Or manually:

```bash
export DATABASE_URL=postgres://user:pass@host:5432/dryo?sslmode=require
make -C ../.. migrate
```
