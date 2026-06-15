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
