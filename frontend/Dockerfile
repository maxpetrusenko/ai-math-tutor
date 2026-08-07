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

ARG NEXT_PUBLIC_SESSION_WS_URL=wss://aitutor-session.maxpetrusenko.com/ws/session
ARG NERDY_FRONTEND_REVISION
ARG NERDY_FRONTEND_SERVICE

ENV NEXT_PUBLIC_SESSION_WS_URL=$NEXT_PUBLIC_SESSION_WS_URL
ENV NERDY_FRONTEND_REVISION=$NERDY_FRONTEND_REVISION
ENV NERDY_FRONTEND_SERVICE=$NERDY_FRONTEND_SERVICE

RUN pnpm build

FROM node:22-slim

ARG NERDY_FRONTEND_REVISION
ARG NERDY_FRONTEND_SERVICE

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NERDY_FRONTEND_REVISION=$NERDY_FRONTEND_REVISION
ENV NERDY_FRONTEND_SERVICE=$NERDY_FRONTEND_SERVICE

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
