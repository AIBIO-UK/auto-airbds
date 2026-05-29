An experimental website for collecting, processing and publishing AI-performed AIRBDS assessments.

## Infrastructure

- **Cloudflare Pages** — hosting and serverless functions (Pages Functions) for the API endpoints (`POST /api/upload`, `GET /api/entries`, `DELETE /api/entries/:id`)
- **Cloudflare D1** — strongly-consistent SQLite database storing uploads, so new entries are visible to readers immediately
- **React** — frontend SPA built with TypeScript (polls `/api/entries` so uploads appear without a manual reload). The main page lists the assessments; clicking one opens a separate page (hash-routed at `#/entry/:id`, so deep links work without SPA-fallback config) showing a scoring-summary box and a per-question results table — or the raw JSON if the payload isn't a recognised assessment
- **Vite** — build tool and dev server (YAML metric files are imported via `@rollup/plugin-yaml`)

## Metric definitions

For a given AIRBDS metric version, each question's **theme**, **grade**, and **text** are fixed (e.g. `ACM-1` is always Access/Important, `ACM-4` is always License/Critical), as is its **score**: a `Yes` answer earns the full points for the question's grade (`grade_points`, e.g. Critical 80 / Important 5 / Optional 2) and a `No` scores 0. These are defined in [`src/metrics/`](./src/metrics/), one language-neutral YAML file per version named by version (`airbds-<version>.yaml`), and are the source of truth — the corresponding fields in uploaded assessments are ignored in favour of these.

The overall score shown in the summary is computed the same way and **not** taken from the uploaded `scoring_summary`: the actual score is the sum of points for the questions answered `Yes`, and the maximum is the total if every question were `Yes`.

The **grade** (e.g. Gold/Silver/Bronze/Caution) is also computed, not trusted from the payload. Each YAML file has a `grading` section (highest grade first) listing, per grade, a `min_proportion_yes` for each grade category and a `min_score`. A dataset earns the highest grade for which the proportion of `Yes` answers in every category is at least its minimum (compared with `>=`) and the total score is at least `min_score`. Editing the `grading` section re-grades without any code change.

[`src/metrics/index.ts`](./src/metrics/index.ts) registers each version and exposes `questionMeta(version, questionId)` (scope/theme/grade/text), `questionScore(version, questionId, answer)`, `questionMaxScore(version, questionId)`, `maxScore(version)`, and `computeGrade(version, answers)`; the assessment view uses them to display each question, the overall total, and the grade. Definitions are validated at load, so a malformed file fails loudly. To support a new version, add `airbds-<version>.yaml` and register it in `index.ts`.

## Configuration

Cloudflare Pages configuration is kept in the repository as code in [`wrangler.toml`](./wrangler.toml) (project name, build output directory, compatibility date, and the `DB` D1 database binding).

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

# In another terminal, upload JSON:
curl -X POST http://localhost:8788/api/upload \
  -H "Content-Type: application/json" \
  -H "X-API-Key: auto-airbds-dev-key" \
  -d '{"your":"json"}'

# Open http://localhost:8788 to view entries
```

The default port is `8788`. Use `--port <number>` to change it.

### Database (D1) setup

Uploads are stored in a Cloudflare D1 database named `auto-airbds`, bound as `DB` in [`wrangler.toml`](./wrangler.toml). The schema lives in [`schema.sql`](./schema.sql).

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

Scripts that upload `scripts/example-assessment-1.json` and report success or the server's error message. Each run rewrites the assessment's `assessment_timestamp` to the current time, so uploads reflect when the script was invoked:

```bash
# Against a local `wrangler pages dev` server
./scripts/test-json-upload-local.sh

# Against the deployed site
./scripts/test-json-upload-online.sh
```

## Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on changes)
npm run test:watch
```
