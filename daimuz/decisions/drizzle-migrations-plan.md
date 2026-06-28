# Plan — Migrar a Drizzle Kit (schema-as-history) sin romper producción

> Fecha: 2026-06-27
> Stack objetivo: Express + mysql2 + MySQL/MariaDB (multi-tenant).
> Principio: pasar de **schema-on-runtime** (DDL embebido en TS) a
> **schema-as-history** (migraciones versionadas, una sola fuente de verdad).
> Driver `mysql2` y todo el SQL raw existente SE QUEDAN. No hay big-bang rewrite.

---

## 0. Estado actual (diagnóstico)

- DDL repartido en 3 lugares, sin fuente única:
  - `backend/inventarioEsteban_v3_multitenant.sql` (base) + `backend/schema_FULL.sql` (consolidado).
  - `backend/src/migrations/*.sql` (13 archivos, idempotentes, MariaDB).
  - **DDL embebido en TypeScript** que corre al arrancar / por request:
    - `src/index.ts` → **80** `CREATE TABLE IF NOT EXISTS` + ALTERs inline.
    - `ensureTable()` dentro de handlers (corren EN CADA REQUEST):
      `portfolio.routes.ts`, `loyalty.routes.ts`, `restbar-qr.routes.ts`,
      `storefront.routes.ts`, `lopbuk-landing.service.ts`, `tenants.service.ts`.
- Consecuencias ya observadas: no se puede regenerar la BD de cero de forma fiable;
  `CREATE TABLE IF NOT EXISTS` no aplica cambios en tablas viejas (drift silencioso);
  `ADD COLUMN IF NOT EXISTS` amarra a MariaDB.
- Conexión: `src/config/database.ts` (pool `mysql2/promise`, env en `src/config/env`).

---

## 1. Decisiones

- **Drizzle Kit** para migraciones versionadas + **Drizzle ORM** (uso parcial, gradual).
- Se mantiene `mysql2` y el SQL raw; Drizzle convive (`db.execute(sql\`...\`)`).
- **Baseline por introspección**: la verdad inicial se captura de una BD ya provisionada
  (no se reescribe a mano), para incluir TODO —las 80 tablas de `index.ts`, las 52
  de runtime y las 13 migraciones.
- `schema_FULL.sql` deja de ser fuente de verdad → pasa a **snapshot/export**.
- Validación con **Zod** en los endpoints nuevos (input), independiente de Drizzle.

## 2. Estructura objetivo

```
backend/src/db/
  schema/            # tablas en TS (typing + fuente para generate)
    users.ts workouts.ts community.ts ... (se va llenando gradual)
  migrations/        # historial versionado (out de drizzle-kit)
    0000_baseline.sql
    0001_xxx.sql
    meta/_journal.json
  index.ts           # cliente drizzle sobre el pool mysql2 existente
  migrate.ts         # runMigrations() para el bootstrap
drizzle.config.ts
```

## 3. drizzle.config.ts (reutiliza tu env)

```ts
import { defineConfig } from 'drizzle-kit'
import { config } from './src/config/env'
export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema',
  out: './src/db/migrations',
  dbCredentials: {
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password, database: config.db.database,
  },
})
```

`src/db/index.ts`:
```ts
import { drizzle } from 'drizzle-orm/mysql2'
import pool from '../config/database'   // reusa el MISMO pool
export const db = drizzle(pool)
```

---

## FASE 1 — Baseline sin tocar prod (≈ 1 día)

Objetivo: tener el historial de migraciones arrancando desde el estado REAL actual,
sin recrear nada en bases existentes.

1. **Instalar**
   ```
   cd backend
   npm i drizzle-orm
   npm i -D drizzle-kit
   ```
2. **Provisionar una BD "verdad"** (entorno limpio, NO prod):
   - crear BD vacía → `mysql ... < schema_FULL.sql`
   - arrancar el backend UNA vez (autocrea las tablas de runtime: las 80 de
     `index.ts` + las 52 de servicios). Ahora esa BD tiene el esquema completo.
3. **Introspección → baseline**:
   ```
   npx drizzle-kit pull      # genera src/db/schema/*.ts + 0000 + meta a partir de la BD real
   ```
   Esto produce el `0000_baseline` = fuente de verdad inicial (todo incluido).
4. **Marcar bases EXISTENTES como ya migradas** (prod/staging ya tienen las tablas):
   - crear la tabla de control y registrar el baseline como aplicado, **sin** ejecutar su SQL,
     para que `migrate()` no intente recrear. (Insertar la entrada del 0000 en
     `__drizzle_migrations` con su hash del `meta/_journal.json`.)
   - En entornos NUEVOS no se hace este paso: `migrate()` corre 0000 y crea todo.
5. **Runner en el bootstrap** (`src/db/migrate.ts`):
   ```ts
   import { migrate } from 'drizzle-orm/mysql2/migrator'
   import { db } from './index'
   export const runMigrations = () => migrate(db, { migrationsFolder: './src/db/migrations' })
   ```
   En `index.ts`: `await runMigrations()` ANTES de `app.listen(...)`.

Entregable Fase 1: BD nueva reproducible 1:1, prod intacta, historial iniciado.

---

## FASE 2 — Congelar el DDL en runtime (la deuda crítica)

Regla nueva (gobernanza): **PROHIBIDO** `CREATE TABLE` / `ALTER TABLE` en runtime.
Todo cambio de esquema = nueva migración.

Pasos:
1. **Sacar `ensureTable()` del camino de requests** (lo más urgente):
   `portfolio.routes.ts`, `loyalty.routes.ts`, `restbar-qr.routes.ts`,
   `storefront.routes.ts`, `lopbuk-landing.service.ts`, `tenants.service.ts`.
   → su DDL ya está en el baseline; eliminar las llamadas (o dejar no-op).
2. **Migrar el bloque inline de `index.ts`** (80 CREATE + ALTERs) → ya está capturado
   en el baseline; eliminar/neutralizar ese bloque tras confirmar paridad.
3. A partir de aquí, cualquier columna/tabla nueva:
   ```
   # editas src/db/schema/*.ts y luego:
   npx drizzle-kit generate    # crea 000N_*.sql (ALTER real, sin IF NOT EXISTS)
   npx drizzle-kit migrate     # aplica
   ```

---

## FASE 3 — Módulos nuevos nacen en Drizzle

`lopbuk-landing`, billing/subscriptions, analytics, AI memory, etc.: definir su tabla en
`src/db/schema/*.ts`, generar migración, y usar `db` para sus queries. Sin `ensureTable`.

## FASE 4 — Refactor gradual (opcional, solo si aporta)

Reemplazar queries `pool.query(...)` por Drizzle por módulo, cuando se toquen. Nunca big-bang.

---

## schema_FULL.sql — nuevo rol

- Ya NO es fuente de verdad. Se conserva como **snapshot** histórico.
- El "esquema completo" se regenera cuando se necesite con `mysqldump --no-data` o
  `drizzle-kit pull`. Las 13 migraciones `src/migrations/*.sql` pueden archivarse una
  vez el baseline esté validado (quedan representadas en el 0000).

## Gobernanza (actualizar CLAUDE.md / daimuz/governance)

- "El esquema vive en `src/db/schema` + `src/db/migrations`. Prohibido DDL en runtime."
- "Cambios de esquema: `drizzle-kit generate` → revisar el `.sql` → `migrate`."

## Riesgos y mitigaciones

- **Recrear tablas en prod** → mitigado por el paso 4 (marcar baseline aplicado).
- **MariaDB vs MySQL** → Drizzle genera ALTER estándar; el baseline por introspección
  evita los `IF NOT EXISTS`. Fijar el motor objetivo en `drizzle.config`.
- **Paridad del baseline** → comparar `drizzle-kit pull` de prod vs de la BD nueva antes
  de borrar el DDL inline (diff de tablas/columnas).
- **FKs/orden** → drizzle-kit ordena; revisar el 0000 generado.

## Checklist de corte
- [x] BD nueva desde 0000 = idéntica a la verdad (149 tablas + 6 vistas + 179 FKs, diff 0). ✅ 2026-06-27
- [x] BD existente marcada como migrada (dev `stockpro_db`: `migrate()` salta, delta 0). Prod: correr `src/db/baseline-mark-applied.sql`. ✅ script listo
- [x] `ensureTable()` fuera de requests; bloque DDL de `index.ts` neutralizado. ✅ 2026-06-27 (FASE 2)
      Baseline recapturado COMPLETO (201 tablas / 2672 cols, antes faltaban 52 tablas). DDL de
      runtime excisado/congelado en `index.ts` + 10 archivos. `tsc` 0 errores; boot real OK.
- [x] `runMigrations()` corre en el arranque, antes de escuchar (gate `NODE_ENV !== 'production'`). ✅
- [x] Documentado el flujo generate→migrate en CLAUDE.md. ✅

---

## ✅ FASE 1 — COMPLETADA (2026-06-27)

**Entorno:** MySQL 8.4.3 (Laragon, puerto 3306, root sin password). Cliente:
`D:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe`.

**Artefactos creados/validados:**
- `backend/src/db/` — `index.ts`, `migrate.ts`, `schema/{schema,relations,index}.ts`,
  `migrations/0000_quiet_swarm.sql` + `meta/`, `baseline-mark-applied.sql`.
- `drizzle.config.ts` — usa `url` (password vacío) y `schema` apunta a los archivos
  explícitos (no la carpeta) para no duplicar las vistas.

**Decisiones de implementación (no estaban en el plan original):**
1. **BD verdad = `stockpro_truth`** (no se usó la dev `stockpro_db`, que estaba
   incompleta: faltaban 56 tablas de módulos). Cargada desde `schema_FULL.sql` con
   ajustes MySQL: quitar `USE`/`CREATE DATABASE` internos, `ADD COLUMN IF NOT EXISTS`
   → `ADD COLUMN`. Los errores de backfill sobre `order_items`/`sale_items` son no-ops
   (columnas inexistentes en el esquema final).
2. **Baseline híbrido** — el `.sql` ejecutable conserva los nombres de FK cortos
   nativos de MySQL (`_ibfk_N`), mientras el snapshot/`schema.ts` usan los canónicos
   de drizzle. Motivo: 5 FKs canónicos superan los 64 chars de MySQL y rompen el
   `migrate`. Así el `generate` queda limpio y el SQL ejecutado nunca usa nombres
   largos. (No se pudo nombrar esas 5 FK con `foreignKey({name})` por forward-refs.)
3. **Vistas** — drizzle hardcodea el nombre de la BD origen en las vistas; se quitó
   el qualifier `stockpro_truth` del `.sql` para portabilidad. El bug de codegen
   `.default(')` en la columna computada `stock_status` se corrigió a mano.

**Marcado:** `__drizzle_migrations` — hash `acb1633a673f14dfa233043376b8f64ed880044881f29522eb9ea227c6831ccf`,
created_at `1782567439458` (= `_journal.json` del tag `0000_quiet_swarm`).
