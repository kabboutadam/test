# BusMapp API container. Build context is the server/ directory.
FROM node:20-alpine

# Prisma's query engine needs OpenSSL at runtime; the minimal Alpine image
# omits it, which crashes the app on its first database call. libc6-compat
# covers glibc-linked binaries.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install dependencies (incl. dev — Prisma CLI + ts-node are used at start for
# `db push` and optional seeding).
COPY package.json package-lock.json ./
RUN npm ci

# App source, Prisma schema, static dashboard.
COPY . .

# Generate the Prisma client and compile TypeScript.
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
# Platforms set PORT; main.ts reads it. 3000 is the local default.
EXPOSE 3000

CMD ["sh", "scripts/start.sh"]
