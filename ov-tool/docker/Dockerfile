# Mehrstufiger Build für den Dienst "app" (docker-compose.yml)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Prisma-CLI mit allen Abhängigkeiten separat installieren (im Standalone-Output fehlen u. a. "effect", "c12")
RUN npm install --prefix /opt/prisma-cli --no-save --no-audit --no-fund prisma@$(node -p "require('./node_modules/prisma/package.json').version")

FROM node:22-bookworm-slim AS run
WORKDIR /app
# Chromium für die PDF-Erzeugung (Einladungen, Protokolle), tini für sauberes Beenden
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates chromium fonts-dejavu-core tini \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    CHROMIUM_PATH=/usr/bin/chromium FILE_STORAGE_PATH=/data/files
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/templates ./templates
# Prisma-Client (generiert) und Prisma-CLI für "migrate deploy" beim Start
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /opt/prisma-cli /opt/prisma-cli
RUN mkdir -p /data/files && chown -R node:node /data
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]
