#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="https://auto-airbds.pages.dev/api/upload"

# Stamp the assessment with the current UTC date and time as its review date, so
# each upload reflects when the script was run rather than leaving it blank.
# (review_date accepts a date or a full timestamp; a human reviewer might give
# only a date.)
now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
payload="$(sed -E "s/(review_date:[[:space:]]*\")[^\"]*\"/\1${now}\"/" \
  "${SCRIPT_DIR}/example-assessment-1.yaml")"

# Capture the response body and append the HTTP status code on the final line.
response="$(curl -sS -X POST "$URL" \
  -H "Content-Type: application/yaml" \
  -H "X-API-Key: auto-airbds-dev-key" \
  --data-binary "$payload" \
  -w $'\n%{http_code}')"

status="${response##*$'\n'}"
body="${response%$'\n'*}"

if [[ "$status" =~ ^2 ]]; then
  echo "Upload succeeded (HTTP $status)."
  echo "Review datetime: $now"
  if id="$(printf '%s' "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)" && [[ -n "$id" ]]; then
    echo "Entry id: $id"
  fi
else
  echo "Upload failed (HTTP $status): $body" >&2
  exit 1
fi
