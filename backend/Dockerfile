FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build || true

# ── Agente de Impresión: compila el .exe (Windows) que sirve el botón "Descargar programa".
# La URL del servidor queda "quemada" en el agente; se puede fijar con el build-arg
# PRINT_AGENT_API si el dominio de producción no es el de por defecto.
# pkg descarga el binario base de Node para Windows (requiere red durante el build). Si falla,
# NO rompe la imagen: /print-agent/download responderá 503 hasta que exista el .exe.
ARG PRINT_AGENT_API=https://daimuz.com/api
RUN mkdir -p /app/assets \
 && sed -i "s|https://daimuz.alexsters.works/api|${PRINT_AGENT_API}|" print-agent-app/index.js \
 && npm install -g pkg@5.8.1 \
 && ( pkg print-agent-app --targets node18-win-x64 --output /app/assets/print-agent.exe \
      || echo "WARN: no se pudo compilar print-agent.exe; /print-agent/download dara 503" )

# ── Imagen final (solo producción) ──
FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production --legacy-peer-deps

COPY --from=builder /app/dist ./dist
# Los .sql del baseline/migraciones NO los compila tsc → copiarlos junto al
# migrador compilado (dist/db/migrate.js los busca en ./migrations relativo a sí).
COPY --from=builder /app/src/db/migrations ./dist/db/migrations
# Binario del Agente de Impresión (lo sirve GET /print-agent/download desde /app/assets).
COPY --from=builder /app/assets ./assets

EXPOSE 3001

# Aplica migraciones (usa el migrador de runtime de drizzle-orm, que SÍ está en
# producción; auto-marca el baseline si la BD ya existía) y luego arranca el server.
# Si la migración falla, el server NO arranca (evita correr con esquema inconsistente).
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
