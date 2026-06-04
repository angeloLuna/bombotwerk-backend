# Phase 1: Build
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package configurations and prisma schema first for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy all source files
COPY . .

# Generate the Prisma client
RUN npx prisma generate

# Compile TypeScript to JavaScript (creates /app/dist)
RUN npm run build

# Phase 2: Runtime (Production)
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy package configurations and prisma schema for production dependencies
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies (excludes devDependencies)
RUN npm ci --omit=dev && npm cache clean --force

# Re-generate the Prisma client in the clean production node_modules
RUN npx prisma generate

# Copy only compiled application code from the builder phase
COPY --from=builder /app/dist ./dist

# Expose NestJS backend port
EXPOSE 4000

# Start NestJS backend application
CMD ["node", "dist/main.js"]
