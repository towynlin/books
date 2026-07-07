# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted, single-user-first book tracking app (statuses: read / reading / want_to_read, fiction vs. nonfiction categorization, drag-sortable "Next Up" lists per category, Goodreads CSV import). Two npm packages in one repo — `backend/` and `frontend/` — with no root package.json workspace; run npm commands inside each directory.

Note: `SETUP.md` is partially stale (it mentions Prisma; the backend actually uses raw SQL via `pg`). Trust the code and this file over SETUP.md.

## Commands

All backend commands run in `backend/`, frontend commands in `frontend/`.

```bash
# Backend
npm run dev                          # tsx watch on src/index.ts (port 3000)
npm run build                        # tsc → dist/
npm test                             # vitest run (JWT_SECRET must be set, see below)
npm run test:watch                   # vitest watch mode
npx vitest run src/tests/utils.test.ts        # single test file
npx vitest run -t "parseISBN"                 # tests matching a name
npm run init-db                      # create tables from schema.sql (no-op if books table exists)

# Frontend
npm run dev                          # vite --host (port 5173)
npm run build                        # tsc && vite build

# Full stack (from repo root)
docker compose up                    # postgres + backend + frontend; requires JWT_SECRET in .env
docker compose up -d postgres        # just the database (host port from POSTGRES_PORT, default 5432)
```

There is no linter configured. Tests exist only in the backend (`backend/src/tests/`).

**Tests require `JWT_SECRET`**: `src/middleware/auth.ts` throws at import time if it's unset, and the test files transitively import it. Locally either have a `.env` (dotenv is loaded) or run `JWT_SECRET=test npm test`. CI (`.github/workflows/tests.yml`) sets it explicitly and only runs backend tests.

For local development, copy `.env.example` to `.env` at the repo root and in `backend/` as needed; the backend loads dotenv itself.

## Architecture

### Backend (`backend/`) — Express 5 + TypeScript + PostgreSQL

- **Raw SQL, no ORM.** All queries go through `src/db.ts` (`query()` helper around a pg `Pool`; `getClient()` for transactions). NUMERIC columns are type-parsed to JS numbers there.
- `src/index.ts` wires everything: helmet CSP (the img-src list must include every host in Open Library's cover-redirect chain), CORS, per-route-group rate limiters (stricter on `/api/auth`), and — in production only — serves the built frontend from `backend/public` with an SPA fallback.
- Route modules in `src/routes/`: `books.ts` (CRUD + next-up ordering + enrich/populate-covers), `auth.ts` (the largest file — passkey registration/login, recovery codes, setup tokens, invitation tokens), `import.ts` (Goodreads CSV via multer + csv-parse), `search.ts` (Open Library search proxy).
- Request validation with zod; all book routes scope queries by `user_id` from the JWT.

### Authentication model

Passkeys (WebAuthn via `@simplewebauthn/server`) are the only primary credential — no passwords. Successful registration/login issues a JWT which the frontend stores in localStorage and sends as `Bearer` tokens (`src/middleware/auth.ts` verifies). Supporting flows, each with its own table: bcrypt-hashed **recovery codes** (fallback login), time-limited **setup tokens** (add a passkey on a new device via link), and **invitation tokens** (first user is `is_initial_user`; additional users need an invitation). `RP_ID`/`RP_ORIGIN` env vars must exactly match the serving domain or all passkey ceremonies fail.

### Database schema and migrations

- `backend/schema.sql` is the **complete schema for fresh installs**; `init-db.js` applies it only when the `books` table doesn't exist (it runs as the Fly.io `release_command` on every deploy).
- `backend/migrations/*.sql` are numbered, hand-applied migrations for **existing** databases. There is no migration runner.
- **When changing the schema, update `schema.sql` AND add a new numbered file in `migrations/`.**
- Enrichment caching convention (columns on `books`): a non-null `*_fetched_at` with a NULL value column means "looked it up, nothing found — don't retry"; transient errors leave the timestamp NULL so it retries later. `src/utils/enrichment.ts` implements this for Open Library descriptions, Wikipedia reception excerpts, and NYT reviews (each source fails independently).

### snake_case / camelCase boundary

The API returns raw DB rows in snake_case. The frontend's `fetchAPI()` in `src/lib/api.ts` recursively converts keys to camelCase, so frontend types (`src/types/book.ts`) are camelCase while backend code and SQL use snake_case. Keep new endpoints consistent with this: return snake_case from the backend and let the client transform.

### Frontend (`frontend/`) — React 19 + Vite + Tailwind CSS 4

- Server state via TanStack Query: `src/hooks/useBooks.ts` holds all query/mutation hooks and invalidates the `['books']` key on mutation. `src/lib/api.ts` is the single fetch layer (auth header injection, error normalization).
- `src/contexts/AuthContext.tsx` + `ProtectedRoute` gate all routes except `/auth` and `/setup`.
- Drag-and-drop for Next Up lists uses `@dnd-kit` (`DraggableBookList` / `DraggableBookCard`).
- **Theme**: Tailwind 4 with a custom `@theme` in `src/index.css` — colors `terracotta`, `warm-cream`, `forest-green`, `soft-peach`, `charcoal`; fonts Nunito (sans) / Fraunces (serif). Use these tokens for any new UI, not stock Tailwind palette colors.
- `VITE_API_URL` is `http://localhost:3000` in dev and **empty string** in production builds (same-origin; the backend serves the SPA).

### External APIs (all called server-side)

- **Open Library** — search, covers, descriptions. All requests must go through the headers from `src/utils/openLibraryHeaders.ts`, which builds a descriptive User-Agent from the `USER_AGENT_CONTACT` env var (API etiquette requirement).
- **Wikipedia** (`src/utils/wikipedia.ts`) — article lookup + Reception-section excerpts, sanitized with sanitize-html.
- **NYT Books API** (`src/utils/nytBooks.ts`) — optional; degrades gracefully when `NYT_API_KEY` is unset.

Cover image URL construction is documented in `BOOK_COVERS.md`.

## Deployment / CI

- **CI**: `tests.yml` runs backend tests on every PR and push to main. `fly-deploy.yml` deploys to Fly.io only after Tests succeeds on main.
- **Production is a single Fly.io app**: the root `Dockerfile` is a multi-stage build that compiles the frontend (with `VITE_API_URL=""`) and backend, then serves both from one Express process on port 8080. `fly.toml` runs `node init-db.js` as the release command and health-checks `/health`.
