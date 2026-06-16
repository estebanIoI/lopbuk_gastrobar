# 🍽️ Plan de integración: restaurant-system (Sirius) → lopbuk_gastrobar

> Análisis y plan. **Hallazgo clave:** lopbuk **ya es superconjunto** de Sirius en
> restaurante. Sirius es un sistema enfocado y más simple; lopbuk tiene casi todo lo
> suyo **y mucho más**. Solo hay **4-5 deltas reales** que vale la pena portar.

---

## 1. Comparación (Sirius → estado en lopbuk)

| Funcionalidad de Sirius | ¿En lopbuk? | Dónde |
|---|---|---|
| Roles mesero/cocinero/cajero/admin | ✅ Sí (+ bartender) | `restbar`, paneles `mesero/cocinero/cajero/bartender` |
| Mesas con estados (libre/ocupada/lista) | ✅ Sí | `restbar.service.ts` |
| Menú + categorías | ✅ Sí | `products`, `restbar` (`is_menu_item`, `available_in_menu`) |
| Pedidos + ítems con estados | ✅ Sí (pendiente→preparando→listo→entregado→cancelado) | `restbar`, `orders` |
| Cocina en tiempo real | ✅ Sí (**Socket.io**, mejor que el auto-refresh por polling de Sirius) | `orders` + `src/index.ts` (Socket.io) |
| `preparation_time` por ítem | ✅ Sí (`prep_time_minutes`, `preparation_area`) | `restbar.service.ts` |
| Cajero: pagos efectivo/tarjeta/Nequi | ✅ Sí (`rb_payments`: efectivo/tarjeta/nequi/transferencia/mixto) | `restbar.routes.ts` |
| Split de cuenta | ✅ Sí (3 modos: toda la mesa / partes iguales / por comensal) | `CajaTab` en `restbar.tsx` |
| Menú QR en mesa / reservas online | ✅ Sí | `/menu/[slug]`, `/reservar/[slug]` |
| Suscripciones MercadoPago | ✅ Sí | `subscriptions` |
| Reportes (ventas, top productos) | ✅ Parcial | `analytics`, `dashboard` |
| **Reporte rendimiento por mesero / por mesa** | ❌ **No** | — (delta) |
| **Prioridad de orden en cocina (normal/alta)** | ❌ **No** | — (delta) |
| **Cache server-side (NodeCache/TTL por módulo)** | ❌ **No** | — (delta) |
| **Backup/restore de BD (self-service)** | ❌ **No** | — (delta) |
| Suite de tests (unit/integration/e2e) | ❌ **No** | — (delta de proceso) |
| Sync cross-tab por localStorage + auto-refresh por rol | ⚠️ Redundante (lopbuk usa Socket.io) | no portar |

**Conclusión:** no hay "bastantes servicios faltantes". Hay **4 features + 1 de proceso**.

---

## 2. Deltas a integrar (priorizados)

### 🟢 Fase 1 — Alto valor, bajo riesgo
**A. Reportes de rendimiento de restaurante** *(esfuerzo: medio)*
- **Qué:** rendimiento **por mesero** (ventas, # mesas, ticket promedio, tiempo de atención), **por mesa** (rotación, ventas), **productos top** del gastrobar, **métodos de pago**, con **export PDF**.
- **Dónde:** backend nuevo `restbar.reports` (queries sobre `rb_orders`, `rb_order_items`, `rb_payments` agrupadas por `waiter_id`/`table_id`/`product`); frontend nuevo tab "Reportes" en `restbar.tsx` o en `analytics`. PDF: skill `pdf` o jsPDF.
- **Regla:** filtrar por `tenant_id`; solo admin.

**B. Prioridad de orden en cocina (KDS)** *(esfuerzo: bajo)*
- **Qué:** marcar una comanda como **normal/alta**; el KDS la resalta y la ordena primero.
- **Dónde:** columna `priority ENUM('normal','alta')` en `rb_orders` (migración idempotente); UI en panel mesero (set) + cocinero (badge + sort). Emitir por Socket.io.

### 🟡 Fase 2 — Performance
**C. Cache server-side para endpoints calientes** *(esfuerzo: medio)*
- **Qué:** cachear lecturas frecuentes (menú, mesas, cocina) con TTL corto, como Sirius (NodeCache).
- **Dónde:** util `cache.ts` (clave **incluye `tenant_id`**); aplicar en GET de `restbar`/menú; **invalidar** en escrituras y en eventos Socket.io. Cuidado: nunca cachear cruzando tenants.

### 🔴 Fase 3 — Operación sensible (requiere aprobación)
**D. Backup/restore de BD** *(esfuerzo: medio-alto, sensible)*
- **Qué:** backup descargable (por tenant o full) y restore.
- **Dónde:** endpoint **superadmin** con `mysqldump` (o export por tenant). **Acción crítica** → aprobación humana (`governance/approval-policy.md`); restore destructivo nunca automático.

**E. Suite de tests** *(proceso, continuo)*
- Empezar por **unit/integration** de los services críticos (`restbar`, `sales`, `inventory`) con Jest. (Sirius ya tiene estructura de referencia.)

---

## 3. Secuencia sugerida
1. Fase 1A (reportes) + 1B (prioridad cocina) — entregan valor visible al restaurante.
2. Fase 2C (cache) — cuando haya carga; medir antes.
3. Fase 3D (backup) con aprobación + E (tests) en paralelo, incremental.

## 4. Lo que NO se porta
- Auto-refresh por polling + sync localStorage de Sirius → lopbuk ya usa **Socket.io** (superior).
- Roles/mesas/menú/pedidos/pagos/QR/reservas → **ya existen** en lopbuk.

---

← [[DAIMUZ]] | [[context/pending]] | [[modules/restbar/restbar]]

---

## 5. Features de experiencia de cliente (NO estaban en el código de Sirius → diseñar nuevas)

> El usuario describió dos funciones que **no existen** en el repo `restaurant-system`
> analizado (sin dep `qrcode`, sin nada de música). Se diseñan desde cero para lopbuk,
> que ya tiene las piezas base (`/menu/[slug]`, `qrcode.react`, `restbar` mesas/orders, Socket.io).

### F. QR de mesa con sesión del cliente *(esfuerzo: medio-alto)*
- **Qué:** cada mesa tiene un **QR**. El cliente lo escanea → se le pide un **nombre** para
  **unirse a la mesa**; ve el menú y puede pedir desde su teléfono. El **QR/sesión se invalida**
  cuando la cuenta se **paga o cancela** (queda inválido).
- **Cómo:**
  - Backend: `rb_table_sessions` (token, table_id, tenant_id, status active/closed, expires_at) +
    `rb_table_guests` (session_id, name). Endpoints públicos: `POST /restbar/table/:token/join` (nombre),
    `GET /restbar/table/:token` (menú + estado), `POST /restbar/table/:token/order` (pedir). El mesero
    genera/rota el token al abrir la mesa; al cobrar/cancelar → `status=closed` (QR inválido).
  - Frontend: ruta pública `/mesa/[token]` (escaneo) con pantalla "¿con qué nombre entras?";
    en el panel mesero, botón **"Generar QR de mesa"** (usa `qrcode.react`, ya instalado).
  - Tiempo real: los pedidos del cliente entran a la comanda y al KDS por Socket.io.
- **Reglas:** público pero acotado al token de esa mesa/tenant; token de un solo uso por sesión; expira.

### G. Jukebox — elegir canción *(esfuerzo: medio)*
- **Qué:** al **completar el consumo / alcanzar un tope**, el cliente puede **elegir una canción**
  que entra a una cola de reproducción de la mesa/local.
- **Cómo:**
  - Backend: `rb_jukebox_queue` (tenant_id, table_session_id, track, requested_by, status). Gating:
    habilitar el botón solo cuando `order.total >= umbral` (config del local) o al cerrar cuenta.
  - Frontend: en `/mesa/[token]`, sección "Elige una canción" (buscador + embed YouTube/Spotify);
    panel del local con la **cola** y reproductor. Socket.io para actualizar la cola en vivo.
  - **Definir:** fuente de música (YouTube embed = simple; Spotify = requiere cuenta/SDK) y el umbral/"tope".

> Ambas se apoyan en `restbar` + el QR menu existente. Sugerencia: F primero (alto valor
> operativo), G después (experiencia/diferenciador).

---

## 6. Verificación cruzada con `admin-manager` (versión documentada de Sirius)

`admin-manager/info.md` lista **46 servicios explícitos**. Resultado:
- ✅ **Confirma deltas reales:** `report.tablePerformance` + `report.paymentSummary` + `report.topProducts` (delta A), "Priorización de pedidos" en cocina (delta B), `database.backup/restore/listBackups` (delta D).
- ❌ **NO existen en NINGÚN repo** (restaurant-system ni admin-manager): la **generación de QR de mesa con sesión de cliente** ni la **función de elegir canción/jukebox**. No hay dep de QR, ni servicios de sesión/invitado, ni música. → Son features **a diseñar nuevas** (secciones F y G).

---

## 7. Plan enriquecido en 4 fases (experiencia cliente → operación → fidelización → marketing)

> Roadmap completo acordado con el usuario. Cada fase es entregable de forma independiente.
> Estado al **2026-06-15**: **Fase 1 COMPLETA y verificada** (tsc 0). Fases 2–4 pendientes.

### ✅ Fase 1 — Experiencia del cliente *(HECHA)*
1. **QR de mesa con sesión del cliente** — el mesero genera el QR por mesa; el cliente escanea,
   entra con su nombre, ve el menú y pide desde su celular. Sesión atada al pedido: se **invalida
   al cobrar/cancelar**.
2. **Disponibilidad real del menú** — los agotados se muestran como "Agotado" y no se pueden pedir.
3. **Estado del pedido visible al cliente** — vista "Mi pedido" con badges en vivo
   (Pendiente / En preparación / Listo / Entregado), refresco cada 7 s.
4. **Página de inicio del restaurante** (`/r/[slug]`) — portada, logo, abierto/cerrado, **promos y
   eventos** (reusa `store_banners`), destacados y CTAs **Ver menú** / **Reservar**.

**Entregables Fase 1:**
- Backend: `backend/src/modules/restbar/restbar-qr.routes.ts` (sesiones, invitados, pedir, **estado**);
  montado en `index.ts` como `/api/restbar-qr`. Tablas `rb_table_sessions`, `rb_table_guests`
  (auto-migración idempotente). Endpoints: `POST /tables/:id/session` (mesero), `GET /session/:token`,
  `POST /session/:token/join`, `POST /session/:token/order`, `GET /session/:token/order`.
- Frontend: `app/mesa/[token]/page.tsx` (cliente: escaneo→nombre→menú→pedir→seguimiento),
  `app/r/[slug]/page.tsx` (home restaurante), `components/restbar/table-qr-button.tsx` (botón mesero
  con `qrcode.react`), insertado en `components/mesero-panel.tsx`.
- Reusa `restbarService` (comanda real → KDS) y el endpoint público `storefront/store-config/:slug`.

### ✅ Fase 2 — Operación *(COMPLETA)*
- ✅ **Prioridad de cocina** (delta B): columna `rb_orders.priority` (`normal|urgente`,
  auto-migración). Endpoint `PATCH /restbar/orders/:id/priority` (cocina/bar/mesero/admin).
  Los paneles **cocinero** y **bartender** muestran badge 🔥 URGENTE + botón ⚡ para marcar/quitar,
  y ordenan las comandas urgentes primero. El sort urgente también se aplica en `getAreaDisplay`.
- ✅ **Regalo entre mesas**: desde `/mesa/[token]` el cliente elige otra mesa ocupada y le envía
  productos; entran a la **comanda de esa mesa** con nota `🎁 Regalo de [nombre] (Mesa X)`.
  Endpoints `GET /restbar-qr/session/:token/tables` + `POST /restbar-qr/session/:token/gift`.
- ✅ **Reservas públicas**: la home (`/r/[slug]`) ya enlaza a `/reservar/[slug]`; al crear una reserva
  online se emite una **notificación** al comercio (`createNotification`, tipo `reservation`).
- ✅ **Jukebox / elegir canción** (sección G): tablas `rb_jukebox_queue` + `rb_jukebox_config`
  (umbral por consumo, default $50.000). Público: `GET/POST /restbar-qr/session/:token/jukebox`
  (se **desbloquea** cuando el total de la comanda ≥ umbral). Staff: `GET/PATCH /restbar-qr/jukebox`
  + página `/jukebox` (reproducir / sonada / saltar). En `/mesa/[token]` (vista "Mi pedido"):
  barra de progreso al desbloqueo, formulario (título + link opcional) y cola en vivo.

> **Fase 2 = COMPLETA.** Siguiente: Fase 3 (fidelización/puntos).

### ✅ Fase 3 — Fidelización / puntos *(COMPLETA)*
- Módulo **loyalty** (`backend/src/modules/loyalty/loyalty.routes.ts`, montado `/api/loyalty`):
  tablas `loyalty_config`, `loyalty_accounts`, `loyalty_transactions`, `loyalty_rewards`
  (auto-migración idempotente). Cuentas identificadas por **teléfono**.
- **Reglas configurables**: `loyalty_config.points_per_thousand` (puntos por cada $1.000 de consumo)
  + on/off. Admin: `GET/PUT /loyalty/config`.
- **Recompensas** (CRUD): `GET/POST/PATCH/DELETE /loyalty/rewards`. **Cuentas**: `GET /loyalty/accounts`,
  `GET /loyalty/accounts/:id/transactions`, `POST /loyalty/accounts/:id/adjust`.
- **Acúmulo**: `POST /loyalty/earn` (calcula puntos del monto; reusable). **No se tocó el flujo de pago**
  (regla CLAUDE.md): el cajero/admin otorga puntos tras cobrar desde el panel.
- **Canje desde la sesión del cliente** (`/mesa/[token]` → vista "Mi pedido", sección ⭐):
  `GET /restbar-qr/session/:token/loyalty?phone=` (saldo + catálogo) y
  `POST /restbar-qr/session/:token/loyalty/redeem` (devuelve **código de canje** para mostrar al mesero).
- **Frontend**: página admin `/fidelizacion` (reglas + recompensas + cuentas + otorgar puntos);
  métodos en `lib/api.ts`. tsc front 0.

> **Fase 3 = COMPLETA.** Roadmap: Fase 1 ✅ · Fase 2 ✅ · Fase 3 ✅. Siguiente: Fase 4 (marketing + reportes).

### ✅ Fase 4 — Marketing y reportes *(COMPLETA)*
- ✅ **Reportes de restaurante** (delta A): sub-router `restbar.reports.routes.ts`
  (`GET /api/restbar/reports/summary?from=&to=`) → resumen de pagos por método, top de productos,
  rendimiento por mesero y por mesa, KPIs (ventas, comandas, ticket promedio, total cobrado).
  Reutiliza `rb_orders/rb_payments/rb_order_items`. Página `/reportes-restaurante` con rango de
  fechas y **export PDF** (imprimir). `api.getRestbarReports()`.
- ✅ **Marketing / promos**: ya cubierto por `store_banners` (que el comercio administra) y que la
  home del restaurante `/r/[slug]` muestra como "Promociones y eventos" (Fase 1). No requirió módulo nuevo.
- ✅ **Backup/restore** (delta D): sub-router `restbar.backup.routes.ts` (`/api/restbar/backup`).
  `GET /export` (admin, **solo lectura**) → JSON con menú, mesas, fidelización, info/banners e histórico.
  `POST /restore/preview` (dry-run) y `POST /restore` (**upsert aditivo SOLO de catálogo/config**;
  nunca pedidos/pagos/transacciones). Guardas: rol superadmin/comerciante + frase **`RESTAURAR`** +
  se fuerza el `tenant_id` del JWT + se eliminan timestamps. Frontend: página `/respaldos`
  (descargar, subir JSON, vista previa con conteos, confirmar).

> **Roadmap: Fase 1 ✅ · Fase 2 ✅ · Fase 3 ✅ · Fase 4 ✅. Integración Sirius COMPLETA.**

---

## ⚠️ Nota operativa (entorno de esta sesión)
El sandbox de build sirve a veces **lecturas truncadas** de archivos (divergencia disco/mount).
Verificación válida = **leer en disco con file-tools** + `tsc` con reintentos, y reparar la cola del
archivo cuando se detecta truncación. En esta sesión, `tsc` del frontend dio **0 errores**; en backend,
los únicos errores eran truncamientos transitorios del mount en `agent.service.ts` y `chatbot.routes.ts`
(**archivos NO tocados**, confirmados íntegros en disco). Mis archivos de Fase 1–4 compilan sin errores.
Regla reforzada: editar con bash/python y verificar en disco; nunca confiar en una sola lectura del mount.

