# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY apps/frontend/package*.json ./
RUN npm ci || npm install

# Copy source
COPY apps/frontend/ ./

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only the built app and minimal files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev || npm install --omit=dev

# Expose port and run
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["npm","run","start","--","-p","8080"]
