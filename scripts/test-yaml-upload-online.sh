#!/usr/bin/env bash
set -euo pipefail

URL="https://auto-airbds.pages.dev/api/upload"

# Assessment YAML file to upload (required).
if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <assessment.yaml>" >&2
  exit 1
fi
FILE="$1"
if [[ ! -f "$FILE" ]]; then
  echo "No such file: $FILE" >&2
  exit 1
fi

# If review_date is blank, fill it with the current UTC date and time so the
# upload reflects when the script was run. A review_date already set in the file
# (e.g. a human reviewer's date) is left untouched.
now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
payload="$(sed -E "s/(review_date:[[:space:]]*\")\"/\1${now}\"/" "$FILE")"
review_date="$(printf '%s' "$payload" \
  | sed -nE 's/^[[:space:]]*review_date:[[:space:]]*"([^"]*)".*/\1/p' | head -n1)"

# Capture the response body and append the HTTP status code on the final line.
response="$(curl -sS -X POST "$URL" \
  -H "Content-Type: application/yaml" \
  --data-binary "$payload" \
  -w $'\n%{http_code}')"

status="${response##*$'\n'}"
body="${response%$'\n'*}"

if [[ "$status" =~ ^2 ]]; then
  echo "Upload succeeded (HTTP $status)."
  echo "Uploaded file: $FILE"
  echo "Review datetime: $review_date"
  if id="$(printf '%s' "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)" && [[ -n "$id" ]]; then
    echo "Entry id: $id"
  fi
else
  echo "Upload failed (HTTP $status): $body" >&2
  exit 1
fi
