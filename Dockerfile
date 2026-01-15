# Multi-stage Dockerfile for production deployment
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend for production
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install backend dependencies
RUN npm ci

# Copy backend source
COPY backend/src ./src
COPY backend/schema.sql ./
COPY backend/init-db.js ./

# Build backend TypeScript
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS production

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled backend from builder
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/schema.sql ./
COPY --from=backend-builder /app/backend/init-db.js ./

# Copy frontend build artifacts to public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Set production environment
ENV NODE_ENV=production

# Expose port (Fly.io will set this via env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
