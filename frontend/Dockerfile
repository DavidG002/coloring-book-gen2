FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* variables are baked in at build time, not read at
# container start — passed through so `docker-compose build` produces a
# build that already points at the right backend URL.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# AUTH_SECRET is a runtime-only value in production (supplied via
# frontend/.env.local's env_file at container start — see docker-compose.yml).
# But `next build` statically evaluates auth.ts while collecting route info
# for /api/auth/[...nextauth], and that file throws if AUTH_SECRET is unset.
# This placeholder only needs to be non-empty to satisfy that check at build
# time — it's never used to sign anything for real, so there's no reason to
# pass the actual secret in as a build arg (which would also bake it into
# the image's layer history unnecessarily).
ARG AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV AUTH_SECRET=${AUTH_SECRET}
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# next.config.ts sets output: "standalone", which produces a minimal,
# self-contained server (no need to copy node_modules or the full
# source tree into the final image).
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
