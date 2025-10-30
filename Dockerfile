# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Build TypeScript sources
RUN npm run build

# Remove development dependencies after build
RUN npm prune --omit=dev

FROM node:20-bullseye-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
