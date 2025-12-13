# ========================================
# Optimized Multi-Stage Dockerfile
# Express + TypeScript + Postgres backend
# ========================================

ARG NODE_VERSION=24.11.1-alpine
FROM node:${NODE_VERSION} AS base

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

# ========================================
# Dependencies Stage (production deps only)
# ========================================
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev && \
    npm cache clean --force

RUN chown -R nodejs:nodejs /app

# ========================================
# Build Dependencies Stage (all deps incl dev)
# ========================================
FROM base AS build-deps

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund && \
    npm cache clean --force

RUN chown -R nodejs:nodejs /app

# ========================================
# Build Stage (compile TypeScript)
# ========================================
FROM build-deps AS build

# Copy the rest of the source (respects .dockerignore)
COPY --chown=nodejs:nodejs . .

# Build the application (TypeScript -> dist)
RUN npm run build

RUN chown -R nodejs:nodejs /app

# ========================================
# Development Stage
# Used by compose develop.watch
# ========================================
FROM build-deps AS development

ENV NODE_ENV=development \
    NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app
COPY . .

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Run your dev script (tsx watch) inside the container
CMD ["npm", "run", "dev"]

# ========================================
# Production Stage
# ========================================
FROM node:${NODE_VERSION} AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

# Set optimized environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256 --no-warnings" \
    NPM_CONFIG_LOGLEVEL=silent

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package*.json ./

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 3000

# Start production server
CMD ["node", "dist/index.js"]