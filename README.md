An experimental website for collecting, processing and publishing AIRBDS dataset assessments (AI-performed or human-performed).

## Infrastructure

- **Cloudflare Pages** — hosting and serverless functions (Pages Functions) for the API endpoints (`POST /api/upload`, `POST /api/import-sheet`, `GET /api/entries`, and the admin-only `DELETE /api/entries/:id`)
- **Cloudflare D1** — strongly-consistent SQLite database storing uploads, so new entries are visible to readers immediately
- **React** — frontend SPA built with TypeScript (polls `/api/entries` so uploads appear without a manual reload). The main page has an upload button and lists the assessments; clicking one opens a separate page (hash-routed at `#/entry/:id`, so deep links work without SPA-fallback config) showing a scoring-summary box and a per-question results table — or the raw payload if it isn't a recognised assessment. The public list is read-only; deleting uploads is done in a separate [admin area](#admin-area), reached via the **Admin Area** button in the top-right of the header
- **Vite** — build tool and dev server (YAML metric files are imported at build time via `@rollup/plugin-yaml`; uploaded YAML assessments are parsed at request time in the Function with the `yaml` package)

## Metric definitions

Two metric versions are supported, **v0.3** and **v0.4**. They have different questions and scoring and are **not directly comparable**, but both produce a Gold/Silver/Bronze/Caution grade, and an assessment carries its own version in `schema_version` so the two coexist.

For a given AIRBDS metric version, each question's **scope**, **grade**, and **question** text are fixed (e.g. in v0.3 `ACM-1` is always Access/Important, `ACM-4` is always License/Critical), as is its **score**: a `Yes` answer earns the full points for the question's grade (`grade_points`, e.g. Critical 80 / Important 5 / Optional 2) and a `No` scores 0. (v0.3 questions also carry a finer-grained **theme**; v0.4 drops it, so the Theme row is shown only for versions that define one.) These are defined in [`src/metrics/`](./src/metrics/), one language-neutral YAML file per version named by version (`airbds_metric_v<version>.yaml`), and are the source of truth — the corresponding fields in uploaded assessments are ignored in favour of these.

The overall score shown in the summary is computed the same way and **not** taken from the uploaded `scoring_summary`: the actual score is the sum of points for the questions answered `Yes`, and the maximum is the total if every question were `Yes`.

The **grade** (e.g. Gold/Silver/Bronze/Caution) is also computed, not trusted from the payload. Each YAML file has a `grading` section (highest grade first) listing, per grade, a `min_proportion_yes` for each grade category and a `min_score`. A dataset earns the highest grade for which the proportion of `Yes` answers in every category is at least its minimum (compared with `>=`) and the total score is at least `min_score`. Editing the `grading` section re-grades without any code change.

[`src/metrics/index.ts`](./src/metrics/index.ts) registers each version and exposes `questionMeta(version, questionId)` (scope/theme/grade/question), `questionScore(version, questionId, answer)`, `questionMaxScore(version, questionId)`, `maxScore(version)`, and `computeGrade(version, answers)`; the assessment view uses them to display each question, the overall total, and the grade. Definitions are validated at load, so a malformed file fails loudly. To support a new version, add `airbds_metric_v<version>.yaml`, register it in `index.ts`, and add its question ids to [`functions/metrics.ts`](./functions/metrics.ts) (a unit test keeps the two in sync). `theme` is optional, so a version that omits it (like v0.4) loads fine.

## Upload format

Assessments are uploaded to `POST /api/upload` as **YAML** in the shape of the AIRBDS [review template](https://github.com/AIBIO-UK/airbds-metric) (`review_template.yaml`). JSON is also accepted, since YAML is a superset of JSON. The version is taken from the file's `schema_version`, so the same **Upload assessment (YAML)** button on the main page ingests both v0.3 and v0.4. Use that button, or POST a file directly (e.g. the [test scripts](#test-upload-scripts)). Filled examples are in [`scripts/example-assessment-1.yaml`](./scripts/example-assessment-1.yaml) (v0.3) and [`scripts/example-assessment-v0.4.yaml`](./scripts/example-assessment-v0.4.yaml) (v0.4).

The fields auto-airbds reads are:

- `schema_version` — the AIRBDS metric version (must be one the app knows: `"0.3"` or `"0.4"`)
- `reviewer.name` — who performed the assessment; a **model name** for an AI assessment or a **person's name** for a human review (the two are unified — there is no separate "model" field)
- `reviewer.review_date` — when it was performed (an ISO date, e.g. `2026-06-03`, or a full timestamp, e.g. `2026-06-03T11:53:00Z`)
- `dataset.name`, `dataset.url` — the dataset assessed
- `dataset.comments` — free-text summary, shown in the scoring-summary box
- `answers.<ID>` — a map keyed by question id (`ACM-1`, … in v0.3; `ABC-01`, … in v0.4), each `{ answer: "Yes" | "No", comments: "…" }`

Other template fields (`reviewer.initials`/`orcid`/`affiliation`, `dataset.hosting_resource`/`accession`, `answers.*.not_applicable`, `result.*`) are accepted but ignored — the score and grade are recomputed from the metric definition, not trusted from the upload.

Uploads are **validated server-side** and rejected with `400` (or `413` if larger than 256 KB) unless they are complete: a known `schema_version`, non-empty `reviewer.name`/`review_date` and `dataset.name`/`url`, and a `"Yes"`/`"No"` answer for **every** question in that metric version. The per-version question list the validator checks against lives in [`functions/metrics.ts`](./functions/metrics.ts) (the Functions bundle has no YAML loader, so it can't read the metric YAML directly); a unit test keeps it in sync with `src/metrics/`.

### Public endpoint & abuse limits

`/api/upload` (and `/api/import-sheet`) are **public** — there is no API key, so both browser and machine uploads are allowed. Both share the same guards (in [`functions/ingest.ts`](./functions/ingest.ts)). Abuse is currently limited by:

- **Per-IP rate limit** (default 20 uploads/hour), counted in D1 ([`functions/ratelimit.ts`](./functions/ratelimit.ts)). The client IP (`CF-Connecting-IP`) is hashed with a salted SHA-256 before storage — **no raw IP is kept** — and rows are pruned to the active window. Over-limit requests get `429`. (`CF-Connecting-IP` is absent under local `wrangler pages dev`, so all local uploads share one bucket.)
- **Global cap** of 50 stored uploads (`MAX_UPLOADS`), returning `429` once full.
- **Max upload size** of 256 KB (`MAX_UPLOAD_BYTES`), returning `413` — checked early via `Content-Length`, again after reading the body, and on the client before posting.

These are interim measures. **Deleting** uploads is now restricted to admins (see [Admin area](#admin-area)); a moderation/holding queue is still planned — see [`doc/PLAN.md`](./doc/PLAN.md).

## Importing from a Google Sheet

As well as uploading YAML, an assessment can be imported straight from a public
**Google Sheet** that follows the AIRBDS scoring template. The **Upload
assessment (Google sheet)** button on the main page opens a form (hash-routed at
`#/import-sheet`) that takes:

- the **sheet URL** (or id) — the sheet must be shared *"anyone with the link"* so
  the public CSV export works;
- a **review date** (required) — the spreadsheet template has no review-date
  field, so it is supplied here;
- optional **reviewer initials** and **affiliation**.

Submitting POSTs `{ url, review_date, initials?, affiliation? }` to
`POST /api/import-sheet`. The browser cannot fetch the sheet itself (Google's CSV
export sends no CORS headers), so the **conversion runs server-side** in the
Function: it fetches the sheet's two tabs, converts them to the review format
using the shared [`@airbds/converter-tools`](https://github.com/AIBIO-UK/airbds-metric)
package (the same library the CLI uses), merges in the form fields, and then
ingests through the **same validation and storage path** as `POST /api/upload`.

Because `@airbds/converter-tools` pulls in `csv-parse` (which uses Node's
`Buffer`/`stream`), the Functions runtime needs the `nodejs_compat`
compatibility flag — set in [`wrangler.toml`](./wrangler.toml).

The metric version is read from the sheet itself — the "AIRBDS … Metric vX.Y"
label on its Instructions tab, via the converter's `detectSchemaVersion` — so the
one button imports both **v0.3** and **v0.4** sheets (the version is trusted from
the sheet, the score is not). The conversion to the converter `Metric` (question
ids + which are Ethics-scope) for that version is driven by
[`functions/metrics.ts`](./functions/metrics.ts), so no metric YAML is parsed in
the Functions bundle; a unit test keeps it in sync with `src/metrics/`.

### Errors reported back

The import only stores a **complete, scorable** assessment. Otherwise it responds
with the full list of problems so the reviewer can fix the sheet (or the form)
and import again, for example:

- `Review date is required.`
- `ACM-12: not answered.` / `ACM-7: answer "Maybe" is not "Yes" or "No".`
- `Dataset link/URL is missing from the sheet.`
- the converter's own fetch errors (sheet not shared, not a valid sheet id, or
  not following the template).

Status codes: `201` with the new entry (and any non-blocking `notices`, e.g.
blank optional fields) on success; `422` with `{ error, problems }` when the
sheet converted but is incomplete; `400` when the sheet can't be fetched/parsed
or the body is invalid; `429` when a rate-limit/cap guard trips.

## Admin area

Deleting uploads is an **admin-only** action. The public list (`/`) is read-only; an **Admin Area** button in the top-right of the header links to `/admin` — a separate page (its own Vite entry, so admin code never ships in the public bundle) that lists every upload with a delete (×) button.

Authentication is handled by **Cloudflare Access** at the edge — there is no login form or password in this app. `/admin` is protected by an Access policy (an allowlist of admin emails); navigating there triggers Access's own login (e.g. an email one-time PIN). Adding or removing an admin is an edit to that allowlist — no code change or deploy. `DELETE /api/entries/:id` independently verifies the Access JWT it receives ([`functions/auth.ts`](./functions/auth.ts)), so it is safe even if called directly, and returns `401` for anyone who isn't a verified admin. The `/admin` page being reachable is *not* what authorises deletion — the verified JWT is.

### Cloudflare Access setup (one-time)

1. In the Cloudflare **Zero Trust** dashboard, create a self-hosted **Access application** covering the admin paths — `https://<your-site>/admin*` and `https://<your-site>/api/entries/*` (the per-entry DELETE path).
2. Add a **policy** allowing your admin emails, with the login method you want (e.g. one-time PIN) and a **session duration** (e.g. 1 week — admins re-authenticate only when it lapses).
3. Note the application's **Audience (AUD) tag** and your Zero Trust **team domain**, and set them in [`wrangler.toml`](./wrangler.toml) as `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` (non-secret identifiers). Until both are set correctly, deletes fail closed (`401`).

The admin email allowlist lives in the Access policy (dashboard/Terraform), not in this repo.

### Local development

The Cloudflare Access edge isn't present under `wrangler pages dev`, so there is no Access JWT locally. To exercise the admin UI and deletes locally, set `ACCESS_DEV_BYPASS` in a `.dev.vars` file (copy [`.dev.vars.example`](./.dev.vars.example)); when set, [`functions/auth.ts`](./functions/auth.ts) treats every request as that admin. **Never** set this in production — it disables the auth check. The real email-PIN login can be verified end-to-end on a Cloudflare Pages **preview deployment**.

## Configuration

Cloudflare Pages configuration is kept in the repository as code in [`wrangler.toml`](./wrangler.toml) (project name, build output directory, compatibility date, the `DB` D1 database binding, and the non-secret Cloudflare Access vars `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` — see [Admin area](#admin-area)).

When this file is present it is the **source of truth** for the bindings and variables it defines — the equivalent Dashboard settings for those environments become read-only. Keep every required binding listed here, otherwise deployed Functions will lose access to them.

The Git connection, build command, and **secrets** are not stored in this file. Set secrets with `wrangler pages secret put <NAME>` or in the Dashboard under **Settings → Functions → Environment variables**.

## Local testing

```bash
# Install dependencies
npm install

# Build the frontend
npm run build

# Create the local D1 schema (one-off; stored under .wrangler/)
npx wrangler d1 execute auto-airbds --local --file=./schema.sql

# Start the local preview server (D1 binding comes from wrangler.toml)
npx wrangler pages dev dist

# In another terminal, upload the example assessment. It already carries a
# review_date, so it is accepted as-is; for files where review_date is blank the
# helper script fills in the current date and time before POSTing:
./scripts/test-yaml-upload-local.sh scripts/example-assessment-1.yaml

# Open http://localhost:8788 to view entries
```

The default port is `8788`. Use `--port <number>` to change it.

### Database (D1) setup

Uploads are stored in a Cloudflare D1 database named `auto-airbds`, bound as `DB` in [`wrangler.toml`](./wrangler.toml). The schema lives in [`schema.sql`](./schema.sql) — the `entries` table plus a `rate_limit` table used for per-IP upload throttling. Re-apply it after pulling changes that add tables (every statement is `IF NOT EXISTS`, so it's safe to re-run).

```bash
# Apply the schema locally (writes to .wrangler/)
npx wrangler d1 execute auto-airbds --local --file=./schema.sql

# Apply the schema to the remote (production) database
npx wrangler d1 execute auto-airbds --remote --file=./schema.sql

# List your D1 databases / ids
npx wrangler d1 list
```

If you recreate the database, update `database_id` under `[[d1_databases]]` in `wrangler.toml` to match (`npx wrangler d1 create auto-airbds` prints it).

### Test upload scripts

Scripts that upload an assessment YAML and report success (printing the file, review datetime, and new entry id) or the server's error message. They take the **path to the file to upload** as a required argument. If the file's `reviewer.review_date` is blank it is filled with the current date and time before upload, so uploads reflect when the script was invoked; a date already set in the file is left as-is.

```bash
# Against a local `wrangler pages dev` server (upload the example fixture)
./scripts/test-yaml-upload-local.sh scripts/example-assessment-1.yaml

# Upload a different assessment file
./scripts/test-yaml-upload-local.sh path/to/my-review.yaml

# Against the deployed site
./scripts/test-yaml-upload-online.sh scripts/example-assessment-1.yaml
```

## Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on changes)
npm run test:watch
```
