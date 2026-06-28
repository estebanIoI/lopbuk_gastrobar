FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build || true

# ── Imagen final (solo producción) ──
FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production --legacy-peer-deps

COPY --from=builder /app/dist ./dist
# Los .sql del baseline/migraciones NO los compila tsc → copiarlos junto al
# migrador compilado (dist/db/migrate.js los busca en ./migrations relativo a sí).
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

EXPOSE 3001

# Aplica migraciones (usa el migrador de runtime de drizzle-orm, que SÍ está en
# producción; auto-marca el baseline si la BD ya existía) y luego arranca el server.
# Si la migración falla, el server NO arranca (evita correr con esquema inconsistente).
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
