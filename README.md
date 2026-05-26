An experimental website for collecting, processing and publishing AI-performed AIRBDS assessments.

## Infrastructure

- **Cloudflare Pages** — hosting and serverless functions (Pages Functions) for the API endpoints (`POST /api/upload`, `GET /api/entries`)
- **Cloudflare KV** — persistent key-value store shared across all function instances
- **React** — frontend SPA built with TypeScript
- **Vite** — build tool and dev server

## Configuration

Cloudflare Pages configuration is kept in the repository as code in [`wrangler.toml`](./wrangler.toml) (project name, build output directory, compatibility date, and the `UPLOADS` KV namespace binding).

When this file is present it is the **source of truth** for the bindings and variables it defines — the equivalent Dashboard settings for those environments become read-only. Keep every required binding listed here, otherwise deployed Functions will lose access to them.

The Git connection, build command, and **secrets** are not stored in this file. Set secrets with `wrangler pages secret put <NAME>` or in the Dashboard under **Settings → Functions → Environment variables**.

## Local testing

```bash
# Install dependencies
npm install

# Build the frontend
npm run build

# Start the local preview server with KV support (includes API functions)
npx wrangler pages dev dist --kv=UPLOADS

# In another terminal, upload JSON:
curl -X POST http://localhost:8788/api/upload \
  -H "Content-Type: application/json" \
  -H "X-API-Key: auto-airbds-dev-key" \
  -d '{"your":"json"}'

# Open http://localhost:8788 to view entries
```

The default port is `8788`. Use `--port <number>` to change it.

For local development with KV, start the server with:
```bash
npx wrangler pages dev dist --kv=UPLOADS
```

### Production KV setup

The `UPLOADS` binding is declared in [`wrangler.toml`](./wrangler.toml) and points at the `auto-airbds` KV namespace, so no manual Dashboard binding is required. If you ever recreate the namespace, update the `id` under `[[kv_namespaces]]` to match. List your namespace ids with:

```bash
npx wrangler kv namespace list
```

### Test upload scripts

Scripts that upload `scripts/example-assessment-1.json` and report success or the server's error message:

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
