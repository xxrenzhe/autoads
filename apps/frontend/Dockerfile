# Build stage
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Environment for reproducible and faster builds
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096 \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# Install production dependencies for frontend workspace only
COPY package*.json ./
COPY apps/frontend/package*.json apps/frontend/
# Install all dependencies (including dev) for build-time tools like Tailwind/PostCSS
RUN npm ci --workspace=apps/frontend --no-audit --no-fund || \
    npm install -w apps/frontend --no-audit --no-fund

# Production dependencies stage (smaller runtime deps)
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
COPY package*.json ./
COPY apps/frontend/package*.json apps/frontend/
RUN npm ci --workspace=apps/frontend --omit=dev --no-audit --no-fund || \
    npm install -w apps/frontend --omit=dev --no-audit --no-fund

# Copy source and build (workspace-aware)
COPY apps/frontend/ apps/frontend/
RUN npm run -w apps/frontend build

# Runtime stage
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

### Copy standalone output for the frontend workspace
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
# Next.js 15 standalone doesn't include Next runtime; copy production node_modules only
COPY --from=prod-deps /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node","server.js"]
