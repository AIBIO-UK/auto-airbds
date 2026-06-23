# DESIGN DECISIONS

Technical/implementation decisions and the reasoning behind them. All these are experimental and can be changed.

## Metrics file format: YAML

For a given AIRBDS metric version, each question's **scope** and **grade** are fixed (e.g. in v0.3 `ACM-1` is always Access/Important, `ACM-4` is always License/Critical; v0.3 also defines a finer-grained **theme**, which v0.4 drops). These definitions live in `src/metrics/`, one file per version named by version (`airbds_metric_v<version>.yaml`) — currently **v0.3** and **v0.4** — and are the source of truth, so the corresponding fields in uploaded assessments are ignored in favour of them. The two versions have different questions and scoring (not directly comparable) but share the same scoring mechanism and Gold/Silver/Bronze/Caution banding, so they render through the same code; `theme` is optional in the parsed definition so a version without it loads cleanly.

**Decision:** store these per-version definition files as **YAML**.

The options considered were a TypeScript module, JSON, and YAML.

- **TypeScript module** (e.g. `export const QUESTIONS = {...} as const`)
    - **Pros**
        - Compile-time type safety and editor autocomplete on the keys/values.
        - Zero extra build configuration — imports directly.
    - **Cons**
        - **Not language-neutral**. It is *code*, not data. Other languages (e.g. a Python assessor agent, validation scripts, future backend tooling) cannot read it without a JavaScript runtime, or must resort to brittle parsing. This was the deciding factor against it: the metric definitions are reference data we may want to read from many tools and possibly publish as a spec.
- **JSON**
    - **Pros**
        - Language-neutral — readable natively by essentially every language.
        - Zero extra build configuration on the web side (native `import`/`fetch`).
    - **Cons**
        - No comments, so the data cannot be annotated inline.
        - No compile-time type safety.
- **YAML** (chosen)
    - **Pros**
        - **Language-neutral**, like JSON — readable by any tool, not just the web frontend. This was a hard requirement.
        - **Best authoring/maintenance ergonomics** for a long, mostly-flat lookup table: no braces/quotes/trailing-comma hazards, clean line-per-field diffs that make version-to-version changes easy to review.
        - **Comments** are supported, so entries and files can be annotated (e.g. why a question is Critical).
        - Format matches the domain — metric definitions read like spec/config data.
    - **Cons**
        - Needs a build dependency (`@rollup/plugin-yaml`) to `import` YAML in Vite; configured once in `vite.config.ts` and, because Vitest shares that config, it applies to tests too. Other languages need a YAML parser (ubiquitous, but one more dependency everywhere).
        - No compile-time type safety (a YAML file resolves to `unknown`).

**Trade-offs accepted / mitigations.** We accept the build-plugin dependency and the loss of compile-time types as the cost of language-neutrality plus good authoring ergonomics. To recover most of the lost safety, `src/metrics/index.ts` **validates each file at load** and throws a clear error if a definition is malformed, so a bad file fails loudly rather than silently dropping questions. A registry in `index.ts` is required regardless of format (a bundle can't pick a file by version string at runtime), so YAML does not add that cost over JSON.

## Upload format: the AIRBDS review-template YAML shape

Assessments are uploaded to `POST /api/upload`.

**Decision:** accept uploads as **YAML in the shape of the upstream AIRBDS `review_template.yaml`** (top-level `schema_version`, `reviewer`, `dataset`, and an `answers` map keyed by question id), and treat that shape as the app's native/internal model. See the README "Upload format" section for the fields.

- **YAML (with JSON for free).** Uploads are parsed in the Function with the `yaml` package. YAML is a superset of JSON, so a single parse path accepts both syntaxes; we don't branch on `Content-Type`. (`@rollup/plugin-yaml` is a *build-time* Vite plugin and can't parse a request body, hence the separate runtime dependency.)
- **One shape, matching the template.** Rather than invent a bespoke assessment shape, we adopt the template humans already fill in. The frontend reads these field names directly (`dataset.name`/`url`/`comments`, `reviewer.name`/`review_date`, `answers.<id>.{answer,comments}`), so there is no long-lived translation layer — the read-time guards in `src/types.ts` are just untrusted-input validation, not format adaptation.
- **Unified human + AI provenance.** "Who performed the assessment" is a single field, `reviewer.name` — a model name for an AI assessment, a person's name for a human review. There is no separate `model` field. This anticipates the human-review workflow noted in `PLAN.md`.
- **Ignored template fields.** `reviewer.initials`/`orcid`/`affiliation`, `dataset.hosting_resource`/`accession`, `answers.*.not_applicable`, and `result.*` are accepted but ignored — the score and grade are recomputed from the metric definition, so trusting the upload's own totals would be redundant and spoofable.

**Server-side completeness validation.** Uploads are rejected (`400`, or `413` if oversized) unless complete: a *known* `schema_version`, non-empty reviewer name/date and dataset name/url, and a `"Yes"`/`"No"` answer for every question in that metric version. Partial templates and unknown versions can't be scored, so they're refused rather than stored half-formed.

- **Why a separate `functions/metrics.ts`.** The validator needs the per-version question-id set, but the Pages Functions bundle has no YAML loader and can't import `src/metrics/`. We keep a minimal plain-data descriptor (versions → question ids) in `functions/metrics.ts`. To stop it drifting from the real metric, `functions/metrics.test.ts` asserts it matches the YAML (Vitest *can* import the YAML, via the shared Vite config) — single source of truth enforced by test rather than a codegen step.

These choices are experimental and reversible; the previous bespoke JSON assessment shape was dropped in favour of this one.

## Public upload endpoint and per-IP rate limiting

A front-page upload button means the browser must call `POST /api/upload`, and a shared API key shipped in frontend code is not a secret. We also want to keep accepting machine/automated uploads.

**Decision:** make `/api/upload` **public** (no API key) and limit abuse with a **per-IP rate limit counted in D1**, plus a global cap.

- **No API key.** The key gate was removed; the rate limit is the control. (The endpoint was already effectively open to anyone who could read the key.) A CAPTCHA such as Turnstile was rejected because it would block the machine uploads we want to allow.
- **Why D1, not the Workers Rate Limiting binding or a WAF rule.** The Workers Rate Limiting binding **is not supported by Pages Functions** (supported bindings: KV, D1, Durable Objects, R2, Vectorize, Workers AI, Service bindings, Queues, Hyperdrive, Analytics Engine, vars/secrets). A WAF rate-limiting rule would work but lives in the dashboard/API, not the repo — we want config-as-code and no manual dashboard steps. Counting in D1 reuses the existing `DB` binding with no new infrastructure.
- **Privacy.** We never store a raw IP: `CF-Connecting-IP` is hashed (salted SHA-256) and only the hash is stored, in a `rate_limit` table whose rows are pruned to the active window. An IP is personal data under UK/EU GDPR, so this keeps the footprint minimal. Default limit: 20 uploads/IP/hour — tunable in `functions/ratelimit.ts`, and D1 allows long windows (the binding only supports 10s/60s).
- **Global cap.** `MAX_UPLOADS` (raised 30 → 50) bounds total stored uploads as a backstop.

**Known gaps (accepted for the experimental phase).** The global cap can still be filled with junk (a self-DoS). `DELETE /api/entries/:id` is now authenticated (admin-only — see the next decision); a moderation/holding queue is still planned — see `PLAN.md`.

## Admin authentication via Cloudflare Access

Once uploads became public, the open `DELETE /api/entries/:id` had to be locked down, and we wanted to grant deletion to a small, growing set of trusted admins (multiple people, equal rights).

**Decision:** gate the admin area (`/admin`) and the delete endpoint with **Cloudflare Access** (Zero Trust) — an email allowlist with edge-handled login — and verify the forwarded Access JWT inside the Function for defence in depth.

Options considered, lightest to heaviest:

- **Shared password / bearer token.** One secret, checked server-side. Lightest to build, but gives no per-person identity, no audit of who deleted what, and revoking one person means rotating the secret for everyone. Acceptable as an interim *single*-admin measure, not as a destination once multiple admins are wanted.
- **Cloudflare Access (chosen).** Cloudflare authenticates the admin at the edge (e.g. email one-time PIN) and forwards a signed JWT carrying their email. Adding/removing an admin is editing the Access policy's allowlist — no code, no deploy — and each admin signs in as themselves, with Cloudflare's audit logs. Scales from one to many admins with zero code change. The cost is that the allowlist lives in the Access dashboard/Terraform, not the repo — but *who is an admin* is operational data that wouldn't belong in a public repo anyway (like a secret), so this is a smaller config-as-code compromise than, say, the WAF rule rejected above.
- **Self-built accounts (a users table in D1).** Per-person identity and revocation kept entirely in our stack, but we would own registration/invites, password or magic-link handling, sessions, and their ongoing security — too much surface to build and maintain for a few trusted admins when Access provides it.

Implementation notes:

- **No login code in the app.** Access serves the login UI; the app only links to `/admin` (the **Admin Area** button). Security is enforced at the edge and re-checked in the Function — never by hiding the page.
- **Why `/admin` is a real path, not a hash route.** Access matches on URL path and never sees the URL fragment, so a hash-routed `#/admin` could not be protected. The public app keeps its hash routing; `/admin` is a separate Vite entry at a real path, which also keeps admin code out of the public bundle.
- **JWT verification.** [`functions/auth.ts`](../functions/auth.ts) reads the token from the `Cf-Access-Jwt-Assertion` header (or the `CF_Authorization` cookie), fetches the team JWKS, and validates the signature plus `aud`/`iss`/`exp` with WebCrypto (RS256) — no new dependency. It fails closed on anything missing or invalid.
- **Local development.** The Access edge is absent under `wrangler pages dev`, so `ACCESS_DEV_BYPASS` (in a gitignored `.dev.vars`) stands in for a verified admin locally; the real email-PIN login is verified on a Cloudflare Pages preview deployment.

These choices are experimental and reversible.

## Google Sheet import: server-side conversion via a shared npm package

Reviewers also fill in assessments as a Google Sheet (the AIRBDS scoring
template), not just YAML. We wanted a one-paste import that ends up as the same
stored assessment as a YAML upload, and reports completeness problems back to the
reviewer. The conversion logic already exists as a TypeScript library in the
`airbds-metric` repo (`src/google-sheet-converter/`).

**Decision:** run the conversion **server-side** in a new `POST /api/import-sheet`
Function, reusing that converter as the published npm package
**`@airbds/converter-tools`**, and collect the sheet's missing **review date** in
the import form rather than the sheet.

- **Why server-side, not in the browser.** Google's CSV export endpoint sends no
  CORS headers, so a browser `fetch` of the sheet is blocked. The converter's
  `fetchSheet`/`convert` use only the global `fetch`, `csv-parse`, and `yaml`, so
  they run in a Pages Function. This also keeps one validation/storage path: the
  converted review is gated by the **same `validateAssessment`** as
  `POST /api/upload` (via `functions/ingest.ts`), so both routes enforce identical
  completeness rules and share the rate-limit/cap guards.
- **Why the metric version is read from the sheet.** The sheet declares its own
  version on the Instructions tab ("AIRBDS … Metric vX.Y"); the route reads it with
  the converter's `detectSchemaVersion` and loads the matching server-side metric
  (`metricForVersion`), so one import path serves every metric version (v0.3 and
  v0.4 today). The sheet is trusted for the *version* only — answers and score are
  recomputed server-side; the `ACM-`/`ABC-` question-id prefix is deliberately not
  used to infer it.
- **Why a published npm package, not vendoring or a path dependency.** The two
  repos are separate, and Cloudflare Pages builds only this repo, so a sibling
  `file:` path won't resolve in the build container. Publishing the converter to
  npm (a `tsc` build emitting `dist/` JS + types, consumed as a normal dependency)
  is the robust option; the cost is a version-bump/publish loop on converter
  changes. Vendoring (git subtree) was the considered alternative — no registry,
  but manual re-sync and duplicated source.
- **Why the review date comes from the form.** The spreadsheet template carries no
  review-date field, but a scorable assessment requires one. Collecting it (plus
  optional initials/affiliation) in the form is a website-only change and keeps
  the metric repo untouched; the trade-off is that the date lives outside the
  sheet artifact. Reading it from the sheet (extending the template + converter)
  remains a possible follow-up — see `PLAN.md`.
- **`nodejs_compat`.** `csv-parse` uses Node's `Buffer`/`stream`, so the Functions
  runtime needs the `nodejs_compat` flag (`wrangler.toml`). Verified by booting
  `wrangler pages dev` and confirming the route's converter import chain loads and
  executes.
- **No metric YAML in the bundle.** As with upload validation, the Functions
  bundle has no YAML loader, so `functions/metrics.ts` builds the converter's
  `Metric` (question ids + the Ethics-scope subset) from plain data, kept in sync
  with `src/metrics/` by `functions/metrics.test.ts`.

These choices are experimental and reversible.
