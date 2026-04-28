# syntax=docker/dockerfile:1.7

# ─── Builder: install deps + build client ─────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

ARG VITE_API_URL
ARG VITE_APP_URL

# Install root (server) deps
COPY package.json package-lock.json ./
RUN npm ci

# Install client deps and build
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY . .
RUN VITE_API_URL=$VITE_API_URL VITE_APP_URL=$VITE_APP_URL cd client && npm run build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./dist/client

EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]
