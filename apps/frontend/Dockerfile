# Dockerfile for frontend service
FROM node:20-alpine

WORKDIR /app

# Copy only frontend package manifests, install deps
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy app sources
COPY . ./

# Build Next.js
ENV NEXT_PUBLIC_DEPLOYMENT_ENV=production
RUN npm run build

EXPOSE 3000
CMD [ "npm", "start" ]
