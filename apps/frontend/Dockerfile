# Build stage
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install dependencies
COPY apps/frontend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline || npm install --omit=dev --no-audit --no-fund

# Copy source
COPY apps/frontend/ ./

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
ENV CI=true PUPPETEER_SKIP_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm run build

# Runtime stage
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

### Copy standalone output & static assets
# Next standalone output contains server.js and minimal node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose port and run
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["node","server.js"]
