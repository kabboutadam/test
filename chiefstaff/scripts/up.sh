#!/usr/bin/env bash
# One command to run the whole thing on a Mac: database, schema, demo data,
# web server on port 3000. Safe to run every morning.
set -euo pipefail
cd "$(dirname "$0")/.."

# Docker's CLI is not always on PATH in a terminal opened before it was installed.
DOCKER="$(command -v docker || true)"
if [ -z "$DOCKER" ] && [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
  DOCKER=/Applications/Docker.app/Contents/Resources/bin/docker
fi
if [ -z "$DOCKER" ]; then
  echo "Docker Desktop is not installed. Get it from https://www.docker.com/products/docker-desktop/ and open it once." >&2
  exit 1
fi
if ! "$DOCKER" info >/dev/null 2>&1; then
  echo "Docker Desktop is installed but not running. Open it from Applications and wait for the whale to settle, then run this again." >&2
  open -a Docker 2>/dev/null || true
  exit 1
fi

[ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example (edit it to add keys later)."; }

echo "▸ database"
"$DOCKER" compose up -d
for i in $(seq 1 30); do "$DOCKER" compose exec -T db pg_isready -U chief >/dev/null 2>&1 && break; sleep 1; done

echo "▸ schema"
npx prisma db push --skip-generate >/dev/null
echo "▸ demo data"
npm run -s seed

# Anything still holding port 3000 from an earlier run gets out of the way,
# so the address is always the same one.
lsof -ti :3000 | xargs kill 2>/dev/null || true

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")"
echo
echo "  Web:    http://localhost:3000"
[ -n "$IP" ] && echo "  Phone:  http://$IP:3000   (Settings → Link your phone, then scan the QR)"
echo
exec npm run -s dev
