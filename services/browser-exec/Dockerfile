# Minimal Cloud Run image
FROM mcr.microsoft.com/playwright:v1.47.0-jammy
WORKDIR /srv
COPY services/browser-exec/package.json ./
RUN npm i --omit=dev && npx playwright install --with-deps chromium
COPY services/browser-exec/ ./
ENV NODE_ENV=production
ENV PLAYWRIGHT=1
EXPOSE 8080
CMD ["node","index.js"]
