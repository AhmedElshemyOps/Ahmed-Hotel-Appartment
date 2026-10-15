FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run lint && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production APP_MODE=cloud PORT=8080
WORKDIR /app
# tsx is retained for the typed server and migration entrypoints.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/server.ts ./
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src/types ./src/types
COPY --from=build --chown=node:node /app/src/services ./src/services
COPY --from=build --chown=node:node /app/src/market ./src/market
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "server.ts"]
