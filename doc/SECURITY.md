# Security Notes

A record of the security posture of this application and the findings from a
manual review. None of the findings below are critical or high severity; they
are availability, hardening, and defence-in-depth items that have been reviewed
and **consciously deferred** for now. This document is the place to track them
so they are not lost.

Last reviewed: 2026-06-29 (commit `26e9747`).

## Scope of the application

- Cloudflare Pages app with API routes in `functions/api/*` (Pages Functions).
- **Public, unauthenticated ingest**: `POST /api/upload` (YAML/JSON) and
  `POST /api/import-sheet` (Google Sheet). Anyone can add an assessment.
- **Public read**: `GET /api/entries` returns all stored assessments
  (`Access-Control-Allow-Origin: *`).
- **Admin-only mutation**: `DELETE /api/entries/:id`, gated by Cloudflare Access
  (edge auth + JWT re-verification in `functions/auth.ts`).
- **Storage**: D1 (SQLite), schema in `schema.sql`.
- **Frontend**: React (Vite), public site + `/admin`.

## Overall posture

The codebase is security-conscious. The following were reviewed and confirmed
sound:

- **SQL injection** — all D1 queries use bound parameters (`ingest.ts`,
  `api/entries.ts`, `api/entries/[id].ts`, `ratelimit.ts`).
- **XSS / stored content** — no `dangerouslySetInnerHTML`/`innerHTML` anywhere;
  all untrusted assessment fields render as escaped JSX text. `dataset.url` is
  rendered as plain text and validated to be an `http(s)` URL on ingest (see
  `functions/validation.ts`), so a stored `javascript:`/`data:` URL cannot
  execute even if the field is ever turned into a link. The raw-JSON fallback
  (`<pre>{JSON.stringify(...)}</pre>`) is also escaped.
- **Admin auth / JWT** — `verifyAccessJwt` pins RS256, requires a `kid`, verifies
  the signature against the team JWKS, and checks `aud`, `iss`, `exp`, and `nbf`
  (with clock skew). No `alg:none` bypass. Fails closed on any error or
  misconfiguration.
- **CSRF on the one privileged endpoint** (`DELETE /api/entries/:id`) — it is a
  non-simple method (CORS-preflighted), the response sets
  `Access-Control-Allow-Origin: *` with **no** `Access-Control-Allow-Credentials`,
  so the `CF_Authorization` cookie cannot be used cross-site; HTML forms cannot
  issue `DELETE`. Not forgeable.
- **YAML abuse** — alias-bomb (`maxAliasCount`) cap, silent logging, no
  deserialization/RCE gadgets, inert `__proto__` (a test asserts no prototype
  pollution). See `functions/validation.ts`.
- **SSRF in the sheet importer** — `import-sheet` fetches server-side, but the
  user input is reduced to a `[a-zA-Z0-9-_]+` spreadsheet id and every fetch is
  hardcoded to `https://docs.google.com/spreadsheets/d/<id>/…`. The host/path
  cannot be controlled by the caller. (Residual: redirects are followed — see
  L1.)
- **IP spoofing of the rate limit** — uses `CF-Connecting-IP`, which the
  Cloudflare edge sets and clients cannot forge.
- **Secrets in config** — `wrangler.toml` holds only non-secret identifiers
  (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `database_id`); real secrets go through
  `wrangler pages secret`. `.dev.vars` is gitignored (only `.dev.vars.example`
  is committed).

## Deferred findings

Severity key: M = medium, L = low. All deferred as of the last review date.

### M1 — Public ingest + global 50-entry cap is a denial-of-service / griefing vector
**Where:** `functions/ingest.ts` (`MAX_UPLOADS = 50`), `functions/api/upload.ts`,
`functions/api/import-sheet.ts`.

The public write endpoints need no auth (by design). `checkIngestGuards` enforces
a **global** cap of 50 stored entries; once reached, every upload returns `429`
until an admin deletes something. The per-IP limit (20/hour) only slows an
attacker from filling all 50 slots, after which no legitimate assessment can be
added.

**Options if revisited:** raise the cap with FIFO eviction of the oldest entry;
or put the public write endpoints behind a lightweight token / Cloudflare
Turnstile.

### M2 — Rate-limit check is not atomic (TOCTOU)
**Where:** `functions/ratelimit.ts` (`allowUpload`).

`SELECT COUNT(*)` followed by a separate `INSERT`, with no transaction.
Concurrent requests from one IP can all read an under-limit count before any
insert lands, letting an IP exceed `MAX_PER_WINDOW`. Rate limiting is best-effort
abuse control, so impact is bounded.

**Options if revisited:** insert-first-then-count-and-reject, or use a D1
`batch()`/transaction.

### L1 — Sheet importer follows redirects on the server-side fetch
**Where:** `@airbds/converter-tools` `fetchSheet` (via
`functions/api/import-sheet.ts`).

Fetches use `redirect: "follow"`. The host is hardcoded to `docs.google.com`, so
this only matters if Google itself redirects elsewhere — low risk.

**Options if revisited:** `redirect: "manual"` and reject off-`docs.google.com`
redirects.

### L2 — No size bound on the sheet-import path
**Where:** `functions/api/import-sheet.ts`.

The YAML upload path caps bodies at `MAX_UPLOAD_BYTES` (256 KB); the sheet-import
path fetches and parses Google CSVs with no size cap. Bounded in practice by the
Workers memory limit and the template requirement.

**Options if revisited:** cap the fetched CSV length before parsing, mirroring
the upload path.

### L3 — Hardcoded rate-limit salt in source
**Where:** `functions/ratelimit.ts` (`IP_SALT`).

IPs are hashed with a salt baked into source. It is a privacy measure, not an
auth secret, but source + DB access would allow brute-forcing IPs from hashes
(small IP space).

**Options if revisited:** move `IP_SALT` to a `wrangler pages secret`.

### L4 — `ACCESS_DEV_BYPASS` is one config slip from a full auth bypass
**Where:** `functions/auth.ts` (`getAdmin`), `.dev.vars`.

When `ACCESS_DEV_BYPASS` is set, every request is treated as an authenticated
admin. Today this is safe: `.dev.vars` is gitignored and only holds a non-secret
`dev@example.com`. The risk is purely operational — if this var is ever set in
the production environment, admin authorization is fully disabled.

**Options if revisited:** only honour the bypass when it cannot be production —
e.g. when `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are unset — so a stray prod var can't
silently open auth.

## Re-running the review

This was a manual review. For a diff-scoped automated pass on a branch, the
`/security-review` Claude Code command reviews the pending changes on the current
branch. Re-do a full manual sweep when the ingest, auth, or rendering paths
change materially, and update the "Last reviewed" line above.
