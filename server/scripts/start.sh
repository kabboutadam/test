#!/bin/sh
# Container entrypoint. In Postgres mode, sync the schema (and optionally seed)
# before starting the API. Memory mode starts immediately with no database.
set -e

if [ "$USE_PRISMA" = "true" ]; then
  echo "[start] USE_PRISMA=true — syncing schema with prisma db push"
  npx prisma db push --skip-generate
  if [ "$SEED_ON_START" = "true" ]; then
    echo "[start] SEED_ON_START=true — seeding demo data"
    npx prisma db seed || echo "[start] seed step failed (continuing)"
  fi
fi

echo "[start] launching API"
exec node dist/main.js
