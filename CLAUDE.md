# CLAUDE.md — Lopbuk

> Archivo cargado automáticamente por Claude Code al inicio de cada sesión.  
> El cerebro completo del proyecto vive en **`daimuz/`**.

---

## 🧠 Primer paso siempre

```
1. Lee daimuz/DAIMUZ.md          → índice maestro del proyecto
2. Lee el módulo específico       → daimuz/modules/[modulo]/[modulo].md
3. Lee el archivo a modificar
4. Lee el flujo si aplica         → daimuz/flows/
```

---

## ⚡ Stack (resumen)

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind · shadcn/ui · Zustand 5 |
| Backend | Node.js · Express 4 · TypeScript · MySQL2 · Socket.io · JWT |
| Auth | JWT + httpOnly cookie + Google OAuth |
| Multi-tenant | `tenant_id` en todas las tablas de negocio |

---

## 📐 Reglas que nunca se rompen

1. **Lógica solo en `*.service.ts`** — nunca en controllers ni routes
2. **Siempre filtrar por `tenant_id`** en queries — `WHERE tenant_id = ?`
3. **`tenant_id` viene de `req.user.tenantId`** (JWT) — nunca del body
4. **Soft delete** — `is_active = 0`, nunca `DELETE` físico en datos de negocio
5. **Respuestas API** — `{ success: true, data }` / `{ success: false, error }`
6. **Errores** — `throw new AppError('mensaje', httpCode)` en services
7. **No tocar sin preguntar:** schema DB · auth middleware · config files
8. **Esquema = migraciones versionadas** — el esquema vive en `backend/src/db/schema`
   (fuente TS) + `backend/src/db/migrations` (historial). **PROHIBIDO `CREATE TABLE` /
   `ALTER TABLE` en runtime** (nada de `ensureTable()` ni DDL en `index.ts`).

---

## 🧬 Migraciones de esquema (Drizzle Kit)

Flujo para cualquier cambio de esquema (tabla/columna nueva, índice, etc.):

```
1. Editar la tabla en backend/src/db/schema/schema.ts
2. npm run db:generate     → crea src/db/migrations/000N_*.sql (revísalo)
3. npm run migrate         → aplica las migraciones pendientes
```

- **Baseline:** `0000_tearful_patch.sql` = esquema completo (203 tablas + 6 vistas +
  196 FKs + 2732 columnas), capturado por introspección de una BD verdad. Incluye la
  feature **hormas** (`hormas`, `horma_colors` + `horma_id`) y las 29 columnas que el
  schema_FULL viejo no creaba (cláusulas `AFTER` fallidas). Reconstruye la BD 1:1.
- **Deploy (Docker/Komodo):** el `CMD` corre `node dist/db/migrate.js && node dist/index.js`
  → aplica migraciones (migrador de runtime de `drizzle-orm`, sin `drizzle-kit`) y luego
  arranca. Si la migración falla, el server NO arranca.
  - **BD nueva/vacía:** `migrate` corre el 0000 y crea todo (203 tablas).
  - **BD existente (prod):** `migrate` **auto-marca** el baseline como aplicado (detecta
    `users` sin registro de migraciones) → no recrea nada, corre solo migraciones futuras.
    Ya NO hace falta correr `baseline-mark-applied.sql` a mano.
  - **Prod vieja/incompleta:** correr UNA vez `src/db/prod-catchup.sql` (idempotente)
    antes/junto al deploy, para rellenar tablas/columnas que le falten (hormas, base_price…)
    ya que el DDL de runtime está congelado.
  - Dev: `runMigrations()` corre al boot solo en `NODE_ENV !== 'production'`.
- `schema_FULL.sql` ya **no** es fuente de verdad → archivado en `backend/db-legacy/`
  (junto con `inventarioEsteban_v3_multitenant.sql` y las 13 migraciones viejas).

---

## 🧩 Dónde está cada cosa

| Necesito saber... | Leo... |
|---|---|
| Estado del proyecto hoy | `daimuz/memory/current-state.md` |
| Resumen rápido de un módulo | `daimuz/modules/[modulo]/compressed.md` |
| Detalles de un módulo | `daimuz/modules/[modulo]/[modulo].md` |
| Qué módulos existen | `daimuz/indexes/modules-index.md` |
| Todos los endpoints API | `daimuz/indexes/endpoints-index.md` |
| Todas las tablas DB | `daimuz/indexes/db-tables-index.md` |
| Archivos críticos del código | `daimuz/indexes/files-index.md` |
| Impacto al cambiar un módulo | `daimuz/synapses/ops-chain.md` (o gastrobar/delivery/saas) |
| Qué ES una entidad (Sale, Order...) | `daimuz/ontology/entities.md` |
| Reglas que nunca se rompen | `daimuz/governance/universal-constraints.md` |
| Seguridad / auditoría (17 fases) | `daimuz/security/README.md` (empezar por `compressed.md`) |
| Antes de tocar auth/tenant/pagos/IA | `daimuz/governance/security-policy.md` + `daimuz/synapses/security-chain.md` |
| Cómo es la arquitectura | `daimuz/architecture/overview.md` |
| Sprint y trabajo activo | `daimuz/context/current-sprint.md` |
| Backlog | `daimuz/context/pending.md` |
| Reglas de negocio por módulo | `daimuz/vault/business-rules.md` |

---

## 💾 Sistema de memoria

**Toda la memoria vive en `daimuz/`** — no en `~/.claude/projects/.../memory/`.

| Qué guardar | Dónde |
|---|---|
| Cambios de hoy | `daimuz/memory/current-state.md` + `daimuz/memory/changelog.md` |
| Feature terminado | `daimuz/memory/completed-features.md` |
| Bug resuelto | `daimuz/memory/important-fixes.md` |
| Lección / feedback | `daimuz/memory/lessons-learned.md` |
| Sprint activo | `daimuz/context/current-sprint.md` |

---

## 🔚 Último paso siempre (cierre de sesión)

Al terminar cualquier sesión de trabajo significativa, ejecutar este prompt:

```
Actualiza los archivos DAIMUZ relevantes basándote en lo que hicimos hoy:
- memory/current-state.md   → qué cambió, qué funciona ahora
- memory/changelog.md       → entrada con fecha de hoy
- context/current-sprint.md → qué hice, qué falta
- memory/lessons-learned.md → si aprendimos algo nuevo
- memory/completed-features.md → si terminamos un feature
```

> **Por qué:** La memoria de DAIMUZ solo vale si se actualiza. Este prompt convierte el mantenimiento en 1 acción, no en disciplina manual.
