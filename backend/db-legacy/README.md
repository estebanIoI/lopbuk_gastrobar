# db-legacy — esquema histórico (NO es fuente de verdad)

Estos archivos **ya no se usan**. Quedan como referencia/snapshot. El esquema vivo
está en **`backend/src/db/schema`** (TypeScript) + **`backend/src/db/migrations`**
(migraciones Drizzle versionadas). El baseline `0000_nervous_norman_osborn.sql`
reconstruye la BD completa (201 tablas + 6 vistas + 196 FKs).

| Archivo | Qué era |
|---|---|
| `inventarioEsteban_v3_multitenant.sql` | Esquema base original (pre-Drizzle). |
| `schema_FULL.sql` | Base + las 13 migraciones consolidadas. Se usó para sembrar la BD "verdad" desde la que se introspectó el baseline Drizzle. |
| `migrations-legacy/` | Las 13 migraciones `.sql` viejas (de `src/migrations`). Ya están en el baseline 0000. |
| `migrations-root-legacy/` | 25 `.sql` aún más viejos (de `backend/migrations`: fleet, age_gate, etc.). También en el 0000. |
| `seed-fac-historico-ventas.sql` | Seed de datos demo (histórico de ventas de un tenant de prueba). One-off. |

> Cambios de esquema de aquí en adelante: editar `src/db/schema/schema.ts` →
> `npm run db:generate` → `npm run migrate`. **Prohibido DDL en runtime.**
> Ver `CLAUDE.md` (sección "Migraciones de esquema").
