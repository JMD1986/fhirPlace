# ── Build stage: install production deps only ─────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy production node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy server source and Synthea FHIR data
COPY server.js ./
COPY public/synthea ./public/synthea

EXPOSE 5001

# Tighten permissions — run as non-root for HIPAA/SOC 2 hardening
USER node

CMD ["node", "server.js"]
