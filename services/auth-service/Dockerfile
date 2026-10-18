# auth-service image. Build from the services/ directory so the shared library is included:
#   docker build -f auth-service/Dockerfile -t hfa/auth-service .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY auth-service/package.json auth-service/
COPY user-service/package.json user-service/
COPY pharmacy-service/package.json pharmacy-service/
COPY payment-service/package.json payment-service/
COPY admin-service/package.json admin-service/
# Production dependencies for this service only (plus the shared workspace it uses).
RUN npm ci --omit=dev --workspace @hfa/auth-service --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production PORT=4001
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY shared/package.json shared/
COPY shared/src shared/src
COPY auth-service/package.json auth-service/
COPY auth-service/src auth-service/src
COPY auth-service/migrations auth-service/migrations
# Run as the unprivileged "node" user; the service listens on an internal port only.
USER node
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:4001/api/v1/health || exit 1
CMD ["node", "auth-service/src/index.js"]
