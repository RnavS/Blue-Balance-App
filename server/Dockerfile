# Production image for the Blue Balance API.
# Build context is the server/ directory:
#   docker build -t blue-balance-api ./server

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

# Install with dev dependencies so TypeScript is available to compile.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Runtime dependencies only. PGlite is a devDependency, so the embedded-Postgres
# fallback cannot be reached here even by accident — production requires a real
# DATABASE_URL and config.ts throws without one.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# ensureSchema() reads ./drizzle at startup, so the migrations ship with the image.
COPY drizzle ./drizzle

# Don't run as root.
USER node

# Hosts that inject PORT (Render, Railway, Fly) override this.
ENV PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
