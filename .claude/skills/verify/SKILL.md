---
name: verify
description: Build, run, and drive this app end-to-end in a headless environment to verify frontend/backend changes at the real UI.
---

# Verifying changes in this repo

Full-stack recipe for driving the real app (React SPA + Express API + Postgres)
in a headless container. Works without docker (docker CLI may exist but the
daemon is usually unavailable in sandboxes).

## 1. Postgres (no docker)

Postgres 16 server binaries are typically installed at `/usr/lib/postgresql/16/bin`.
`initdb`/`pg_ctl` refuse to run as root — run them as the `postgres` user, and
use a data dir the postgres user can traverse (e.g. under `/tmp`; a root-owned
scratchpad path fails with Permission denied):

```bash
PGDIR=/tmp/pgdata-verify
mkdir -p $PGDIR && chown postgres:postgres $PGDIR
su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/initdb -D $PGDIR -U books --auth=trust -E UTF8"
su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/pg_ctl -D $PGDIR -o '-p 5433 -k /tmp -c listen_addresses=localhost' -l /tmp/pg.log start"
psql -h localhost -p 5433 -U books -d postgres -c "CREATE DATABASE books OWNER books;"
```

## 2. Backend + frontend dev servers

```bash
cd backend && npm install
export DATABASE_URL=postgresql://books@localhost:5433/books JWT_SECRET=verify-secret \
  RP_ID=localhost RP_ORIGIN=http://localhost:5173 CORS_ORIGIN=http://localhost:5173 \
  PORT=3000 USER_AGENT_CONTACT='verify@example.com' RP_NAME='Books Tracker'
node init-db.js
nohup npx tsx src/index.ts >/tmp/backend.log 2>&1 &

cd ../frontend && npm install
VITE_API_URL=http://localhost:3000 nohup npx vite --host --port 5173 >/tmp/frontend.log 2>&1 &
curl -s http://localhost:3000/health   # {"status":"ok"}
```

## 3. Bypass passkey login

Passkeys can't be exercised headlessly. Instead insert a user and mint a JWT
with the backend's own jsonwebtoken + JWT_SECRET, then seed it into
localStorage (key `authToken`) before the SPA loads:

```bash
psql -h localhost -p 5433 -U books -d books \
  -c "INSERT INTO users (username, is_initial_user) VALUES ('verifyuser', true) RETURNING id;"
node -e "const jwt=require('./backend/node_modules/jsonwebtoken');
console.log(jwt.sign({userId:'<uuid-from-above>',username:'verifyuser'},'verify-secret',{expiresIn:'1d'}))"
```

Seed books directly with SQL when needed:
`INSERT INTO books (user_id, title, author, status) VALUES ('<uuid>','The Hobbit','J.R.R. Tolkien','reading');`

## 4. Drive with Playwright

Chromium is pre-installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) and
`playwright@1.56` is a *global* npm package. `NODE_PATH` doesn't work for ESM
imports — symlink it into your script dir instead:

```bash
mkdir -p node_modules && ln -sfn "$(npm root -g)/playwright" node_modules/playwright
```

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((t) => localStorage.setItem('authToken', t), token);
await page.goto('http://localhost:5173/');
await page.waitForSelector('text=My Books');
```

## Gotchas

- Open Library / Wikipedia / NYT calls fail (403) behind the sandbox egress
  proxy — the "search to add a book" flow shows "Search failed". Seed books
  via SQL instead; don't mistake this for an app bug.
- Home's filter/tab/sort state is synced into URL search params on every
  change (`?tab=&sort=&dir=&q=`) — useful for asserting state from `page.url()`.
- Frontend has no tests; backend tests need `JWT_SECRET` set (but tests are
  CI's job, not verification).
