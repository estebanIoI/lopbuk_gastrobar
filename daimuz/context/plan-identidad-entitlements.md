# 🪪 Plan Maestro — Modelo de Identidad por Entitlements

> Una persona = UNA cuenta (`users`). El acceso se controla por **entitlements**, nunca por `role`.
> Un usuario puede ser consumidor **y** comerciante a la vez, sin re-login ni cambio de cuenta.
> Estado: 🟢 **Fundación implementada** (aditiva, blast-radius contenido) · 🟡 cutover por fases.
> ⚠️ No compilado en este entorno → correr `tsc`/build antes de desplegar.

---

## 1. Las tres capas

1. **Identidad** — solo `users` (Platform User). No hay `merchant_users` ni `consumer_users`.
2. **Entitlements** — derechos múltiples por usuario, almacenados como STRINGS extensibles:
   `os_legend_free`, `os_legend_pro`, `merchant_basic|pro|enterprise`, `admin`, `super_admin`, …
3. **Workspaces** — espacios derivados de los entitlements (no del rol): `consumer_os`,
   `merchant_dashboard`, `admin`, `admin_console`, `support`.

## 2. Modelo de datos — `user_entitlements` (aditiva)

Definición Drizzle a agregar en `backend/src/db/schema/schema.ts` (fuente de verdad; luego
`npm run db:generate && npm run migrate`). SQL equivalente en `migrations/0055_user_entitlements.sql`.

```ts
export const userEntitlements = mysqlTable("user_entitlements", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	entitlement: varchar({ length: 64 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }),
	source: varchar({ length: 20 }).default('manual').notNull(),
	status: varchar({ length: 16 }).default('active').notNull(),
	metadata: json(),
	grantedAt: timestamp("granted_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
}, (table) => ({
	idxUeStatus: index("idx_ue_status").on(table.userId, table.status),
	idxUeEntitlement: index("idx_ue_entitlement").on(table.entitlement),
	userEntitlementsId: primaryKey({ columns: [table.id], name: "user_entitlements_id" }),
	uqUserEntitlement: unique("uq_user_entitlement").on(table.userId, table.entitlement),
}));
```
> Asegurar que `json` y `unique` estén importados desde `drizzle-orm/mysql-core` en schema.ts.

## 3. Catálogo y bundles (implementado — `entitlements.catalog.ts`)

Data-driven, sin enums rígidos. Bundles obligatorios (no configurables):

| Plan | Entitlements otorgados |
|---|---|
| free | `os_legend_free` |
| merchant_basic | `merchant_basic` + `os_legend_free` |
| merchant_pro | `merchant_pro` + `os_legend_free` |
| **merchant_enterprise** | `merchant_enterprise` + **`os_legend_pro`** |

Mapa plan legacy del tenant → plan de entitlements: `basico→merchant_basic`, `profesional→merchant_pro`,
`empresarial→merchant_enterprise`. Workspaces derivados por reglas `requiresAnyOf` en `WORKSPACE_RULES`.

## 4. API (implementada — `entitlements.routes.ts`)

- `GET /api/me/entitlements` → derechos activos.
- `GET /api/me/workspaces` → `{ entitlements, workspaces }` (para el Workspace Selector).
- `POST /api/merchant/activate` `{ businessName, businessType? }` → activa negocio sobre la cuenta actual,
  en **una transacción**. `tenant_id`, `owner_id`, `role`, `plan`, `slug` los calcula el **servidor**.

## 5. Seguridad (baked-in)

- **Backend-only**: el grant por defecto y la activación jamás dependen del frontend.
- **JWT solo identifica**: la autorización se resuelve leyendo `user_entitlements` en cada request
  (`requireEntitlement(...)`), no desde claims mutables del token.
- **Transacción única** en `activateMerchant` (tenant + owner + user + store_info + entitlements) con
  rollback. `FOR UPDATE` sobre el usuario para evitar doble activación concurrente.
- Cierra de paso el hueco **F1** (registro que aceptaba `role`/`tenant` del body): el alta de negocio es
  autenticada y server-computed.

## 6. Compatibilidad / migración

`migrations/0056_backfill_entitlements.sql` (idempotente): todo usuario → `os_legend_free`; comerciantes
→ su bundle por plan; enterprise → `os_legend_pro`; superadmin → `super_admin`. Nadie pierde acceso.

---

## 7. Estado y fases

### ✅ Fase 0 — Fundación (implementada este lote, aditiva)
`entitlements/` (catalog, service, middleware, routes, index) + migraciones 0055/0056. **Inerte hasta
cablearse** → no rompe nada existente.

### 🟡 Fase 1 — Wiring backend (siguiente, bajo riesgo)
1. **Montar rutas** en `backend/src/index.ts`:
   ```ts
   import { entitlementsRoutes } from './modules/entitlements';
   app.use(`${apiPrefix}`, entitlementsRoutes); // cubre /me/* y /merchant/*
   ```
2. **Grant por defecto al registrarse** en `auth.service.ts` (register, registerClient, googleLogin nuevo):
   tras crear el usuario → `await entitlementsService.grantDefault(id)`.
3. **Hook de plan (incluye Wompi):** donde se confirme/actualice el plan del tenant (webhooks/callbacks de
   Wompi, MercadoPago, ADDI, Sistecredito, Stripe, o cambio manual de plan), tras setear `tenants.plan`
   llamar `await entitlementsService.syncFromTenantPlan(ownerUserId, tenant.plan, tenant.id)` para
   re-otorgar el bundle (p.ej. subir a empresarial otorga `os_legend_pro`).

### 🟡 Fase 2 — Cutover de autorización (mayor cuidado, por módulo + build)
Migrar los `authorize('comerciante'|...)` a `requireEntitlement(...)` módulo por módulo, verificando
`tsc`/tests en cada uno. `authorize`/`role` quedan como *compat* hasta terminar; NO se borran de golpe.

### 🟡 Fase 3 — Frontend
`WorkspaceSelector`, `ConsumerOS`, `MerchantPanel`, navbar, sidebar, login, onboarding, settings y
`app/page.tsx` consumen `GET /me/workspaces` (no `role`). CTA permanente en Consumer OS
**"¿Tienes un negocio? Actívalo"** → `POST /merchant/activate` → refrescar workspaces → entrar al panel.
El `app/page.tsx` deja de ramificar por `role` y ramifica por workspaces disponibles.

### 🟡 Fase 4 — Limpieza
Eliminar ramas basadas solo en `role` una vez migradas todas; sin `TODO/FIXME`, sin feature flags temporales.

---

## 8. Criterio de salida (para dar por terminado)
Todos los accesos por entitlements · Workspace Selector automático · `os_legend_free` por defecto ·
consumidor+comerciante simultáneo · enterprise → `os_legend_pro` automático · flujo "Activa tu negocio"
completo · migraciones+backfill aplicados · build/tsc/eslint en verde (lo valida quien compila) · sin
referencias funcionales al modelo por-rol.

← [[security/findings/audit-payments-2026-07-22]] | [[DAIMUZ]]
