# Plan · Drift de migraciones — loyalty_* / engagement_* / gym_*

> **Estado:** documentación de un problema conocido. **NO reparar aquí.** Tarea
> independiente del Product Experience Builder.
> **Origen:** detectado durante la Fase 1.5 al intentar `node dist/db/migrate.js`.

---

## 1. Síntoma

El migrador aborta al arrancar:

```
Table 'engagement_automations' already exists  (sqlState 42S01)
```

Como `runMigrations()` ejecuta `migrate()` **antes** de `runCatchup()`, y `migrate()`
lanza, **el catch-up nunca corre**. En Fase 1.5 esto se sorteó ejecutando `runCatchup()`
de forma aislada (por eso `product_template_versions` sí se creó), pero el flujo normal de
migración está roto para esta BD.

> **Importante:** esto NO afecta a producción con BD nueva/vacía (ahí `migrate()` corre el
> baseline y todo aplica). Afecta a BDs que ya tienen las tablas de `engagement_*` / `gym_*`
> creadas por otra vía (dev y cualquier entorno donde se corrió el catch-up antes que la
> migración formal).

---

## 2. Migraciones afectadas

| idx | tag | contenido | estado en BD |
|---|---|---|---|
| 48 | `0048_curious_gorgon` | — | aplicada (marcada) |
| 49 | `0049_amber_sentinel` | `CREATE TABLE engagement_notes` | tabla ya existe → CREATE falla |
| 50 | `0050_absurd_lord_tyger` | 18 CREATE TABLE + 25 ALTER | tablas ya existen → CREATE falla |

- **Marcadas como aplicadas en `__drizzle_migrations`:** 49
- **En el journal (`_journal.json`):** 51 (hasta `0050`)
- **Pendientes:** `0049`, `0050`

La 50 es la que importa: mezcla creación de tablas (idempotentes vía catch-up) con **ALTER
que agregan columnas reales**, y esos ALTER no son cubiertos por el catch-up.

---

## 3. Tablas que `0050` crea (ya existentes en la BD con drift)

Creadas fuera del flujo de migración (probablemente por el catch-up de Fase 1.5 del gym/eventos
o por `prod-catchup.sql`):

```
engagement_automations   engagement_campaigns   engagement_events
engagement_notes         engagement_segments
exercises                exercise_translations  exercise_media   exercise_tags
routines                 routine_versions       routine_exercises
gym_members              gym_member_profiles    gym_member_timeline   gym_objectives
```

Estas **no son el problema de fondo**: `CREATE TABLE IF NOT EXISTS` las haría idempotentes.
El problema son los ALTER de abajo.

---

## 4. ALTER pendientes (el riesgo real)

`0050` agrega columnas que el catch-up **no** crea. Si se marca la migración como aplicada sin
verificar, estas columnas podrían quedar **ausentes para siempre**:

### `loyalty_accounts` (11 columnas)
```
customer_email  level  visits  last_visit  total_spent
wallet_id  wallet_provider  wallet_status
birthday  acquisition_channel  favorite_category_id
```

### `loyalty_config` (8 columnas)
```
wallet_enabled  wallet_logo_url  wallet_primary_color  wallet_business_name
wallet_short_description  geo_radius_meters  geo_push_enabled  geo_push_message
```

### `loyalty_rewards` (3 columnas)
```
reward_type  condition_value  streak_days
```

### `gym_*` (constraints, no columnas)
```
gym_member_profiles / gym_member_timeline / gym_members
  → ADD CONSTRAINT (FKs a tenants/users/gym_members)
```
Las FKs son menos críticas: su ausencia no rompe queries, solo integridad referencial.

> **⚠️ Pendiente de verificar contra BD** (estaba caída al documentar): cuáles de estas 22
> columnas ya existen y cuáles faltan de verdad. Ese inventario es el **paso 1 obligatorio** de
> cualquier reparación. El módulo Customer Engagement usa varias de estas columnas en runtime,
> así que si funcionaba, es probable que ya existan — pero hay que confirmarlo, no asumirlo.

---

## 5. Riesgos

| # | Riesgo | Gravedad |
|---|---|---|
| R1 | Marcar `0050` como aplicada sin verificar → columnas `loyalty_*` faltantes nunca se crean → el módulo Engagement rompe en runtime | **Alta** |
| R2 | Envolver `migrate()` en try/catch → se silencian fallos de migración futuros legítimos (viola CLAUDE.md: "si la migración falla, el server NO arranca") | Alta |
| R3 | Reintentar los CREATE tal cual → siguen fallando con 42S01, server no arranca | Media (ya presente) |
| R4 | Editar el `.sql` de `0050` a `IF NOT EXISTS` → altera una migración ya versionada; diverge del hash de otros entornos | Media |
| R5 | Dejarlo sin resolver → cualquier migración futura queda bloqueada detrás de `0050` | **Alta** (deuda que crece) |

---

## 6. Estrategia segura de resolución (para la tarea futura)

Principio: **reconciliar, no forzar**. No marcar a ciegas ni silenciar.

1. **Inventariar** (solo lectura): con la BD arriba, comparar columna por columna las 22 de §4
   contra `information_schema.columns`. Producir la lista exacta de lo que falta.
2. **Rellenar lo faltante de forma idempotente**: añadir las columnas ausentes al `runCatchup()`
   con el helper `addColumnIfMissing` que el proyecto ya usa (mismo patrón que las 29 columnas
   del baseline). NADA de DDL a mano fuera del flujo.
3. **Reconciliar el registro**: una vez la BD tiene realmente lo que `0049`/`0050` describen,
   marcar ambas como aplicadas en `__drizzle_migrations` (patrón `ensureEventsMigrationsMarked`,
   que ya existe para `0044`–`0047`). Extender ese reconciliador a `0048`–`0050`.
4. **Verificar**: `migrate()` corre limpio de punta a punta en una BD con drift, y una BD nueva
   sigue construyéndose 1:1 desde el baseline.
5. **No tocar** `product_templates` ni `product_template_versions`: la Fase 1.5 ya quedó bien.

### Lo que NO se debe hacer (decisión explícita del owner)
- ❌ Marcar `0050` como aplicada sin el inventario del paso 1.
- ❌ Envolver `migrate()` en try/catch.
- ❌ Silenciar el error.
- ❌ Modificar el pipeline de migraciones.

---

## 7. Alcance

Este drift pertenece al **estado histórico del repositorio** y afecta `loyalty_*` / `engagement_*`
/ `gym_*`. **No tiene relación con el Product Experience Builder** ni con el versionado de
plantillas. Se resuelve como tarea independiente para no mezclar un refactor de PDP con una
reparación del sistema de migraciones.
