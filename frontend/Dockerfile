FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG FIREBASE_WEBAPP_CONFIG
ARG NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG
ARG NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH
ARG NEXT_PUBLIC_SESSION_WS_URL

ENV FIREBASE_WEBAPP_CONFIG=$FIREBASE_WEBAPP_CONFIG
ENV NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG=$NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG
ENV NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH=$NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH
ENV NEXT_PUBLIC_SESSION_WS_URL=$NEXT_PUBLIC_SESSION_WS_URL

RUN pnpm build

FROM node:22-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
