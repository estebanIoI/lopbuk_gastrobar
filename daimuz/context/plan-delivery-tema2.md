# Plan · Domicilios de plataforma en la tienda (tema 2)

> **Estado:** plan de integración, pendiente de aprobación.
> **Objetivo:** que el comerciante decida desde su panel cómo maneja los domicilios, y
> que —si activa los repartidores de la plataforma— el cliente pueda solicitar uno desde
> el checkout, chatear mientras el pedido está activo, y calificar o reportar al final.
> **Método:** igual que el resto de la sesión — auditar, reutilizar, ser honesto con el alcance.

---

## 0. Hallazgo: el ~70% del motor ya existe

| Pieza | Estado |
|---|---|
| Repartidores por comercio | ✅ `courier_tenants` (vincula repartidor ↔ comercio) |
| Presencia y ubicación en vivo | ✅ `courier_availability` (`is_online`, `status`, `current_lat/lng`, `last_seen_at`) |
| Pedidos disponibles para tomar | ✅ `GET /delivery/available` |
| **El repartidor acepta el pedido** | ✅ `POST /delivery/accept/:orderId` |
| Estados de la entrega | ✅ `storefront_orders.delivery_status` (`sin_asignar → asignado → recogido → en_camino → entregado`) |
| Asignación desde el comercio | ✅ `PUT /delivery/assign/:orderId` |
| **Chat por pedido** | ✅ `delivery_chat_rooms` (con `status` + `closed_at`) + `delivery_chat_messages` |
| Endpoints de chat | ✅ `/room/:orderId`, `/room/:roomId/messages`, `/read`, `/active-rooms` |
| Socket de chat | ✅ `delivery-chat.socket.ts` |
| Zonas de cobertura | ✅ `delivery_zones` + `coverage.routes.ts` |
| Vista de operación | ✅ `/active-couriers`, `/active-orders-map`, `/ops-stats` |

**Conclusión:** el flujo del repartidor está construido. Lo que falta es (a) el interruptor del
comerciante, (b) la cara del cliente, y (c) el control de calidad.

### Lo que realmente FALTA

1. **Config del comerciante**: no existe un campo para decidir el modo de domicilio. Solo hay
   `store_info.cart_delivery_fee` (un número), nada que diga *"uso mis propios domicilios"* vs
   *"uso los de la plataforma"* vs *"no hago domicilios"*.
2. **Cara del cliente en el checkout**: hoy `theme2-order-flow.tsx:990` muestra un cartel fijo
   *"Domicilio no incluido — se coordina con el restaurante"*. No hay forma de ver repartidores
   disponibles ni de solicitar uno.
3. **Chat para el cliente**: `delivery-chat.tsx` existe pero **solo lo usa `/delivery-os`** (la app
   del repartidor). El cliente no tiene acceso a esa conversación.
4. **Calificación y reporte**: no existe ninguna tabla. Es el único módulo de datos nuevo real.

---

## 1. Los 4 componentes

### A · Modo de domicilio (config del comerciante)
Un módulo simple en el panel: **cómo maneja los pedidos de su tienda**.

```sql
ALTER TABLE store_info
  ADD COLUMN delivery_mode ENUM('ninguno','propio','plataforma') NOT NULL DEFAULT 'ninguno',
  ADD COLUMN platform_delivery_fee INT NOT NULL DEFAULT 0,   -- lo que se cobra al cliente
  ADD COLUMN delivery_auto_broadcast TINYINT NOT NULL DEFAULT 1; -- avisar a todos los repartidores
```

- `ninguno` → comportamiento actual (el cartel "se coordina con el restaurante")
- `propio` → el comercio reparte con su gente (usa `assign` manual, ya existe)
- `plataforma` → aparece el flujo nuevo del cliente

**Todo aditivo**: sin cambiar el modo, la tienda se comporta exactamente como hoy.

### B · Solicitud de repartidor en el checkout (cara del cliente)
En `theme2-order-flow.tsx`, donde hoy está el cartel fijo:

- Si `delivery_mode = 'plataforma'` → reemplazar el cartel por un bloque **"Domicilio"** que
  muestre cuántos repartidores hay disponibles cerca y el costo.
- Al confirmar el pedido, se crea con `delivery_status = 'sin_asignar'` y se **difunde** a los
  repartidores del comercio (`courier_tenants` + `courier_availability.is_online`).
- El cliente ve un estado: *"Buscando repartidor…"* → *"Juan aceptó tu pedido"*.

**Endpoint nuevo (público):** `GET /storefront/delivery-availability/:storeSlug`
→ `{ enabled, fee, couriersOnline }`. No expone datos personales de los repartidores, solo el conteo.

**Reutiliza:** el repartidor acepta con el `POST /delivery/accept/:orderId` que ya existe.

### C · Chat cliente ↔ repartidor (solo mientras el pedido esté activo)
El motor ya está; falta exponerlo al cliente y cerrarlo al entregar.

- **Apertura:** al aceptar el repartidor (`accept`), crear/activar el room (`/room/:orderId` ya lo hace).
- **Acceso del cliente:** el pedido público se sigue por token (`/seguimiento/:token`, ya existe).
  El chat se autoriza con ese mismo token — el cliente no necesita cuenta.
- **Cierre:** al pasar a `entregado`, marcar `delivery_chat_rooms.status='closed'` + `closed_at`.
  Con la sala cerrada, el POST de mensajes responde 409 y la UI pasa a solo lectura.
- **Retención:** ya hay un purgado de privacidad (`deliveryChatMessages` en el retention purge).

**Regla:** el chat vive exactamente lo que vive el pedido. Ni antes (no hay a quién escribir),
ni después (se cierra al entregar).

### D · Calificación y reporte (el control)
Único módulo de datos nuevo:

```sql
CREATE TABLE courier_ratings (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  courier_user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  stars TINYINT NULL,                 -- 1..5 (null si solo reportó)
  comment VARCHAR(400) NULL,
  reported TINYINT NOT NULL DEFAULT 0,
  report_reason VARCHAR(60) NULL,     -- tarde / trato / producto / no_entregado / otro
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rating_order (order_id)   -- una calificación por pedido
);
```

- Se pide **al entregar**, en la pantalla de seguimiento (misma que ya usa el token).
- `UNIQUE(order_id)` evita calificar dos veces el mismo pedido — la garantía de que el
  promedio no se puede inflar.
- Solo se puede calificar un pedido **entregado** y con repartidor asignado.
- El promedio del repartidor sale de datos reales; los reportes alimentan una vista de
  moderación para el superadmin (reutiliza `CouriersTab`, que ya existe).

---

## 2. Plan incremental

| Fase | Entrega | Riesgo |
|---|---|---|
| **F1** | Config `delivery_mode` + módulo en el panel del comerciante | Bajo |
| **F2** | Endpoint público de disponibilidad + bloque en el checkout tema 2 | Bajo |
| **F3** | ✅ Difusión del pedido a repartidores + estado "buscando/aceptado" en el seguimiento | Medio |
| **F4** | ✅ Chat del cliente (autorizado por token) + cierre automático al entregar | Medio |
| **F5** | ✅ Calificación y reporte + promedio del repartidor | Bajo |
| **F6** | ✅ Vista de moderación de reportes en superadmin | Bajo |

**Arranque sugerido:** F1 → F2. Con eso el comerciante ya elige el modo y el cliente ve la
opción real en vez del cartel fijo, sin tocar el flujo de pedido.

---

## 3. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Cambiar el checkout tema 2 (flujo de venta vivo) | El bloque nuevo solo aparece con `delivery_mode='plataforma'`; el resto ve lo mismo de hoy |
| R2 | Pedido sin repartidor que acepte | Timeout configurable → cae a "coordinar con el restaurante" (comportamiento actual) |
| R3 | Chat abierto después de entregar | Cierre por estado + guarda en el POST (409 si la sala está cerrada) |
| R4 | Calificaciones infladas o repetidas | `UNIQUE(order_id)` + solo pedidos entregados |
| R5 | Exponer datos del repartidor al público | El endpoint público solo devuelve conteo y costo; nombre/teléfono solo tras aceptar |
| R6 | Cliente sin cuenta no puede chatear | Autorización por el token de seguimiento que ya existe |

---

## 4. Lo que este plan NO promete

- **Tarifas dinámicas por distancia**: se usa una tarifa fija configurable. El cálculo por
  distancia con `delivery_zones` es una fase posterior.
- **Asignación automática inteligente**: se difunde a los repartidores en línea y el primero
  que acepta se lo lleva. Un algoritmo de asignación por cercanía/carga es otro trabajo.
- **Pagos al repartidor**: fuera de alcance; aquí solo se cobra el domicilio al cliente.

---

## 5. Resumen

El motor de repartidores **ya está construido** (aceptar, estados, ubicación, chat por pedido,
zonas). Lo que falta es el **interruptor del comerciante**, la **cara del cliente en el checkout
tema 2**, exponer el **chat al cliente con cierre al entregar**, y una **tabla de calificaciones**
para el control de calidad.

Empezando por F1+F2 se entrega valor visible sin tocar el flujo de venta: el comerciante elige
cómo maneja sus domicilios y el cliente ve la opción real donde hoy hay un cartel fijo.

---

**Relacionados:** [[plan-restaurante-gastrobar]] · [[plan-erp-manufactura]] (mismo método).

---

## F3 — implementada (2026-07-18)

**Columnas nuevas** (`storefront_orders`, catch-up idempotente en `migrate.ts`):
`courier_requested TINYINT NULL` · `courier_requested_at TIMESTAMP NULL`

Semántica de `courier_requested` — esto es lo que mantiene el cambio aditivo:

| Valor | Significa | ¿Se difunde? |
|---|---|---|
| `NULL` | La tienda no está en modo plataforma | Sí (comportamiento histórico intacto) |
| `1` | El cliente pidió repartidor de plataforma | Sí |
| `0` | Recoge en tienda / domicilio propio | **No** |

**Hallazgos durante la implementación** (dos cosas que el plan no preveía):

1. `delivery_status` ya tenía default `'sin_asignar'`, así que **todo** pedido de tienda
   ya aparecía en `/delivery/available`. Sin la columna nueva, activar el modo plataforma
   habría difundido también los pedidos de "recoger en tienda".
2. `tracking_token` solo se generaba **al despachar** (`ensureTrackingTokens` en
   logistics). Un pedido con repartidor necesita el token desde el minuto cero o el
   cliente no puede ver la búsqueda → ahora `/orders/public` lo genera cuando
   `courier_requested = 1` y lo devuelve en la respuesta.

**Bug preexistente corregido:** `PUT /delivery/accept/:orderId` hacía `SELECT` de
verificación y luego `UPDATE` en sentencias separadas → dos repartidores podían aceptar
el mismo pedido. Con difusión eso pasa de improbable a probable. Ahora las condiciones
van en el `WHERE` del `UPDATE` y se valida `affectedRows`.

**Eventos de socket** (sobre la infraestructura que ya existía):
- `delivery-order-available` → sala `ops:<tenantId>` (repartidores ya unidos vía `join-courier`)
- `delivery-order-taken` → sala `ops:<tenantId>`, quita el pedido de las demás listas
- `delivery-courier-assigned` → sala `tracking:<token>` (nueva, pública por token)

El socket es solo aviso en vivo; la fuente de verdad sigue siendo el polling
(`/delivery/available` y `/storefront/tracking/:token`), así que un repartidor
desconectado no pierde pedidos.

**Verificado contra la BD real** (4/4): carrera de `/accept` (gana uno solo), y la matriz
de visibilidad para `courier_requested` en 1 / 0 / NULL. Backend y frontend: 0 errores TS.

**Pendiente de validar en navegador** — nada de F1–F3 se ha probado con un pedido real
de punta a punta.

---

## F4 — implementada (2026-07-18)

**Sin tablas ni columnas nuevas.** El motor de chat ya existía; faltaba la puerta del
cliente y el cierre. `sender_role` es `varchar(30)`, así que `'cliente'` entra sin migración.

**Endpoints públicos nuevos** (en `storefront.routes.ts`, autorizados por el token de
seguimiento — el cliente no tiene cuenta):
- `GET /storefront/tracking/:token/chat` → `{ available, roomId, status, courierName, messages }`
- `POST /storefront/tracking/:token/chat` → envía como `sender_role = 'cliente'`

La sala se crea **al primer acceso** una vez hay repartidor asignado, no antes: sin
repartidor el endpoint responde `available: false, reason: 'sin_repartidor'`.

**Cierre automático:** en `PUT /delivery/status/:orderId` al marcar `entregado` se cierra
la sala (`status='closed'` + `closed_at`) y se emite `delivery-chat-closed`. Además
`resolveChatOrder` cierra de forma perezosa e idempotente si la entrega se marcó por otra
vía — el chat no puede quedar abierto tras entregar. El historial queda legible en solo
lectura; el POST responde 409.

**Identidad del mensaje del cliente:** no tiene `user_id`, así que `sender_id` guarda el
`order_id`. Es consistente (el pedido *es* su identidad aquí) pero conviene tenerlo
presente si algún día se cruza `sender_id` contra `users`.

### 🔒 Agujero de seguridad preexistente corregido

`delivery-chat.routes.ts` verificaba **solo que la sala existiera**:
`GET /room/:roomId/messages`, `POST .../messages` y `POST .../read` no comprobaban tenant
ni pertenencia → cualquier usuario autenticado de **cualquier tenant** podía leer y
escribir la conversación de otro comercio. Viola la regla 2 del proyecto.

Además `GET /room/:orderId` filtraba por tenant solo `if (tenantId)`; un repartidor de
plataforma tiene `tenant_id NULL`, así que el filtro desaparecía y podía abrir la sala de
**cualquier pedido del sistema**.

Corregido con `authorizeRoom()`: superadmin, el comercio dueño de la sala, o el repartidor
asignado a ese pedido. Los demás reciben 404 (no se confirma que la sala exista).

**Verificado contra el servidor real** (13/13, `npm run dev` + fetch a los endpoints):
sin repartidor → `available:false` y POST 409 · con repartidor → sala creada · el cliente
envía y el mensaje persiste · mensaje vacío → 400 · token inválido → 404 · entregado →
sala cerrada y POST 409 · historial legible tras cerrar · el teléfono del repartidor deja
de exponerse al entregar. Backend y frontend: 0 errores TS.

**Pendiente:** validar en navegador el flujo completo (F1→F4) con un pedido real.

---

## F5 — implementada (2026-07-18)

**Tabla nueva `courier_ratings`** (la única de todo el plan), creada por el catch-up
idempotente en `migrate.ts`. Campos según el plan + dos para F6: `reviewed_at`, `reviewed_by`.

**Por qué NO se reusó `storefront_orders.rating`:** esa columna mide la satisfacción con
el **pedido/tienda** y ya alimenta el KPI de satisfacción en `executive.service.ts:157`.
Calificar al **repartidor** es otra cosa; mezclarlas habría corrompido un KPI en uso.
Por eso en el seguimiento aparecen dos bloques distintos y con textos distintos.

**Endpoint público:** `POST /storefront/tracking/:token/courier-rating`
→ `{ stars?, comment?, reported?, reportReason? }`

Reglas (todas verificadas):
- Solo pedidos **entregados** y **con repartidor de plataforma** → si no, 409.
- Sin estrellas y sin reporte no hay nada que registrar → 400.
- Reporte sin motivo → 400. Motivo fuera del catálogo (`tarde`/`trato`/`producto`/
  `no_entregado`/`otro`) → 400 por el validador.
- **Una calificación por pedido**: `uk_courier_rating_order` + captura de `ER_DUP_ENTRY`
  → 409. Esta es la garantía real de que un promedio no se puede inflar; no depende de
  que la UI se porte bien.

**Promedio del repartidor:** `GET /delivery/my-rating` → `{ average, ratings, reports, recent }`.
Sale de `AVG(stars)` sobre calificaciones reales. **Nada simulado** — si no hay
calificaciones, `average` es `null` y la UI no debe inventar un número.

El tracking ahora devuelve `delivery.rated` / `ratedStars` / `reported`, para no volver a
pedirle calificación a quien ya calificó.

**Verificado contra el servidor real** (12/12): el catch-up creó la tabla y el UNIQUE al
arrancar · calificar sin entregar → 409 · sin datos → 400 · reporte sin motivo → 400 ·
motivo inválido → 400 · estrellas fuera de rango → 400 · calificación válida se registra ·
**segundo intento sobre el mismo pedido → 409** · el tracking marca `rated` ·
promedio real calculado · token inválido → 404. Backend y frontend: 0 errores TS.

**Pendiente:** validar en navegador el flujo completo (F1→F5) con un pedido real.
F6 (moderación en superadmin) puede consumir `reported = 1` + `reviewed_at IS NULL`.

---

## F6 — implementada (2026-07-18)

**Sin tablas ni columnas nuevas**: `reviewed_at` y `reviewed_by` ya se dejaron previstas
en `courier_ratings` durante F5. Se reusó `CouriersTab` como decía el plan.

**Endpoints** (en `superadmin-orders.routes.ts`, ya protegido con
`authenticate` + `authorize('superadmin')`):
- `GET /superadmin/courier-reports?status=pendientes|revisados|todos` → `{ reports, pending }`
- `POST /superadmin/courier-reports/:id/review` → marca revisado; `{ reopen: true }` reabre

`GET /superadmin/couriers` se enriqueció con `avgStars`, `ratingsCount` y `openReports`,
y ordena por reportes abiertos primero — el problema sube solo a la vista.

**Principio de la moderación: revisar no borra.** Marcar como revisado guarda `reviewed_at`
+ `reviewed_by`; el reporte y su comentario quedan intactos y siempre se puede reabrir.
No hay endpoint de borrado, a propósito: un control de calidad que permite hacer
desaparecer las quejas no controla nada.

**`avgStars` es `null` cuando nunca lo calificaron** — la tarjeta muestra "Sin
calificaciones", no un 0. Un repartidor nuevo no es un repartidor malo.

**Verificado contra el servidor real, autenticado con JWT de superadmin** (15/15):
aparece en pendientes · contador correcto · trae motivo/repartidor/pedido · no está en
revisados · marcar revisado responde ok · queda constancia de quién y cuándo · pasa a
revisados y sale de pendientes · reabrir funciona y limpia `reviewed_at` · **el reporte
nunca se borra** · la tarjeta muestra reportes abiertos y promedio real · sin token → 401 ·
rol comerciante → 403. Backend y frontend: 0 errores TS.

---

## Estado final del plan (F1–F6 completas)

Datos nuevos en todo el plan: **1 tabla** (`courier_ratings`) y **2 columnas**
(`storefront_orders.courier_requested`, `courier_requested_at`). El resto fue conectar
piezas que ya existían, como decía la auditoría inicial.

### Bugs preexistentes encontrados y corregidos por el camino
1. **F3** · `PUT /delivery/accept/:orderId` tenía una carrera (SELECT + UPDATE separados):
   dos repartidores podían aceptar el mismo pedido.
2. **F4** · `delivery-chat.routes.ts` no verificaba tenant ni pertenencia en 3 rutas →
   cualquier usuario autenticado podía leer/escribir el chat de otro comercio. Además el
   filtro por tenant desaparecía para repartidores de plataforma (`tenant_id NULL`).

### ⚠️ Lo que NO está validado
**Nada de F1–F6 se ha probado en un navegador.** Toda la verificación fue contra el
backend (HTTP real + BD real): 4 + 13 + 12 + 15 = **44 comprobaciones**, todas pasando.
Pero la UI escrita —bloque de domicilio en el checkout, tarjeta de repartidor, chat,
calificación, panel de moderación— no la ha renderizado nadie.

**Siguiente paso recomendado antes de dar el módulo por cerrado:** un pedido real de punta
a punta con una tienda en `delivery_mode='plataforma'` y un repartidor de prueba en línea.

---

## 🐛 Bloqueador encontrado al intentar activarlo (2026-07-18)

Al responder "¿cómo activo los repartidores?" se probó el flujo real y **no funcionaba**:
un repartidor de plataforma se ponía en línea y el checkout seguía mostrando
`couriersOnline: 0`.

**Causa:** `PUT /delivery/availability` guarda `courier_availability.tenant_id` con
`req.user.tenantId || ''`. Un repartidor **de plataforma tiene `tenant_id NULL`** → la fila
se guarda con `''`. El conteo público exigía `ca.tenant_id = <tenant del comercio>`, que
nunca coincide. El feature completo (F1–F6) era inalcanzable para los repartidores de
plataforma, es decir, exactamente para quienes se construyó.

**Corregido** en `delivery-availability/:storeSlug`: el `JOIN courier_tenants` ya acota al
comercio, así que la condición pasa a
`(ca.tenant_id = ? OR ca.tenant_id = '' OR ca.tenant_id IS NULL)`.

**Verificado:** `couriersOnline = 1` con un repartidor de plataforma en línea (antes 0), el
checkout ve `enabled: true` con su tarifa, y el pedido con `courier_requested=1` aparece en
"Disponibles" del repartidor.

**Lección:** las 44 pruebas de F1–F6 pasaban porque cada una construía su propio escenario.
Ninguna recorría el camino que recorre un operador real de principio a fin. Probar las
piezas no es probar el flujo.

---

## 🐛 Segundo bloqueador: no existía forma de ponerse en línea (2026-07-18)

Al revisar la vista del repartidor se encontró que **`PUT /delivery/availability` no se
llamaba desde ninguna parte del frontend**. El endpoint existía desde antes, pero sin
interruptor en la UI: ningún repartidor podía marcarse como disponible, así que
`couriersOnline` era 0 siempre y el flujo de plataforma era inalcanzable — incluso después
de corregir el bug del `tenant_id`.

**Agregado en `driver-panel.tsx`** (la vista del repartidor, que se monta desde
`merchant-panel.tsx:122` cuando `role === 'repartidor'`):
- Interruptor **En línea / Fuera de línea** con estado visible.
- **Latido de disponibilidad**: la ventana del backend es de 5 minutos, así que un toggle
  único "se apagaba" solo. Ahora el reporte de GPS (cada 15s con entregas activas, cada
  2 min sin ellas) renueva `last_seen_at` mientras esté en línea.
- **Su calificación real** (`GET /delivery/my-rating`, que hasta ahora era código muerto:
  se creó en F5 y nadie lo consumía). Muestra "Aún sin calificaciones" cuando `average`
  es null — no un 0.

**Verificado contra el servidor real (10/10):** sin activar → 0 disponibles · activar → 1 ·
a los 4 min sigue contando · **a los 6 min deja de contar** (justifica el latido) · el
latido lo restaura · desactivar → 0 · `isOnline` no booleano → 400 · `/my-rating` → 200.

### Vista del repartidor — estado actual
`/panel` con rol `repartidor` → `DriverPanel`: mapa en vivo, GPS propio, pestañas
**Mis Pedidos / Disponibles / Historial**, aceptar pedido, cambiar estado de entrega con
prueba de entrega, chat, cola offline, y ahora estado en línea + calificación.
(`/delivery-os` es otra cosa: la consola de operación del comercio.)

---

## ✅ E2E completo del flujo (2026-07-18) — **41/41**

Script permanente: `backend/scripts/e2e-delivery.ts` → `npm run e2e:delivery`
(requiere el server arriba). Crea sus datos, recorre el flujo por HTTP real como
cada actor, y limpia todo al final restaurando la tienda.

Cubre: repartidor en línea → checkout ve disponibilidad → pedido → "buscando" →
difusión → aceptar (+ carrera) → cliente ve al repartidor → chat en ambos sentidos →
recogido → en camino → entregado → cierre del chat → calificar + reportar (+ doble
intento) → promedio del repartidor → moderación del superadmin → cierre del pedido.

### 🐛 EL 400 QUE REPORTÓ EL USUARIO — encontrado

**`theme2-order-flow.tsx` nunca enviaba `acceptsDataPolicy`.** El endpoint
`/orders/public` lo exige (Ley 1581, `requireDataPolicyConsent`) y responde 400.

**Ningún pedido del tema 2 podía crearse. Nunca.** No era un fallo de los domicilios:
el checkout completo del tema 2 estaba roto, con o sin repartidores. Los otros tres
checkouts (`CheckoutView`, `landing-page`, `checkout-wizard-ml`) sí lo enviaban.

Corregido con una **casilla real de consentimiento** (no un `true` hardcodeado — sería
fabricar una prueba legal): el botón de confirmar queda deshabilitado hasta marcarla,
con enlace a la política. El E2E incluye la regresión: sin el campo → 400.

### Otro error encontrado por el E2E
`/superadmin/couriers` devolvía `avgStars` como string `"2.00"` (mysql2 sobre `AVG`
de DECIMAL) mientras el frontend lo tipa `number`. Se ve bien pero rompe cualquier
comparación numérica. Normalizado en el backend, igual que ya hacía `/my-rating`.

### Recuento de bugs del módulo de domicilios
| # | Bug | Impacto |
|---|---|---|
| 1 | Carrera en `/delivery/accept` | Dos repartidores podían tomar el mismo pedido |
| 2 | Chat sin filtro de tenant (3 rutas) | Un comercio podía leer chats de otro |
| 3 | `courier_availability.tenant_id=''` | `couriersOnline` siempre 0 → flujo inalcanzable |
| 4 | Sin interruptor "en línea" en la UI | Ningún repartidor podía activarse |
| 5 | Falta `acceptsDataPolicy` en tema 2 | **Ningún pedido del tema 2 se creaba (400)** |
| 6 | `avgStars` string vs number | Inconsistencia de tipo entre backend y frontend |

Los 6 son **preexistentes o de integración**; ninguno lo introdujeron F1–F6. Los bugs
3, 4 y 5 solo aparecieron al recorrer el flujo completo — las 44 pruebas por fase no
los detectaron porque cada una montaba su propio escenario.

**Sigue pendiente:** validación visual en navegador. El E2E prueba el backend de punta
a punta, no que la UI renderice bien.

---

## 🖥️ Validación en navegador (2026-07-19) — flujo real recorrido

Escenario: tienda **`tienda-ropa-demo`** (`/t/tienda-ropa-demo`, theme2), repartidor de
prueba "Carlos Prueba" en línea. Pedido creado **desde el navegador**, no por script.
Datos de prueba eliminados y tienda restaurada a `delivery_mode='ninguno'` al terminar.

**Lo que se vio funcionando en pantalla:**
- Bloque de domicilio con datos reales: *"1 repartidor disponible ahora"*, $6.000
- Casilla de consentimiento + total $25.000 + $6.000 = **$31.000**
- Pedido creado con `courier_requested=1`, `tracking_token` y `consent_id`
- Seguimiento: **"Buscando repartidor…"** → tras aceptar, cambió **solo** a
  *"Carlos aceptó tu pedido"* + apareció el chat
- Chat en ambos sentidos, mensajes llegando en vivo
- Al entregar: *"Conversación finalizada"*, historial legible, prueba de entrega
- Calificación + reporte → *"Recibimos tu reporte"* → llegó al panel del superadmin
  con motivo, estrellas, pedido y comercio

### 🐛 Bugs que SOLO aparecieron en el navegador

| # | Bug | Impacto |
|---|---|---|
| 7 | **El tema 2 nunca enviaba `shippingCost`** | El cliente aceptaba $31.000 y el pedido guardaba $25.000: **los $6.000 del domicilio desaparecían**. Corregido en el backend con tarifa **autoritativa** desde `store_info` (si viniera del request, cualquiera pediría domicilio gratis). |
| 8 | **`users.phone` va cifrado** y se devolvía crudo | El botón "Llamar al repartidor" generaba `tel:e4ec8252…:283caefb…`. Imposible llamar. Corregido con `decryptNullable` en el tracking y en el evento de socket de F3. |
| 9 | Botón mudo sin el consentimiento | Con todo lleno y la casilla sin marcar, decía "Confirmar pedido" deshabilitado sin explicar. Ahora dice *"Falta: Aceptar política de datos"*. (Introducido por mí al agregar la casilla.) |
| 10 | Tarjeta congelada en "aceptó tu pedido" | Seguía igual con el pedido ya `en_camino`. Ahora refleja el estado: *"recogió tu pedido"* / *"va en camino"*. |
| 11 | `aria-label="1 estrellas"` | Detalle de accesibilidad. Corregido a *"1 estrella"*. |

**Lección:** los bugs 7 y 8 son de dinero y de contacto — los dos peores del módulo — y
**ninguna** de las 41 pruebas E2E los detectó, porque el script construía el payload a
mano en vez de usar el que arma la UI. El E2E prueba el backend; solo el navegador prueba
el contrato real entre frontend y backend.

**Total del módulo: 11 bugs encontrados**, de los cuales solo 2 los introduje yo (9 y 10).

---

## 🧭 Revisión de navegación (2026-07-19)

### Corregido
**12 · Mi casilla de consentimiento enlazaba a `/legal/politica-datos`, que NO EXISTE (404).**
No se puede pedir aceptar una política que el cliente no puede leer. Reemplazado por un
**modal** con `DEFAULT_PRIVACY_POLICY` + `fillTemplate` (mismo patrón que `CheckoutView` y
`checkout-wizard-ml`), con botón "Entiendo y acepto" que marca la casilla.
Verificado en navegador: abre, muestra la política real de Ley 1581, cierra y marca.

### Hallazgos reportados (no corregidos — decisión del dueño)
- **Página principal:** enlaces `Términos` y `Privacidad` con `href="#"` (muertos).
  Las redes sociales apuntan a `facebook.com` / `instagram.com` genéricos y a
  `api.whatsapp.com/send` sin número.
- **`/t/<slug-inexistente>` devuelve 200** y renderiza `LandingPage` con el catálogo de
  otra tienda, en vez de un "tienda no encontrada". Causa: en `app/t/[slug]/page.tsx` el
  theme cae a `'theme1'` cuando `store-config` no resuelve, sin estado de error.
- Rutas `/comercios`, `/ofertas`, `/novedades`, `/registro` dan 404, pero **ningún enlace
  apunta a ellas** (los botones son manejadores in-page), así que no rompen nada hoy.

### ⚠️ Lo que NO se pudo verificar
La navegación **basada en scroll** (botones "Inicio", "Nosotros", "Hacer Pedido",
"Ver comercios", "Ver todos") no pudo evaluarse: en el navegador automatizado **el scroll
no funciona** — ni `window.scrollTo`, ni `scrollIntoView` sobre el footer mueven la página.
Los "SIN EFECTO" que arrojó la primera medición son artefacto del entorno, no defectos
comprobados de la app. **Requiere revisión manual en un navegador real.**

---

## 🔧 Correcciones de UX y sesión (2026-07-19)

### 13 · Estado de la sesión anterior al entrar con otras credenciales — CORREGIDO
`useStore` (zustand) persistía en localStorage `activeSection`, **`cart`** y
**`storeInfo`**, pero `logout()` solo limpiaba `user`/`isAuthenticated`. Al iniciar
sesión con otro usuario en el mismo navegador sobrevivían:
- la **sección abierta** de la sesión anterior (el síntoma reportado),
- el **carrito del POS** del usuario anterior,
- los **datos de facturación** (nombre, NIT) del comercio anterior — cruce entre tenants.

Añadido `resetSession()` en `lib/store.ts`, llamado desde `lib/auth-store.ts` en
**logout, login y googleLogin** (este último solo si cambia el `user.id`). Conserva a
propósito las preferencias del equipo (cámara, sidebar), que no son del usuario.

### 14 · Botón "Instalar app" persistente — CORREGIDO
El descarte vivía solo en estado del componente: volvía a aparecer en cada navegación.
Ahora en `pwa-manager.tsx`: se **auto-oculta a los 20s** y el descarte se recuerda en
localStorage — 1 día si se ocultó solo, 7 días si el usuario lo cerró.

### 15 · "Volver" en móvil salía de la app — CORREGIDO
Al entrar a una tienda por **enlace directo** o como primera pantalla del PWA no había
historial previo, así que el botón volver cerraba la app. En `app/t/[slug]/page.tsx` se
agrega una entrada de historial **solo cuando no se viene navegando desde la app**
(`document.referrer` de otro origen o vacío); al retroceder redirige al inicio.
Se usa `window.location.replace('/')`: con `router.replace()` Next volvía a sincronizar
la URL de la tienda y el usuario se quedaba donde estaba.

También en `landing-page.tsx`, abrir una tienda que se muestra por estado ahora hace
`pushState(?store=<slug>)` + listener de `popstate`, para que retroceder cierre la tienda
en vez de salir del marketplace.

**Verificado en navegador:** entrada directa a `/t/tienda-ropa-demo` → volver → queda en
`/` dentro de la app. Navegación interna → volver → también queda en `/`.

### 16 · Enlaces "Términos" y "Privacidad" muertos — CORREGIDO
Eran `href="#"` en el pie de `home-theme2.tsx`. Ahora abren un modal con
`DEFAULT_TERMS` / `DEFAULT_PRIVACY_POLICY`. Verificado en navegador.

### Pendiente (no corregido, requiere decisión)
- `/t/<slug-inexistente>` sigue devolviendo 200 con el catálogo de otra tienda.
- Redes sociales del pie apuntan a `facebook.com` / `instagram.com` genéricos.
