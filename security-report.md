# Security Review: Books Tracker Application

**Date:** 2026-02-12
**Scope:** Full source code review + live deployment probe
**Application:** Books Tracker (Express.js + React SPA with PostgreSQL)
**Deployment:** https://books-tracker.fly.dev/ (Fly.io)

---

## Executive Summary

Books Tracker is a personal book-tracking web application using WebAuthn/passkeys for authentication, JWT for session management, and PostgreSQL for storage. The codebase is relatively compact and benefits from strong foundational choices: parameterized SQL queries, Zod input validation, and React's built-in XSS protection. No critical vulnerabilities were found in third-party dependencies (`npm audit` clean on both frontend and backend).

That said, several configuration and design issues range from **critical** to **informational**. The two most urgent findings — a hardcoded JWT secret fallback and an open CORS fallback — could allow full account takeover if the app is deployed without setting environment variables. Both are easy fixes.

---

## Findings

### CRITICAL

#### 1. Hardcoded JWT Secret Fallback

| | |
|---|---|
| **CWE** | [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html) |
| **CVSS 3.1** | **9.8** (Critical) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H |
| **Effort to fix** | Trivial |
| **Files** | `backend/src/middleware/auth.ts:4`, `backend/src/routes/auth.ts:49` |

**What's happening:** Both files that handle JWT contain this pattern:

```ts
const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
```

If the `JWT_SECRET` environment variable is not set (or is empty), the application silently falls back to the string `'default-secret-key'`. Since the source code is public, any attacker who knows this (or guesses it) can forge valid JWT tokens for any user.

**Who's at risk:** Anyone who deploys this app and forgets to set `JWT_SECRET`. The `docker-compose.yml` default is similarly weak: `your-secret-key-change-in-production`.

**Impact:** An attacker can craft a JWT like `{ userId: "<target-uuid>", username: "admin" }` and sign it with the known secret, gaining full access to any user's books, passkeys, invitations, and recovery codes.

**Recommendation:** Remove the fallback entirely. Crash on startup if `JWT_SECRET` is not set or doesn't meet a minimum entropy threshold:

```ts
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a value of at least 32 characters');
}
```

---

### HIGH

#### 2. Open CORS Policy Fallback

| | |
|---|---|
| **CWE** | [CWE-942: Permissive Cross-domain Policy](https://cwe.mitre.org/data/definitions/942.html) |
| **CVSS 3.1** | **8.1** (High) — AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N |
| **Effort to fix** | Trivial |
| **File** | `backend/src/index.ts:17-20` |

**What's happening:**

```ts
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
```

When `CORS_ORIGIN` is not set, `origin: true` tells the CORS middleware to reflect *any* requesting origin back in the `Access-Control-Allow-Origin` header. Combined with `credentials: true`, this means any website on the internet can make authenticated cross-origin requests to the API on behalf of a logged-in user.

**What that means in plain English:** If a user is logged in and visits a malicious website, that website can silently read/modify/delete all of their books and generate invitation tokens.

**Recommendation:** Fail closed. Either require `CORS_ORIGIN` to be set, or default to a restrictive origin:

```ts
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin) {
  throw new Error('CORS_ORIGIN must be set');
}
```

---

#### 3. No Rate Limiting

| | |
|---|---|
| **CWE** | [CWE-307: Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html) |
| **CVSS 3.1** | **7.5** (High) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N |
| **Effort to fix** | Medium |
| **Files** | All route files; `backend/src/index.ts` |

**What's happening:** No rate limiting exists on any endpoint. This enables:

- **Recovery code brute-forcing:** Each code is 16 hex characters (64 bits of entropy), and users have 10 codes. Without rate limiting, an attacker who knows a username can automate guesses at network speed. While the entropy is reasonable, the absence of *any* throttling is a weakness.
- **Invitation/setup token brute-forcing:** 64-character hex tokens (256 bits) are infeasible to brute-force, but rate limiting is still a best practice.
- **Username enumeration at scale:** See finding #5.
- **Denial of Service:** An attacker can flood the WebAuthn challenge store (in-memory `Map`) or exhaust database connections.

**Recommendation:** Add `express-rate-limit` (or similar) at minimum to auth endpoints:

```ts
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);
```

---

#### 4. Recovery Codes Stored in Plaintext

| | |
|---|---|
| **CWE** | [CWE-256: Plaintext Storage of a Password](https://cwe.mitre.org/data/definitions/256.html) |
| **CVSS 3.1** | **7.5** (High) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N |
| **Effort to fix** | Medium |
| **File** | `backend/src/routes/auth.ts:217-220` |

**What's happening:** Recovery codes are stored as plaintext in the `recovery_codes` table:

```sql
INSERT INTO recovery_codes (user_id, code) VALUES ($1, $2)
```

Recovery codes are functionally equivalent to passwords — they grant full account access. If the database is compromised (SQL injection in a future feature, backup leak, cloud misconfiguration), all recovery codes are immediately usable.

**What that means in plain English:** Recovery codes are like spare keys to your account. Right now they're sitting in the database in readable form. If someone gets a copy of the database, they can log in as any user.

**Recommendation:** Hash recovery codes with bcrypt or argon2 before storage. Show the plaintext codes to the user exactly once (at registration), then only store the hashed versions. On login, hash the submitted code and compare:

```ts
import bcrypt from 'bcrypt';
const hashedCode = await bcrypt.hash(code, 12);
// Store hashedCode, not code
```

---

### MEDIUM

#### 5. Username Enumeration

| | |
|---|---|
| **CWE** | [CWE-204: Observable Response Discrepancy](https://cwe.mitre.org/data/definitions/204.html) |
| **CVSS 3.1** | **5.3** (Medium) — AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N |
| **Effort to fix** | Easy |
| **File** | `backend/src/routes/auth.ts` (lines 271, 409, 85) |

**What's happening:** Several endpoints return distinct error messages depending on whether a username exists:

| Endpoint | User exists | User doesn't exist |
|---|---|---|
| `POST /login/options` | 200 (challenge) | 404 "User not found" |
| `POST /login/recovery` | 400 "Invalid recovery code" | 404 "User not found" |
| `POST /register/options` | 400 "Username already exists" | 200 (options) |

An attacker can systematically probe these endpoints to build a list of valid usernames.

**Why it matters:** For a personal book tracker with invitations, this is lower risk than for, say, a banking app. But it still lets an attacker confirm whether a specific person uses the service, and then target them for recovery-code brute-forcing.

**Recommendation:** Return generic, timing-consistent error messages:

```ts
// Instead of "User not found" vs "Invalid credential":
return res.status(400).json({ error: 'Invalid username or credential' });
```

---

#### 6. Missing HTTP Security Headers

| | |
|---|---|
| **CWE** | [CWE-693: Protection Mechanism Failure](https://cwe.mitre.org/data/definitions/693.html) |
| **CVSS 3.1** | **5.4** (Medium) — AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N |
| **Effort to fix** | Easy |
| **File** | `backend/src/index.ts` |

**What's happening:** The Express server sets no security-related HTTP headers. The following are all absent:

| Header | Purpose | Risk if missing |
|---|---|---|
| `Strict-Transport-Security` | Forces HTTPS | User could be MitM'd on first visit |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type sniffing | Browser may execute uploaded file as script |
| `X-Frame-Options: DENY` | Prevents clickjacking | Attacker embeds app in iframe overlay |
| `Content-Security-Policy` | Controls resource loading | XSS payloads can load external scripts |
| `Referrer-Policy` | Controls referrer leakage | Tokens in URLs leak to third parties |
| `Permissions-Policy` | Restricts browser features | Unnecessary API surface |

**Note:** Fly.io's `force_https = true` in `fly.toml` handles HTTP-to-HTTPS redirects at the edge, but HSTS should still be set by the application to protect against SSL stripping.

**Recommendation:** Add the `helmet` middleware, which sets sensible defaults for all of these:

```ts
import helmet from 'helmet';
app.use(helmet());
```

---

#### 7. Unbounded File Upload Size

| | |
|---|---|
| **CWE** | [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html) |
| **CVSS 3.1** | **5.3** (Medium) — AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L |
| **Effort to fix** | Trivial |
| **File** | `backend/src/routes/import.ts:9` |

**What's happening:**

```ts
const upload = multer({ storage: multer.memoryStorage() });
```

Multer is configured with in-memory storage and no size limit. A user (or attacker with a valid token) can upload an arbitrarily large file, which will be fully buffered into Node.js process memory. On a 256MB Fly.io VM, this could crash the server quickly.

**Recommendation:**

```ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});
```

A typical Goodreads export is well under 1MB, so 5MB is generous.

---

#### 8. In-Memory WebAuthn Challenge Store

| | |
|---|---|
| **CWE** | [CWE-613: Insufficient Session Expiration](https://cwe.mitre.org/data/definitions/613.html) |
| **CVSS 3.1** | **5.3** (Medium) — AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L |
| **Effort to fix** | Medium |
| **File** | `backend/src/routes/auth.ts:52` |

**What's happening:**

```ts
const challenges = new Map<string, string>();
```

WebAuthn challenges are stored in a plain JavaScript `Map`:

- **No expiration:** Challenges are only deleted after successful verification. Abandoned challenges accumulate indefinitely (memory leak).
- **No multi-instance support:** If the app scales to multiple instances (or restarts mid-flow), challenges are lost.
- **DoS vector:** An attacker can spam `POST /register/options` or `POST /login/options` to grow this Map unboundedly.

**Recommendation:** Use a TTL-based store. If Redis isn't warranted, at least add a cleanup interval:

```ts
const challenges = new Map<string, { challenge: string; createdAt: number }>();
// Periodically clean up entries older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challenges) {
    if (now - value.createdAt > 5 * 60 * 1000) challenges.delete(key);
  }
}, 60 * 1000);
```

---

#### 9. No Server-Side JWT Revocation

| | |
|---|---|
| **CWE** | [CWE-613: Insufficient Session Expiration](https://cwe.mitre.org/data/definitions/613.html) |
| **CVSS 3.1** | **5.4** (Medium) — AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N |
| **Effort to fix** | Medium-High |
| **File** | `backend/src/middleware/auth.ts`, `frontend/src/contexts/AuthContext.tsx:50-54` |

**What's happening:** JWTs are issued with a 30-day expiration and are entirely stateless. The "logout" action only removes the token from `localStorage` — the token itself remains valid:

```ts
const logout = () => {
  localStorage.removeItem('authToken');
  setToken(null);
  setUser(null);
};
```

If a token is stolen (via XSS in a future vulnerability, a compromised device, or a browser extension), there's no way to invalidate it. The attacker retains access for the remainder of the 30-day window.

**Recommendation:** Reduce JWT expiry to 1-7 days. If token revocation is needed, maintain a server-side blocklist (a `revoked_tokens` table or Redis set) checked in the `authenticate` middleware. Alternatively, switch to short-lived JWTs with a refresh token flow.

---

### LOW

#### 10. JWT Stored in localStorage

| | |
|---|---|
| **CWE** | [CWE-922: Insecure Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/922.html) |
| **CVSS 3.1** | **3.7** (Low) — AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N |
| **Effort to fix** | Medium |
| **File** | `frontend/src/contexts/AuthContext.tsx:23,45`, `frontend/src/lib/api.ts:15` |

**What's happening:** The JWT is stored in `localStorage`, which is accessible to any JavaScript running on the same origin. If an XSS vulnerability is ever introduced (via a dependency, a future feature, or a browser extension), the token can be exfiltrated silently.

**Why it's rated Low:** The current codebase has no XSS vulnerabilities. React renders all user content safely, and no `dangerouslySetInnerHTML`, `innerHTML`, or `eval` patterns were found. This is a defense-in-depth concern, not an active exploit path.

**Recommendation:** For this app's threat model (small personal tool), `localStorage` is acceptable. For hardening, consider `httpOnly` cookies — though this adds CSRF complexity. A pragmatic middle ground: keep `localStorage` but add a strong `Content-Security-Policy` header (see finding #6) to limit XSS impact.

---

#### 11. Error Detail Leakage

| | |
|---|---|
| **CWE** | [CWE-209: Generation of Error Message Containing Sensitive Information](https://cwe.mitre.org/data/definitions/209.html) |
| **CVSS 3.1** | **3.7** (Low) — AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N |
| **Effort to fix** | Trivial |
| **File** | `backend/src/routes/import.ts:191` |

**What's happening:**

```ts
res.status(500).json({
  error: 'Failed to import Goodreads data',
  details: error instanceof Error ? error.message : 'Unknown error'
});
```

In the 500 error path, the raw error message is returned to the client. This could include PostgreSQL error details (table names, constraint names, query fragments) that help an attacker understand the database schema.

**Recommendation:** Log the full error server-side; return a generic message to the client:

```ts
console.error('Import error:', error);
res.status(500).json({ error: 'Failed to import Goodreads data' });
```

---

### INFORMATIONAL

#### 12. Dockerfile Uses Development Server

| | |
|---|---|
| **File** | `backend/Dockerfile:21` |

The Dockerfile ends with `CMD ["npm", "run", "dev"]`, which starts the `tsx watch` development server. This is fine for the local Docker Compose setup, but if this Dockerfile is ever used for production, it would run with hot-reloading, verbose error output, and unoptimized performance. The production fly.io deployment likely uses a separate build process, but this is worth documenting.

---

#### 13. Expired Tokens Never Cleaned Up

| | |
|---|---|
| **File** | Database tables: `setup_tokens`, `invitation_tokens`, `recovery_codes` |

Used and expired tokens are marked but never deleted. Over time (months/years), these tables accumulate stale rows. While not a security vulnerability per se, a large `recovery_codes` table with plaintext codes (see finding #4) increases the blast radius of a database compromise.

**Recommendation:** Add a periodic cleanup job, or clean up during relevant operations:

```sql
DELETE FROM setup_tokens WHERE used = TRUE OR expires_at < NOW();
DELETE FROM invitation_tokens WHERE used = TRUE OR expires_at < NOW();
```

---

#### 14. No `express.json()` Body Size Limit

| | |
|---|---|
| **File** | `backend/src/index.ts:22` |

```ts
app.use(express.json());
```

Express 5's default body size limit is 100KB, which is reasonable. But it's worth being explicit:

```ts
app.use(express.json({ limit: '100kb' }));
```

---

#### 15. Challenge Key Collision Risk

| | |
|---|---|
| **File** | `backend/src/routes/auth.ts:297` |

Login challenges are keyed by username: `challenges.set(username, options.challenge)`. If two browser tabs (or an attacker and the legitimate user) initiate login simultaneously for the same username, the second request overwrites the first challenge, causing the first login to fail. This is a minor UX annoyance, not a security hole, but could be used to grief a known user.

---

## What's Done Well

Credit where it's due — the codebase makes strong choices in several areas:

- **Parameterized SQL everywhere.** Every database query uses `$1, $2, ...` placeholders via the `pg` library. No string concatenation of user input into SQL. This eliminates SQL injection, which is the most common and devastating web vulnerability.

- **Zod validation on book input.** The `createBookSchema` and `updateBookSchema` enforce types, ranges (rating 1-5), and formats (URL, datetime) before data reaches the database.

- **WebAuthn as primary auth.** Passkeys are phishing-resistant by design. Users can't be tricked into entering their credentials on a fake site. This is a significantly stronger auth mechanism than passwords.

- **User isolation in queries.** Every book query includes `AND user_id = $N`, ensuring users can only access their own data. This pattern is consistent across all CRUD operations.

- **React's inherent XSS protection.** All user-provided content (titles, authors, notes) is rendered through JSX, which auto-escapes HTML. No `dangerouslySetInnerHTML`, `innerHTML`, or `eval` usage found.

- **Clean dependency tree.** `npm audit` reports 0 vulnerabilities in both frontend and backend. Dependency count is lean — no unnecessary packages.

- **Invitation-gated registration.** After the first user, all subsequent registrations require an invitation token. This prevents unauthorized signups.

---

## Summary Table

| # | Severity | Finding | CVSS | Effort |
|---|---|---|---|---|
| 1 | **CRITICAL** | Hardcoded JWT secret fallback | 9.8 | Trivial |
| 2 | **HIGH** | Open CORS policy fallback | 8.1 | Trivial |
| 3 | **HIGH** | No rate limiting | 7.5 | Medium |
| 4 | **HIGH** | Recovery codes stored in plaintext | 7.5 | Medium |
| 5 | **MEDIUM** | Username enumeration | 5.3 | Easy |
| 6 | **MEDIUM** | Missing HTTP security headers | 5.4 | Easy |
| 7 | **MEDIUM** | Unbounded file upload size | 5.3 | Trivial |
| 8 | **MEDIUM** | In-memory challenge store (no TTL) | 5.3 | Medium |
| 9 | **MEDIUM** | No server-side JWT revocation | 5.4 | Medium-High |
| 10 | **LOW** | JWT in localStorage | 3.7 | Medium |
| 11 | **LOW** | Error detail leakage | 3.7 | Trivial |
| 12 | **INFO** | Dockerfile uses dev server | — | Trivial |
| 13 | **INFO** | Expired tokens never cleaned up | — | Easy |
| 14 | **INFO** | No explicit JSON body size limit | — | Trivial |
| 15 | **INFO** | Challenge key collision risk | — | Easy |

---

## Recommended Fix Order

Addressing by impact-to-effort ratio:

1. **Finding 1** (JWT secret) — one-line change, eliminates critical risk
2. **Finding 2** (CORS) — one-line change, eliminates high risk
3. **Finding 7** (upload size) — one-line change, eliminates medium risk
4. **Finding 11** (error leakage) — one-line change, eliminates low risk
5. **Finding 6** (security headers) — add `helmet`, ~3 lines
6. **Finding 5** (username enumeration) — standardize error responses
7. **Finding 3** (rate limiting) — add `express-rate-limit`, ~10 lines
8. **Finding 4** (recovery code hashing) — requires bcrypt + migration
9. **Finding 8** (challenge TTL) — small refactor of challenge store
10. **Finding 9** (JWT revocation) — architectural decision, can defer

---

## Live Deployment Notes

The probe of https://books-tracker.fly.dev/ returned `403 Forbidden` with `x-deny-reason: host_not_allowed` on every path. This is an Envoy edge proxy rejection (the app isn't actively serving traffic). While this blocked runtime testing, the source code review covers all relevant attack surfaces. Once the deployment is active, re-run the header and CORS checks to verify the production configuration.
