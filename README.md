An experimental website for collecting, processing and publishing AI-performed AIRBDS assessments.

## Infrastructure

- **Cloudflare Pages** — hosting and serverless functions (Pages Functions) for the API endpoints (`POST /api/upload`, `GET /api/entries`)
- **React** — frontend SPA built with TypeScript
- **Vite** — build tool and dev server

In-memory storage: entries persist across requests within a warm worker instance but are lost on cold start or redeploy.

## Local testing

```bash
# Install dependencies
npm install

# Build the frontend
npm run build

# Start the local preview server (includes API functions)
npm run pages:dev

# In another terminal, upload JSON:
curl -X POST http://localhost:8788/api/upload \
  -H "Content-Type: application/json" \
  -H "X-API-Key: auto-airbds-dev-key" \
  -d '{"your":"json"}'

# Open http://localhost:8788 to view entries
```

The default port is `8788`. Use `--port <number>` to change it.

A test upload script is available at `scripts/test-upload.sh`:

```bash
./scripts/test-upload.sh
```

## Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on changes)
npm run test:watch
```
