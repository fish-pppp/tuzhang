# Production image for a China-reachable VPS (Hong Kong / Singapore / Japan, or
# a mainland host after ICP filing). Build: docker compose -f docker-compose.prod.yml build
#
# Vercel deploys do not use this file; they keep the Nitro `vercel` preset.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Hide Google / X on the login page — those sites are usually unreachable in CN.
ARG VITE_SHOW_OAUTH=false
ENV VITE_SHOW_OAUTH=$VITE_SHOW_OAUTH
ENV NITRO_PRESET=node-server
# Image build has no Postgres; migrate at container start instead.
RUN npx vite build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV TUZHANG_SELF_HOST=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.output ./.output
COPY migrations ./migrations
COPY scripts/migrate.mjs scripts/migrate.mjs
COPY scripts/start-prod.mjs scripts/start-prod.mjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=25s --retries=8 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-prod.mjs"]
