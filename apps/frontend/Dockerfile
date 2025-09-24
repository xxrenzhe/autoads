# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci

# Copy source
COPY apps/frontend/ ./

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only the built app and minimal files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install production dependencies only
RUN npm ci --omit=dev

# Expose port and run
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["npm","run","start","--","-p","8080"]
