FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_SESSION_WS_URL
RUN if [ -z "$NEXT_PUBLIC_SESSION_WS_URL" ]; then \
      echo "NEXT_PUBLIC_SESSION_WS_URL must be set for frontend image builds" >&2; \
      exit 1; \
    fi; \
    case "$NEXT_PUBLIC_SESSION_WS_URL" in \
      ws://*|wss://*) ;; \
      *) echo "NEXT_PUBLIC_SESSION_WS_URL must start with ws:// or wss://" >&2; exit 1 ;; \
    esac

ENV NEXT_PUBLIC_SESSION_WS_URL=$NEXT_PUBLIC_SESSION_WS_URL

RUN pnpm build

FROM node:22-slim

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ARG NEXT_PUBLIC_SESSION_WS_URL
ENV NEXT_PUBLIC_SESSION_WS_URL=$NEXT_PUBLIC_SESSION_WS_URL

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
