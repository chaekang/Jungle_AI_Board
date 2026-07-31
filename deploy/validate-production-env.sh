#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
REQUIRED_VARS=(
  DOMAIN
  NEST_ENV_FILE
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  JWT_SECRET
  GOOGLE_OAUTH_STATE_SECRET
  OPENAI_API_KEY
)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi

chmod 600 "$ENV_FILE"

for name in "${REQUIRED_VARS[@]}"; do
  value="$(sed -n "s/^${name}=//p" "$ENV_FILE" | tail -n 1)"
  if [[ -z "$value" || "$value" == replace-me || "$value" == replace-with-* ]]; then
    echo "Production environment variable $name is missing or still a placeholder." >&2
    exit 1
  fi
done

echo "Production environment is valid."
