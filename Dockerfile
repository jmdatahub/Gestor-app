# syntax=docker/dockerfile:1.7

# ─── Builder: install deps + build client ─────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

ARG VITE_API_URL
ARG VITE_APP_URL

# Cache server dep layer — only re-runs when package files change.
# Full npm ci (with scripts) is needed for native addons like bcrypt.
COPY package.json package-lock.json ./
RUN npm ci

# Cache client dep layer — only re-runs when client package files change.
# No native addons in the client, so --ignore-scripts is safe and faster.
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --ignore-scripts

COPY . .
RUN cd client && VITE_API_URL=$VITE_API_URL VITE_APP_URL=$VITE_APP_URL npm run build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime
WORKDIR /app

# Create a non-root user and group for security
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

ENV NODE_ENV=production

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.json ./
COPY --from=builder --chown=appuser:appgroup /app/server ./server
COPY --from=builder --chown=appuser:appgroup /app/client/dist ./dist/client

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["./node_modules/.bin/tsx", "server/index.ts"]
