# Dryo — Cardamom Dryer & Curing House Management Platform (ERP)

A monorepo for **Dryo**: a phone-first PWA + Go API for running a cardamom curing
house — farmer intake, drying/curing chambers, batch lifecycle, graded inventory,
staff accounts, invitations, and role-based permissions.

```
dryo/
├── apps/
│   ├── web/   → React 19 + TypeScript + Vite PWA (Firebase Auth)
│   └── api/   → Go REST API (chi + pgx) on PostgreSQL 18
├── Makefile
└── package.json  (npm workspaces)
```

## Architecture

- **Auth:** Firebase Authentication (Google + Phone). The web app sends the
  Firebase **ID token** as a `Bearer` token on every API call.
- **API:** Go verifies that token on every data route, loads the user from
  Postgres, and enforces account status + role before touching data.
- **DB:** PostgreSQL 18 (works great with Neon serverless). Schema is applied by
  migrations — automatically on API startup, or with `make migrate`.

## Accounts, invitations & permissions

Roles: **OWNER → MANAGER → OPERATOR**.

- The **first person** to sign in becomes the **OWNER** (bootstraps the house).
- Everyone else must be **invited**. An Owner/Manager invites by **phone or
  email + role** on the **Team** screen (Account → Team & invitations).
- When an invited person signs in, the API matches their token's phone/email to
  the pending invite, activates them with that role, and marks it accepted.
- Anyone who signs in **without** an invite (and isn't the first user) gets a
  **PENDING** account with no data access and sees an "awaiting access" screen.
- Only **Owner/Manager** can view/manage members & invitations; only the
  **Owner** can change a member's role.

## Security measures (API)

- Firebase ID-token verification required on all `/api/v1` routes except
  `/health`; invalid/expired tokens are rejected with `401`.
- Non-`ACTIVE` accounts are rejected with `403`; member/invite routes require
  Owner/Manager.
- Parameterized SQL everywhere (pgx) — no string-built queries.
- CORS locked to configured web origins; `Authorization`/`Content-Type` only.
- Rate limiting (120 req/min per IP), panic recovery, request timeouts,
  1 MiB body cap, `DisallowUnknownFields` on JSON.
- Security headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS over TLS.
- TLS to Postgres (`sslmode=require`), pooled connections with lifetimes.
- Errors never leak internals to clients.

## Prerequisites

- **Node 20+** and **Go 1.23+** (`brew install go`)
- A **PostgreSQL 18** database (local, or a Neon connection string)
- Firebase project (already configured: `dryo-18227`)

## Configuration

Env files are already created (git-ignored). The only value you supply is the DB
URL:

- `apps/api/.env` → set **`DATABASE_URL`** (Postgres 18 connection string)
- `apps/web/.env` → Firebase web keys + `VITE_API_BASE_URL` (pre-filled)

To enable **Phone** sign-in, turn on the Phone provider in the Firebase console
(Authentication → Sign-in method); Google sign-in already works.

## Run it locally

```bash
# 1. Install web deps
npm install

# 2. Start the API (applies migrations + seed on first run)
cd apps/api && go mod tidy && cd ../..
make api          # → http://localhost:8080  (health: /api/v1/health)

# 3. In a second terminal, start the web app
make web          # → http://localhost:5173
```

Sign in → the **first** account becomes OWNER → open **Account → Team &
invitations** to invite staff. Data now reads/writes to Postgres; if the API is
down, the web app falls back to demo data so the UI still works.

### Test the API directly

```bash
curl http://localhost:8080/api/v1/health          # {"status":"ok"} — public
curl http://localhost:8080/api/v1/batches         # 401 — token required
# With a real token from the web app:
curl -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" http://localhost:8080/api/v1/batches
```

For quick local API testing without Firebase, set `AUTH_DISABLED=true` in
`apps/api/.env` (never in production).

## Handy commands

| Command | Does |
|---|---|
| `make api` | Run the Go API |
| `make web` | Run the web PWA |
| `make migrate` | Apply SQL migrations with `psql` (`$DATABASE_URL`) |
| `make api-build` | Compile API to `bin/dryo-api` |
| `make web-build` | Production build of the web app |
