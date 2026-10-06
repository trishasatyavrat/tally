# syntax=docker/dockerfile:1
# Three stages so the image that runs carries nothing it does not need:
#   deps  - node_modules from the lockfile
#   build - generate the Prisma client, compile Next.js
#   run   - only the standalone server, static assets, and a non-root user
# Next's "standalone" output (next.config.ts) traces exactly which files
# the server imports and copies them into .next/standalone with its own
# server.js - no node_modules directory, no source.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate reads prisma.config.ts, which reads DATABASE_URL. No
# database is contacted at build time - every page that touches the
# database is force-dynamic - so a placeholder URL is enough here. The
# real one arrives at run time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER app
EXPOSE 3000
# Run migrations separately (`npx prisma migrate deploy` against the same
# DATABASE_URL) before starting the container; the image has no Prisma CLI.
CMD ["node", "server.js"]
