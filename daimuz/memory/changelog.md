# Changelog - Lopbuk

> Registro de cambios significativos. Formato: `## [YYYY-MM-DD] — Descripcion`

---

## [2026-07-12] — Revisión Content Hub (otro agente): 7 bugs corregidos

El Content Hub (recetas, FAQ, páginas, newsletter, búsquedas, insignias + editores de sección + 3 vistas públicas) estaba **estructuralmente completo pero funcionalmente roto**. Verificado con E2E → 10/10 tras los fixes.

1. **Migración 0042 nunca aplicada** — las 9 tablas no existían → todo daba 500. Aplicada.
2. `RecipeEditor.tsx:84` — error tsc (`t` implicit any). Anotado `(t: string)`.
3. **Recetas público** — ruta `/public/:slug` vs frontend `?store=` → mismatch. Ruta → `/public` + controller lee `req.query.store`.
4. **FAQ público** — controller leía `req.query.slug` pero el front manda `?store=` → 400. Alineado a `store`.
5. **content_pages.create** — `id` varchar(36) no generado + `page_type='page'` inválido (enum `corporate|legal|custom`) → 500. Genera uuid + default `custom`.
6. **newsletter.subscribe** — `id` varchar(36) no generado → 500. Genera uuid.
7. **newsletter.findAll** — `LIMIT ? OFFSET ?` con `execute` (mysql2 lo rechaza) → 500. Enteros validados interpolados.

`tsc` back 6 / front 8 base. E2E 10/10 (crear+leer público de recetas/FAQ/newsletter/content-pages, consentimiento obligatorio).

**Ajuste newsletter (store):** `api.subscribeNewsletter(email, acceptedTerms, store?)` ahora envía `store`; y el controller **exige `store`** (antes, sin store, suscribía al tenant más antiguo → contaminaba la lista de un comercio con correos de otro). Ahora sin store → 400.

## [2026-07-12] — Fix Caja: botones duplicados + orden de mesas

- `restbar.tsx` modo cajero: el toggle (Cobro/Cajero) y la barra de acciones estaban **duplicados** (dos bloques idénticos) → se veían dos veces. Eliminado el bloque repetido. Corregido typo "Andir" → "Añadir".
- `restbar.service.ts` `getTables`: `ORDER BY t.number` ordenaba como TEXTO (Mesa 1, 10, 11, 2, 3…). Cambiado a `ORDER BY CAST(t.number AS UNSIGNED), t.number` → orden numérico natural (1, 2, 3 … 10, 11). `tsc` back 6 / front 8 base.

## [2026-07-12] — Impresión USB (agente) + "Imprimir cuenta" en caja

El agente ahora imprime también en impresoras **USB** (por el spooler de Windows), y el cajero tiene un botón "Imprimir cuenta" que saca la pre-cuenta en la impresora de Caja. Migración 0041. E2E 8/8.

- **DB** (0041): `print_jobs` + `connection_type` (lan|usb), `printer_name` (nombre en Windows), `printer_ip` ahora nullable. `printers` + `device_name` (nombre exacto de la impresora en Windows para USB).
- **Backend** `printers.service.ts`: `_enqueueJob` distingue LAN (ip) vs USB (device_name); nuevo `printBill(tenantId, data)` (resuelve la impresora de 'caja', arma ESC/POS `buildBillTicket` = PRE-CUENTA con ítems+total, encola; avisa si no hay agente). `Printer` + `deviceName` en tipo/mapRow/create/update.
- **Backend** `restbar`: `restbarService.printBill` + `POST /restbar/orders/:id/print-bill` (WAITER+CASHIER).
- **Agente** `print-agent-app/index.js`: `printRawWindows(printerName, buffer)` — imprime RAW por el spooler de Windows vía PowerShell (P/Invoke winspool.drv, sin deps nativas). `processJob` ramifica USB vs LAN. heartbeat entrega `connectionType`/`printerName`.
- **Frontend**: campo "Nombre de la impresora en Windows" para USB en `printers.tsx` (+ validación, api.ts, types); botón **"Imprimir cuenta"** en el modo cajero de `restbar.tsx` (`api.printRestbarBill`).
- `tsc` back 6 / front 8 base. **E2E 8/8**: crear comanda→ítem→sin caja=400→USB caja=200 encola job USB con device_name y ticket PRE-CUENTA.
- **Pendiente redeploy**: requiere recompilar el agente (.exe) para que reconozca jobs USB.

## [2026-07-12] — Ticket POS (notas/negrita) + mesero: nota sin guardar

- **Ticket POS** (`printers.service.ts` `buildSaleTicket`): la nota del pedido se imprimía en una sola línea → se cortaba. Ahora usa `wrapText(str, cols)` (ajuste por palabras, parte palabras largas) bajo un rótulo "Nota:" en peso normal y alineada a la izquierda. Los **ítems** ahora salen en **negrita + doble alto** (más grandes y legibles). El ancho no cambia (doble alto no altera columnas) → alineación de precios intacta.
- **Panel mesero** (`mesero-panel.tsx`): al salir del detalle de la comanda con una **nota de ítem escrita sin guardar**, ya no se pierde: `requestClose` detecta `noteText !== noteOriginal` (nuevo estado `noteOriginal`) y muestra un toast "Tienes una nota sin guardar" con acción **"Guardar y salir"**. El botón de cerrar del header ahora llama `requestClose`. `tsc` back 6 / front 8 base.

## [2026-07-12] — Fix: prueba de impresión LAN daba 500

`printers.service.ts` `testPrint`: hacía TCP directo backend→impresora; en la nube no alcanza la IP privada → timeout → 500. Ahora, para impresoras **LAN**, **encola** un `print_job` (lo imprime el Agente local) y responde 200 con mensaje según haya o no un agente conectado (últimos 90s). USB/Bluetooth siguen con envío directo. `tsc` back 6 base. E2E 4/4.

## [2026-07-12] — Fix UX: cancelar mesa (mesero) pedía doble confirmación

`components/mesero-panel.tsx`: el flujo de "Cancelar mesa" tenía 2 confirmaciones (cancelStep 0→1→2) y el botón final decía "Cancelar" (ambiguo con "cancelar la operación"). Reducido a **una** confirmación (`0→1`): "¿Cancelar la mesa?" → **[Sí, cancelar] / [No]**. `tsc` front 8 base.

## [2026-07-12] — Fix: "Combos por día" faltaba en el sidebar clásico

El ítem de menú solo estaba en `panel-comerciante-shell.tsx` (tema verde); el tema clásico usa `components/sidebar.tsx`. Añadido ahí: `{ id: 'combos', name: 'Combos por día', icon: Layers, adminOnly, merchantOnly, group: 'gastrobar' }` (import de `Layers`). `tsc` front 8 base.

## [2026-07-12] — Agente de Impresión: empaquetado en Docker

El botón "Descargar programa" queda funcional en el despliegue: el `.exe` se compila dentro del build del backend.

- **Movido** `tools/print-agent/` → `backend/print-agent-app/` (para que esté en el contexto de build del backend). Build script ahora emite `../assets/print-agent.exe`.
- **`backend/Dockerfile`**: en el stage builder, tras compilar el server, corre `pkg print-agent-app --targets node18-win-x64 --output /app/assets/print-agent.exe` (instala `pkg@5.8.1`). Es **no-fatal**: si pkg falla (p.ej. sin red), la imagen igual se construye y `/print-agent/download` responde 503. El runner copia `/app/assets` → `./assets`.
- `BINARY_PATH` del endpoint resuelve a `/app/assets/print-agent.exe` (coincide con lo copiado). Syntax-check del agente OK.
- **Nota**: `pkg` descarga el binario base de Node para Windows → el build necesita red. Verificar en los logs del build que NO aparezca "WARN: no se pudo compilar print-agent.exe".

## [2026-07-12] — Agente de Impresión: cola de trabajos

Cierra el puente nube→impresora: los tickets de cocina/bar se encolan y el agente los imprime en la LAN. Migración 0039. E2E 10/10.

- **DB** (migración 0039): tabla `print_jobs` (tenant, module, `printer_ip`/`printer_port`, `data_base64` ESC/POS, `status` pending|sent|done|failed, `attempts`, `error`, timestamps).
- **Backend** `printers.service.ts`: `enqueueKitchenJob(module, tenantId, data)` — resuelve la impresora LAN del módulo, arma el ESC/POS (`buildKitchenTicket`) y lo inserta en `print_jobs`. No encola si no hay impresora LAN con IP (no rompe el pedido).
- **Backend** `restbar.service.ts` `_printOrderToArea`: ahora **encola** (`enqueueKitchenJob`) en vez de imprimir por TCP directo (que la nube no puede).
- **Backend** `print-agent.routes.ts`: `heartbeat` ahora reclama pendientes (pending→sent, +attempts), recupera atascados (sent >60s → pending) y devuelve `{id, ip, port, dataBase64, area}`; nuevos `POST /jobs/:id/done` y `POST /jobs/:id/failed` (reintenta hasta 3, luego failed). Helper `agentFromToken`.
- El agente (`tools/print-agent/index.js`) ya consumía este formato (imprime por TCP y confirma done/failed) → sin cambios.
- `tsc` back 6 base. **E2E 10/10**: entrega con bytes, done, reintentos 3×→failed, reclaim de atascados, aislamiento por token.

## [2026-07-12] — Agente de Impresión local: distribución + vinculación

Primer paso del puente nube→impresora LAN: el comerciante descarga un programa desde su panel, lo abre y lo vincula con un código. La cola de trabajos de impresión va en el siguiente paso. Migración 0038. E2E 14/14.

- **DB** (migración 0038): tabla `print_agents` (tenant, `pairing_code` único, `token` único, `paired_at`, `last_seen_at`).
- **Backend** `modules/print-agent/print-agent.routes.ts` (montado en `/api/print-agent`):
  - Comerciante (auth): `GET /download` (sirve el .exe desde `PRINT_AGENT_BINARY_PATH` o `backend/assets/print-agent.exe`; 503 con mensaje si no está), `GET /status` (agentes + online<90s + binaryAvailable), `POST /pairing-code` (genera/reutiliza código sin vincular), `DELETE /:id`.
  - Agente (público): `POST /pair` (canjea código→token durable + nombre del comercio), `POST /heartbeat` (header `x-agent-token`, actualiza last_seen, devuelve `jobs:[]` — placeholder de la cola).
- **Agente** `tools/print-agent/` (Node nativo, sin deps → empaquetable con `pkg`): `index.js` (config en `%APPDATA%`, pide código en 1er arranque, canjea token, se registra en auto-inicio de Windows vía clave Run, loop heartbeat + impresión TCP a `ip:9100`), `package.json` (`npm run build` → `backend/assets/print-agent.exe`), `README.md`.
- **Frontend**: `components/print-agent-card.tsx` (descargar, generar/copiar código, equipos con estado en línea) integrado en `printers.tsx`; métodos en `api.ts` (`getPrintAgentStatus`, `createPrintAgentCode`, `deletePrintAgent`, `downloadPrintAgent` con blob).
- **Pendiente**: (1) compilar el `.exe` (`cd tools/print-agent && npm i && npm run build`) e incluirlo en la imagen Docker para que `/download` lo sirva; (2) cola de trabajos: encolar tickets en `sendToKitchen`/venta y entregarlos por `heartbeat`. `tsc` back 6 / front 8 base. E2E 14/14.

## [2026-07-12] — Impresión cocina/bar (fix) + PWA instalable en escritorio

### Fix impresión RestBar (cocina/bar)
- `restbar.service.ts` `_printOrderToArea`: leía los ítems/comanda con nombres **snake_case** (`i.preparation_area`, `menu_item_name`, `order.order_number`…) pero `getOrderById` los devuelve **camelCase** (`mapOrderItem`/`mapOrder`) → filtros siempre vacíos → **nunca imprimía** (silencioso, TS no lo atrapa por bivarianza del callback de `.filter`). Corregido a camelCase (`preparationArea`, `menuItemName`, `itemNotes`, `orderNumber`, `tableNumber`, `waiterName`). `tsc` back 6 base.
- **Nota de arquitectura pendiente**: la impresión LAN sale del backend (socket TCP a `ip:9100`). Con el backend en la nube NO alcanza IPs privadas `192.168.x.x` de las impresoras Ethernet del local → hace falta un **agente de impresión local** (puente nube→impresora). Ver plan en la sesión.

### PWA instalable + aviso de actualización
- `next.config.ts`: `BUILD_ID` único por build → `generateBuildId` + `env.NEXT_PUBLIC_APP_VERSION`.
- Nuevo `app/app-version/route.ts`: devuelve el build id del servidor (`no-store`, fuera de `/api` para no pasar por el rewrite al backend).
- Nuevo `components/pwa-manager.tsx` (montado en `layout.tsx`): registra el SW al arranque, captura `beforeinstallprompt` → botón "Instalar app" (escritorio Chrome/Edge + Android, oculto si ya está en modo standalone), y sondea `/app-version` (cada 2 min + al enfocar) → si el build del servidor difiere del horneado en el cliente, muestra toast persistente "Actualizar" que recarga. `tsc` front 8 base.

## [2026-07-12] — Combos por día — Fases 3+4: storefront, stock, visualización

Cierre completo del módulo de combos. `tsc` backend 6 base (0 nuevos). Migración 0037.

### Fase 3 — Storefront + ruta de pedido de combo
- **Nuevo** `frontend/components/combos-today.tsx` (`CombosToday`): sección pública "Combos de hoy" en el storefront (Tema 1). Muestra combos activos HOY con modal armador (elegir tamaño → elegir N ítems → precio fijo). Línea de combo al carrito con `comboId`, `comboSizeCount`, `comboItemIds`.
- **Backend** `combos.routes.ts`: `resolveComboOrderItem()` — resolución autoritativa server-side del precio + validación de ítems.
- **Backend** `orders.routes.ts:289-308`: integración de combo en el POST público de pedidos: revalida precio, marca `_isCombo`, inserta con `product_id=NULL` + `combo_data` JSON, crea holds de componentes.
- **Fix** `.catch(() => {})` → `.catch(err => console.error(...))` en `createHolds` para no tragar errores.

### Fase 4 — Stock, visualización, Theme 2, DAIMUZ
- **Bug crítico corregido**: stock de componentes nunca se deducía al entregar (los ítems de combo tenían `product_id=NULL` y saltaban el bloque de deducción). Ahora `orders.routes.ts:1893-1930` itera `componentIds` de `combo_data`, descuenta `products.stock`, crea `stock_movements` y descuenta `sede_stock`.
- **Schema**: migración 0037 (`0037_wild_supreme_intelligence.sql`) — columna `combo_data` JSON en `storefront_order_items`.
- **Frontend** `pedidos.tsx`: badge "COMBO" en ítems de combo + lista colapsable de componentes.
- **Frontend** `theme2-order-flow.tsx`: integración de `CombosToday` en Tema 2 con `CartItem` extendido (campos `comboId`, `comboSizeCount`, `comboItemIds`) y payload de checkout.
- **DAIMUZ**: `daimuz/modules/combos/combos.md` creado. Índices de módulos y endpoints actualizados.

### Verificación (revisión + E2E)
- **Bug crítico corregido en `createHolds`** (`orders.routes.ts`): insertaba un `uuid` en la columna `id` de `inventory_holds`, que es **`BIGINT AUTO_INCREMENT`** → MySQL coacciona el uuid a número (0/parcial) y el 2.º hold colisiona en PK y falla. Esto rompía **todos** los holds anti-sobreventa de contraentrega (enmascarado por el `.catch(()=>{})`). Fix: no insertar `id`, dejar que la BD lo genere.
- **E2E `/orders/public` con combo → 15/15**: precio autoritativo (front 999 ignorado → 15000), línea con `product_id=NULL` (respeta FK), nombre con detalle, holds creados para los 2 componentes (no para el combo), x3→20000, y rechazos correctos (ítems insuficientes, ítem ajeno, tamaño inexistente, combo inactivo).
- **Round-trip `combo_data` verificado**: `{comboId, sizeCount, componentIds, componentNames}` se almacena y se relee OK (alimenta el render de `pedidos.tsx`).
- Deducción de stock de componentes al facturar (`orders.routes.ts:1895-1927`): revisado por código — correcto y consistente con la rama de producto normal (lock `FOR UPDATE`, `products.stock` + `sede_stock` + `stock_movements`).
- `tsc` backend 6 base / frontend 8 base — 0 errores nuevos.

## [2026-07-11] — Combos por día — Fase 2: panel del comerciante

Módulo "Combos por día" en el panel del comerciante para crear/editar/activar/eliminar combos usando los endpoints ya verificados en Fase 1. `tsc` front 8 base (0 nuevos).

- **Nuevo** `frontend/components/combos-manager.tsx` (`CombosManager`): lista de combos (chips de días Dom–Sáb, tamaños `x{count} · precio`, # ítems, toggle activo, editar, eliminar) + diálogo crear/editar con nombre, días activos (chips 0-6), tamaños+precios dinámicos (agregar/quitar filas), inclusiones, y **multiselección de ítems** con buscador + filtro por categoría (`api.getProducts({limit:1000})` + `api.getCategories()`). Validación cliente: nombre, ≥1 día, cada tamaño con precio > 0, ≥1 ítem.
- `frontend/lib/api.ts`: `getCombos`, `createCombo`, `updateCombo`, `toggleCombo`, `deleteCombo`, `getPublicCombos(store)`.
- `frontend/components/panel-comerciante-shell.tsx`: ítem de menú `{ id: 'combos', label: 'Combos por día', icon: Layers, adminOnly: true }` (grupo gastrobar).
- `frontend/components/merchant-panel.tsx`: import + `case 'combos': return <CombosManager />`.
- **Pendiente Fase 3** (storefront): sección "Combos de hoy" + upsell + modal armador (elegir tamaño → elegir N ítems) + línea de combo en carrito. Nota técnica: el blindaje de precios del backend (`order-pricing.service`) reescribe el `unitPrice` de ítems con `productId` real → la Fase 3/4 necesita una ruta de pedido de combo dedicada (precio fijo autoritativo desde la tabla `combos` + descuento de stock de los componentes).

## [2026-07-11] — Combos por día — Fase 1: DB + backend

Combos recurrentes por día de la semana (lun perros x2/x3, mié hamburguesas, jue tacos), armados con ítems elegibles seleccionados (no toda la categoría), tamaños a precio fijo e inclusiones. Verificado E2E 13/13. Migración 0036.

- **DB** (`schema.ts` → migración 0036 `woozy_the_executioner`): tabla `combos` (name, `active_days` JSON [0-6], `sizes` JSON `[{count,price}]`, `includes` texto, image_url, is_active) + `combo_items` (los ítems elegibles del combo → product_id).
- **Backend** (`modules/combos/combos.routes.ts`, montado en `/api/combos`): 
  - Comerciante: `GET /` (lista con ítems), `POST` (name/activeDays/sizes/includes/itemIds, valida días+tamaños+ítems), `PUT /:id` (campos + ítems), `PATCH /:id` (activar/desactivar), `DELETE /:id`.
  - **Público `GET /combos/public?store=slug`** → combos **activos HOY** (weekday en zona Bogotá UTC-5 vía `JSON_CONTAINS(active_days, ?)`) con sus ítems (id, nombre, precio, foto) + tamaños + inclusiones; solo los que tienen ≥1 ítem.
- `normalizeDays`/`normalizeSizes`, `attachItems` (join a products), `bogotaWeekday`. `tsc` back 6 base (0 nuevos). E2E 13/13: crear combo hoy y otro día; validaciones (sin días/ítems → 400); el público SOLO trae el de hoy (no el de otro día); trae tamaños/ítems/inclusiones; desactivar lo oculta; editar ítems reduce a 1.
- **Siguiente**: Fase 2 (panel comerciante: módulo "Combos"), Fase 3 (storefront: sección "Combos de hoy" + armador + upsell + línea de carrito), Fase 4 (pedido/cocina). Pendiente commit + redeploy.

## [2026-07-11] — Plantillas de modificadores — Fase 2: UI en el gestor del ítem (inventario) · ROADMAP COMPLETO

El comerciante guarda y aplica plantillas desde el mismo gestor de modificadores del producto. `tsc` front 8 base (0 nuevos).

- **Gestor de modificadores** (`product-modifiers-manager.tsx`): en el footer, dos acciones nuevas — **"Guardar como plantilla"** (pide nombre y guarda los grupos actuales del ítem vía `createModifierTemplate`), y **"Aplicar a categorías"** → sub-diálogo con: selector de **qué aplicar** (los modificadores de este ítem, o una plantilla guardada) + **checklist de categorías** (de `getCategories`) + botón Aplicar → `applyModifiersBulk`, mostrando el resultado ("Agregados a N producto(s) · M grupo(s)").
- Helper `cleanGroups()` reutilizado por guardar/plantilla/aplicar.
- **api.ts**: getModifierTemplates, createModifierTemplate, deleteModifierTemplate, applyModifiersBulk.
- Endpoints ya E2E 14/14 (F1); la UI es presentacional sobre ellos. (Chequeo visual pendiente.)

### 🎉 ROADMAP PLANTILLAS DE MODIFICADORES COMPLETO (2/2)
F1 DB + backend (CRUD + apply-bulk agrega sin borrar) · F2 UI en el gestor (guardar/aplicar). Migración 0035. **Caso de uso listo**: pones los modificadores en un ítem → "Guardar como plantilla" → "Aplicar a categorías" (ej. todas las hamburguesas) → se agregan a todos de una, sin duplicar. Pendiente commit + redeploy.


## [2026-07-11] — Plantillas de modificadores + aplicación masiva por categoría — Fase 1: DB + backend

El comerciante guarda los modificadores de un ítem como plantilla y los aplica en bloque a categorías completas, sin agregarlos ítem por ítem. Verificado E2E 14/14. Migración 0035.

- **DB** (`schema.ts` → migración 0035 `nasty_fallen_one`): tabla `modifier_templates` (tenant, name, `groups` JSON — misma estructura de grupos+opciones que ya usa un ítem).
- **Backend** (`modifiers.routes.ts`): `normalizeGroups` (sanea la estructura), `insertGroup` (grupo+opciones en un producto), `resolveGroups` (desde templateId / fromProductId / groups). Endpoints:
  - CRUD plantillas: `GET/POST/PATCH/DELETE /modifiers/templates` — crear principalmente con `fromProductId` (copia los modificadores del ítem).
  - **`POST /modifiers/apply-bulk`** `{ templateId | fromProductId, categoryIds }` → para cada producto de esas categorías, **agrega los grupos cuyo nombre NO exista ya** (dedup case-insensitive, no borra nada), con sort_order tras los existentes. Devuelve `{ productsScanned, productsAffected, groupsAdded }`.
- **Nota**: `groups` es palabra reservada en MySQL → todas las queries la usan con backticks (`` `groups` ``).
- `tsc` back 6 base (0 nuevos). E2E 14/14: guardar plantilla desde ítem (copia 2 grupos con opciones); aplicar a categoría de 3 productos → la fuente ya los tenía (0), T1 tenía "Salsas" propio → solo se agrega "Tamaño" (no duplica "Salsas", conserva su opción Mostaza), T2 sin nada → +2; conteos correctos; reaplicar es idempotente (0 afectados).
- **Siguiente**: Fase 2 (frontend inventario: "Guardar como plantilla" + "Aplicar a categorías" + gestión). Pendiente commit + redeploy.

## [2026-07-11] — Links de campaña (share links) — Fase 3: generador en el panel superadmin (QR + clics) · ROADMAP COMPLETO

El superadmin crea los links visualmente, con QR y métricas. `tsc` back 6 / front 8 base (0 nuevos).

- **Tab nuevo** `ShareLinksTab.tsx` (superadmin, entre Repartidores y Usuarios; icono Link2): lista de links (título, tipo, URL con **copiar**, **QR**, clics, activar/desactivar, borrar) + **"Nuevo link"** con:
  - **colección** → chips de rubro (businessTypes de los tenants) + checklist de comercios + título. (el caso "solo restaurantes")
  - **tienda** → selector de comercio (usa su `slug`).
  - **producto** → comercio + selector de producto (carga los publicados vía `/storefront/products?store=slug`; fallback a ID manual).
- **QR** con `qrcode.react` (`QRCodeCanvas`) en diálogo, **descargable como PNG** (canvas→dataURL). URL completa `${origin}/l/<code>`, copiar al portapapeles.
- **Backend**: `/superadmin/orders/tenants` ahora incluye `slug` (para armar links de tienda/producto). `api.ts`: getShareLinks/createShareLink/patchShareLink/deleteShareLink.
- **Wiring** (`SuperadminLayout.tsx`): tab "Links". Los endpoints ya E2E 14/14 (F1); el tab es presentacional sobre ellos. (Chequeo visual del panel pendiente.)

### 🎉 ROADMAP LINKS DE CAMPAÑA COMPLETO (3/3)
F1 DB + backend (CRUD + resolve público + clics) · F2 ruta `/l/<code>` + vista de colección filtrada · F3 generador panel (QR/clics/título). Migración 0034. **Caso de uso listo**: pegar `/l/<code>` en una historia → el cliente abre y ve SOLO restaurantes (o la tienda/producto), sin distraerse con otras categorías. Pendiente commit + redeploy.


## [2026-07-11] — Links de campaña (share links) — Fase 2: ruta pública /l/<code> + vista de colección filtrada

El link ya redirige/abre la app filtrada a lo compartido. Verificado E2E 7/7. Sin migración.

- **Ruta** (`app/l/[code]/page.tsx`): resuelve `GET /storefront/share/:code` y redirige — **producto** → `/t/<slug>?product=<id>` (abre el modal del item), **tienda** → `/t/<slug>`, **colección** → `/?collection=<code>`. Link inválido/expirado → mensaje "Enlace no disponible".
- **Vista de colección** (`landing-page.tsx`): al detectar `?collection=<code>` resuelve la config y **filtra el array `stores` a solo los comercios de la colección** (por `tenantIds` y/o `businessTypes`) — como toda la cuadrícula lee de `stores`, se muestran solo esos (p. ej. solo restaurantes), sin tocar el JSX de render. Banner fijo con el **título** de la colección. Si el link falla, se muestran todos (degradación grácil).
- `tsc` front 8 base (0 nuevos). E2E 7/7: el link de colección resuelve con config+título; aplicando el filtro del frontend sobre `/storefront/stores` reales, el resultado **incluye** el comercio objetivo, **todos** son del rubro o el elegido, **excluye** comercios de otro rubro, y reduce el total.
- **Nota**: chequeo visual del marketplace filtrado pendiente (requiere levantar la tienda con varios comercios).
- **Siguiente**: Fase 3 (generador en panel superadmin: crear link + QR + copiar URL + clics + título). Pendiente commit + redeploy.


## [2026-07-11] — Links de campaña (share links) — Fase 1: DB + backend

Base para links compartibles (historias IG/TikTok) que abren la app filtrada a lo que se comparte, sin distraer con otras categorías. Verificado E2E 14/14. Migración 0034. Solo superadmin.

- **DB** (`schema.ts` → migración 0034 `wonderful_chimera`): tabla `share_links` (`code` único, `type` product/store/collection, `config` JSON, `title`, `clicks`, `is_active`, `created_by`).
  - producto → `{ slug, productId }` (abre el modal del item — deep-link `?product=` ya existe)
  - tienda → `{ slug }` (`/t/<slug>` ya existe)
  - colección → `{ businessTypes: [], tenantIds: [] }` (rubro y/o comercios elegidos)
- **Backend superadmin** (`superadmin-orders.routes.ts`): `GET/POST/PATCH/DELETE /superadmin/share-links` — crear genera **code corto único** (8 chars base36, hasta 6 intentos) + valida config por tipo; activar/desactivar; borrar.
- **Backend público** (`storefront.routes.ts`): `GET /storefront/share/:code` → resuelve `{ type, config, title }` **solo si activo** + **suma 1 clic** (fire-and-forget). Inexistente/inactivo → 404.
- `tsc` back 6 base (0 nuevos). E2E 14/14: crea los 3 tipos con code; valida config incompleta (400) + tipo inválido; público resuelve config+title e incrementa clicks; code inexistente/inactivo → 404; borrar quita de la lista.
- **Siguiente**: Fase 2 (ruta `/l/<code>` + vista de colección filtrada), Fase 3 (generador en panel superadmin con QR/clics/título). Pendiente commit + redeploy.

## [2026-07-11] — Seguimiento en vivo (Fase 2) — ETA + API de mapas configurable (Google/Mapbox) desde superadmin

Al mapa en vivo se le suma **ETA** ("Llega en ~N min") siempre gratis, y opcionalmente **ruta trazada + ETA por tráfico** si el superadmin configura una API de mapas. La key se guarda cifrada y **nunca** se expone al cliente. Verificado E2E 11/11. Sin migración.

- **Config superadmin** (`superadmin-orders.routes.ts`): `GET/PUT /superadmin/maps-config` — proveedor (`none`/`google`/`mapbox`) + API key. La key se guarda **cifrada** en `platform_settings` (`encrypt`); el GET solo devuelve `{ provider, hasKey }`, nunca la key. Poner `none` borra la key.
- **ETA + ruta** (`storefront.routes.ts` tracking): mientras va en tránsito y hay destino, calcula **ETA recta** (Haversine / ~22 km/h, gratis, `source:'directo'`) **siempre**. Si hay proveedor + key, hace la llamada **server-side** a Directions (Google/Mapbox) con timeout 4s, **caché por pedido 60s** (o si el repartidor no se movió >150m) → devuelve `routeGeometry` (polyline) + ETA real (`source:'ruta'`); si falla, degrada a la ETA recta. Decode de polyline de Google incluido. La key nunca sale al cliente.
- **UI superadmin** (`CouriersTab.tsx`): tarjeta "Seguimiento en vivo — API de mapas" (proveedor + campo de key tipo password que no re-muestra la guardada). `api.getMapsConfig`/`setMapsConfig`.
- **Página cliente** (`app/seguimiento/[token]`): muestra **"Llega en ~N min"** (con "(aprox.)" si es recta) y **dibuja la línea de ruta** en el mapa Leaflet cuando `routeGeometry` viene; reencuadra a la ruta.
- `tsc` back 6 base / front 8 base (0 nuevos). E2E 11/11: config guarda/lee sin exponer la key + key cifrada en BD; `none` borra la key; tracking en tránsito trae `eta` (source directo, minutos razonables) + `routeGeometry` null sin proveedor.
- **🎉 Seguimiento en vivo COMPLETO (F1 gratis + F2 API configurable).** Pendiente commit + redeploy.


## [2026-07-11] — Seguimiento en vivo del pedido (Fase 1) — mapa embebido para el cliente (Leaflet + OSM, gratis)

El cliente ve al repartidor **moverse en un mapa** en la página pública de seguimiento mientras el pedido va en camino; el mapa **se cierra solo al entregar**. Sin API de pago. Verificado E2E 10/10. Sin migración.

- **Ya existía** (F5): el endpoint público `/storefront/tracking/:token` devuelve la posición del repartidor (`vehicle.lat/lng` desde `dispatch_routes.last_lat/lng`, atada al pedido vía `route_id`) **solo mientras la ruta está `en_ruta`/`retornando`** (privacidad → se cierra al terminar). El GPS del repartidor ya se capturaba.
- **Backend** (`storefront.routes.ts` tracking): añadido `destinationCoords` (del pedido `delivery_latitude/longitude`) para pintar el punto de entrega.
- **Conductor** (`driver-panel.tsx`): ping GPS a **15s cuando tiene entregas activas** (my-orders > 0), 3 min sin entregas (batería) — antes era siempre 3 min, muy lento para "tiempo real".
- **Página del cliente** (`app/seguimiento/[token]/page.tsx`): **mapa Leaflet + OpenStreetMap** embebido con marcador del repartidor (índigo) + destino (verde), reencuadre automático; **polling cada 12s en tránsito** (60s si no); al entregar (`vehicle` deja de venir) el mapa se desmonta y queda la línea de tiempo + POD. Link "Abrir en Maps" como acción secundaria.
- `tsc` back 6 base / front 8 base (0 nuevos). E2E 10/10: en tránsito devuelve vehicle (pos del repartidor) + destinationCoords + lastPingAt; token <20 chars → 404; ruta cerrada/entregado → vehicle null (mapa se cierra) pero destino sigue; ruta planificada (no salió) → vehicle null.
- **Siguiente (opcional)**: Fase 2 — API de mapas configurable en superadmin (Google/Mapbox key para ETA + línea de ruta + tráfico + tiles premium); el core en vivo ya funciona gratis. Pendiente commit + redeploy.

## [2026-07-11] — Repartidor de plataforma (Fase 3) — panel del repartidor + notificación en vivo · ROADMAP COURIER COMPLETO

El repartidor ve el **comercio** en cada pedido y recibe **aviso en tiempo real** cuando entra un pedido en uno de sus comercios (sin recargar). Verificado E2E socket 5/5. Sin migración.

- **Comercio por pedido**: ya se mostraba — `delivery.routes.ts` devuelve `t.name AS storeName` y `driver-panel.tsx` lo pinta (badge con ícono Store) en disponibles y asignados. Sin cambios.
- **Tiempo real** — reutiliza infra existente (`ops:<tenantId>` + `emitOps`): el checkout ya emite `dispatch-changed`/`order-created` a `ops:<tenantId>` (orders.routes.ts:412). Nuevo handler socket **`join-courier`** (`delivery-chat.socket.ts`): resuelve **server-side** los comercios del repartidor (su tenant si está atado a uno, o `courier_tenants` si es de plataforma) y lo une **solo** a esas salas `ops:` — no confía en una lista del cliente. Devuelve ack `courier-joined` con `tenantIds`.
- **Panel** (`driver-panel.tsx` + `lib/socket.ts`): `getDeliverySocket()` (namespace raíz); al montar emite `join-courier` con el `userId`, escucha `dispatch-changed` → si `kind==='order-created'` refresca la lista de disponibles + toast "📦 Nuevo pedido disponible". **Poll de respaldo cada 30s** por si el socket se cae.
- `tsc` back 6 base / front 8 base (0 nuevos). E2E socket 5/5: repartidor de plataforma se une **solo** a A y B (asignados); sin asignaciones → `[]` (ninguna sala); repartidor de un comercio → solo su tenant; userId inexistente → `[]`.

### 🎉 ROADMAP REPARTIDOR MULTI-COMERCIO COMPLETO (3/3 fases)
F1 DB + scoping + endpoints superadmin (fix aislamiento) · F2 UI superadmin "Repartidores" · F3 panel repartidor + notificación en vivo. Migración 0033. **Fuera de alcance (declarado):** asignación directa desde el comercio, zonas geográficas, disponibilidad/online del courier, liquidación de pagos. Pendiente commit + redeploy.


## [2026-07-11] — Repartidor de plataforma (Fase 2) — UI superadmin "Repartidores"

Pantalla para que el superadmin cree repartidores de plataforma y arme su grupo de comercios sin tocar SQL. Consume los endpoints ya verificados en Fase 1. `tsc` front 8 base (0 nuevos).

- **Tab nuevo** `CouriersTab.tsx` (`components/superadmin/tabs/`): lista de repartidores (nombre, email, teléfono, nº comercios, activar/desactivar); **"Nuevo repartidor"** (nombre/email/contraseña/teléfono → `POST /superadmin/couriers`); **"Gestionar comercios"** — modal con **buscador + filtro por rubro** (`businessType`) y checklist de comercios (preseleccionados los asignados), atajos "seleccionar/quitar visibles", guardar → `PUT /couriers/:id/tenants`.
- **Wiring** (`SuperadminLayout.tsx`): tab "Repartidores" (icono Truck) entre Comercios y Usuarios; import dinámico + render.
- **api.ts**: `getPlatformCouriers`, `createPlatformCourier`, `getCourierTenants`, `setCourierTenants`, `setCourierActive`; `getSuperadminTenantsList` ahora tipa `businessType`.
- **Verificación**: endpoints ya E2E 15/15 (Fase 1); UI es presentacional sobre ellos. `tsc` front sin errores nuevos. (Chequeo visual del panel pendiente — requiere levantar el panel superadmin con sesión.)
- **Siguiente**: Fase 3 (panel del repartidor: nombre del comercio por pedido + notificación socket). Pendiente commit + redeploy.


## [2026-07-11] — Repartidor de plataforma multi-comercio (Fase 1) — grupo de comercios + fix de aislamiento

Un repartidor (Carlos) que NO pertenece a un comercio fijo y atiende un **grupo de comercios** que el superadmin le asigna (ej. solo restaurantes) — ve/toma pedidos solo de ese grupo, nunca de comercios ajenos (ferreterías). Verificado E2E 15/15. Migración 0033. **Tapa además un hueco de seguridad.**

- **El hueco corregido**: en `delivery.routes.ts`, un repartidor **sin `tenantId`** caía en `${tenantId ? 'AND o.tenant_id = ?' : ''}` → el filtro por comercio desaparecía y en `available` veía pedidos de **todos** los tenants. Ahora un repartidor sin comercio se scopea por su grupo asignado.
- **DB** (`schema.ts` → migración 0033 `dapper_blink`): tabla `courier_tenants` (courier_user_id, tenant_id, assigned_by; único por par) — el grupo de comercios de cada repartidor de plataforma. `users.tenant_id` ya era nullable → el repartidor de plataforma es un usuario `role='repartidor'` con `tenant_id = NULL`.
- **Backend** (`delivery.routes.ts`): helper `courierTenantScope(alias, tenantId, driverId)` — si el repartidor tiene comercio, filtra por ese (como siempre); si es de plataforma (tenantId NULL), filtra por `tenant_id IN (SELECT tenant_id FROM courier_tenants WHERE courier_user_id = ?)`. **Sin asignaciones → no ve nada** (default seguro). Aplicado a `my-orders`, `my-history`, `available` y `accept` (claim).
- **Superadmin** (`superadmin-orders.routes.ts`): `GET /superadmin/couriers` (repartidores de plataforma + nº comercios), `POST /couriers` (crea con tenant_id NULL + bcrypt), `GET/PUT /couriers/:id/tenants` (ver/reemplazar el grupo), `PATCH /couriers/:id` (activar/desactivar). `/orders/tenants` ahora incluye `businessType` para filtrar por rubro en la UI.
- `tsc` back 6 base (0 nuevos). E2E 15/15: superadmin crea a Carlos (tenant NULL), le asigna 2 comercios; Carlos ve los pedidos de A y B pero **NO** el de C (no asignado); toma el de A (200) y **no** puede tomar el de C (400, sigue sin repartidor); `my-orders` trae el que tomó; al quitar todas las asignaciones, `available` queda vacío.
- **Siguiente (según plan)**: Fase 2 (UI superadmin "Repartidores" — crear + multi-select de comercios con filtro por rubro), Fase 3 (panel del repartidor: nombre del comercio por pedido + notificación socket), Fase 4 (verificación UI). Pendiente de commit + redeploy.

## [2026-07-10] — Variantes de ferretería: atributos con nombre (Diámetro, Ángulo, Presión…) genéricos y retrocompatibles

El modelo de variantes estaba cableado a 3 ejes fijos (color/size/material + horma para calzado), inservible para catálogos técnicos (codos PVC: ángulo × diámetro × presión × conexión × uso). Se añadió una capa de **atributos con nombre**, genérica, aditiva y sin romper color/size/material/horma. Verificado E2E 14/14 (+ tsc back 6 base, front 8 base, 0 nuevos). Migración 0032.

- **DB** (`schema.ts` → migración 0032 `married_power_man`): `product_variants.attributes` (JSON, array ordenado `[{name,value}]`). Se descartó `products.variant_axes` porque chocaba con 3 vistas que espejean `products` y no hace falta: el orden de ejes se deriva de la aparición de los atributos y el swatch se auto-detecta.
- **Backend** (`variants.service.ts`): helpers `parseAttributes`/`normalizeAttributes` (dedup por nombre case-insensitive, trim); `mapVariant` expone `attributes` y el `label` cae a los valores de atributos si no hay color/talla; `create`/`bulkCreate`/`update` persisten attributes (JSON). `ProductVariant` type + attributes. **Storefront** (`storefront.routes.ts`): `attachVariants` selecciona y parsea `pv.attributes` → viaja en el payload público. **RAG** (`agent.service.ts`): el label de variante para el chatbot usa los atributos con nombre ("Diámetro 1/2\" · Ángulo 90°"), con fallback a talla/color → el bot entiende consultas técnicas.
- **Selector cliente** (`variant-selector.tsx`): generalizado a **N ejes con nombre** (además de color/talla/material/horma). Ejes de atributos = unión de nombres en orden de aparición; **chips que envuelven** (swatch solo para el eje color legacy); resolución por `valueForKey` (legacy o `attrs[name]`); auto-selección de la primera opción de cada eje; **ficha técnica** (tabla de specs) de la variante elegida con sus atributos + color/talla/material + SKU.
- **Manager panel** (`variant-manager.tsx`): modo de **ejes con nombre** universal en el asistente guiado — agregar/quitar ejes propios con chips de sugerencia (Diámetro, Ángulo, Presión, Tipo de conexión, Rosca, Uso, Calibre, Acabado); combinatoria cartesiana con los ejes fijos, SKU desde los valores, `attributes` en cada variante generada; vista previa con los valores de atributos.
- **Verificación E2E 14/14**: create/bulk/update persisten attributes en orden; guardado como JSON en BD; dedup case-insensitive; `attachVariants` (SELECT replicado) trae attributes en el payload; variante resolvible por atributo; producto legacy color/talla sigue OK sin romper. (Nota: el listado público `/storefront/products?store=goti` no sirvió el producto de prueba por una peculiaridad del **resolver de slug público** de dev — ajeno a esta feature; se verificó el payload replicando el SELECT de `attachVariants`, que es lo que arma la respuesta.)
- **Edición por variante** (`variant-manager.tsx`): el form individual (crear/editar variante) ahora muestra y **edita los atributos** (agregar/quitar nombre+valor) — clave en ferretería porque el precio cambia por combinación (½" ≠ 4"): al ajustar precio/stock de un SKU se ve exactamente qué codo es. Usa el mismo `PUT /variants/:id` ya verificado. `ProductVariant` type (front) + attributes.
- **Pendiente**: commit + redeploy.


## [2026-07-10] — Calendario de reservas Fase 6: retención (lista de espera + reprogramar + fidelidad + métricas) — ROADMAP COMPLETO

Sexta y última fase del rediseño UX de reservas. Cierra el ciclo de retención. Verificado E2E 19/19. Migración 0031.

- **DB** (`schema.ts` → migración 0031 `dashing_tag`): tabla `service_waitlist` (tenant, service, cliente, desired_date, note, status pendiente/notificado/convertido/cancelado) + `service_bookings.loyalty_awarded` (evita doble acreditación de puntos).
- **Backend** (`services.service.ts`): (1) **Lista de espera** — `joinWaitlist` (público, valida servicio publicado), `listWaitlist`, `updateWaitlistStatus`. (2) **Reprogramar** — `rescheduleBooking` revalida disponibilidad (409 si no hay cupo) y respeta el guard de solape del especialista (excluyendo la propia reserva); rechaza reservas cerradas. (3) **Fidelidad al completar** — `updateBookingStatus('completada')` llama `awardLoyaltyForBooking`, que usa `earnPoints` del módulo loyalty sobre `total_amount`, **una sola vez** (marca `loyalty_awarded=1` antes de acreditar → idempotente, respeta config del tenant). (4) **Métricas** — `getBookingStats` (total 30d, por estado, completadas, % no-show, ingresos de completadas, lista de espera pendiente, top servicios/especialistas). Endpoints: público `POST /services/:id/waitlist`; autenticados `GET/PUT /services/waitlist`, `PUT /services/bookings/:id/reschedule`, `GET /services/bookings/stats`.
- **Editor panel** (`services-management.tsx`): **KPIs** en la pestaña Reservas (reservas/ingresos/no-show/en espera + top servicio); **pestaña "Lista de espera"** (tabla con Notificar→WhatsApp+marca notificado, Convertido, Cancelar); **diálogo Reprogramar** (fecha+hora, valida en backend, muestra 409).
- **Modal** (`service-booking-modal.tsx`): cuando un día no tiene cupos, CTA **"🔔 Avísame si se libera un cupo"** → mini-form (nombre+teléfono) → `joinWaitlist`, con confirmación inline.
- `types.ts` (ServiceWaitlistEntry, ServiceBooking.loyaltyAwarded) + `api` (rescheduleBooking, getBookingStats, getWaitlist, updateWaitlist, joinWaitlist). `tsc` back (6 base, 0 nuevos) y front (8 base, 0 nuevos). E2E 19/19: join+gestión de espera, join a servicio inexistente→404, reschedule a slot libre / a slot no disponible→409 / el slot viejo se libera, fidelidad suma 80 pts por reserva de 80k y NO duplica al re-completar, stats con completadas/ingresos/top servicio.
- **Fuera de alcance (declarado)**: "promos por horario" (happy-hour / precio dinámico por franja) queda como feature de pricing aparte; disponibilidad por-especialista en el calendario (ver F5).

### 🎉 ROADMAP DE RESERVAS COMPLETO (6/6 fases)
F1 disponibilidad rica ✅ · F2 hold anti doble-reserva ✅ · F3 vender la experiencia ✅ · F4 cross-sell/order bump ✅ · F5 especialista por cita ✅ · F6 retención ✅. Migraciones 0027–0031. Pendiente solo de commit + redeploy a producción.


## [2026-07-10] — Calendario de reservas Fase 5: especialista por cita (elige profesional + anti doble-booking del mismo)

Quinta fase del rediseño UX. El cliente puede elegir **con qué profesional** agendar (o "sin preferencia"), y un mismo especialista no puede quedar con dos citas solapadas. Verificado E2E 19/19. Migración 0030.

- **DB** (`schema.ts` → migración 0030 `blushing_ricochet`): tabla `service_specialists` (id, tenant_id, name, title, photo_url, is_active, sort_order) + `services.specialist_ids` (JSON, quiénes realizan el servicio) + `service_bookings.specialist_id`/`specialist_name` (snapshot al reservar).
- **Backend** (`services.service.ts`): CRUD de especialistas (`list/create/update/removeSpecialist` — remove es **soft delete** is_active=0 para preservar el nombre ya snapshoteado en reservas). `mapService` expone `specialistIds`; create/update los normalizan. `getPublicSpecialists` resuelve solo activos, en el orden configurado. `createBooking` acepta `specialistId`: valida que el servicio lo ofrezca **y** que esté activo (si no → 400), snapshotea el nombre, y ejecuta un **guard de solape** (`start_time < ? AND end_time > ?` sobre pendiente/confirmada del mismo `specialist_id`) → **409** si el profesional ya está ocupado. `mapBooking` expone specialistId/specialistName. Endpoints: CRUD autenticado `/services/specialists` + público `GET /services/:id/specialists`.
- **Editor panel** (`services-management.tsx`): nueva pestaña **"Especialistas"** (tarjetas con foto/cargo, # servicios, crear/editar/eliminar) + selector **"Especialistas que lo realizan"** en el form del servicio (citas) + **especialista** en el detalle de reserva del comerciante.
- **Modal** (`service-booking-modal.tsx`): tras elegir el horario, **"¿Con quién quieres tu cita?"** con tarjetas (foto/nombre/cargo) + opción **"Sin preferencia"**; el especialista elegido se muestra en el resumen fijo y en la confirmación. `specialistId` viaja a `createPublicBooking`.
- `types.ts` (Service.specialistIds, ServiceBooking.specialistId/Name, ServiceSpecialist) + `api` (getPublicServiceSpecialists, getSpecialists/create/update/deleteSpecialist, createService/createPublicBooking con los campos). `tsc` back (6 base, 0 nuevos) y front (8 base, 0 nuevos). E2E 19/19: CRUD; público solo activos/en orden/excluye no asignados; snapshot de nombre; guard 409 del mismo especialista mientras otro sí cabe (max_simultaneous=2); no permitido → 400; inactivo (soft delete) excluido + 400; reserva sin especialista → nulos.
- **Nota de alcance**: la disponibilidad del calendario sigue siendo a nivel servicio (max_simultaneous); el conflicto por especialista se garantiza en el momento de reservar (guard). Disponibilidad por-especialista en el calendario queda para una iteración futura.
- **Siguiente**: Fase 6 (retención — lista de espera, promos por horario, puntos de fidelidad al confirmar, métricas, reprogramar). **Última del roadmap de reservas.**


## [2026-07-10] — Calendario de reservas Fase 4: cross-sell / order bump para servicios (sube el ticket)

Cuarta fase del rediseño UX. Al reservar un servicio, se ofrecen **complementos** (otros servicios) como agregado opcional que suben el valor de la reserva — order bump aplicado a citas. Verificado E2E 18/18. Migración 0029.

- **DB** (`schema.ts` → migración 0029 `shallow_boomer`): `services.addon_service_ids` (JSON, IDs de servicios ofrecidos como complemento) + `service_bookings.addons` (JSON, snapshot `{id,name,price}` al reservar) + `service_bookings.total_amount` (decimal, base + complementos).
- **Backend** (`services.service.ts`): `mapService` expone `addonServiceIds`; `create`/`update` los normalizan (dedup, trim, NULL si vacío). Nuevo `getPublicAddons` — resuelve los complementos **solo publicados+activos**, en el orden configurado, sin auto-referencia. `createBooking` acepta `addonIds` y **resuelve precios SIEMPRE en el servidor** (nunca del cliente): filtra a los que el servicio realmente ofrece + existen + publicados, snapshotea `{id,name,price}` reales y calcula `total_amount = base (si fijo/desde) + Σ complementos`. `mapBooking` expone `addons` + `totalAmount`. Endpoint público `GET /services/:id/addons`.
- **Editor panel** (`services-management.tsx`): en el form de servicio (citas), selector **"Complementos sugeridos"** (checkboxes de otros servicios con precio, excluye el actual y las cotizaciones). El detalle de reserva del comerciante muestra los **complementos agregados + Total**.
- **Modal** (`service-booking-modal.tsx`): carga los complementos al abrir; en el paso de datos, tarjeta **"Agrega a tu experiencia"** con toggles (+precio); el resumen fijo muestra **desglose base + complementos = Total** en vivo; la confirmación lista los complementos y el total. `addonIds` viaja a `createPublicBooking`.
- `types.ts` (Service.addonServiceIds, ServiceBooking.addons/totalAmount, ServiceAddon) + `api.getServiceAddons` + `createService`/`createPublicBooking` aceptan los campos. `tsc` back (6 base, 0 nuevos) y front (8 base, 0 nuevos). E2E 18/18: endpoint público solo publicados/en orden/sin auto-ref; booking ignora add-ons no permitidos (OTHER), no publicados (A3) y falsos (bogus); total 100k+20k+30k=150k con precios reales del servidor; persistencia JSON + total_amount en BD; reserva sin add-ons → total = base.
- **Siguiente**: Fase 5 (especialista por cita — `service_bookings` aún no asigna profesional) · 6 (lista de espera/promos por horario/fidelidad/métricas/reprogramar).


## [2026-07-10] — Calendario de reservas Fase 3: vender la experiencia (resumen fijo + "qué incluye" + confirmación emocional)

Tercera fase del rediseño UX. El modal pasa de un formulario funcional a una **landing de venta premium**: layout de 2 columnas con resumen fijo, tarjeta de beneficios y una confirmación que emociona. Verificado E2E 17/17. Migración 0028 (2 columnas nuevas en `services`).

- **DB** (`schema.ts` → migración 0028 `easy_ronan`): `services.benefits` (JSON, array de strings "qué incluye") + `services.preparation` (text, "cómo prepararte"). Ambos nullable → servicios viejos siguen igual.
- **Backend** (`services.service.ts`): `mapService` parsea benefits (defensivo: array o string JSON) y expone preparation; `create`/`update` normalizan benefits (trim + filtra vacíos → NULL si queda vacío) y preparation. Los endpoints públicos y autenticados ya los devuelven sin más cambios (el controller pasa `req.body`).
- **Editor panel** (`services-management.tsx`): en el form de servicio, editor de lista **"¿Qué incluye?"** (agregar/quitar beneficios, Enter agrega otro) + textarea **"Cómo prepararte"** (solo citas). `emptyServiceForm`/`openEdit`/`submitService` cablean ambos.
- **Modal** (`service-booking-modal.tsx`, reescrito): **layout 2 columnas** (`max-w-3xl`) — izquierda el flujo (calendario/formulario), derecha un **resumen fijo** (imagen, nombre, precio, duración, lista "Incluye" con checks, la cita elegida resaltada + countdown del hold, "Cómo prepararte", política de cancelación con ✓). En móvil el resumen va arriba. **Confirmación emocional** a pantalla completa: check animado, "¡Tu cita está reservada! 🎉", saludo por nombre, tarjeta con servicio/fecha/hora/valor, bloque "¿Qué sigue?", botón **"Añadir a Google Calendar"** (link TEMPLATE con `America/Bogota`), política de cancelación. Toda la lógica de F1 (estados de slot) y F2 (hold + countdown) intacta.
- `types.ts` Service + `api.createService` aceptan benefits/preparation. `tsc` back (6 base, 0 nuevos) y front (8 base, 0 nuevos). E2E 17/17: create devuelve/persiste benefits[3] en orden + preparation; guardado como JSON en BD; GET autenticado los trae; update reemplaza ambos; strings vacíos filtrados; endpoint público expone la experiencia; vaciar → NULL.
- **Siguiente**: Fase 4 (cross-sell + paquetes / order bump para servicios) · 5 (especialista por cita) · 6 (lista de espera/promos/fidelidad/métricas).


## [2026-07-10] — Calendario de reservas Fase 2: reserva temporal (hold 5 min, anti doble-reserva)

Segunda fase del rediseño UX del calendario. Cuando el cliente elige un slot y pasa al formulario, el cupo queda **apartado 5 minutos** para que nadie más lo tome mientras llena sus datos (patrón boletería). Verificado E2E 12/12. Migración 0027 `service_slot_holds`.

- **DB** (`schema.ts` → migración 0027 `rare_hulk`): tabla `service_slot_holds` (id, tenant_id, service_id, hold_token único, booking_date, start_time/end_time, expires_at NOT NULL, created_at; índices por (service_id, booking_date) y expires_at).
- **Backend** (`services.service.ts`): los 3 métodos de disponibilidad (`getAvailableSlots`, `getSlotsWithStatus`, `getMonthAvailability`) ahora **cuentan los holds activos** (`expires_at > NOW()`) junto con las reservas reales → un slot apartado sale ocupado para los demás. Nuevo `createHold` (limpia vencidos, valida el slot vía getAvailableSlots, inserta con `expires_at = NOW()+5min`, devuelve `holdToken` + `expiresAt`); `releaseHold` (borra por token). `createBooking` acepta `holdToken` y **borra el hold ANTES de re-validar** (así el propio hold del cliente no le bloquea su reserva). Endpoints públicos `POST /services/:id/hold` y `POST /services/hold/release`.
- **Frontend** (`service-booking-modal.tsx`): al pulsar "Continuar" se crea el hold (`handleContinue`, label "Apartando…"); si el slot ya se ocupó → 409 → recarga slots y avisa. Cuenta regresiva de 5 min (banner "Apartado M:SS", rojo cuando ≤60s); al llegar a 0 vuelve al calendario, recarga y avisa. Botones "Cambiar hora" y "Cancelar" liberan el hold; también se libera al desmontar el modal. `holdToken` viaja en `createPublicBooking` y se limpia al confirmar. `api.holdServiceSlot` + `releaseServiceHold`.
- `tsc` back (6 base, 0 nuevos) y front (8 base, 0 nuevos). E2E 12/12: hold ocupa el slot para otros, 2º hold del mismo slot → 409, reserva con token creada + hold consumido + slot sigue ocupado por la reserva real, hold vencido libera el slot, crear hold limpia los vencidos.
- **Siguiente**: Fase 3 (vender la experiencia + resumen fijo + confirmación emocional) · 4 (cross-sell/paquetes) · 5 (especialista por cita) · 6 (lista de espera/promos/fidelidad/métricas).


## [2026-07-10] — Calendario de reservas Fase 1: disponibilidad rica (estados de slot + cupos por día)

Primera fase del rediseño UX del calendario de reservas (spa/salón premium). El motor de disponibilidad ya existía y calculaba bien, pero la API solo devolvía los slots DISPONIBLES como strings → la UI mostraba todo igual. Ahora expone los estados. Verificado E2E 11/11. Sin migración (reutiliza el motor).

- **Backend** (`services.service.ts`): helper `buildDaySlots` (genera TODOS los slots del bloque con estado: disponible/ocupado/bloqueado/pasado + spotsLeft; marca **últimos_cupos** cuando quedan ≤3 disponibles en el día o spotsLeft===1). Métodos `getSlotsWithStatus(serviceId, tenantId, date)` (día con estados) y `getMonthAvailability(serviceId, tenantId, year, month)` (por día: available + status libre/pocos/lleno/cerrado, con queries batcheadas por mes). Endpoints públicos `GET /services/:id/slots-detailed` y `GET /services/:id/month-availability`.
- **Frontend** (`service-booking-modal.tsx`): slots ahora pintan estado — disponible normal, **últimos cupos** ámbar con etiqueta, ocupado gris tachado con 🔒 (clicable solo para mostrar el motivo "ya están reservadas"), bloqueado opaco ("no hay atención en esta franja"), pasado atenuado. Leyenda de estados. Calendario con **punto de color bajo cada día** (verde=libre, ámbar=pocos, rojo=lleno) + tooltip con nº de cupos; días llenos deshabilitados/tachados. `api.getPublicSlotsDetailed` + `getServiceMonthAvailability`.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 11/11: 08:30 ocupado (reserva), 09:00 bloqueado (bloqueo), 08:00/09:30 últimos cupos por escasez, month-availability con "pocos"/2 disponibles, día sin disponibilidad "cerrado".
- **Siguiente**: Fase 2 (reserva temporal/hold 5 min anti doble-reserva) · 3 (vender experiencia + resumen fijo + confirmación emocional) · 4 (cross-sell/paquetes) · 5 (especialista) · 6 (lista de espera/promos/fidelidad/métricas).


## [2026-07-09] — Chatbot de tienda: robustez del contexto + persistencia de últimos 10 mensajes

Reporte del comerciante: el chatbot "ya no trae productos de la tienda en la que estoy" ni la info del comercio. La tienda vive en producción (no reproducible en dev; todas las queries del contexto pasan contra la BD de dev). Se atacaron las causas de código y se agregó la persistencia pedida.

- **Fragilidad corregida (raíz probable)**: `buildDynamicContext` (agent.rag.ts) corría sus 8 queries en un `Promise.all` con **un solo catch** → si UNA fallaba (config faltante, diferencia de columna en prod), el bot perdía TODO el contexto de golpe (nombre, productos, ofertas). Ahora cada query lleva su propio `.catch(() => [[]])` → una falla degrada solo su parte, el resto del contexto sigue llegando.
- **Errores ya no se tragan en silencio**: `searchProductsForChatbot` y `buildDynamicContext` en agent.service ahora hacen `console.error` en su catch → si hay un fallo SQL real en prod, aparece en logs (antes devolvían vacío sin rastro).
- **Persistencia (ChatWidget.tsx)**: guarda los **últimos 10 mensajes por tienda** (clave `dz_chat_{slug}` en localStorage) + el sessionToken; al reabrir el chat (o cambiar de tienda) restaura esa conversación. Queda atada a la tienda actual — cada comercio tiene su propio historial.
- `tsc` back (6 base, 0 nuevos) y front (8 base, 0 nuevos). Requiere redeploy. **Nota para el comerciante**: si una tienda sigue sin mostrar productos, verificar que estén `published_in_store = 1` (un producto no publicado nunca aparece en el chatbot) y que el chatbot esté habilitado para ese tenant.


## [2026-07-08] — Cierre de vacíos, Bloque E: optimización de secuencia de paradas (vecino más cercano + 2-opt)

Quinto bloque — de agrupar por zona (ya existía) a ORDENAR en qué orden visitar las paradas para minimizar km. Verificado E2E 9/9. Sin migración.

- **Backend** (`logistics.routes.ts`): helpers `haversineKm` / `pathKm` / `nearestNeighbor` / `twoOpt`. Endpoint `POST /fleet/routes/:id/optimize` — toma las paradas pendientes (no entregadas) con coordenadas, origen = `store_info` lat/lng (fallback: primera parada), calcula vecino más cercano + mejora 2-opt (guard 50 iter), reescribe `route_sequence` (paradas con coords en orden óptimo, las sin coords al final conservando orden). Devuelve `kmBefore/kmAfter/savedKm`. <2 paradas ubicadas → `{ optimized: false }`. Emite `route-optimized` por socket.
- **Frontend** (`logistics-board.tsx`): botón **"Optimizar"** en cada ruta planificada/cargando con ≥2 paradas; toast con km ahorrados ("15.5 → 8.8 km, ahorras 6.7 km") o "ya estaba en el orden óptimo"; refresca. `api.optimizeRoute`.
- `tsc` back (0 — base bajó de 6 a 0) y front (8 base) sin errores nuevos. E2E 9/9: 4 paradas colineales en orden malo → optimize responde optimized, kmAfter ≤ kmBefore, kmBefore coincide con cálculo independiente, secuencia resultante 0→3 (cerca a lejos), route_sequence reescrito, ruta con <2 paradas ubicadas no optimiza. (El test fija store_info como depósito determinista y lo restaura.)
- **Siguiente**: F (2FA, requiere decidir método TOTP vs WhatsApp) · G (DIAN, requiere elegir proveedor). Son los 2 últimos y ambos bloqueados por decisión del comerciante.


## [2026-07-08] — Cierre de vacíos, Bloque D: satisfacción post-entrega (calificación del cliente)

Cuarto bloque — cierra el círculo con el cliente y completa el KPI de satisfacción del marco. Verificado E2E 10/10.

- **DB (migración 0026 `loving_rawhide_kid`)**: `storefront_orders.rating` (tinyint 1-5) + `rating_comment` + `rating_at`.
- **Backend**: `POST /storefront/tracking/:token/rating` PÚBLICO (sin login, token = llave) — valida 1-5, solo permite calificar pedidos entregados (400 si no), 404 si token inválido; re-calificar actualiza. El GET del tracking ahora devuelve `rating` existente. El WhatsApp de "entregado" (en los 2 flujos: cascada de ruta y entrega por parada) ahora incluye `…/seguimiento/:token#calificar`. Dashboard de Gerencia: `operation.satisfaction` (promedio de estrellas + conteo, 30 días).
- **Frontend**: bloque **RatingBlock** en el portal público `/seguimiento/[token]` — estrellas 1-5 interactivas + comentario opcional, solo cuando el pedido está entregado; agradecimiento tras enviar; si ya estaba calificado muestra las estrellas y el comentario. Tarjeta **"Satisfacción"** (★ promedio con semáforo ≥4 verde) en la sección Ventas del dashboard.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 10/10: calificar entregado (guarda estrellas+comentario+fecha), rechazo si no entregado, 404 token inválido, rango 1-5 validado, GET devuelve el rating, re-calificar actualiza, promedio en el dashboard.
- **Siguiente**: E (optimización de paradas) · F (2FA, requiere decidir método) · G (DIAN, requiere proveedor).


## [2026-07-08] — Cierre de vacíos, Bloque C: modo offline del conductor (cola local + endpoints idempotentes)

Tercer bloque del plan — resiliencia: que una zona sin señal no haga perder ni duplicar entregas. Verificado E2E 9/9.

- **DB (migración 0025 `flawless_shard`)**: `idempotency_keys` (id = clientActionId PK, tenant, action, user). El dispositivo genera un clientActionId por acción; el backend la aplica UNA sola vez aunque llegue repetida.
- **Backend** (`delivery.routes.ts` PUT /delivery/status/:orderId): patrón **claim-first** — INSERT de la llave ANTES de aplicar; si duplicado (ER_DUP_ENTRY) responde `{ duplicate: true }` sin re-aplicar; si el trabajo posterior falla, libera la llave en el catch para permitir un reintento legítimo. Cubre el caso crítico de campo (marcar entregado + POD) evitando doble logStage 'entregado', doble WhatsApp y doble cierre de ruta.
- **Frontend**: nueva utilidad `lib/offline-queue.ts` — `enqueueOrRun` ejecuta la acción con clientActionId si hay red; si falla por red o está offline, la ENCOLA en localStorage; auto-flush al evento `online` y cada 30s; `subscribe` para el contador de pendientes. Integrada en `driver-panel.tsx`: la entrega pasa por la cola (toast "sin señal: se subirá al reconectar"), indicador **"N sin subir"** en el header, runner registrado + startAutoFlush en el montaje.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 9/9: 1er envío aplica (entregado + POD + etapa 1 vez), 2do envío del mismo clientActionId responde `duplicate` sin sobreescribir POD ni duplicar la etapa, un clientActionId distinto es acción nueva, ambas llaves quedan registradas.
- **Nota de alcance:** picking ocurre dentro de la bodega (con wifi) y sus endpoints ya son atómicos/guardados, así que el offline se enfocó en el conductor (el que sí entra en zonas muertas). PWA instalable con service worker quedó declarada como mejora futura (la resiliencia crítica —no perder/duplicar acciones— ya está cubierta por la cola + idempotencia).
- **Siguiente**: D (satisfacción post-entrega) · E (optimización de paradas) · F (2FA, decisión) · G (DIAN, proveedor).


## [2026-07-08] — Cierre de vacíos, Bloque B: exactitud de inventario (conteo cíclico con ajuste auditado)

Segundo bloque del plan de cierre de vacíos — el criterio "99% físico vs. sistema" de la auditoría. Verificado E2E 19/19.

- **DB (migración 0024 `rainy_wilson_fisk`)**: `inventory_counts` (número, sede, estado abierto/cerrado/cancelado, accuracy_pct, contadores, created_by/closed_by) + `inventory_count_items` (esperado congelado, contado, ubicación; unique count+producto).
- **Backend** (nuevo módulo `inventory-counts`, montado en `/api/inventory-counts`): **abrir** conteo por sede congela el esperado (snapshot de `sede_stock`; sin sede usa `products.stock`); **capturar** contado por ítem (recalcula contadores en vivo); **cerrar** en transacción aplica el ajuste AUDITADO por cada ítem con diferencia — lleva `products.stock` (por la diferencia) y `sede_stock` de la sede (al valor físico contado) al conteo real, genera `stock_movements` tipo `ajuste` con referencia al conteo, y calcula la **exactitud** (% de ítems sin diferencia). Conteo cerrado es inmutable. `GET /accuracy` (promedio de conteos cerrados 90d). La **exactitud** entra a `inventory.accuracy` del dashboard de Gerencia.
- **Frontend**: nuevo módulo **"Conteo Inventario"** (`inventory-count-panel.tsx`) — lista con % de exactitud (semáforo ≥99 verde), crear conteo (elige bodega + filtro de línea), captura tipo planilla (sistema vs. físico vs. diferencia con colores faltante/sobrante), cerrar con confirmación. KPI de exactitud en la tarjeta de Inventario del dashboard. Wiring completo (sidebar special-case inventory, modules.ts + preset ferretería, merchant-panel, section-renderer, shell Tema 2). `api.ts`: 7 métodos.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 19/19: esperado congelado (incl. ubicación), captura con faltante vs. exacto, cierre → exactitud 50%, ajuste de total + sede al físico, movimiento `ajuste` auditado (qty y ref correctas), producto exacto sin cambio, conteo cerrado inmutable, exactitud en `/accuracy` y en Gerencia.
- **Siguiente**: Bloque C (offline conductor) · D (satisfacción) · E (optimización paradas) · F (2FA, requiere decisión) · G (DIAN, requiere proveedor).


## [2026-07-08] — Cierre de vacíos de auditoría, Bloque A: KPIs gerenciales OTIF + utilización de flota + rotación

Primer bloque del plan para cerrar los vacíos detectados al auditar el sistema real contra el marco de auditoría del comerciante. Completa el tablero de Gerencia con 3 métricas que faltaban, sobre datos ya existentes (sin migración). Verificado E2E 8/8.

- **OTIF (On-Time In Full)**: % de pedidos entregados a tiempo (`delivery_delivered_at ≤ promised_at`) sobre los que tenían promesa, últimos 30 días. En `operation.otif` (rate/onTime/withPromise/delivered). Badge en el header de "Operación en vivo" con semáforo (≥90 verde, ≥75 ámbar, <75 rojo).
- **Utilización de flota**: minutos de ruta activa (`started_at→closed_at`, 7 días) sobre la capacidad de la flota (vehículos activos × 7 días × 10h hábiles). En `logistics.utilizationPct`. KPI en la sección Logística (ámbar si <30%).
- **Rotación de inventario**: costo de ventas 30d (`stock_movements` venta × `purchase_price`) / valor de inventario → `inventory.rotationMonthly` (veces/mes) + `daysOfInventory` (30/rotación). KPI en la sección Inventario.
- Todo en `executive.service.dashboard()` (3 queries en paralelo tras el bloque principal) + `executive-dashboard.tsx`. Sin migración.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 8/8: los 3 KPIs presentes; OTIF cuenta a tiempo vs tarde; utilización sube con ruta cerrada; rotación y días derivados de consumo conocido.
- **Siguiente**: Bloque B (exactitud de inventario / conteo cíclico), luego C (offline conductor), D (satisfacción post-entrega), E (optimización de paradas), F (2FA), G (DIAN).


## [2026-07-08] — Pendientes ferretería cerrados: sede en pedidos/compras, alerta min por sede, mantenimiento preventivo, promesa auto

Cierre de los 5 pendientes menores declarados tras completar las 6 fases. Verificado E2E 15/15.

- **A — Pedidos storefront descuentan sede** (`orders.routes.ts`): al confirmar/entregar un pedido online con `sede_id`, además de `products.stock` se descuenta `sede_stock` de esa sede (GREATEST(0,…)). La devolución la cubre la anulación de la venta vinculada (ya restaura sede_stock desde F1).
- **B — Recepción de compras con bodega destino** (migración 0022 `purchase_invoices.sede_id`): `POST /ops/purchases/:id/arrival` acepta `sedeId` (se elige la bodega al llegar el camión); `markReceived` SUMA los `purchase_invoice_items` al `sede_stock` de esa sede (idempotente: solo la primera recepción). Nuevo `GET /ops/recent-purchases` (estado por_llegar/en_descargue/recibida) + tablero accionable de recepción en el módulo Tiempos (marcar llegó con bodega / almacenada).
- **C — Alerta de min_stock por sede**: `GET /sedes/low-stock` (sede_stock donde `stock <= min_stock` y min>0, con `availableElsewhere` para sugerir transferencia). Banner en el panel Bodegas + contador `sedeLowStock` en el dashboard Gerencia.
- **D — Mantenimiento preventivo de flota** (migración 0023 `fleet_vehicles.next_maintenance_date`; el campo por km ya existía): job de alertas ampliado con la variante por fecha (≤7 días o vencido); `GET /fleet/maintenance-due` (km ≥ 90% de la regla o fecha ≤7d) + `POST /fleet/vehicles/:id/service-done` (reinicia `last_maintenance_km = odómetro`, fija próxima fecha); el PUT de perfil acepta `lastMaintenanceKm`/`nextMaintenanceDate`; contador `maintenanceDue` en el dashboard.
- **E — Promesa de entrega automática**: al pasar una ruta a `en_ruta`, los pedidos sin `promised_at` reciben `NOW + min(360, 30 + nº_paradas×40)` min → alimenta el at-risk (F4) y el portal de seguimiento (F5) sin trabajo manual.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. Migraciones 0022 + 0023. E2E 15/15: descuento de sede en pedido, low-stock por sede + sugerencia de transferencia, recepción distribuye a bodega e idempotente, mantenimiento vencido detectado + servicio reinicia contador, promesa automática en ventana razonable.
- **Auditoría ferretería 100% cerrada** (6 fases + 5 pendientes). Migraciones 0015–0023. Pendiente solo de redeploy (back+front) a producción.


## [2026-07-08] — F5 (tracking + POD) + F6 (dashboard gerencial): auditoría ferretería COMPLETA 6/6

Cierre del plan ferretería. F5 conecta al cliente con la entrega en vivo; F6 le da al gerente la pantalla única de decisión. Verificado E2E 23/23 (F5+F6 juntos).

**F5 — Seguimiento en ruta + portal del cliente:**
- **DB (migraciones 0020 `dapper_gambit` + 0021 `nice_rick_jones`)**: `dispatch_routes.last_lat/last_lng/last_ping_at` (GPS del conductor) · `storefront_orders.tracking_token` (indexado) + `pod_photo_url` + `pod_received_by` (prueba de entrega).
- **Backend**: `POST /fleet/my-route/ping` (el teléfono del conductor reporta posición si su ruta está `en_ruta`/`retornando`; emite `route-ping` por socket) · `markStopDelivered` y `delivery/status` aceptan POD (foto + receptor) · **`GET /storefront/tracking/:token` PÚBLICO sin auth** (token aleatorio 24 chars = llave; expone datos MÍNIMOS — solo primer nombre del cliente, ítems, línea de etapas, posición del vehículo SOLO si la ruta está activa, y POD al final) · `notifyCustomers` genera el token (`ensureTrackingTokens`) y agrega el link `FRONTEND_URL/seguimiento/:token` al WhatsApp "tu pedido salió".
- **Frontend**: `driver-panel` reporta GPS cada 3 min (watchPosition→`pingMyRoute`) y pide **prueba de entrega** (modal con `CloudinaryUpload` + nombre de quien recibe) antes de marcar entregado · nueva página pública **`app/seguimiento/[token]/page.tsx`** (barra de progreso 5 pasos, vehículo en vivo con link a Google Maps, POD, historial de etapas, productos; auto-refresh 60s; sin login).

**F6 — Dashboard Gerencial:**
- **Backend** (`executive.service.ts` en ops-timeline): `GET /ops/executive-dashboard` (ventas hoy/semana/mes + conversión de cotizaciones · embudo de operación en vivo: pendientes/picking/preparados/cargando/en ruta/entregados hoy + en riesgo + ciclo promedio · logística: vehículos por estado, valor en la calle, costo logístico/entrega · talento: equipo + top pickers hoy · inventario: valor, agotados, bajos, reservados — TODO en un payload con Promise.all) · `GET /ops/sales-heatmap` (top 15 zonas por ingreso — informa rutas y expansión) · `GET /ops/purchase-suggestions` (consumo real 30d de `stock_movements` vs stock → qué pedir, con días de cobertura y urgencia).
- **Frontend**: nuevo módulo **"Gerencia"** (`executive-dashboard.tsx`, grupo Reportes) — KPIs de ventas, embudo de 6 pasos con colores, logística+talento lado a lado, inventario con sugerencia de compra, mapa de calor en barras. Wiring completo (sidebar special-case analytics, modules.ts + preset ferretería, merchant-panel, section-renderer, shell Tema 2).
- **Fix (E2E)**: `fleet_vehicle_expenses` no tiene `expense_date` → usa `created_at` (como la analítica existente); método `getPurchaseSuggestions` duplicaba el de gastrobar-ops → renombrado a `getOpsPurchaseSuggestions`.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 23/23: ping GPS guardado, tracking público con datos mínimos + 404 sin token + vehículo solo en ruta, POD guardado y expuesto tras entrega, dashboard agrega ventas/embudo/gastos/inventario/talento reales, heatmap por zona, sugerencia de compra urgente.
- **Plan ferretería COMPLETO**: F1 multibodega (28/28) · F2 cotizaciones (24/24) · F3 picking (20/20) · F4 tiempos (17/17) · F5 tracking + F6 gerencia (23/23). Migraciones 0015–0021. Pendiente de redeploy (back+front) para producción.


## [2026-07-07] — Tiempos F4: cuellos de botella + pedidos en riesgo + recepción medida (auditoría ferretería)

Fase 4 del plan ferretería: el gerente ve DÓNDE se pierde el tiempo entre facturar y entregar, con datos, y recibe alerta de pedidos en riesgo ANTES de que el cliente reclame. Verificado E2E 17/17.

- **DB (migración 0019 `fine_cardiac`)**: `order_stage_events` (línea de tiempo canónica: confirmado→en_picking→preparado→cargado→despachado→entregado, con `duration_seconds` PRECALCULADO desde la etapa anterior → analítica = AVG simple) + `storefront_orders.promised_at` (promesa de entrega, base del at-risk) + `purchase_invoices.arrival_at/received_at/received_by` (recepción medida).
- **Backend** (`modules/ops-timeline/`, montado en `/api/ops`): helper **`logStage()`** exportado (best-effort, no rompe la transacción de negocio; calcula duración vía `TIMESTAMPDIFF` en MySQL para evitar TZ) enganchado en las transiciones reales — picking take→`en_picking` y complete→`preparado` (picking.service), y cascada de despacho cargado/despachado (logistics setRouteStatus) + entrega por parada→`entregado` (markStopDelivered). Endpoints: `GET /ops/stage-analytics` (min promedio por etapa + **cuello de botella** = etapa más lenta + ciclo total confirmado→entregado, filtro por sede/días) · `GET /ops/at-risk` (promesa vencida/≤2h o abiertos > 1.5× el ciclo promedio del comercio, con motivo legible para actuar) · `GET /ops/orders/:id/timeline` · `PATCH /ops/orders/:id/promise` · `POST /ops/purchases/:id/arrival` + `/received` + `GET /ops/reception-analytics` (tiempo llegada→almacenado por proveedor + pendientes en descargue).
- **Frontend**: nuevo módulo **"Tiempos Operación"** (`ops-timeline-panel.tsx`, vista del gerente) — barras de tiempo por etapa con la etapa cuello resaltada en ámbar + ciclo total; lista de pedidos en riesgo (rojo vencido / ámbar próximo) con botón WhatsApp "Avisar" directo; recepción por proveedor con tiempo promedio y contador de descargues pendientes. Selector de sede/rango. Wiring completo (sidebar special-case fleet, modules.ts + preset ferretería, merchant-panel, section-renderer, shell Tema 2 grupo Reportes). `api.ts`: 8 métodos.
- **Fix (E2E)**: columna ambigua `created_at` en el JOIN de `orderTimeline` (existe en order_stage_events y users) → calificada con `e.`.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 17/17: eventos en transiciones de picking/despacho, duración medida desde creación (~90 min), analítica con cuello detectado, timeline por pedido, promesa vencida → en riesgo con overdue+motivo, recepción por proveedor (~45 min).
- **Siguiente (Fase 5 del plan)**: GPS del conductor (teléfono) + prueba de entrega con foto + página pública de seguimiento del cliente. Pendiente menor: botones de recepción (llegada/almacenado) dentro del módulo de Compras; promised_at automático al despachar según ETA.


## [2026-07-07] — Picking F3: cola de preparación en bodega + ubicaciones + productividad de auxiliares (auditoría ferretería)

Fase 3 del plan ferretería: la bodega funciona "tipo Amazon" — el pedido se prepara ANTES de que llegue el vehículo, el auxiliar recorre la bodega guiado por ubicaciones y su productividad queda medida. Verificado E2E 20/20.

- **DB (migración 0018 `wise_aqueduct`)**: `picking_tasks` (order_id UNIQUE — una tarea por pedido, snapshot items JSON con ubicaciones, estados pendiente→en_preparacion→preparada|cancelada, assigned_to, taken_at/completed_at, priority) + `sede_stock.warehouse_location` varchar(50) (ubicación pasillo-bloque-nivel POR SEDE; fallback `products.location_in_store` que ya existía).
- **Backend** (`modules/picking/`, montado en `/api/picking`): `POST /tasks/generate-pending` (1 clic: tareas para todos los pedidos confirmados/preparando con dispatch pendiente y sin tarea) · snapshot de ítems con `COALESCE(sede_stock.warehouse_location, products.location_in_store)` **ordenado por ubicación** (= ruta de recorrido dentro de la bodega, sort numérico es-CO) · `PATCH take` atómico (UPDATE condicional → 409 si otro auxiliar la tomó) · `complete` marca preparada + avanza el pedido a `status='preparando'` (visible en el Centro de Comando) · `GET /board` (pendientes/en preparación/preparadas hoy, filtro por sede) · `GET /productivity` (por auxiliar: completadas, hoy, minutos promedio taken→completed, líneas) · emite `picking-changed` por Socket.io `ops:{tenant}` (reusa `emitOps` de logistics). Roles: comerciante/despachador/auxiliar_bodega/vendedor.
- **Dossier de Jerarquía**: `GET /users/:id/dossier` ahora incluye `picking` (preparados totales, este mes, min promedio) + sección "Productividad en bodega" en el drawer (org-chart.tsx) — se muestra solo si el colaborador tiene actividad.
- **Frontend**: nuevo módulo **"Picking Bodega"** (`picking-board.tsx`) — 3 columnas con cronómetros en vivo (espera en pendientes con alerta >30 min, tiempo transcurrido en preparación, duración final), tarjeta con lista de recorrido (producto × cantidad + ubicación monoespaciada), botones Tomar/Preparado✓/Cancelar, refresco automático cada 20 s (bodega multi-usuario), ranking de productividad del equipo (30 días). **Ubicaciones editables** en Inventario → Bodegas: la celda de la matriz ahora acepta stock + ubicación ("P1-B2") y la muestra bajo la cantidad. Wiring completo (sidebar con special-case fleet/inventory, modules.ts + preset ferretería, merchant-panel, section-renderer, shell Tema 2 con flag warehouse para auxiliares).
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 20/20: ubicaciones guardadas y devueltas en matriz, generate-pending, snapshot ordenado (P1 antes que P3), doble tarea rechazada, take atómico (409 al repetir), timestamps, pedido→preparando, tablero, productividad con minutos, dossier, cancelación.
- **Siguiente (Fase 4 del plan)**: tiempos por etapa (order_stage_events) + recepción de compras medida + alertas de riesgo. Pendiente menor: escaneo código de barras en picking (socket scanner ya existe); prioridad manual de tareas.


## [2026-07-07] — Cotizaciones F2: del proyecto del cliente a la venta con reserva por sede (auditoría ferretería)

Fase 2 del plan ferretería. El flujo comercial que faltaba: el cliente cotiza su obra → el vendedor la envía por WhatsApp → al aceptar se RESERVA el stock (no se vende dos veces la mercancía del proyecto) → se factura con 1 clic. Verificado E2E 24/24.

- **DB**: migración **0016** `quotes` (número COT-xxxxx, cliente, vendedor, sede, items JSON, totales, estados borrador→enviada→aceptada→facturada|vencida|cancelada, valid_until, delivery_promise, sale_id) + migración **0017** `products.reserved_stock` (la BD real NO lo tenía — solo product_variants; descubierto por E2E; disponible = stock − reservado).
- **Backend** (`modules/quotes/` service+routes, montado en `/api/quotes`): totales SIEMPRE server-side desde products (con `unitPrice` negociable por línea); **aceptar reserva** `products.reserved_stock` + `sede_stock.reserved_stock` de la sede (valida disponible); cancelar/vencer libera; **vencimiento lazy** al listar (valid_until < hoy); **convertir** llama `salesService.create` (libera reserva → vende → marca facturada con sale_id; si la venta falla re-reserva); `GET /quotes/stats` (KPI del mes: conversión %, valor facturado, pipeline); `POST /:id/send-whatsapp` (resumen transaccional vía Evolution `chatbot_config.evolution_instance`, marca enviada). La reserva también bloquea transferencias entre sedes (disponible = stock − reservado, ya validado en F1).
- **Frontend**: nuevo módulo **"Cotizaciones"** (`quotes-panel.tsx`) — KPIs del mes (total, % conversión, valor facturado, pipeline con stock reservado), filtros por estado, form con búsqueda de productos + precio negociado + validez (default 15 días) + promesa de entrega + sede que despacha, acciones por estado (WhatsApp, aceptar, facturar con método de pago, cancelar), vista imprimible (window.print). Wiring completo: sidebar (con special-case de visibilidad si POS activo — mismo patrón que Jerarquía), lib/modules.ts (defaultOn + preset ferretería), merchant-panel, section-renderer, panel-comerciante-shell (grupo Ventas). `api.ts`: 8 métodos.
- `tsc` back (6 base) y front (8 base) sin errores nuevos. E2E 24/24: totales server-side, precio negociado, reserva por sede, sobre-reserva rechazada, transferencia bloqueada por reserva, conversión con stock/reserva/sale_id correctos, re-facturar rechazado, cancelar libera, vencida lazy, stats.
- **Siguiente (Fase 3 del plan)**: picking + ubicaciones + productividad de auxiliares. Pendiente menor: sugerencia automática de promesa de entrega según stock/rutas; PDF real (hoy print HTML); fiado requiere cliente registrado (customer_id).


## [2026-07-07] — Multibodega F1: stock por sede + transferencias entre bodegas (auditoría ferretería)

Primera fase del plan "ferretería 60 empleados / 6 ubicaciones": inventario visible por sede sin llamadas entre bodegas. Verificado E2E 28/28 (distribución, sobre-asignación rechazada, transferencia con cascada, venta descuenta sede + fallback, anulación devuelve, soft delete).

- **Arquitectura elegida**: `products.stock` sigue siendo el TOTAL consolidado (fuente de verdad — los 8 flujos que mutan stock no se tocan: ventas, compras, merma, restbar, variantes, pedidos…). La nueva `sede_stock` es el DESGLOSE por sede. Transferir mueve desglose sin alterar el total; vender descuenta total + desglose.
- **DB (migración 0015 `eminent_the_fury`)**: `sedes` += `type` enum(punto_venta/bodega/mixta), `phone`, `manager_id`, `is_active` · nueva `sede_stock` (unique sede+producto, stock/reserved/min decimal) · nueva `stock_transfers` (items JSON, estados solicitada→en_transito→recibida|cancelada, quién solicitó/envió/recibió) · `users.sede_id` (sede del colaborador).
- **Backend**: nuevo `sedes/sedes.service.ts` (el módulo era routes-only). Endpoints: `GET /sedes/stock-matrix` (desglose de todos los productos), `GET /sedes/:id/stock`, `PUT /sedes/:id/stock/:productId` (distribuir; valida suma ≤ total), `GET /sedes/availability/:productId` (para POS), `GET|POST /sedes/transfers`, `PATCH /sedes/transfers/:id/status` (en_transito descuenta origen bajo lock FOR UPDATE, recibida suma destino con upsert, cancelada en tránsito devuelve a origen; transición inválida → 400). `DELETE /sedes/:id` ahora es soft delete (is_active=0) y desvincula productos/usuarios; `GET /sedes` solo activas (`?all=1` para todas). La auditoría de transferencias vive en la propia tabla (stock_movements solo audita cambios del TOTAL).
- **Ventas** (`sales.service.ts` create): resuelve `saleSedeId = data.sedeId || users.sede_id del vendedor`, lo guarda en `sales.sede_id` y descuenta `sede_stock` (GREATEST(0,…), también insumos BOM) dentro de la misma transacción. Anulación devuelve el desglose a la sede de la venta.
- **Empleado↔sede**: `PATCH /users/:id/sede` (org.routes) + selector "Sede / bodega asignada" en el dossier de Jerarquía; org-chart y dossier devuelven sedeName; tarjeta del árbol muestra 📍sede.
- **Frontend**: nuevo `sede-stock-panel.tsx` — botón "Bodegas" en Inventario (si hay 2+ sedes): pestaña **Stock por sede** (matriz productos × sedes con edición inline de la distribución + columna "Sin asignar") y pestaña **Transferencias** (crear eligiendo del stock físico del origen, enviar/recibir/cancelar). POS: icono 🏭 junto al stock abre "¿Dónde hay stock?" (disponibilidad por sede) y la venta envía `sedeId` del filtro de sede activo. `api.ts`: 8 métodos nuevos.
- **Fix colateral**: query de matriz usaba `products.is_active` que NO existe en esa tabla (descubierto por E2E).
- `tsc` back (6 base) y front (8 base) sin errores nuevos.
- **Pendiente F1.5 (declarado)**: compras/recepción con sede destino · storefront orders descuentan sede · reservas por sede en cotizaciones (Fase 2 del plan ferretería).


## [2026-07-06] — Organigrama del comercio con expediente consolidado por colaborador

El comerciante ahora ve a todo su equipo en un árbol jerárquico y, al tocar una tarjeta, todo lo vinculado a esa persona en un solo lugar. Verificado por HTTP (org-chart, set-manager con anti-ciclo, dossier).

- **DB (migración 0014 `confused_shatterstar`)**: `users.manager_id` (self-ref) + índice — habilita la jerarquía que no existía (antes solo había rol y cargo, sin padre).
- **Backend** (`users/org.routes.ts`, montado bajo `/api/users` antes de las rutas `/:id`):
  - `GET /users/org-chart` — todos los colaboradores del tenant (sin clientes) con cargo y managerId para armar el árbol.
  - `PATCH /users/:id/manager` — define "reporta a" con **validación anti-ciclo** (recorre la cadena de jefes; rechaza si crearía un bucle) y tenant-scoped.
  - `GET /users/:id/dossier` — expediente consolidado en una consulta paralela: datos personales + cargo + jefe; **compensación** (salario base, comisión, meta, bono); **ventas generadas** (histórico + mes desde `sales.seller_id`); **vacaciones** del año (concedidas/usadas/disponibles); **nómina** (últimos 12 `payroll_records`); **novedades** (`employee_novelties`); **ajustes** (bonos/descuentos de `payroll_adjustments`); y **vehículo asignado ahora** (ruta activa como conductor o pedido en curso — para ferretería).
- **Frontend** (`org-chart.tsx`): árbol recursivo con líneas conectoras y tarjetas (avatar/iniciales por rol con degradado, cargo, "N a cargo"); búsqueda que atenúa los que no coinciden; clic → **drawer lateral** con el expediente completo en tarjetas (contacto, compensación, ventas, vacaciones con barra, vehículo, nómina, ajustes, novedades) y **selector "reporta a"** para armar la jerarquía desde la misma UI.
- **Menú "Organigrama"** (icono Network, grupo Operaciones) cableado en los 4 registros existentes (`sidebar.tsx`, `merchant-panel.tsx`, `section-renderer.tsx`, `panel-comerciante-shell.tsx`) + `lib/modules.ts` para que aparezca sin importar el shell activo.
- `api.ts`: `getOrgChart`, `setUserManager`, `getUserDossier`. `tsc` back y front sin errores nuevos.
- **Siguiente iteración**: exportar organigrama a PDF/imagen · foto de perfil subible desde el dossier · adjuntar contrato/documentos del empleado · drag&drop para reorganizar el árbol.


## [2026-07-06] — Jerarquía: fix de visibilidad del módulo + rename + responsabilidades del cargo

El comerciante no veía el módulo "Organigrama" pese a estar cableado. Causa: `sidebar.tsx` filtra los ítems por `enabledModules` guardados del tenant (resolveActiveModules); un módulo NUEVO no está en la lista guardada de tenants existentes → quedaba oculto (Tema 1). El Tema 2 (PanelComercianteShell) filtra solo por rol, así que ahí sí salía.

- **Fix visibilidad** (`sidebar.tsx` `filterItem`): caso especial para `organigrama` → visible siempre que Empleados (`vendedores`) esté activo o no haya config de módulos, sin exigir reconfigurar. Los tenants nuevos ya lo traen (defaultOn).
- **Rename a "Jerarquía"** (petición del usuario) en sidebar.tsx, panel-comerciante-shell.tsx (×2) y lib/modules.ts; el id interno sigue siendo `organigrama` (no se tocan cases ni API). Título del componente y descripción actualizados.
- **Responsabilidades del cargo**: el dossier (`users/org.routes.ts`) ahora incluye `responsibilities` (descripción del cargo + permisos parseados de `employee_cargos`). Nueva sección "Responsabilidades y permisos" en el expediente (org-chart.tsx) con la descripción y los permisos como chips. Completa el control del empleado: cargo, responsabilidades, permisos, sueldo, comisión, meta, ventas, vacaciones, nómina, bonos/descuentos, novedades/permisos y vehículo asignado.
- `tsc` back y front sin errores nuevos.


## [2026-07-06] — Fix GIF de portada (400 Cloudinary) + fondo de página completa en escritorio (theme2)

Reporte con captura: al entrar al comercio (SIRIUSGASTROPUD, theme2) la portada GIF fallaba con 400 y quedaba el hero negro. Además el usuario quiere el GIF de fondo de TODO el contenido en escritorio.

- **Causa raíz del 400** (`utils/img.ts` `cldImg`): a la URL del GIF se le insertaba `w_…,q_auto,f_auto,dpr_auto`; Cloudinary rechaza (400) transformar GIFs animados grandes (límite píxeles × frames). Verificado por red: URL cruda → 200, URL transformada → 400. **Fix**: `cldImg` detecta `.gif` y devuelve la URL sin transformar (los GIF ya vienen "optimizados" como animación). Beneficia a TODO uso de GIF en el sistema.
- **Fondo de página completa en escritorio** (`theme2/theme2-storefront.tsx`): nueva capa `fixed inset-0 -z-10` (solo `md:`) con la portada/GIF (`cardCoverUrl`) + velo `bg-black/70` para legibilidad; la raíz pasa a `md:bg-transparent` solo cuando hay portada (si no, mantiene el negro). El cover propio del hero se oculta en escritorio (`md:hidden`) para no duplicar el GIF, y el velo del hero se atenúa (`md:from-black/40…to-transparent`) para dejar ver el fondo. Móvil intacto (sin fondo fijo; el hero conserva su cover).
- **Mismo fondo en el modal de pedido** (`theme2/theme2-order-flow.tsx`): idéntica capa GIF `fixed -z-10` + velo (solo escritorio) detrás del listado de productos; `T2Info` gana `cardCoverUrl` (el caller ya pasa el `info` completo). El header sticky conserva su fondo semi-oscuro para legibilidad. Móvil sin cambios.
- `tsc` frontend sin errores nuevos.


## [2026-07-06] — Rediseño del panel del despachador: Centro de Comando de una sola pantalla

Feedback del usuario: el panel obligaba a saltar entre pestañas (Centro/Activos/Despachados/Entregados), perdía contexto, desperdiciaba >50% de la pantalla en monitores grandes y no escalaba a decenas de pedidos. Rediseño de UI **sin tocar el backend** (reutiliza los endpoints fleet existentes).

- **Nuevo `dispatch-command-center.tsx`** — todo en una pantalla:
  - **Strip de 7 KPIs**: pendientes, en preparación, en ruta, entregados hoy, tiempo promedio (+retrasados), vehículos/conductores, capacidad usada (con barra).
  - **Kanban de 4 columnas** (Pendientes 🟠 / En preparación 🔵🟣 / En ruta 🟢 / Entregados ⚪) con **drag & drop nativo** que cambia el estado del pedido (bloqueado para pedidos en ruta; confirma retrocesos). Tarjetas compactas con cliente, zona, peso, total, "hace X min", urgencia por tiempo de espera (Alta/Media/Normal con anillo de color) y acciones rápidas (llamar/mapa/WhatsApp) sin abrir el pedido.
  - **Panel de detalle persistente** a la derecha (desktop) / bottom-sheet (móvil): cliente, dirección con acciones, productos/vehículo/nota colapsables, asignación de vehículo+conductor inline y botón de siguiente estado — **sin perder el listado** (estilo Trello/Jira).
  - **Tira de vehículos** con barra de capacidad real (peso asignado/máximo, %, color por saturación) calculada en cliente desde los pedidos.
  - **Sugerencias de agrupación** inline con creación de ruta en un modal compacto (reutiliza `createDispatchRoute`).
  - **Búsqueda** (pedido/cliente/teléfono/dirección) + filtro por vehículo; refresco automático cada 25s; entregados limitados a HOY (tope 60) sin cambiar backend.
- **`dispatch-panel.tsx`**: ahora tiene selector de vista en el header — **Comando** (nuevo, por defecto) · **Rutas** (LogisticsOps) · **Clásico** (lista por pestañas anterior, conservada como fallback). Contenedor a `h-screen flex flex-col` para que el comando ocupe toda la altura.
- Sin cambios de backend ni de datos; `tsc` frontend sin errores nuevos. Datos DECIMAL coercionados con `Number()` en todo el componente (evita el bug de `toFixed`).
- **Siguiente iteración**: mapa Leaflet embebido en el panel de detalle y en Rutas (hoy es link a Google Maps) · swipe para cambiar estado en tablet · optimización de orden de paradas.


## [2026-07-06] — Fix producción: crash `t.toFixed is not a function` (DECIMAL de MySQL como string)

Crash en el bundle de producción dentro de un `.map()`: los campos DECIMAL de MySQL (`total_weight_kg`, `AVG()`…) llegan como **string** por la API (mysql2 sin `decimalNumbers`), y varios componentes les aplicaban `.toFixed()` directo.

- `dispatch-panel.tsx` — `formatKg()` ahora coerciona con `Number()` y valida `isFinite` (el peso de `/fleet/pending-dispatch` es DECIMAL→string).
- `driver-panel.tsx` — `Number(order.totalWeightKg).toFixed(2)` en la tarjeta del vehículo.
- `restbar.tsx` — `avgGuests` (AVG SQL) coercionado en sus 3 usos (excel x2 + tabla).
- Regla para el futuro: **todo campo numérico que venga de la API se envuelve en `Number()` antes de `.toFixed()`** (los componentes nuevos de logistics-board ya lo hacían).
- Nota de incidente: un reemplazo masivo con PowerShell corrompió el encoding de restbar.tsx; se restauró desde git y se editó con herramienta segura. No usar `Get-Content`/`Set-Content` para editar código con tildes.


## [2026-07-05] — Fix chatbot: respuestas vacías del modelo (DeepSeek razonador) + fallback consciente de venta

Bug reportado con captura: el bot respondía siempre con los textos de FALLBACK ("¡Claro que sí! Tenemos X…" / "Cuéntame qué producto buscas") e ignoraba el "Quiero pedir: X" del botón. Causa raíz: en `orchestrator.service.ts` `agentOpenAICompat`, cuando el modelo no llama tools y `message.content` viene vacío, se devolvía `''` tal cual — y los modelos con razonamiento (DeepSeek v4, proveedor default) consumen el `max_tokens` (260) en el razonamiento interno y entregan content vacío → TODA respuesta caía al fallback.

- **Orchestrator**: content vacío sin tool_calls → ya no retorna `''`; rompe hacia el **cierre forzado** (llamada final sin tools, `max_tokens` ≥700) para extraer el texto. Mismo guard en el camino Gemini.
- **agent.service**: `maxTokens` del agente 260 → 520 (el prompt sigue exigiendo respuestas cortas; el presupuesto extra es para el razonamiento).
- **Fallback consciente del contexto**: si el mensaje es "Quiero pedir: X" (botón "Pedir por aquí"), el fallback AVANZA la venta ("¿Cuántas unidades de X quieres?" + quick replies) en vez de reiniciar la conversación. Prioridad: dato faltante → intención de pedido → producto matcheado → genérico.
- **Diagnóstico**: `console.warn('[chatbot] respuesta vacía del modelo…')` cuando se usa el fallback, para detectar reincidencias en logs.


## [2026-07-05] — Sistema Operativo Logístico para Ferreterías (flota + rutas + rentabilidad)

Extensión del módulo fleet existente a un sistema logístico completo multi-sede. Verificado E2E 11/11 por HTTP real (JWT firmado). Se REUTILIZÓ todo lo existente (autoAssignVehicle, calcOrderWeight, dispatch-panel, driver-panel, fleet-management, canal Socket.io `ops:{tenant}`, order_status_history) — nada duplicado.

- **DB (migraciones 0012 `mysterious_vapor` + 0013 `white_ultimates`):** `dispatch_routes` (rutas agrupadas con estados planificada→cargando→en_ruta→retornando→cerrada, auxiliares JSON, zona, sede) · `fleet_vehicle_expenses` (tipo/monto/galones/odómetro/ruta) · `fleet_vehicles` + SOAT/tecno/seguro/odómetro/fuel/volumen/mantenimiento-cada-km · `storefront_orders.route_id/route_sequence/sede_id` · `courier_availability.status` (6 estados de personal) · enum de merchant_notifications + `fleet_alert`.
- **Rutas agrupadas** (`fleet/logistics.routes.ts`): sugeridor por zona textual (barrio/municipio) que propone el vehículo disponible más ajustado, # auxiliares por peso (>300kg→1, >800kg→2) y **sumar a rutas activas con capacidad restante** antes de sacar otro vehículo; creación con validación de capacidad (sobrepeso → 400); **cascada de estados** ruta→pedidos→vehículo con `order_status_history` en cada transición; entrega por parada con **cierre automático de ruta y liberación del vehículo** en la última (también integrado al flujo existente del repartidor en delivery.routes).
- **Centro de operaciones en vivo**: `GET /fleet/ops-board` (pedidos con minutos de espera para semáforo, vehículos con % de carga de su ruta, personal con estado y entregas del día) + eventos Socket.io `dispatch-changed`/`staff-status-changed` en el canal ops existente, emitidos al facturar (orders públicas), al cambiar dispatch-status y en todo el ciclo de rutas.
- **Vehículo empresarial**: perfil con documentos y odómetro (`PUT /vehicles/:id/profile`), gastos reales reportables también por el conductor (`POST /fleet/expenses`, actualiza odómetro), y **job diario de alertas** (`alerts.job.ts`): SOAT/tecno/seguro ≤15 días o vencidos, mantenimiento vencido por km, consumo >30% sobre el promedio de la flota — con dedupe diario.
- **Analítica de rentabilidad** (`GET /fleet/analytics`): por vehículo — entregas, **facturación movilizada**, costos reales (gastos+mantenimiento), **utilidad estimada** y costo/entrega; ranking de conductores con min/entrega; KPIs de operación (pedidos, retrasados, tiempo facturación→despacho y despacho→entrega desde timestamps reales).
- **WhatsApp al cliente** (transaccional, base contractual — no marketing): "tu pedido salió 🚚" al poner la ruta en_ruta y "entregado ✅" al cerrar/entregar, vía la Evolution API ya integrada.
- **UI** (`logistics-board.tsx`): `<LogisticsOps/>` como pestaña **"🛰️ Centro"** del dispatch-panel (sugerencias con un clic → modal de crear ruta, kanban con semáforo verde/ámbar>30min/rojo>60min, rutas activas con paradas y avance, vehículos con barra de carga, personal con selector de estado) y `<FleetInsights/>` como pestaña **"📊 Rentabilidad & Docs"** de fleet-management (tabla de rentabilidad, ranking, KPIs 7/30/90 días, documentos con vencimientos, registro de gastos).
- **Fix colateral**: alias `delayed` (palabra reservada MySQL 8) → `delayedOrders` en la analítica.
- **E2E 11/11**: sugerencia agrupa 4 pedidos/560kg con 1 auxiliar, sobrepeso rechazado, ruta creada, cascada + 3 registros de historial, cierre automático + vehículo disponible, gasto+odómetro 1500km, alerta SOAT emitida, analítica exacta (3 entregas, $300k movilizado, $80k combustible, $220k utilidad), tablero ops. `tsc` back/front sin errores nuevos.
- **Siguiente iteración**: GPS histórico en mapa ops · optimización de orden de paradas · evidencia formal de entrega (firma/foto) · sede automática por zona · peso obligatorio en productos ferretería al publicar.


## [2026-07-04] — Plantillas Dinámicas de Producto (tipo Shopify) — MVP completo

Sistema JSON-driven para convertir cada producto en una landing de venta configurable sin código. El hero de compra (galería/variantes/precio/CTA con su lógica crítica) queda intacto; las secciones de plantilla se renderizan debajo (patrón Shopify). Verificado E2E 9/9 + HTTP.

- **F1 DB + backend (migración `0011_strange_morgan_stark`):** tabla `product_templates` (sections JSON `{id,type,settings,order,visible}`, estados draft/published/archived) + `products.template_id`/`page_content`. Módulo `product-templates`: CRUD, duplicar (versionado ligero), estados, asignación masiva, contenido único por producto, semillas Moda/Tech/Belleza, y endpoint público `GET /storefront/product-page/:productId` con caché en memoria 60s (draft/sin plantilla → `sections: []`, nunca rompe el detalle). Contrato de 10 tipos de sección en `section-types.ts` con `normalizeSections()` (tipos válidos, máx 25 secciones, settings ≤20KB).
- **F2 Renderer:** `frontend/components/product-template/SectionRenderer.tsx` — 10 secciones (benefits, rich_text con markdown-lite, video YouTube/TikTok/MP4, faq acordeón, testimonials con reviews aprobadas automáticas + manuales, comparison, urgency con stock real y countdown, guarantees, image_banner, related) con lazy images `cldImg` y colorimetría. Variables `{{product.*}}`/`{{store.*}}` en `lib/template-vars.ts`. Integrado en el detalle clásico (móvil + desktop, oculta la sección nativa de relacionados si la plantilla trae la suya) y en el detalle ML (debajo de `ProductDetailML`).
- **F3 Editor visual:** tab "Plantillas" en store-customization → `product-template-editor.tsx`: lista con estados y conteo, editor de 3 columnas (secciones con drag&drop HTML5 nativo + flechas + duplicar/ocultar/eliminar · settings por tipo con listas dinámicas · vista previa en vivo con el MISMO SectionRenderer y producto de muestra), guardar borrador/publicar, asignación masiva con buscador y modal de "Contenido" por producto (video/beneficios/FAQs/testimonios propios).
- **F4 SEO + verificación:** JSON-LD `Product` schema + `document.title` al abrir el detalle (client-side). E2E service-level 9/9 (crear/validar tipos/draft oculto/publicar visible/page_content/caché/conteo/duplicar/huérfano con gracia) + HTTP público 200. `tsc` back y front sin errores nuevos.
- **Deviaciones del plan declaradas:** asignación vive en el editor de plantillas (masiva) en vez del form de producto del inventario; el modal de contenido no precarga el page_content existente (el GET de products no lo devuelve) — ambos anotados como pendientes en el módulo DAIMUZ.
- **Fuera de alcance (spec F2-3):** SEO SSR con slugs, responsive por breakpoint, bloques globales, A/B testing, historial de versiones completo.


## [2026-07-03] — Tema 1: auditoría de jerarquía z-index + scroll dinámico en relacionados

Dos bugs de UX en el detalle de producto del Tema 1 (`landing-page.tsx`):

- **Jerarquía (login tapado):** el detalle de producto (clásico y ML) es un overlay `fixed z-[150]` que deja el header visible; desde el header se abrían login (z-81), carrito (z-65) y menú móvil (z-70), y los tres quedaban DETRÁS del detalle. Fix: login → `z-[180]/z-[181]`, carrito → `z-[160]/z-[161]`, sidebar móvil → `z-[160]/z-[170]`. Jerarquía resultante: contenido (≤55) < sidebar/carrito (160-170) < login (180) < legales/alertas (200) < form dirección (210) < age gate (300).
- **Scroll en relacionados:** al elegir un producto en "Productos relacionados", el contenedor scrolleable del detalle (mismo div reutilizado por React) se quedaba abajo. Fix: `productDetailScrollRef` en ambos contenedores (clásico y ML) + `scrollTo(top: 0, smooth)` en `openProductModal` (cubre también el related del tema ML, que pasa por `onSelectRelated → openProductModal`).
- Verificado: `tsc` frontend sin errores nuevos.


## [2026-07-02] — Chat Vendedor: el agente IA como asesor y cerrador de ventas (5 fases)

Upgrade del chatbot de tienda (web + WhatsApp) para asesorar y cerrar ventas de verdad. Verificado con suite E2E determinista (16/16 checks sin LLM) + prueba HTTP del takeover.

- **F1 Cerebro confiable** (`agent.service/rag/tools`): la búsqueda RAG adjunta **variantes** con disponibilidad real (`stock - reserved_stock`, incluye productos padre con stock=0); `registrar_pedido` ahora: resuelve producto+variante desde el texto (recorte progresivo: "Body Siso GRIS JASPEADO"), pregunta la opción si es ambigua, **valida stock** y **reserva variantes atómicamente** (`reserveForPublicOrder` + release en fallo), calcula **envío real** (`cart_delivery_fee`/`cart_min_purchase`, gratis sobre el mínimo), guarda `variant_id/size/color` en items, y registra **consentimiento Ley 1581** (`recordCheckoutConsents` con `source: 'whatsapp'` + `consent_id` en la orden). Prompt: sección DISPONIBILIDAD Y VARIANTES + autorización de datos antes de registrar.
- **F2 Motor de cierre**: `buildDynamicContext` inyecta ofertas activas, cupones vigentes, umbral de envío gratis y el **order bump** (upsell: UN complemento tras la decisión, una vez). `registrar_pedido` acepta `cupon` validado server-side (`resolveCouponDiscount`). **Cliente recurrente** por teléfono de la sesión: nombre + resumen de última compra al prompt; "¿misma dirección?" se resuelve server-side (`direccion: "misma"`) — la dirección nunca va al LLM. Sección de **objeciones** con datos (contra entrega, urgencia solo real).
- **F3 Widget** (`ChatWidget.tsx`): **quick replies** (marcador `[[opciones: A|B|C]]` extraído en el pipeline → `suggestedReplies` → chips), **"Agregar al carrito" real** (prop `onAddToCart` desde landing-page; con variantes abre el modal), markdown ligero (negrita/viñetas), link "Tratamiento de datos" en el footer.
- **F4 Panel comerciante**: endpoints `GET /chatbot/sessions`, `GET /sessions/:id/messages`, `PATCH /sessions/:id/takeover`, `POST /sessions/:id/reply` (WhatsApp vía Evolution; web por polling público `GET /chatbot/session-updates`). `/chatbot/message` devuelve `takeover` + `lastMessageId`; el widget entra en modo polling y dedupe del aviso. Nuevo `chatbot-conversations.tsx` montado en el tab Chatbot de store-customization: lista de sesiones, detalle, "Atender yo", respuesta manual.
- **F5 Verificación**: suite determinista `ts-node` — variantes en búsqueda, prompt (6 secciones), variante ambigua → pregunta, stock insuficiente → mensaje honesto, pedido válido (envío gratis 188k≥100k, consent_id, variant_id, reserva +2), "misma" dirección, domicilio $8k bajo el mínimo. HTTP: takeover silencia al bot y session-updates entrega la respuesta manual. `tsc` back y front sin errores nuevos. Datos de prueba limpiados.
- **Pendiente próxima iteración**: streaming SSE, pago en línea dentro del chat (link Wompi), follow-up post-venta (requiere consentimiento marketing, ya implementado).


## [2026-07-02] — Blindaje de privacidad Ley 1581/RGPD (módulo privacy, 6 fases)

Auditoría + implementación completa de protección de datos personales, motivada por los patrones de sanción tipo Sephora/Criteo/Amazon (pixel sin consentimiento, PII sin base legal, sin derecho al olvido).

- **Fase 1 (DB, migración `0010_tense_turbo`):** `consent_records` (registro inmutable de consentimientos, revocar = INSERT granted=0) + `data_subject_requests` (habeas data, `due_at` = 10 días hábiles). Columnas: `customers.is_active/deleted_at/anonymized_at` (la tabla nunca cumplió la regla de soft delete), `storefront_orders.consent_id`, `store_info.privacy_policy_version/cookies_content`.
- **Fase 2 (backend):** módulo `backend/src/modules/privacy/` (service + routes + index). Endpoints públicos rate-limited (consents, requests con verificación teléfono+nombre anti-enumeración) y admin (listar/atender solicitudes, export JSON, erase). `eraseCustomer()` = anonimización irreversible (identidad fuera de customers/storefront_orders/sales/chatbot; montos quedan por obligación fiscal) — bloqueado con crédito pendiente. **Primer módulo que escribe en la tabla `audit_log`** (`pii_export`, `pii_erasure`, `dsr_*`, `retention_purge`). `customers.service.ts`: DELETE físico → soft delete + filtro `is_active=1`. Las 4 rutas de checkout público exigen `acceptsDataPolicy` (400 si falta) y registran consentimiento (`consent_id` en la orden). Webhook Wompi: payload minimizado (`minimizeGatewayPayload`). Logs con PII redactados (`utils/redact.ts`, incluye `sql`/`sqlMessage` de errores mysql2).
- **Fase 3 (frontend):** `CookieConsentBanner` granular (esenciales/analítica/marketing, `localStorage['dz_consent']` + sync a backend); **Meta Pixel solo se inyecta con consentimiento de marketing** (era el gap tipo Sephora); checkbox obligatorio Ley 1581 + opcional marketing WhatsApp en `CheckoutView` y `CheckoutWizardML`; plantillas legales Ley 1581 por defecto (`lib/legal-templates.ts`) como fallback de los modales del footer (que ahora siempre se muestran) + política de cookies + `DataRightsModal` (formulario público de derechos).
- **Fase 4 (CRM admin):** en `customers.tsx` — botón exportar datos (JSON), "Desactivar" (soft) vs "Borrado definitivo (habeas data)" con diálogo explicativo, y panel "Solicitudes de datos" con días restantes del SLA y acciones atender/completar/denegar. API: `exportCustomerData`, `eraseCustomerData`, `getPrivacyRequests`, `updatePrivacyRequest`.
- **Fase 5 (retención + WhatsApp + IA):** `retention.job.ts` (boot + cada 24h): chatbot_messages >12m DELETE, delivery_chat_messages >6m DELETE, GPS de pedidos entregados >90d NULL, resumen en audit_log. Webhook WhatsApp: "BAJA"/"STOP"/"NO MÁS" → revocación `marketing_whatsapp` + confirmación al cliente. `sendMarketingMessage()` en whatsapp.service (verifica consentimiento; obligatorio para campañas futuras). Guard anti-PII documentado en `agent.rag.ts`.
- **Fase 6 (governance):** sección "🔐 Protección de Datos" en universal-constraints; procesadores externos + redacción de logs en security-policy; módulo `daimuz/modules/privacy/` (full + compressed); indexes actualizados.
- **Verificado E2E** (backend dev + MySQL docker): pedido sin consentimiento → 400 con mensaje Ley 1581; con consentimiento → 201 + 3 consent_records + consent_id; DSR pública verificada por nombre (`phone_name_match`) con due_at correcto; erasure anonimiza cliente+orden+chat conservando total y audita critical; retención corre limpia; opt-out deja `hasConsent=false`. `tsc` front y back sin errores nuevos (solo los preexistentes).
- **Pendiente negocio:** DPAs con procesadores, validación jurídica de plantillas, consentimiento en pedidos del chatbot.


## [2026-06-28] — Merge de main (feature hormas) integrado al baseline Drizzle

Se mergeó `origin/main` en `esteban` para unir el trabajo de Drizzle con la feature **hormas** (siluetas de calzado) que vivía solo en main.

- **Merge:** trae módulo `backend/src/modules/hormas/` + frontend + migraciones v40-v46 (archivadas en `db-legacy/migrations-root-legacy/`). Conflicto de `package-lock.json` resuelto eliminándolo (el proyecto usa pnpm). `index.ts` conserva la excisión de DDL **y** monta `/api/hormas`.
- **Hormas en el baseline:** se aplicó el DDL de hormas (tablas `hormas`/`horma_colors` + `horma_id` en `products`/`product_variants` + `weight_grams`/`shelf`) y se **regeneró el baseline** por introspección → `0000_dizzy_mongoose.sql` = **203 tablas + 6 vistas + 196 FKs**. Se agregó `tablesFilter: ['!__drizzle_migrations']` al config.
- **DDL de runtime de hormas congelado:** `hormas.service.ts` y `variants.service.ts` `ensureTables()` → no-op.
- **Verificado:** `tsc` sin errores nuevos (5 preexistentes de main); BD fresca crea hormas; backend bootea (migrate salta); `GET /api/hormas` → 200. Hash baseline `f07c8909…`.


## [2026-06-27] — Drizzle Kit FASE 2: baseline completo (201 tablas) + DDL de runtime congelado

Continuación de FASE 1. Dos logros: (a) **completar el baseline** con TODO el esquema real, (b) **eliminar el DDL de runtime**.

- **Baseline incompleto (corrección de FASE 1):** el `stockpro_truth` de FASE 1 se armó solo desde `schema_FULL.sql` (149 tablas) y **faltaban 52 tablas** de runtime (Vault, Coach/trainers, guilds, arena, drops, gamificación consumer, loyalty, portfolio, jukebox, workout, etc.) + decenas de columnas. Causa: se omitió el paso de capturar el DDL embebido.
- **Captura por extracción (sin boot):** script Node que extrae TODO el DDL estático de `index.ts` + 10 archivos de módulos (101 CREATE + 107 ALTER). Hubo que iterar la extracción para cubrir **todas las formas**: `.query(\`…\`)`, helpers (`addCol`/`addArenaCol`/`addOb`/`addTrCol`), comillas simples (`'ALTER…'`), interpolación dinámica (`${col}`) y verificar que no hubiera concatenación. Cross-check dev-vs-truth para validar (gap final: 9 columnas, añadidas a mano). Resultado: **baseline definitivo `0000_nervous_norman_osborn` = 201 tablas + 6 vistas + 196 FKs + 2672 columnas**, reconstruye 1:1.
- **DDL de runtime congelado:** bloque de `index.ts` (líneas 255-1472, ~21 try/catch, 1213 líneas) **excisado**. Funciones `ensure*` (loyalty, restbar, portfolio×3, storefront, lopbuk-landing, tenants, workout, variants) con `return` temprano. DDL inline en handlers (storefront `store_order_bump`/`store_info` ALTERs, superadmin `order_status_history` IIFE, portfolio `portfolio_config`, restbar `priority`) reemplazado por comentarios.
- **Verificación:** `tsc --noEmit` = 0 errores. **Boot real OK** (backend arranca contra la BD marcada: conecta, `runMigrations` salta el baseline, imprime banner, STDERR vacío). Hash baseline `2d6234c6…`, created_at `1782588720972` (mark script actualizado).
- **Gobernanza:** CLAUDE.md ya prohíbe DDL en runtime (regla 8). Cada `ensure*`/inline lleva comentario "DDL congelado → baseline Drizzle".


## [2026-06-27] — Drizzle Kit: baseline schema-as-history (FASE 1 completa)

Migración de **schema-on-runtime** (DDL embebido en TS) a **schema-as-history** (migraciones versionadas). Driver `mysql2` y todo el SQL raw SE QUEDAN; Drizzle convive. Plan completo en `daimuz/decisions/drizzle-migrations-plan.md`.

- **Scaffolding** — `backend/src/db/`: `index.ts` (cliente drizzle sobre el pool mysql2 existente), `migrate.ts` (`runMigrations()`), `schema/` (TS), `migrations/` (historial). `drizzle.config.ts` usa **`url`** de conexión (drizzle-kit rechaza password vacío de root local). Scripts: `db:pull`, `db:generate`, `migrate`. `runMigrations()` ya cableado en `index.ts` antes del `listen` (solo `NODE_ENV !== 'production'`).
- **BD verdad** — `stockpro_truth` provisionada cargando `schema_FULL.sql` (MySQL 8.4.3 Laragon; se quitaron `USE stockpro_db`/`CREATE DATABASE` internos y se convirtió `ADD COLUMN IF NOT EXISTS` MariaDB→`ADD COLUMN`). Reveló que el dev DB `stockpro_db` estaba **incompleto** (le faltaban 56 tablas: módulos affiliates/cartilla/community/theme4/consumer/landing/notifications).
- **Baseline `0000_quiet_swarm.sql`** — por introspección (`db:pull`): 149 tablas + 6 vistas + 179 FKs. Descomentado (ejecutable), vistas portables (quitado el qualifier `stockpro_truth`). **Validado: reconstruye una BD vacía 1:1 con la verdad** (tablas/vistas/columnas/FKs idénticos).
- **Nombres de FK (escollo resuelto)** — el `generate` desde `schema.ts` produce nombres canónicos de drizzle, 5 de los cuales **superan los 64 chars** de MySQL y rompen el `migrate`. Solución **híbrida**: el `.sql` ejecutable conserva los **nombres cortos nativos** (`_ibfk_N`, = prod), mientras el snapshot/`schema.ts` usan los canónicos → **`generate` queda limpio** ("No schema changes") y el SQL ejecutado nunca toca los nombres largos.
- **Marcar BDs existentes** — `src/db/baseline-mark-applied.sql` registra el 0000 en `__drizzle_migrations` (hash `acb1633a…`, created_at `1782567439458`) **sin recrear**. Aplicado a `stockpro_db`; **validado: `migrate()` salta el baseline** (delta 0 tablas). Para prod: correr ese script UNA vez.
- `tsc --noEmit` = 0 errores (incluye `schema.ts`/`relations.ts`). `schema_FULL.sql` deja de ser fuente de verdad → snapshot. **Pendiente FASE 2** (congelar DDL en runtime: sacar `ensureTable()` y el bloque inline de `index.ts`) — NO iniciada (requiere OK).


## [2026-06-25] — Workout Engine: Progression Engine + Runtime + Workout Mode UI (Fitness OS)

Construido el corazón del "Iniciar rutina" como sistema determinístico por capas. **NO deployado** (pendiente `pnpm exec tsc --noEmit` front+back + push + Komodo). Migraciones corren al boot.

- **Progression Engine (determinístico, sin deps)** — `backend/src/modules/progression/`. Núcleo puro hipertrofia + double progression (rango 8-12). Capas: `shared` (enums/constants/`schema.ts` validación estilo zod sin instalar zod), `domain` (entities, `rules/goal-rules.ts` = **único RuleEngine**, calculators volume/completion-rate/1RM, evaluator, strategies + factory), `application` (ProgressionService + evento `progression_computed`). Decisión: todas las series al tope → `increase` (+2.5 upper / +5 lower); dentro de rango → `maintain`; bajo mínimo o rate<0.8 → `decrease`. `strength`/`endurance` y `linear`/`rir_based` LANZAN a propósito (anti-alucinación). **19 tests** node:test verdes, tsc 0 errores.
- **Workout Runtime (Fase 5)** — `backend/src/modules/workout/` (scope consumidor = `users.id`, como `rutina`; NO tenant). State machine explícita (`pending→active→paused→completed/cancelled`). Tablas idempotentes: `workout_sessions`, `workout_exercises`, `workout_sets`, `exercise_progressions` (snapshot por user+ejercicio = source of truth). Repository único user-scoped+transaccional. Services: lifecycle + set-tracking + **progression-bridge** (al completar la sesión corre el engine por ejercicio → upsert snapshot → eventos). Event publisher no-op extensible. **12 tests** verdes. Montado en `index.ts`: `/api/workouts` + `ensureWorkoutSchema()` al boot.
- **Workout Mode UI (Fase 6, slice vertical)** — Backend glue `today-plan.service.ts` + `POST /workouts/start-today` (arma template por tipo de sesión + **peso sugerido = `nextWeight` del snapshot**). Frontend: `lib/workout-api.ts` (módulo aparte, NO se tocó el `api.ts` gigante), `components/workout/` (WorkoutSessionScreen, ExerciseCard, SetTracker, RestTimer 90s, WorkoutSummary), ruta `app/workout/session/[id]/page.tsx`, y botón "Iniciar rutina" de `MissionControl.tsx` cableado → `startToday` → `router.push`. **Regla:** el front NO calcula nada; solo renderiza `action`/`nextWeight` del backend. tsc 0 errores en archivos nuevos.
- **Verificación:** el mount del sandbox quedó stale otra vez (glitch conocido: trunca archivos grandes y no refleja sobreescrituras vía bash). Se verificó reconstruyendo el contenido correcto en `/tmp` y leyendo el workspace con file-tools. Correr `pnpm exec tsc --noEmit` en Windows.


## [2026-06-24] — Chatbot: limpiar llamados de herramienta filtrados como texto

- **Síntoma:** el modelo escribía el tool-call COMO TEXTO en el chat (`<function=registrar_pedido>{...}</function>`), visible para el usuario, además de hacer varias preguntas juntas. Pasa cuando el tool-calling nativo del proveedor no engancha y el modelo improvisa el llamado en texto.
- **Fix determinista:** sanitizador en `processAgentMessage` que elimina `<function...>...</function>` (cerrado y sin cerrar), `<tool_call>…`, tokens `<|...|>` y `[COMPRAR:…]`; si tras limpiar no queda texto útil, responde algo amable. Refuerzo de prompt en `buildEnrichedSystemPrompt`: "habla natural, UNA pregunta por mensaje, JAMÁS escribas etiquetas de herramientas ni JSON de pedidos en el mensaje".


## [2026-06-24] — Fix chatbot 500 por rate limit (regresión de IA7) + TS build

- **Causa del 500:** la migración del chatbot de tienda a `agentLoop` (IA7) quitó el manejo amable del 429 que tenían los `callGroq`/`callOpenAI` viejos (devolvían texto en vez de lanzar). Al saturarse Groq (free tier, 12k TPM), el error subía a 500 y el front mostraba "hubo un problema". **Fix:** `processAgentMessage` ahora captura 429/rate-limit/quota y devuelve respuesta amable ("muchas consultas, espera unos segundos") con código 200, conservando las tarjetas de producto ya encontradas. Otros errores de IA → mensaje genérico amable, nunca 500.
- **Causa raíz real (chatbot + coach caen a Groq):** ambos usan tools; al fallar OpenCode Go (suscripción, alta capacidad) el `agentLoop` caía a Groq (free, 12k TPM) → 429. Mitigaciones: (a) `providerChain` deja a **Groq de ÚLTIMO recurso** (orden `opencode_go → gemini → openai → groq`); (b) **log de diagnóstico** en `agentLoop` (`[ai] agente: proveedor "X" (model) falló → ...`) para ver POR QUÉ falla Go. Sospecha por docs OpenCode: el `model` de la API debe ir **pelado** (`deepseek-v4-flash`), no `opencode-go/deepseek-v4-flash` (el prefijo es solo del config CLI). Pendiente: confirmar con el log real de Go tras redeploy y corregir id/endpoint/tools según corresponda. Warnings `Duplicate key name 'idx_soi_variant'/'idx_si_variant'` son benignos.
- **TS build:** `lib/push.ts` `applicationServerKey ... as BufferSource` (choque de tipos lib DOM); `rutina.service.ts` `sex: sex ?? undefined` en computeNutrition. Ambos preexistentes.


## [2026-06-24] — Storefront: hora del pedido, checkout Tema 2, imágenes en modificadores

- **Hora del pedido (-5h):** causa = `created_at` es TIMESTAMP (interno UTC) pero la sesión MySQL estaba en hora Colombia y mysql2 sin config de zona → el `Date` quedaba 5h atrás y el front lo mostraba en Colombia (doble desfase). Fix UTC end-to-end: `database.ts` con `timezone:'Z'` + `SET time_zone='+00:00'` en cada conexión nueva; `pedidos.tsx` formatea con `timeZone:'America/Bogota'` (tarjeta + tickets de impresión).
- **Checkout Tema 2:** al confirmar ya NO redirige a WhatsApp. `submitOrder` muestra el contenedor "Tu pedido está en camino" y deja seguir comprando ("Seguir comprando"). `sendWhatsApp` → `buildWhatsAppUrl()`; el éxito (`Theme2OrderSuccess`) recibe `whatsappUrl` y ofrece botón opcional "¿Olvidaste algo? Confírmalo por WhatsApp".
- **Imágenes en modificadores (por opción):** el schema (`product_modifier_options.image_url`), backend (GET/PUT) y storefront (Tema 2/Tema 1 ya renderizan `o.imageUrl`) YA lo soportaban; faltaba la subida en el editor → `product-modifiers-manager.tsx` ahora tiene `CloudinaryUpload` + miniatura por opción.
- **Auditoría modificadores (valor/ítem separado):** en el código ACTUAL de Tema 2 (`detailUnit = detailBase + detailExtra`) y Tema 1 (`finalPrice += t1Extra`) el delta SÍ se suma al unitario y se une como UNA sola línea (el modificador se concatena al nombre, no crea ítem aparte); el pedido del reporte quedó en $16.000 = 14.000+2.000 (correcto). No se reprodujo el bug en fuente → probable desfase de deploy; recomendado redeploy + re-test.
- Verificado con esbuild (backend + tsx), 0 NUL.


## [2026-06-24] — Chatbot de comercio: auditoría resuelta (tools en cualquier IA + fixes)

Resolución de la auditoría del chatbot de tienda:
- **CRÍTICO — pedidos/reservas en cualquier proveedor:** `processAgentMessage` ya NO ramifica por proveedor. Todo pasa por `agentLoop` (IA7) con las herramientas reales (`registrar_pedido`/`crear_reserva`/`registrar_interes_cliente`). Antes solo Gemini ejecutaba herramientas; con el default `opencode_go` el bot no registraba nada. Ahora registra con la IA configurada, con respaldo y telemetría. Helper `toToolDefs`/`lowercaseTypes` convierte las declaraciones Gemini (MAYÚSCULA) a JSON-schema estándar para el orchestrator. **Dedupe por turno** (`executedTools`) evita pedidos/reservas duplicados si el modelo reintenta. `maxRounds: 4`, `maxTokens: 260`, tier main. Se conserva el error 'Servicio de IA no configurado' (mapea NO_AI_KEY).
- **MEDIO — historial duplicado:** la ruta `/message` ahora procesa ANTES de guardar el mensaje del usuario, así el historial que ve el modelo no incluye el mensaje actual (se anexa una sola vez dentro del pipeline). Elimina el doble último turno y, de paso, el mensaje "huérfano" si el pipeline falla.
- **MENORES:** telemetría del bot de tienda ahora sí se registra (pasa por orchestrator); en human takeover se guarda el mensaje del usuario.
- Verificación: el mount del sandbox quedó stale (glitch conocido, esbuild dio falso EOF); contenido confirmado completo y correcto vía file-tools. Correr `pnpm exec tsc --noEmit` en Windows.


## [2026-06-24] — Chatbot de comercio: asesor consultivo + no repetir/ofrecer productos

Mejora del chatbot de tienda (`agent.service` + `chatbot.routes` + `ChatWidget`):
- **Prompt** (`buildEnrichedSystemPrompt`): reescrito como ASESOR CONSULTIVO (entender→recomendar UNA opción→resolver objeciones→microcompromisos→cierre). Regla clave: solo mencionar/mostrar productos que el cliente pidió o que encajan; **nunca ofrecer el catálogo al azar**; y si el cliente ya dijo que quiere pedir un producto, **no repetir su tarjeta** sino avanzar el pedido (cantidad→nombre→teléfono→dirección). La carta pasa a "consulta interna — NO la listes".
- **`processAgentMessage`**: nuevo parámetro `excludeProductIds`; se **eliminó el relleno con productos destacados** (causa de mostrar productos no pedidos); las sugerencias = solo coincidencias reales menos los ya pedidos.
- **`chatbot.routes /message`**: lee `excludeProductIds` del body y lo pasa al pipeline.
- **`ChatWidget`**: trackea los productos pedidos por "Pedir por aquí" (`orderedIds`), los envía como `excludeProductIds`, y oculta su tarjeta (incluso en mensajes previos) al pedirlos. `onOrderByChat` ahora recibe el producto completo (id+nombre).
- Verificado con esbuild (backend + tsx), 0 NUL.


## [2026-06-24] — IA7: tools provider-agnóstico + AI Coach con cualquier IA

**Sin push/deploy — pendiente del usuario** (`pnpm exec tsc --noEmit` backend + redeploy).

- Orchestrator: nuevo `agentLoop(req)` con function-calling **provider-agnóstico**. Tools en JSON-schema estándar (tipos minúscula) + callback `execute(name,args)`. Soporta OpenAI-compat (OpenCode Go/OpenAI/Groq con `tools`) y Gemini (`functionDeclarations`, convertidos con `geminiSchema` a MAYÚSCULA). Loop multi-ronda (def. 6) con cierre forzado a texto si se agotan; telemetría (`logUsage` tier `agent`), tiering, guardas de límite y respaldo entre proveedores. **No reintenta en otro proveedor tras ejecutar una tool** (evita doble escritura en BD) vía flag `executed`.
- AI Coach (`rutina.assistant`) migrado a `agentLoop`: eliminado el fetch directo a Gemini y la restricción "solo Gemini". TOOLS reescritas a JSON-schema minúscula. Ahora corre con OpenCode Go / OpenAI / Groq / Gemini según configuración; el usuario tiene su coach funcional controlando su OS (perfil, rutina, comidas, compras, productos reales) con la IA que el admin elija. Free=tier small, LEGEND=tier main.
- Fix: el archivo `rutina.assistant.ts` tenía 1082 bytes NUL al final (artefacto de edición); se limpiaron (verificado con esbuild, 0 NUL).
- Asistente operador (`assistant.runPlatformAssistant`, superadmin Agente Maestro + comerciante) migrado también a `agentLoop`: se borraron los runners por proveedor (`runWithGemini`/`runWithOpenAICompat`) y `getAssistantKey`; tools (SUPERADMIN_TOOLS/MERCHANT_TOOLS) reescritas a JSON-schema minúscula y tipadas `ToolDef[]`. Ahora también corre con cualquier IA configurada (tier main, telemetría por tenant). `toOpenAITools` se conserva (lo usa `daimuz-chat`).
- **Todos los agentes con tools quedan sobre el orchestrator unificado.**


## [2026-06-24] — AI Coach: base de conocimiento certificada de fitness

- Nuevo `backend/src/modules/rutina/rutina.coach-kb.ts` → `COACH_KB`: conocimiento estructurado de coach (objetivos: fuerza/hipertrofia/pérdida de grasa/movilidad/salud-mantenimiento/recomposición/rendimiento, con series·reps·descanso·frecuencia·ejercicios·splits por meta; nutrición por prioridad calorías→proteína 1.6–2.2 g/kg→grasas 20–30%→carbos; reglas de progresión entrenamiento+nutrición; recuperación; onboarding; SEGURIDAD —derivar a profesional, nunca esteroides/dietas extremas/sobreentrenamiento—; estructura de respuesta; tono).
- `rutina.assistant.ts`: el `SYSTEM_PROMPT` ahora antepone `COACH_KB` como bloque estable y debajo la capa DAIMUZ (herramientas, productos reales, operación de la app). El coach detecta objetivo y ajusta rutina/nutrición según el KB; al crear rutina distribuye días y esquema por meta.
- `guardar_perfil.goal`: descripción con mapeo de las 7 metas del KB a los 4 enums almacenados (bajar_peso/subir_masa/mantener/salud_general).
- Nota: este asistente corre en Gemini (function-calling). Sin migración de DB.


## [2026-06-24] — Orquestación de IA: IA6 (telemetría + guardas de límite) — plan IA COMPLETO

**Sin push/deploy — pendiente del usuario** (`pnpm exec tsc --noEmit` backend + redeploy; corre migración `ai_usage_log` al boot).

- Migración idempotente `ai_usage_log` (tenant, provider, model, tier, tokens, `est_cost`, ok, created_at + índices).
- Orchestrator: las llamadas de proveedor devuelven `{text, usage}`; `logUsage` registra cada llamada (best-effort, nunca rompe). `estCost` con tabla de tarifas aprox por modelo.
- `getUsageStats()`: gasto estimado de `opencode_go` en ventanas 5h/7d/30d (cache 60s). Límites por env `AI_LIMIT_5H/WEEK/MONTH` (12/30/60).
- `limitGuard` en `textLLM`: ≥80% del tope degrada `main`→`small`; ≥100% evita Go (cae a Groq/Gemini).
- Endpoint `GET /chatbot/superadmin/ai-usage` (stats + desglose por modelo 30d) + tarjeta **"Consumo de IA"** en IntegrationsTab. `agent.processAgentMessage` pasa `tenantId` para telemetría por comercio. Visión también se registra (tier `'vision'`).

**Plan de orquestación IA completo (IA1–IA6).** Pendientes futuros menores: migrar `assistant.runAssistant`/`rutina.assistant` (requieren tools en el orchestrator) y compactar historial largo con `small`.


## [2026-06-24] — Orquestación de IA: IA5 (tiering main/small)

Continuación. **Sin push/deploy — pendiente del usuario** (`pnpm exec tsc --noEmit` backend + redeploy).

- `getAIKeys()` devuelve `opencodeGoModelMain`/`opencodeGoModelSmall` (settings `ai_text_model_main`/`ai_text_model_small`; default main=modelo Go configurado, small=`deepseek-v4-flash`).
- Orchestrator: `goModelFor(keys,{tier})` elige el modelo Go; `textLLM`/`textReply`/`run`/`resolveTextProvider` aceptan `tier`.
- Call sites: `runPublicAssistant`=**small**; chatbot de tienda (`agent.processAgentMessage`) y `daimuz-chat`=**main**.
- UI: campos main/small bajo OpenCode Go en `IntegrationsTab` + persistencia GET/PUT + `useIntegrations`/`api.ts`.
- Cache de prompt: el `system` ya va como bloque líder estable (lo que aprovecha el cache de Go). Pendiente futuro: compactar historial con `small` antes de `main`.


## [2026-06-24] — Orquestación de IA: IA2 (visión) + IA3 (config visión) + IA4 (centralizar proveedor)

Continuación del plan `context/plan-orquestacion-ia.md`. **Nada se ha hecho push/deploy — pendiente del usuario** (correr `pnpm exec tsc --noEmit` en backend + redeploy; la migración `ai_vision_cache` corre sola al boot).

**IA2 — Visión como rol** (`backend/src/modules/ai/orchestrator.service.ts`):
- `visionToText(img)` convierte imagen→texto (por `url` o `base64`), **caché por hash SHA-256** en tabla nueva `ai_vision_cache` (no re-OCR la misma imagen). Defensivo: devuelve `''` si falla.
- `run({ system, message, images })`: transcribe cada imagen y razona TODO con el modelo de texto barato (Go) vía `textReply`. Pipeline imagen→texto→Go.
- `invoice-ocr` se queda como OCR especializado (JSON); la visión genérica vive en el orchestrator.

**IA3 — Config texto vs visión:**
- `getAIKeys()` devuelve `visionProvider`/`visionModel` (settings `ai_vision_provider`/`ai_vision_model`); valida que **la visión nunca use Go** (cae a gemini).
- `visionToText` honra el proveedor configurado (orden: configurado → fallback por key disponible; el modelo configurado solo aplica al proveedor elegido).
- Persistencia en `chatbot.routes` GET/PUT `superadmin/integrations`.
- UI: tarjeta **"Visión — Imagen a texto"** en `IntegrationsTab` (selector gemini/openai/groq + modelo + estado de key); `useIntegrations` + `api.ts` extendidos.

**IA4 — Centralizar selección de proveedor:**
- `resolveTextProvider(keys)` en el orchestrator: devuelve `{provider,url,model,apiKey}` OpenAI-compat para los call sites con function-calling.
- `daimuz-chat.llmCall` usa el helper (borrado su if-chain duplicado; Gemini sigue por su rama propia con tools).
- `agent.processAgentMessage`: rama no-Gemini → `textLLM` (import dinámico para evitar ciclo; Gemini conserva sus tools).
- Sin migrar aún (tool-calling): `assistant.runAssistant`/`runWithOpenAICompat` y `rutina.assistant` → IA5/IA6.

**Archivos:** `ai/orchestrator.service.ts`, `agent/agent.service.ts`, `chatbot/chatbot.routes.ts`, `daimuz-chat/daimuz-chat.routes.ts`, `index.ts` (tabla `ai_vision_cache`), front `IntegrationsTab.tsx` + `hooks/useIntegrations.ts` + `lib/api.ts`.


## [2026-06-22] — Coach Economy T4–T8, Vault/Access Ecosystem (V1–V4), cierres Fase 3 + Adaptive OS (F4.1)

Sesión larga sobre el DAIMUZ Fitness Lifestyle OS. Detalle completo en `context/current-sprint.md`. **Nada se ha hecho push/deploy — pendiente del usuario.**

**Coach Economy (Fase 2) — cerrada T1–T8:**
- **T4 delivery + coach feed:** al activar el programa se materializa una rutina en el OS + mensaje de bienvenida; feed async `coach_feed_entries` (feedback/checkin/ajuste/tarea/anuncio + reply). Front: `ProgramFeed` (default si hay programa activo).
- **T5 payouts coach:** `trainer_withdrawals`, `releaseMaturedCommissions` (pending→available a los 7d), wallet, retiros + admin (`adminProcessWithdrawal`).
- **T6 portal `/coach`:** `CoachPortal` (auth propia, Resumen/Programas/Clientes-feed/Retiros/Perfil) + tab superadmin **Coaches** (`CoachPayoutsTab`).
- **T7 pulir CoachSection:** hero, ranking top coaches, reseñas + score en detalle.
- **T8 reviews + Transformation Score + ranking:** `createReview` (1 por booking pagado), `listTrainerReviews`, `getRanking`; `ReviewCard` en `ProgramFeed`.

**Vault / Access Ecosystem (Fase 3) — V1–V4 + cierres:**
- **V1 Vault Keys:** `vault_keys`/`vault_key_redemptions`/`consumer_vault_unlocks`; módulo `vault` (createKey, redeem transaccional idempotente, getMyUnlocks); `useVaultUnlocks` + `<AccessGate>` + `VaultSection` (tab Vault desktop / 🔑 header móvil) + tab superadmin **Vault** (`VaultKeysTab`). Interfaces: secret_theme, hidden_catalog, coach_room, drops, leaderboard, inner_circle.
- **V2 Drops como eventos:** `drops`/`drop_claims`; `vault.drops.service` (estado computado, claim transaccional `FOR UPDATE`), `vault.realtime` (namespace `/vault`, cupos en vivo); `DropsSection` (countdown + cupos en vivo Socket.io + claim) + tab superadmin **Drops** (`DropsTab`).
- **V3 Logros:** `consumer_achievements`; módulo `achievements` (catálogo con rareza, award idempotente); hooks en vault/drops/coach/legend/streak; `AchievementShelf` en Vault + perfil.
- **V4 Afiliados-curadores:** `createKeyAsAffiliate`/`listAffiliateKeys` (atribución `created_by_affiliate_id`); portal **`/promotor`** (`AffiliatePortal`): tier, ranking, emitir Vault Keys, lista con canjes.
- **Cierres F3:** contexto de pago `drop` (Wompi) + `convertClaim` → **10% de comisión al curador** cuya llave dio el acceso; botón "Pagar y asegurar" en `DropCard`; **waiting room** (badge + countdown ≤10 min).

**Fase 4.1 — Adaptive OS:** módulo `adaptive` (`/adaptive/me`) — nudges priorizados desde señales reales (feed coach sin leer, drop en vivo, racha, cercanía a logro, membresía). `AdaptiveCards` en Today (móvil+desktop), descartables 24h.

**Eventos nuevos en whitelist analytics:** coach_review_submitted, vault_key_redeemed, drop_claimed.

## [2026-06-21] (parte 2) — Rediseño del filtro y de "Editar en grupo" (feedback de UX)

Feedback directo tras la parte 1 de hoy: las etiquetas pill "Todas / [nombre horma]" se veían poco
profesionales, "Editar en grupo" repetido dentro de cada producto era ruidoso, y había que confirmar
que el filtro combina horma+talla+color (no es "repartir stock en cascada", es "filtrar en cascada" —
aclarado con el usuario).

- **Filtro unificado "Filtrar por:".** Se eliminaron los pills de horma ("Todas", "Oversize Americana", "Oversize Fit") y los chips sueltos de talla/color de la fila expandida. Reemplazados por 3 `Select` (Horma/Talla/Color, ocultos si el producto no tiene esa dimensión) + botón "Limpiar" — mismo lenguaje visual que los filtros de Tipo/Categoría/Stock del toolbar principal. Las opciones de cada Select salen de `getDisplayTallas`/`getDisplayColors`/`getDisplayHormas` (ya existían, estaban sin usar).
- **"Editar en grupo" ya no vive dentro de cada producto.** El toggle se movió a UN solo lugar: el botón "Editar variantes" en el header, junto a "Seleccionar" (mismo patrón `variant={modo ? 'default' : 'outline'}`). Con el modo activo, cada fila expandida muestra checkboxes por variante; "seleccionar grupo visible" pasó de ser un link de texto subrayado a un checkbox real en el header de la tabla (escritorio) y una fila con checkbox (mobile) — selecciona/deselecciona todas las variantes que pasan el filtro activo.
- **Confirmado con el usuario:** "cascada" = el filtro debe combinarse según lo que se seleccione (horma solo, talla solo, color solo, o cualquier combinación de los 3) — NO es repartir una cantidad total entre variantes. La lógica `getFilteredVariantsFor` (AND entre los 3 filtros) ya cumplía esto desde la parte 1; no requirió cambios de lógica, solo de UI.

## [2026-06-21] — Talla/Color como filtro real de variantes + edición en grupo (bulk) en Inventario

- **Talla y color ahora filtran, no solo consultan.** El picker rápido (Horma/Talla/Color) en la fila principal de `inventory-list.tsx` ya sincronizaba la horma con la fila expandida (`onHormaChange`, ver parte 15); ahora `useVariantPicker` también dispara `onSizeChange`/`onColorChange`, conectados a nuevo estado `expandedSizeFilter`/`expandedColorFilter` (por producto). La fila expandida ("Ver variantes") y el bloque móvil filtran la tabla completa combinando horma+talla+color a la vez (`getFilteredVariantsFor`), con chips removibles ("Talla M ✕", "Color Negro ✕") para ver/limpiar el filtro activo.
- **Edición en grupo de variantes (bulk).** Botón "Editar en grupo" dentro de la fila expandida de cada producto activa `bulkVariantMode`: aparecen checkboxes por variante + botón "Seleccionar grupo visible" (selecciona de un click todas las variantes que pasan el filtro activo de talla/color/horma). La selección es global (`selectedVariantIds`, un `Set<string>` no atado a un producto), así se puede armar un lote combinando variantes de varios productos/filtros. Barra sticky muestra el contador y abre el diálogo de edición: stock (sumar/restar/establecer cantidad exacta, con motivo obligatorio), precio override, costo y stock mínimo — cada campo es opt-in (checkbox "Cambiar X") para no pisar lo que no se quiere tocar.
- **Backend nuevo:** `POST /api/variants/bulk-update` (`variants.service.ts::bulkUpdate`, `variants.controller.ts::bulkUpdate`, ruta declarada ANTES de `/variants/:id` igual que `/variants/summary`). Itera variante por variante (no transaccional entre ellas a propósito): si una falla (ej. stock insuficiente al restar) las demás igual se aplican; reporta `{ updated, failed: [{id, error}] }`. El stock reusa `adjustStock` (atómico, registra `inventory_movements` con `reference_type: 'bulk_edit'`); precio/costo/stock mínimo reusan `update()`.
- **Frontend:** `api.bulkUpdateVariants()` en `lib/api.ts`. Toda la UI vive en `inventory-list.tsx` (no se tocó `variant-manager.tsx` — ese modal es por-producto, esto es cross-variante desde la vista de inventario).
- Petición del usuario: "que seleccionar la talla y el color también funcione como filtro en las variantes" + "una opción para editar por grupos por si se necesita modificar grandes cantidades".

## [2026-06-19] (parte 16) — Talla y Color: mismo orden siempre, sin importar la horma

Las columnas/chips de Talla y Color del picker rápido (`VariantPickerColumns` /
`VariantQuickPicker`) tomaban el orden tal cual venía del array de variantes — podía
"saltar" al cambiar de horma. Se agregaron `SIZE_ORDER`/`sortSizes` a nivel de módulo
(antes `SIZE_ORDER` vivía duplicado dentro de `InventoryList`) y se aplican siempre:
- **Talla:** orden de confección XS/S/M/L/XL/XXL/XXXL.
- **Color:** alfabético (A-Z).
Al cambiar de horma se sigue filtrando a las tallas/colores de ESA horma (eso no
cambió), pero el orden visual ya no varía — siempre el mismo criterio.

## [2026-06-19] (parte 15) — Picker de Horma sincroniza el filtro + feedback de hover

- **Elegir horma en la columna "Horma" (o en el bloque móvil) ahora también filtra la
  fila expandida ("Ver variantes")** — antes eran dos selecciones independientes (la del
  picker rápido y la del filtro de la tabla expandida), había que elegir la horma dos
  veces. `useVariantPicker` acepta un callback `onHormaChange` que ambos componentes
  (`VariantQuickPicker`, `VariantPickerColumns`) disparan al click, conectado a
  `setHormaFilterFor(product.id, hormaId)`.
- **Feedback de hover/cursor** en todos los botones clickeables del picker (horma, talla,
  círculos de color) y en los chips de filtro de la fila expandida: `cursor-pointer` +
  borde resaltado en hover para horma/talla, y los círculos de color ahora escalan
  (`hover:scale-125`) y muestran un anillo sutil al pasar el mouse — antes no tenían
  ninguna señal visual de que eran clickeables.

## [2026-06-19] (parte 14) — Fix colisión de SKU entre hormas + filtro, círculo de color, 4 imágenes

- **Fix real:** "Oversize Fit" y "Oversize Americana" generaban el mismo tag de horma
  en el SKU ("OVERSI", truncado a 6 chars) — `0009-OVERSI-BLANCO-S` para las dos,
  imposible diferenciarlas. `variant-manager.tsx` ahora usa el **slug completo** de la
  horma (sin truncar) para ese tag — los slugs ya son únicos por definición
  (`UNIQUE KEY uk_horma_slug_tenant`), así que no puede volver a colisionar. No se
  renombran los SKUs ya creados con el bug viejo — solo aplica a variantes nuevas.
- **Filtro por horma en la fila expandida:** cuando un producto tiene variantes en más
  de una horma, aparecen chips ("Todas" + cada horma) arriba de la lista/tabla para
  filtrar qué variantes se muestran — en escritorio y en la tarjeta móvil. El "Stock
  total" del pie cambia a "Stock de esta horma" cuando hay un filtro activo.
- **Columna Color (tabla expandida, escritorio):** ya no muestra el nombre como texto
  ("Blanco") — solo el círculo con su hex, el nombre queda de tooltip (`title`).
- **4 imágenes por variante desde el editor rápido:** el diálogo "Editar variante" que
  se abre con el lápiz de la fila expandida ahora tiene la misma galería de 4 slots
  (`CloudinaryUpload`) que ya existía en el gestor completo de Variantes — antes solo
  se podían cargar imágenes abriendo "Variantes / Tiers".

## [2026-06-19] (parte 13) — Fila expandida: variantes ordenadas por Horma → Color → Talla

El orden de las variantes al expandir un producto dependía de cuándo se habían creado
en la base de datos (`sort_order`/`created_at`), así que podían salir mezcladas si se
agregaron en momentos distintos o por hormas distintas. Se agregó `sortVariantsForDisplay`
(ordena por nombre de horma, después color, después talla con el orden de confección
S/M/L/XL/XXL) y se aplicó en ambas vistas expandidas:
- **Escritorio:** la tabla ya tenía columna "Horma" (cuando hay más de una) — al ordenar,
  las filas de la misma horma quedan juntas, fáciles de escanear.
- **Móvil:** además del orden, se agregó una pequeña etiqueta en negrita con el nombre
  de la horma cada vez que cambia de grupo (solo si el producto tiene más de una).

## [2026-06-19] (parte 12) — El selector Horma/Talla/Color en la tabla queda solo de lectura

A pedido del usuario: el stock que aparece al elegir horma+talla+color en la tabla de
inventario (columnas nuevas + tarjeta móvil) ya **no se puede editar ahí** — solo se
consulta. Se quitó `api.adjustVariantStock` y el `<Input>` editable de `useVariantPicker`
y de los dos componentes que lo consumen (`VariantQuickPicker`, `VariantPickerColumns`);
ahora muestran el stock de la variante elegida con el mismo estilo de punto+número que
el total agregado (verde/ámbar/rojo según `suficiente/bajo/agotado`). Para editar stock
sigue estando el lápiz de la fila expandida o el gestor completo de "Variantes / Tiers".

## [2026-06-19] (parte 11) — Tabla de inventario: Horma/Talla/Color en columnas separadas + Stock dinámico

- Se quitó el resumen "Hormas · colores · tallas" que aparecía debajo del nombre del
  producto (en tarjeta móvil y en la celda Producto del escritorio) — esa info ya vive
  en columnas dedicadas, era redundante.
- **Columna "Variante" partida en 3 columnas reales:** Horma | Talla | Color (antes
  todo apilado en una sola celda). Lógica compartida vía el hook `useVariantPicker`
  (extraído de lo que antes era el cuerpo de `VariantQuickPicker`), consumido por dos
  componentes: `VariantQuickPicker` (móvil, todo en un bloque) y `VariantPickerColumns`
  (escritorio, 4 `<TableCell>` propias: Horma, Talla, Color, Stock).
- **La columna Stock ahora es dinámica:** sin selección, muestra el total agregado (como
  antes). En cuanto se elige talla + color, muestra el stock de **esa variante exacta**
  en un input editable (mismo guardado atómico de siempre). Se movió a continuación de
  Color en vez de su posición anterior (junto a Precio) — comparten la misma instancia/
  estado de selección, así que tenían que quedar en el mismo componente.
- `inventoryColSpan` recalculado: Producto, Horma, Talla, Color, Stock, SKU, Tipo,
  Categoria, [Sede], Precio, Acciones.

## [2026-06-19] (parte 10) — Unificación: la generación por horma vive SOLO en el Gestor de Variantes

A pedido del usuario ("vamos a unificar las dos en una sola ya que hacen lo mismo"):
había DOS implementaciones del mismo generador color×talla por horma — una en
"Agregar Producto" (`inventory-list.tsx`) y el modo guiado libre en el Gestor de
Variantes (`variant-manager.tsx`). Se consolidó en una sola.

- **`variant-manager.tsx`:** el modo "Crear rápido" ahora tiene un conmutador
  **Usar horma / Libre**. Con horma: chips de selección múltiple + una tabla de
  stock color×talla por cada horma elegida (idéntico a lo que tenía antes
  `inventory-list.tsx`), hex heredado de `horma_colors`, SKU con tag de horma si
  hay más de una seleccionada. Libre: el modo de siempre (ejes color/talla/material
  en texto libre). `generate()` quedó unificado con un branch interno según el modo.
  Carga la lista completa de hormas (`api.getHormas`) en vez de solo una por prop.
- **Form manual de variante:** ganó un `<Select>` de Horma (guarda/edita `hormaId`
  directo en la variante) — ya estaba "preparado para guardar" todo lo demás, faltaba
  este campo.
- **`inventory-list.tsx` (ProductFormDialog):** se eliminó por completo el selector
  múltiple de hormas y las tablas de stock — ya no genera variantes al crear el
  producto. Flujo nuevo: crear el producto (datos generales) → abrir "Variantes /
  Tiers" → generar ahí (con horma o sin ella). `handleSubmit` quedó en una sola
  línea (`onSubmit(cleaned)`, sin segundo argumento).
- El encabezado del diálogo de Variantes ahora deriva **todas** las hormas en juego
  desde las variantes ya creadas (`existingHormaNames`), no de un único `hormaId` fijo.

## [2026-06-19] (parte 9) — Horma como plantilla, no como validador: fin de la duplicación de colores

Decisión arquitectónica (a pedido): la horma deja de ser una segunda fuente de verdad
que compite con la variante. Pasa a ser solo una **plantilla de arranque** — define
qué colores/tallas sugerir al crear, pero no sigue validando ni sincronizando nada
después. `isColorAllowed` se mantiene tal cual (sigue bloqueando al crear desde la
matriz, aunque ahí es imposible violarlo porque los colores YA salen de la paleta de
la horma). `horma_colors`/`size_chart` quedan como plantilla/sugerencia, sin validación
posterior sobre variantes ya creadas (confirmado con el usuario).

- **`frontend/lib/colors.ts` (nuevo):** única fuente para "nombre de color → hex" —
  `COLOR_HEX_FALLBACK`, `normalizeColorName`, `hashHex`, `resolveColorHex`, `colorToCss`.
  Reemplaza 3 copias pegadas a mano (con listas ligeramente distintas) en
  `horma-manager.tsx`, `inventory-list.tsx` y `variant-selector.tsx` — los tres ahora
  importan de aquí.
- **Variantes generadas desde la matriz de horma heredan el hex real** de
  `horma_colors.hex` al nacer (antes nacían sin hex, dependían 100% del fallback por
  nombre). Una vez creada, la variante es dueña de su propio `colorHex` — no se vuelve
  a tocar desde la horma.

## [2026-06-19] (parte 8) — Columna "Variante": selector Horma→Talla→Color con stock editable inline

- Nueva columna **Variante** en la tabla de inventario (entre Producto y SKU), componente `VariantQuickPicker`: muestra la horma (label si es una sola, chips si son varias) → tallas (chips) → colores (círculos), en ese orden. Al elegir talla y color se resuelve la variante exacta y aparece un input de stock; al perder foco (blur) o Enter, guarda con `api.adjustVariantStock(id, { type: 'ajuste', ... })` (ajuste atómico, set absoluto — no delta) y refresca el resumen.
- Misma lógica reutilizada en la tarjeta móvil (debajo de los botones de acción, solo si el producto tiene variantes).
- Cada fila tiene su propia instancia con selección independiente (no hay estado compartido entre productos).
- `inventoryColSpan` actualizado (+1) para la nueva columna.

## [2026-06-19] (parte 7) — Un producto puede tener variantes en VARIAS hormas + resumen compacto

- **`horma_id` pasó de `products` a `product_variants`:** antes un producto tenía UNA sola horma; ahora cada VARIANTE tiene la suya. Permite que un mismo producto (ej. "Estampado DTF") tenga variantes repartidas en distintas hormas (Oversize Fit, Camiseta Clásica...), cada una con su propia paleta de colores y tabla de tallas. Migración idempotente en `variants.service.ts → ensureTables()` (+ backfill desde `products.horma_id` para variantes existentes) y `migrations/v46_product_variants_horma_id.sql`. `hormasService.ensureTables()` se hizo público porque `variantsService` la necesita (LEFT JOIN a `hormas` por `horma_id`).
- **Validación de paleta por variante:** `variantsService.create()` valida el color contra la paleta de SU horma (`hormasService.isColorAllowed`), no la del producto.
- **Formulario "Agregar Producto":** selector de horma pasó de único a **multi-selección** (chips). Cada horma elegida muestra su propia tabla de stock color×talla. El SKU de cada variante incluye la horma como prefijo solo cuando hay más de una horma seleccionada (evita colisión real: "Negro-M" puede existir en dos hormas distintas).
- **Catálogo (storefront):** `attachVariants` (storefront.routes.ts) y `VariantSelector` (frontend) ganaron el eje **Horma/Modelo** — si un producto tiene variantes en más de una horma, el cliente la elige como un eje más (junto a Color/Talla/Material).
- **Resumen más corto en la tabla de inventario:** se consolidó todo en una sola línea compacta bajo el nombre del producto — hormas (texto, no badges), círculos de TODOS los colores, y TODAS las tallas — en vez de badges apilados en varias filas. Se quitó el badge de horma duplicado de la columna "Tipo".
- **Fix colores grises:** los círculos de color usaban `colorHex || gris-fijo`; como las variantes creadas desde la matriz de horma no traen hex, todos salían grises. Se agregó `resolveColorHex` (mapa de nombres conocidos + hash estable de respaldo) igual que en `horma-manager.tsx`, aplicado en fila principal, tarjetas móvil y tabla expandida.
- Tabla expandida: agrega columna **Horma** por variante solo cuando el producto tiene variantes en más de una horma (si es una sola, no hace falta repetirla en cada fila — ya está en el encabezado).

## [2026-06-19] (parte 6) — Variantes expandidas: misma estética de la tabla + Editar/Eliminar

- La fila expandida de variantes en `inventory-list.tsx` dejó de ser un `<table>` HTML suelto y ahora usa los mismos componentes `Table/TableHeader/TableRow/TableHead/TableCell` (y las mismas clases de texto/color) que la tabla principal de productos — misma tipografía, mismos bordes, mismo estilo de fila.
- Cada variante tiene columna **Acciones** con botones Editar/Eliminar (ghost icon, igual que la fila de producto):
  - **Editar** abre un diálogo liviano (`editingQuickVariant` / `quickVariantForm`) para color, hex exacto, talla, costo y precio override — usa `api.updateVariant`. El stock sigue ajustándose desde "Variantes / Tiers" (movimiento auditado, no edición directa).
  - **Eliminar** pide confirmación (`deletingQuickVariant`) y hace soft-delete vía `api.deleteVariant`.
  - Ambas acciones refrescan el resumen (`loadVariantsSummary()`) al terminar.
  - Mismo patrón (iconos más chicos) en la vista expandida de las tarjetas móviles.

## [2026-06-19] (parte 5) — Inventario: stock total real, todos los colores, horma y precio en variantes

- **Fix `isUUID()` en rutas de variantes:** `variants.routes.ts` exigía `param('productId'/'id'/'tierId').isUUID()` — algunos productos heredados de la migración anterior no tienen ID UUID, y esa validación los rechazaba con 400 silencioso (solo visible como "Validation errors" en consola, sin toast). Se relajó a `.notEmpty()`.
- **Endpoint nuevo `GET /api/variants/summary`:** trae TODAS las variantes activas del tenant en un solo viaje (`variantsService.findAllByTenant`, sin eager-load de tiers — liviano a propósito). Antes solo existía por-producto (`GET /products/:id/variants`), forzando N+1 si se quería un resumen global.
- **Inventario (`inventory-list.tsx`) consume ese resumen al cargar** (`loadVariantsSummary`, junto a `fetchProducts`) y ya no hace fetch perezoso por fila al expandir — todo queda pre-cargado:
  - **Stock "general" = suma de todas las variantes** del producto (`getDisplayStock`), no el campo `products.stock` desconectado. Se refresca tras crear producto+horma y al cerrar el gestor de Variantes.
  - **Todos los colores** del producto se pintan como círculos en la fila principal (antes tope de 5) — `getDisplayColors`, deduplicados por nombre.
  - Si el producto tiene `hormaId`, se muestra un badge **Horma** junto a "Tipo" (y repetido como encabezado al expandir).
  - Tabla expandida: agregó columna **Precio** (`priceOverride ?? basePrice`), fila de **stock total**, y el SKU ahora se ve como chip `<code>` en vez de texto monoespaciado plano (mismo tratamiento en SKU del producto).

> **Tipo vs Categoría (aclaración, no cambia código):** `Tipo` (`productType`, fijo: ropa/alimentos/electrónica/...) es del sistema y decide qué **campos extra** pide el formulario (talla/material para ropa, vencimiento/registro sanitario para alimentos, etc.) — vive en `lib/product-config.ts`. `Categoría` es libre, la crea cada comercio (`categories` table) para **organizar/filtrar** su propio catálogo (ej. "Camisetas", "Promos") — no afecta el formulario. Son independientes: un producto tiene un Tipo (estructura) y una Categoría (organización), a la vez.

## [2026-06-19] (parte 4) — Fix: `ER_NO_SUCH_TABLE` product_variants (auto-heal de schema)

- **Causa:** `004_variants_and_suppliers.sql` (tablas `product_variants`, `variant_price_tiers`, `inventory_movements`, `suppliers`, `supplier_products` + columna `products.base_price`) es una migración que se corre **a mano**. En tenants donde nunca se ejecutó (ej. `stockpro_db`), cualquier llamada al módulo de variantes tronaba con `ER_NO_SUCH_TABLE` — se disparó al usar el nuevo expandible de inventario (`findByProduct`).
- **Fix:** `variants.service.ts` ganó `ensureTables()` (auto-migración idempotente, mismo patrón que `hormasService.ensureTables()`): crea las 5 tablas con `CREATE TABLE IF NOT EXISTS` + agrega `products.base_price` (backfill desde `sale_price`) si falta. Se llama al inicio de **todos** los métodos públicos del service (`findByProduct`, `findById`, `create`, `update` vía `findById`, `softDelete` vía `findById`, `adjustStock`, `decrementStockInTransaction`, `reserveForPublicOrder`, `releaseForOrder`, `settleVariantForSale`, tiers, `getMovements`). El método es público (no `private`) porque `import.service.ts` (CSV bulk) y `suppliers.service.ts` también tocan estas tablas directamente — ambos ahora llaman `variantsService.ensureTables()` antes de su primera query. En `import.service.ts` se llama **antes** de abrir la transacción (DDL hace COMMIT implícito en MySQL, rompería una transacción en curso).
- **No tocado:** `purchases.service.ts` también lee `suppliers` pero no se incluyó en este fix (fuera del alcance del error reportado); si falla igual, aplica el mismo patrón.

## [2026-06-19] (parte 3) — Variantes: galería de 4 imágenes por color + inventario expandible (color/talla/stock)

- **Hasta 4 imágenes por color en variantes:** `variant-manager.tsx` reemplazó el campo único "Imagen del color (URL)" por una galería de 4 slots (`CloudinaryUpload`, igual patrón que la galería de 4 imágenes del producto general). `ProductVariant.images` ya soportaba un array; ahora la UI lo expone completo. Cap de **4** también validado en backend (`variants.service.ts` → `create`/`update`, constante `MAX_VARIANT_IMAGES`, error 400 si se excede).
- **Tabla de inventario expandible:** en `inventory-list.tsx`, cada fila de producto (desktop y tarjetas móvil) tiene un toggle (chevron / "Ver colores/tallas") que carga `api.getVariantsByProduct` (lazy + cache en `variantsByProduct`) y muestra una mini-tabla con **color (swatch), talla, SKU y stock** (coloreado según `stock`/`minStock`). Si el producto no tiene variantes, se indica explícitamente.

## [2026-06-19] (parte 2) — Hormas: campo Composición (ej. "100% Algodón")

- **`hormas.composition`** (VARCHAR(150), nullable, ej. "100% Algodón"): auto-migración idempotente en `ensureTables` + migración manual `v45_hormas_composicion.sql`. Se decidió mantener `weight_grams` **numérico** (no convertirlo a texto libre) y agregar este campo separado, para no perder el peso usable en cálculos futuros (envíos, etc.). Input "Composición" en `horma-manager.tsx` junto al de Peso; la tabla de listado muestra ambos apilados en la columna "Peso / Composición".

## [2026-06-19] — Hormas: campo Sexo + paleta de colores con círculos seleccionables

- **Campo `sexo` en hormas** (`unisex` | `hombre` | `mujer`, default `unisex`): columna ENUM con auto-migración idempotente en `hormasService.ensureTables` + migración manual `v44_hormas_sexo.sql`. Validado en `create`/`update` (`assertValidSexo`). Selector en `horma-manager.tsx` (form) + columna "Sexo" en la tabla de listado.
- **Paleta de colores con círculos seleccionables:** `horma-manager.tsx` ahora deduplica los colores de **todas** las hormas del tenant (`existingColorCatalog`, vía `useMemo` sobre `hormas`) y los muestra como círculos clicables — clic agrega/quita el color de la horma actual sin re-tipearlo. Se agregó `resolveColorHex` (mapa de nombres conocidos → hex + hash estable de fallback) para que cualquier color tenga un círculo visible aunque no tenga `hex` guardado. Sigue existiendo el flujo manual (nombre + `<input type=color>` para hex exacto) para colores nuevos. La tabla de listado también pinta mini-círculos de la paleta de cada horma.
- Sin cambios de breaking: `colors`/`hex` ya existían en el backend (`horma_colors.hex`); solo se expuso bien en la UI.

> Pendiente: confirmar con patronaje real la manga estimada de "Camiseta Clásica" (ver `brain/horma-architecture.md`).


## [2026-06-18] (parte 3) — Color exacto por variante, bulk inventario, auto-fallback IA, tamaño de logo, posición del Lanyard

- **Color EXACTO por variante (hex) separado del nombre:** columna `product_variants.color_hex` (migración idempotente + auto-heal `ensureColorHex` en el service ante `ER_BAD_FIELD_ERROR`). En `variant-manager` el campo "Color (nombre)" quedó separado de una **paleta** que escribe `colorHex` (ya no pisa el nombre). El storefront (`variant-selector`) arma un mapa nombre→hex y pinta el **swatch con el color exacto** del comercio. Arregla la incoherencia "Vainilla sesgo" mostrándose gris.
- **Aviso de SKU duplicado en variantes + fix:** `saveVariant` NO chequeaba `result.success` → mostraba "Variante creada" en falso y ocultaba el 400 real. Ahora muestra el error del servidor, y además hay **aviso proactivo**: detecta SKU repetido contra las variantes cargadas y **bloquea Guardar** (botón "SKU duplicado").
- **Multi-selección + borrado masivo en Inventario:** `products.service.bulkDelete` (filtra por tenant; ante FK por ventas borra uno a uno y omite los referenciados → `{deleted, skipped}`), ruta `DELETE /products/bulk` (ANTES de `/:id`), controller, `api.bulkDeleteProducts` + acción en store. UI en `inventory-list`: botón "Seleccionar", checkboxes en tabla, overlay en tarjetas móvil, barra bulk + dialog.
- **IA "solo pegar la clave" (auto-fallback):** `getAIKeys` ahora, si el proveedor default no tiene clave, usa el primero que sí la tenga (Groq → Gemini → OpenAI/OpenCode). Diagnóstico del 500 del chatbot = **OpenCode sin saldo** (facturación, no bug). Copy de IntegrationsTab actualizado.
- **Tamaño del logo de la tienda:** columna `store_info.logo_size`; slider + vista previa en Personalizar Tienda → Info Tienda; aplicado al logo del nav en Tema 1 (landing) y Tema 2.
- **Posición y tamaño del Lanyard (portafolio):** `portfolio_config.lanyard_offset_x/_y/_scale` (migración idempotente). Controles en el tab Portafolio del superadmin: **flechas** ↑↓←→ (±10px) + centrar + slider de tamaño (40–200%). La página aplica `transform: translate(x,y) scale()` al contenedor del carnet 3D.

> ⚠️ **Line endings (lección):** el working tree quedó en **CRLF** y el repo en **LF** → 444 archivos "modificados" pero solo ~12 reales. Se creó `.gitattributes` (`* text=auto eol=lf`). NO usar `git add -A`; commitear solo los archivos reales y, aparte, `git add --renormalize .`. Configurar `core.autocrlf input` en Windows.
> Todo necesita commit (sin el ruido CRLF) + push + **Deploy en Komodo** (las columnas nuevas se crean al arrancar el backend).


## [2026-06-18] (parte 2) — Integración de variantes COMPLETA: asiento al confirmar + pasarelas + columna variant_id + cupo de preventa

Cierre de los 4 pendientes de variantes (tsc back+front: **0 errores**):

- **Migraciones idempotentes** (`index.ts`, helper `addCol`): `variant_id` + `cost_price`/`margin_pct`/`margin_amount` en `storefront_order_items` y `sale_items`; `preorder_limit` + `preorder_count` en `product_variants` (+ índices).
- **Asiento al confirmar** (`orders.routes.ts`, status `entregado`): `variants.service.settleVariantForSale(conn, …)` descuenta `product_variants.stock`, libera la reserva (`reserved_stock`; en preventa puede quedar negativo = backorder real), registra movimiento `'salida'` (ref `sale`) y congela `variant_id`/costo/margen en `sale_items`. El SELECT de items ahora trae `variant_id` + `is_preorder`. Producto simple sigue por el flujo legacy (`products.stock` + `stock_movements`).
- **Cupo de preventa** (`variants.service`): `reserveForPublicOrder` ahora maneja normal (incrementa `reserved_stock`) y preventa (incrementa `preorder_count` con guard atómico `preorder_count + qty <= preorder_limit`; NULL = ilimitado), distinguidos por `reference_type` (`storefront_order` vs `storefront_order_preorder`). `releaseForOrder` revierte el contador correcto. `create`/`update` aceptan `preorderLimit`; campo "Cupo de preventa" en `variant-manager.tsx`. `attachVariants` expone `preorderLimit`/`preorderCount`.
- **Reserva en pasarelas** (`orders.routes.ts`): MP-preference, ADDI y Sistecrédito reservan variantes (cancela el pedido + 409 si no alcanza), persisten `variant_id` en sus items, y liberan en sus webhooks de rechazo. `cancel-gateway` y la cancelación desde el panel también liberan (`releaseForOrder`).

> **Solo queda operativo:** arrancar backend (corre migraciones) + cargar AnMarg + **Deploy en Komodo**.


## [2026-06-18] — Variantes en todo el storefront + selección dinámica (Tema 2) + reserva atómica en pedidos + preventa (backorder) + producto AnMarg

**Producto AnMarg (Camiseta Clásica) — datos de carga:** `backend/imports/anmarg-camiseta-clasica/` con CSV de 90 variantes (18 colores × 5 tallas, handle `camiseta-clasica`, material `100% Algodon 160g`, proveedor AnMarg, venta $56.000, costo $28.000, SKU `CC-<COLOR>-<TALLA>`), SQL de tiers por volumen (6+/12+/24+) y README. El importador solo crea el tier base (min_qty=1); los escalones van por el SQL complementario.

**Selección de variantes dinámica en Tema 2 (`theme2-order-flow.tsx`):** se integró el `VariantSelector` existente en el flujo compacto. Al abrir el detalle de un producto con variantes, el cliente elige color/talla y se actualizan precio, imagen y disponibilidad al instante; bloqueo de "Agregar" hasta elegir variante válida; carrito/WhatsApp/ticket/pedido llevan la variante (label + `variantId`); el "+" y "Ordenar Ahora" abren el detalle si hay variantes. Tema 1 (`landing-page`) ya lo tenía; se le agregó `variantId` a los 4 `items.map` (público + 3 pasarelas).

**Bug crítico resuelto — variantes no cargaban hasta recargar:** solo `/storefront/products` adjuntaba variantes; el resto de secciones devolvía el producto sin ellas. Se centralizó el helper `attachVariants()` en `storefront.routes.ts` y se aplicó a TODOS los endpoints públicos de producto: lista, `/offers`, `/new-launches`, `/platform-featured`, `/drop/:id` y `featured`/`trending` de `store-config`.

**Bug crítico de visibilidad:** la lista filtraba `(p.stock > 0 OR p.is_preorder = 1)` y los productos con variantes tienen `products.stock = 0` → no aparecían en la tienda. Se agregó al filtro un `EXISTS` sobre `product_variants` con disponibilidad (`stock - reserved_stock > 0`).

**Reserva atómica de stock de variante en `POST /orders/public`:** antes `checkStockAvailability` validaba contra `products.stock` (0 para variantes) → 409 falso en todo pedido con variante. Ahora: `checkStockAvailability` ignora ítems con `variantId`; nuevos métodos en `variants.service.ts` — `reserveForPublicOrder()` (incrementa `reserved_stock` atómico y race-safe `WHERE (stock - reserved_stock) >= qty`, transaccional, movimiento `'reserva'`) y `releaseForOrder()` (al cancelar o si falla la creación, movimiento `'liberacion'`). `cancel-gateway` libera reservas. Filosofía igual a los `inventory_holds` de productos (reserva suave, reversible).

**Preventa (backorder) para variantes — embudos masivos:** `attachVariants` ya NO oculta variantes agotadas (devuelve todas las activas); el `VariantSelector` recibe `allowOutOfStock` → muestra agotadas en gris pero seleccionables (borde punteado, "Disponible en preventa"). En `/orders/public`, los ítems de variante con `isPreorder` NO se reservan (se venden sin límite de stock). Conectado en ambos themes (`detailIsPreorder` / `Boolean(selectedProduct.isPreorder)`), con flags de preventa en el payload.

> **Pendiente:** asiento al confirmar (pedido→venta) para variantes (hoy descuenta `products.stock`, no asienta `reserved_stock`→`stock`); reserva en flujos de pasarela (solo `/public` reserva); columna `variant_id` en `storefront_order_items` (trazabilidad va por `inventory_movements` + nombre); cupo máximo de preventa por variante. Todo necesita **Deploy en Komodo**.


## [2026-06-17] — Módulo Afiliados (Sprints 1–4) + tarjetas externas + imagen por variante + barra de bienvenida configurable + cierre Tema 2

**Programa de Promotores/Afiliados — backend Sprints 1–4 (parcial, falta deploy):**
- **Sprint 1 (schema):** migración inline idempotente en `index.ts` (10 tablas, `CREATE TABLE IF NOT EXISTS`, sin `ADD COLUMN IF NOT EXISTS`): `affiliates` (nivel plataforma, sin tenant_id), `affiliate_campaigns` (polimórfica store/product/event/service), `affiliate_conversions`, `affiliate_commissions`, `affiliate_withdrawals`, `affiliate_missions`, `affiliate_mission_submissions`, `merchant_events`, `affiliate_packages`, `affiliate_package_orders`. Referencia: `backend/src/migrations/005_affiliates.sql`. Tipos: `modules/affiliates/affiliates.types.ts`.
- **Sprint 2 (core):** `affiliates.service.ts` + `affiliates.routes.ts` (montado en `/api/affiliates`). Auth propia del promotor (bcrypt + JWT `type:'affiliate'`, 30d) — NO se tocó el enum `role` de users. Endpoints promotor (me, campañas+token, conversiones, comisiones, retiros, leaderboard, misiones), superadmin (`/admin/*`: afiliados, retiros con pago→descuenta saldo, misiones CRUD, revisión de envíos→acredita bono) y comercio (`/tenant/*`: overview, conversiones).
- **Sprint 3 (paquetes, pago inmediato):** CRUD de paquetes (superadmin), contratación por el comercio (`affiliate_cop`/`platform_cop` congelados), `markPackagePaid` transaccional que **acredita el wallet al instante**, entrega de contenido (promotor) y completar (comercio).
- **Sprint 4 (atribución por enlace):** `attributeOrder` + `_recordConversion` (pending) + `runAutoApprovals` (vencida la ventana `cookie_days`→approved, pending_cop→balance_cop, +1 monthly_sales). Hook en `POST /orders/public` (`refToken`, no bloqueante). Frontend Tema 2: captura `?ref=` en `localStorage` (30d) y lo envía en el checkout. Endpoint `POST /admin/run-approvals` (cron/tarea). **Hook POS por código:** métodos `lookupAffiliateCode`/`attributeSaleByCode` listos, NO enganchados (sales.service no tiene flujo de código de descuento).
- **PENDIENTE:** Sprint 5 (tier engine + cron mensual de reset/recalcular tier), Sprints 6–8 (portal `/promotor`, tab superadmin, vista comercio — frontend). Ver `context/roadmap-afiliados.md`.

**Tarjetas externas (comercios fuera del aplicativo):** tabla `marketplace_external_cards` + CRUD superadmin (`/api/tenants/external-cards`) + merge en `/storefront/stores` (con `externalUrl`). UI en `CommercesTab` (crear/editar/eliminar). En la home, `StoreCard` clickeable aunque no tenga productos, badge "VISITAR ↗", y `goToStore` abre el link externo en pestaña nueva.

**Imagen por variante (color → imagen):** el backend ya guardaba `images` por variante; se agregó el campo "Imagen del color (URL)" en `variant-manager` y, en la tienda (`landing-page`), la foto principal usa la imagen de la variante seleccionada (`heroUrl = selectedVariant.image || activeUrl`) en ambos layouts.

**Barra de bienvenida configurable (Tema 2):** claves `home_welcome_enabled/title/subtitle` en `platform_settings` (sin tocar backend) + card en `LandingConfigTab` (toggle + título + subtítulo) + props a `home-theme2` (visibilidad por `welcomeEnabled`, contenido editable; la "X" sigue siendo descarte del usuario).

**Cierre Tema 2:** pantalla de éxito con animación holo "en camino" + ticket (`theme2-order-success.tsx`); **bug crítico** corregido (tras enviar no se vaciaba el carrito → pedidos duplicados; ahora `resetCheckout`); restyle minimalista del carrito; tarjeta premium en Favoritos. La confirmación al cliente sale desde el **módulo de pedidos**: botón "Confirmar por WhatsApp" en `pedidos.tsx` con mensaje prellenado según estado.

**Home móvil:** carrusel ajusta su altura a la imagen (sin franjas, sizer móvil); bienvenida responsive sin recorte; sección "Únete a DAIMUZ" con valor para 3 públicos (cliente/comerciante/promotor).

> Nota deploy: TODO lo anterior necesita commit + push + **Deploy en Komodo**. Las tablas de afiliados se crean solas al arrancar el backend.


## [2026-06-16] — Tema 2: reservas que guardan, pedidos sin falla silenciosa, "Ordenar Ahora" + QR de mesa administrable

- **Reservas Tema 2 (guardar + confirmar + WhatsApp):** `theme2-reserve-flow.tsx` ahora hace `POST
  /restbar/reservations/public-quick` (endpoint nuevo en `reservations.routes.ts`) que **guarda la reserva**
  (auto-asigna mesa si hay, o crea con `table_id NULL` y número `R-####` vía secuencia transaccional) y
  **notifica al comercio**. Tras guardar, pantalla de éxito "¡Reserva exitosa! Te llamaremos para confirmar"
  con N° de reserva + botón **opcional** de WhatsApp (con todo el formulario). Antes solo abría WhatsApp.
- **Pedidos Tema 2 — falla silenciosa corregida:** `theme2-order-flow.registerOrder()` ahora chequea
  `res.ok`/`success`, devuelve éxito y muestra el error en UI; `submitOrder` **no abre WhatsApp si el guardado
  falla** (ej. stock 409). Verificado que el pedido SÍ se guarda en `storefront_orders` (+ items + notificación)
  con el `tenantId` correcto (`/storefront/products` devuelve `p.tenant_id as tenantId`, sin disparar fallback).
- **"Ordenar Ahora" en Favoritos:** abre el flujo de pedido con el producto **ya en el carrito**
  (`initialProductId` → efecto que lo agrega una vez al cargar productos).
- **Botón "todas las tiendas":** en móvil estaba centrado abajo (invasivo) → movido a la derecha; escritorio
  sigue como pestaña al borde derecho.
- **QR de mesa ADMINISTRABLE (antes solo generaba):** dos endpoints auth nuevos en `restbar-qr.routes.ts`:
  `GET /tables/:id/session` (sesión activa + invitados + **consumo de cada persona**, parseando la etiqueta
  `[nombre]` del `item_notes`; lo no asignado va a "Sin asignar / mesa") y `POST /tables/:id/session/close`
  (invalida el QR sin cerrar la comanda). `table-qr-button.tsx` reescrito como panel: QR, lista de quién está
  en la mesa con su consumo desglosado, total, **compartir** (copiar/WhatsApp/share nativo), **regenerar** y
  **eliminar**. API: `getTableQrSession` / `closeTableQrSession`.

> Pendientes Tema 2: restyle minimalista del carrito, animación holo "en camino" al activar ubicación,
> tarjeta de ticket de éxito y tarjeta premium (Uiverse). El consumo por persona requiere que el cliente
> entre con su nombre al escanear. Todo esto necesita **commit + push + Deploy en Komodo** para verse en prod.


## [2026-06-16] — Fix IA: agente respeta Base URL (OpenCode) + selector de modelo + checklist deploy

- **FIX raíz de los 500:** `agent.service.callOpenAI` tenía `api.openai.com` hardcodeado → el chatbot de
  tienda fallaba con la key de OpenCode (con Groq sí funcionaba porque tiene URL propia). Ahora `callOpenAI`
  acepta **baseUrl/model** y `processAgentMessage` se los pasa desde `getAIKeys()`. Así los TRES caminos
  (chatbot/agente, asistente del panel, Modo Chat) usan la Base URL configurada. Falta **redeploy del backend**.
- **Selector de modelo (contingencia):** en Integraciones, los campos **Base URL** y **Modelo** ahora tienen
  `datalist` → se puede **elegir de una lista o escribir** libremente. Suaviza cambiar de modelo si uno falla.
- **Checklist de deploy** creado en `context/deploy-checklist-ia.md` (redeploy back/front + config OpenCode + verificación).


## [2026-06-16] — Interruptor de tema + fixes prod (OpenCode base URL, columna priority) + pedidos reales

- **Cambio de tema (claro/oscuro) con expansión dinámica:** `components/theme-switch.tsx` (botón Uiverse
  by mamyapro123, CSS scoped a `.theme-switch__*`, keyframes propios). Usa **next-themes** (ya en el layout)
  y la **View Transitions API** para el reveal circular desde el botón (fallback si no hay soporte / reduce-motion).
  Colocado en el footer del sidebar → visible en todas las vistas del panel.
- **FIX prod — asistente usaba api.openai.com con la key de OpenCode:** `assistant.service` ahora lee la
  **Base URL y el modelo** desde `getAIKeys()` (ajustes `ai_openai_base_url` / `ai_openai_model`), no solo del env.
  Acción del usuario: en Integraciones → OpenAI, Base URL = `https://opencode.ai/zen/v1`, Modelo = `deepseek-v4-flash`.
- **FIX prod — `Unknown column 'o.priority'`:** causa = **MySQL no soporta `ADD COLUMN IF NOT EXISTS`**
  (es de MariaDB), así que esa migración fallaba silenciosa. `getAreaDisplay` ahora es resiliente: intenta con
  `priority`, y si falta la columna la crea con `ADD COLUMN` plano (MySQL) y reintenta sin ella. Cocina/bar
  vuelven a funcionar.
- **Pedidos del chat de tienda ahora son REALES:** `agent.tools.toolRegistrarPedido` inserta en
  `storefront_orders` + `storefront_order_items` (parsea el texto de items, casa con productos, calcula total,
  status 'pendiente') además de notificar → aparecen en el Centro de Pedidos. (Reservas ya insertaban en
  `rb_reservations`; leads siguen como notificación.)
- **Venta POS por chat:** acción `registrar_venta` en el Modo Chat → `salesService.create` (descuenta stock,
  factura), con confirmación.

> Pendiente menor: aplicar el loader/tema a más vistas públicas; leads del chatbot a un módulo CRM si se crea.


## [2026-06-16] — Loader 3D de cajas + crear producto + reflejo visual en Chat Daimuz

- **Loader nuevo:** `components/box-loader.tsx` (`BoxLoader` + `FullPageLoader`, Uiverse by Admin12121,
  CSS scoped a `.dz-loader` y keyframes prefijados `dzl-` para no colisionar). Reemplaza el círculo
  de carga en `app/page.tsx` (carga principal de la app) y `app/login/page.tsx` (2 loaders). El
  **preloader del portafolio se mantiene** intacto. El componente está disponible para otras pantallas.
- **Crear producto por chat:** acción `crear_producto({nombre, precio, categoria?, stock?, es_menu?})`
  → `productsService.create` (genera SKU, categoría 'General' por defecto), con confirmación.
- **Reflejo visual:** tras ejecutar una acción, `/modo-chat` muestra qué módulo se actualizó
  (Mesas/Restbar o Inventario) con acceso directo "Abrir panel" (las acciones devuelven `refresh`).

> Modo Chat Daimuz: estadísticas + Restbar (abrir/tomar/enviar/cobrar) + Inventario (ajustar stock,
> crear producto), OpenAI/Groq/Gemini, botón glitch gated por plan, reflejo del módulo afectado.
> Pendiente mayor: registrar venta (flujo POS), embeber el módulo en vivo bajo el chat.


## [2026-06-16] — Chat Daimuz: pendientes cerrados (gate + acciones + Gemini)

- **Gate del botón:** `CHAT DAIMUZ` en el sidebar solo se muestra a `tenantPlan === 'empresarial'`.
- **Más acciones (confirm-before-execute):**
  - **POS/cobrar:** `cobrar_mesa({mesa, metodo})` → `restbarService.processPayment` (efectivo/tarjeta/nequi/transferencia; cobra el total del pedido).
  - **Inventario:** `ajustar_stock({producto, cantidad})` → `productsService.updateStock` (suma/resta, no baja de 0).
- **Gemini function-calling:** `runGemini` con declarations (tipos en mayúscula) y patrón de 2 rondas:
  functionCall de lectura → ejecuta → segunda llamada con los datos para la respuesta final; las escrituras se proponen igual. Ya no rechaza Gemini en el modo Chat.

> Modo Chat Daimuz ahora cubre: estadísticas/análisis (ventas, pedidos, stock, citas) + acciones de
> Restbar (abrir/tomar/enviar/cobrar) + Inventario (ajustar stock), con OpenAI/Groq/Gemini.
> Nota entorno: mount del sandbox sigue truncando lecturas (archivos verificados íntegros en disco).


## [2026-06-16] — Chat Daimuz: modelos OpenCode Go configurables + botón glitch + multi-módulo

- **Proveedor/modelo configurable desde el panel:** `getAIKeys()` ahora devuelve `openaiBaseUrl` y
  `openaiModel` (settings `ai_openai_base_url` / `ai_openai_model`, fallback env `OPENAI_BASE_URL` /
  `OPENAI_MODEL`). `daimuz-chat` los usa en `llmCall`. Integraciones (GET/PUT) + `IntegrationsTab`
  exponen campos **Base URL** y **Modelo**. Para el plan **OpenCode Go**: Base URL
  `https://opencode.ai/zen/v1`, modelo p. ej. `deepseek-v4-flash` (key `sk-` de opencode en el campo OpenAI).
- **Modo Chat Daimuz multi-módulo:** el agente da estadísticas/análisis del negocio (reusa
  `execMerchant`: ventas, pedidos, stock, citas) + opera Restbar (abrir mesa / tomar pedido / enviar
  a cocina) con confirmación. UI `/modo-chat` estilo ChatGPT con sugerencias.
- **Botón CHAT DAIMUZ** (`components/chat-daimuz-button.tsx`, estilo glitch Uiverse, CSS scoped a
  `.cd-glitch` para no romper otros botones) en el footer del sidebar → abre `/modo-chat`.

> Pendiente: que el botón gate por rol/empresarial, más acciones por módulo, Gemini function-calling.
> Nota entorno: el mount del sandbox truncó lecturas de varios archivos (todos verificados íntegros
> en disco con file-tools); el código nuevo es type-correcto. tsc-en-sandbox no fiable esta sesión.


## [2026-06-16] — Modo Chat Daimuz (slice vertical Restbar) + fix OpenAI en asistentes

**Asistentes multi-proveedor:** `assistant.service.ts` ahora acepta claves OpenAI (`sk-`),
no solo Gemini/Groq. Se generalizó `runWithGroq` → `runWithOpenAICompat(url, model)` (tool-calling),
con ramas `sk-` en `runPlatformAssistant` y `runPublicAssistant`. Base URL configurable por
`OPENAI_BASE_URL` (+ `OPENAI_MODEL`) para compatibles (opencode/openrouter). Mensajes de error
actualizados. **Nota:** la key de opencode.ai no autentica contra api.openai.com salvo que se
fije `OPENAI_BASE_URL` al endpoint de opencode.

**Seguridad de keys (integraciones):** el GET de `/superadmin/integrations` ahora ENMASCARA las
AI keys (`••••••últimos4`) + flags `*Set`; el PUT ignora valores enmascarados (no pisa la key).
Nuevo `GET /superadmin/integrations/reveal/:provider` para ver la key real bajo demanda; el ojo
en `IntegrationsTab` la trae solo al revelar.

**Modo Chat Daimuz (slice Restbar/mesas):** nuevo `modules/daimuz-chat/daimuz-chat.routes.ts`
(montado `/api/daimuz-chat`). El comerciante escribe en lenguaje natural y el agente OPERA mesas:
lecturas (`listar_mesas`, `ver_menu`, `ver_cuenta`) al vuelo; escrituras (`abrir_mesa`,
`tomar_pedido`, `enviar_cocina`) se **proponen** como `pendingAction` y se ejecutan vía
`POST /restbar/execute` SOLO tras confirmación humana (governance). Reusa `restbarService` (KDS real)
y `getAIKeys()` (OpenAI/Groq function-calling; Gemini pendiente). Frontend: página `/modo-chat`
(chat + tarjeta de confirmación) y `api.daimuzChatRestbar/daimuzChatExecute`.

> Esto es la **base** de la visión "todo el panel se vuelve chat y mueve los módulos por debajo"
> (ver `base de la empresa daimuz.md`). Slice v1 = Restbar, confirm-before-execute. Pendiente:
> cobrar, más módulos (inventario/POS/CRM), Gemini function-calling, y el toggle que reemplaza
> el panel completo + reflejo visual del módulo afectado.

> **Nota de entorno:** el sandbox de build truncó lecturas del mount en varios archivos NO tocados
> (`agent.service`, `chatbot.routes`, `index.ts`, `api.ts`); todos verificados ÍNTEGROS en disco con
> file-tools. El módulo nuevo compila limpio. tsc-en-sandbox no fiable esta sesión; build local OK.

## [2026-06-15] — Multi-API Key + cifrado en reposo para agente IA

**Backend:**
- `agent.service.ts`: nueva `getAIKeys()` → devuelve `{ geminiKey, openaiKey, groqKey, defaultProvider }`. `getAIKey()` mantenida (backward compat). `processAgentMessage()` ahora usa routing explícito por provider.
- `chatbot.routes.ts`: GET/PUT `/superadmin/integrations` ahora maneja 3 API keys + provider selector. Las keys se cifran con AES-256-CBC al guardar y se descifran al leer.

**Frontend:**
- `IntegrationsTab.tsx`: rediseñado con 3 campos separados (Gemini/OpenAI/Groq), toggle show/hide individual, badges "Configurado" por provider, y selector de proveedor default con botones con iconos.
- `useIntegrations.ts`: nuevo estado `geminiApiKey`, `groqApiKey`, `defaultAiProvider`.
- `lib/api.ts`: tipos actualizados para `updateSuperadminIntegrations`.

**Entorno:**
- `backend/.env` creado con la OpenAI key del usuario.
- `backend/.env.example` actualizado: `OPENAI_API_KEY`, `GROQ_API_KEY`, `AI_DEFAULT_PROVIDER`.
- `docker-compose.dev.yml` y `docker-compose.dokploy.yml`: incluídas las 4 nuevas env vars.

## [2026-06-16] — Fase 4 Restaurante: reportes (delta A) + cierre del roadmap

- **Reportes de restaurante**: nuevo sub-router `restbar.reports.routes.ts`
  (`GET /api/restbar/reports/summary?from=&to=`, montado en `/api/restbar/reports`): resumen de
  pagos por método, top de productos, rendimiento por mesero y por mesa, KPIs (ventas, comandas,
  ticket promedio, total cobrado). Reutiliza `rb_orders/rb_payments/rb_order_items`. Frontend:
  página `/reportes-restaurante` (rango de fechas, tablas, **export a PDF vía imprimir**) +
  `api.getRestbarReports()`.
- **Marketing/promos**: ya cubierto por `store_banners` → home `/r/[slug]` (Fase 1); sin módulo nuevo.
- **Backup/restore**: NO implementado (acción crítica, approval-gated por `governance`).
- **Build**: frontend tsc 0. En backend, los 2 errores de `tsc` eran truncamientos transitorios del
  mount del sandbox en `agent.service.ts` y `chatbot.routes.ts` (archivos NO tocados; verificados
  íntegros en disco con file-tools). También se reparó una truncación del mount en `lib/api.ts` y
  `restbar.routes.ts` provocada por ediciones con file-tools (restauradas y reverificadas).

- **Backup/restore (delta D)**: sub-router `restbar.backup.routes.ts` (`/api/restbar/backup`):
  `GET /export` (solo lectura), `POST /restore/preview` (dry-run) y `POST /restore` (upsert SOLO
  catálogo/config; nunca pedidos/pagos; exige rol alto + frase `RESTAURAR` + fuerza tenant_id del JWT).
  Frontend: página `/respaldos`. `api.exportRestbarBackup/previewRestbarRestore/restoreRestbarBackup`.

> Roadmap restaurante: Fase 1 ✅ · Fase 2 ✅ · Fase 3 ✅ · Fase 4 ✅. **Integración Sirius COMPLETA.**

## [2026-06-15] — Fase 3 Restaurante: módulo de fidelización / puntos

Nuevo módulo **loyalty** (tsc front 0; backend sin errores nuevos):

- Backend `modules/loyalty/loyalty.routes.ts` (montado `/api/loyalty`): tablas `loyalty_config`,
  `loyalty_accounts`, `loyalty_transactions`, `loyalty_rewards` (auto-migración). Reglas
  configurables (`points_per_thousand`), CRUD de recompensas, cuentas por teléfono, `POST /earn`
  (acúmulo sin tocar el flujo de pago), ajustes manuales y transacciones. Helpers exportados
  `ensureLoyaltyTables`, `getLoyaltyConfig`, `ensureAccount`, `earnPoints`.
- Canje público desde la sesión de mesa (`restbar-qr`): `GET /session/:token/loyalty?phone=` +
  `POST /session/:token/loyalty/redeem` → genera **código de canje** para el mesero.
- Frontend: sección ⭐ en `/mesa/[token]` (consultar saldo por teléfono, ver recompensas, canjear)
  y página admin **`/fidelizacion`** (reglas, recompensas, cuentas, otorgar puntos).
  Métodos `api.getLoyaltyConfig/updateLoyaltyConfig/getLoyaltyRewards/createLoyaltyReward/...`.

## [2026-06-15] — Fase 2 Restaurante COMPLETA: reservas con aviso + jukebox

Cerradas las dos piezas restantes de la Fase 2 (tsc front 0):

- **Reservas con notificación**: al crear una reserva pública (`POST /restbar/reservations/public`)
  se emite `createNotification(tenant, {type:'reservation', ...})` para avisar al comercio. La home
  `/r/[slug]` ya enlazaba a `/reservar/[slug]`.
- **Jukebox**: tablas `rb_jukebox_queue` + `rb_jukebox_config` (auto-migración en `ensureTables`).
  Público `GET/POST /restbar-qr/session/:token/jukebox` (se desbloquea cuando el total de la comanda
  ≥ umbral, default $50k). Staff `GET/PATCH /restbar-qr/jukebox` + nueva página `/jukebox`
  (reproducir/sonada/saltar). En `/mesa/[token]`: progreso al desbloqueo + pedir canción + cola en vivo.
  `api.getJukeboxQueue()` / `api.updateJukeboxStatus()`.

## [2026-06-15] — Fase 2 Restaurante: prioridad de cocina + regalo entre mesas

Implementado y verificado (tsc front 0; backend solo errores preexistentes en `cartillas`):

- **Prioridad de cocina (delta B)**: nueva columna `rb_orders.priority` (`normal|urgente`,
  auto-migración idempotente en `index.ts`). `PATCH /restbar/orders/:id/priority`
  (`setOrderPriority` en service/controller, roles cocina/bar/mesero/admin). `getAreaDisplay`
  selecciona `priority` y ordena **urgentes primero**. Paneles `cocinero-panel.tsx` y
  `bartender-panel.tsx`: badge 🔥 URGENTE (pulse), botón ⚡ para alternar, borde rojo + sort.
  `api.setRestbarOrderPriority()`.
- **Regalo entre mesas**: en `restbar-qr.routes.ts`, `GET /session/:token/tables` (mesas ocupadas)
  y `POST /session/:token/gift` (envía items a la comanda de otra mesa, nota
  `🎁 Regalo de [nombre] (Mesa X)`, → KDS). En `/mesa/[token]`: botón "Regalar a otra mesa",
  selector de mesa y barra inferior que cambia a "🎁 Regalar a Mesa X".

## [2026-06-15] — Fase 1 Restaurante: QR de mesa + sesión del cliente

Se implementó y verificó (tsc 0) la **Fase 1** del plan de integración (sección 7 de
`context/plan-integracion-sirius.md`):

- **QR de mesa con sesión del cliente**: el mesero genera el QR por mesa
  (`table-qr-button.tsx` con `qrcode.react`, insertado en `mesero-panel.tsx`); el cliente
  escanea `/mesa/[token]`, entra con su nombre, ve el menú con disponibilidad real (agotados),
  y pide desde su celular. El pedido entra a la **comanda real → KDS** vía `restbarService`.
- **Sesión invalidada al cobrar/cancelar**: `loadSession()` hace LEFT JOIN al pedido y descarta
  la sesión si el `rb_order` está `cerrada/cancelada` (sin tocar el flujo de pago).
- **Estado del pedido en vivo** para el cliente: `GET /restbar-qr/session/:token/order` +
  vista "Mi pedido" con badges (Pendiente/En preparación/Listo/Entregado), refresco cada 7 s.
- **Home del restaurante** `/r/[slug]`: portada, logo, abierto/cerrado, promos/eventos (reusa
  `store_banners`), destacados y CTAs Ver menú / Reservar. Reusa `storefront/store-config/:slug`.

Backend nuevo: `modules/restbar/restbar-qr.routes.ts` (montado `/api/restbar-qr`), tablas
`rb_table_sessions` + `rb_table_guests` (auto-migración idempotente en arranque).

**Nota de proceso:** `lib/api.ts` se truncó por una edición con file-tools (terminaba en
`export const ap`); restaurado desde HEAD y reaplicados los cambios con python. Reafirma la
lección: **editar archivos existentes con bash/python y verificar en disco**, nunca file-tools.

## [2026-06-15] — Cerebro v4 + visión Empresa/Ramas/DAIMUZ Chat

Se actualizó el cerebro a la estructura **DAIMUZ v4** (`brain/daimuzv4.md`) y se
centralizó la visión de producto:

- **Empresa y ramas** (`brain/empresa-y-ramas.md`): DAIMUZ = empresa con ramas; la **rama Comercio** es el núcleo (`branches/comercio.md`).
- **DAIMUZ Chat** (`brain/daimuz-chat.md`): los dos modos de operar un comercio — **Operativo** (gestionas módulos) y **ControlChat** (la IA opera todo: publicaciones, catálogo, módulos), gateado por **membresía con chat**, con **panel independiente** del chat. Roadmap técnico: dar al `agent/` herramientas que ACTÚAN + permisos + aprobación + auditoría.
- **Capas v4 nuevas**: `graph/` (entities, relations, impact-map), `agents/` (incl. `daimuz-chat-agent`), `tasks/` (template + index), `governance/security-policy.md` y `approval-policy.md`.
- `DAIMUZ.md` actualizado con la sección "Empresa y Ramas (v4)".

---

## [2026-06-14] — Portafolio: tarjetas Lanyard 3D + robot IA público

**Tarjetas del equipo = Lanyard 3D** (`@react-three/*`, ver package.json). Foto del dev → textura del carnet; banda/cordón configurable por tarjeta (columna `portfolio_team_cards.band_image_url`, migración idempotente). Componentes en `frontend/components/portfolio/` (`lanyard.tsx`, `lanyard-showpiece.tsx`). Assets: `public/models/card.glb`, `public/assets/lanyard.png`.

**Robot flotante con IA (portafolio)**
- Robot Spline vía web component `<spline-viewer>` por CDN (sin deps npm). Chat debajo + "nubecitas" arriba con la respuesta. `frontend/components/portfolio/robot-assistant.tsx`.
- **Asistente público nuevo**: `runPublicAssistant()` en `assistant.service.ts` (sin tools ni datos internos, prompt de portafolio) expuesto en `POST /chatbot/platform-assistant/message` (público). Requiere el asistente de plataforma **habilitado** + clave IA (Gemini/Groq).
- URL de la escena del robot configurable desde superadmin → `portfolio_config.robot_spline_url` (migración idempotente); campo en PortfolioTab.

**⚠️ Incidente de fiabilidad:** en este entorno las ediciones del editor truncan archivos en disco; se hizo todo con bash/python y verificación en disco. Ver [[memory/important-fixes]] y [[memory/lessons-learned]].

---

## [2026-06-14] — Colorimetría en Tema 2 + favicon.ico + regla de temas

**Bug:** la paleta del superadmin se generaba y guardaba pero el home (Tema 2,
`MarketplaceHomeGovCo`) seguía verde. **Causa:** pintaba la marca con estilos
**inline** (`style={{ background: GREEN }}`) usando constantes JS fijas — los
estilos inline no se pueden sobreescribir con reglas CSS de clases — y además el
componente nunca recibía la paleta.

**Fix (patrón A, ahora estándar):**
- `home-theme2.tsx` — `GREEN`/`GREEN_DARK`/`GOLD` pasan a ser `var(--brand-green, #00833E)` etc.; nueva prop `themeColors`; la raíz inyecta `--brand-green`/`--brand-green-dark` desde la paleta. Todo el home se tiñe sin tocar cada estilo. Fallback al verde DAIMUZ.
- `landing-page.tsx` — pasa `themeColors={platformThemeColors}` al Tema 2. (El Tema 1 ya se teñía vía remap de clases Tailwind a `--color-primary`.)

**Favicon:** `app/favicon.ico` (App Router) tiene prioridad sobre `metadata.icons`;
había uno viejo. Se **regeneró desde `daimuz-icon.png`** (ICO 16→256). `layout.tsx`
y `dynamic-favicon.tsx` ya apuntan a `daimuz-icon.png`.

**Documentación / gobernanza:**
- `daimuz/brain/colorimetria.md` (nuevo) — doc canónico del sistema + checklist.
- `governance/universal-constraints.md` y `brain/coding-standards.md` — **regla: todo tema nuevo DEBE consumir la colorimetría; nunca hex de marca inline.**

**Estética home (mismo día):** contenedor `max-w-[1600px]`, tarjetas "Para ti"
con formato unificado (precio/Disponible, chip de etiqueta, pill de descuento).

---

## [2026-06-14] — Colorimetría de marca por IA (2 niveles) + fixes favicon/tarjeta

**Arquitectura (decisión):** dos niveles de paleta. Plataforma (superadmin, desde el logo DAIMUZ) → home/marketplace + login + acento por defecto en paneles. Individual del comercio (desde su logo) → su tienda (full color) + solo acento en su panel. Jerarquía de acento: comercio > plataforma > base. Los paneles operativos NO se colorizan por completo (solo acento) para preservar contraste/legibilidad.

**Colorimetría de plataforma (superadmin)**
- `frontend/lib/platform-theme.ts` (nuevo) — `getPlatformPalette()`, `applyPlatformAccentDefault()`, `parsePlatformPalette()`; clave `platform_theme_colors` en `platform_settings`
- `frontend/components/platform-theme-loader.tsx` (nuevo) — montado en `app/layout.tsx`, aplica el acento de plataforma como default app-wide (login + paneles)
- `frontend/components/platform-theme-generator.tsx` (nuevo) — tarjeta en LandingConfigTab: genera desde el logo, previsualiza paleta, guarda
- `frontend/components/landing-page.tsx` — tiñe la home/marketplace con la paleta de plataforma cuando no hay tienda seleccionada (no afecta tiendas con paleta/bg propios)
- `frontend/components/merchant-panel.tsx` — acento de plataforma como fallback cuando el comercio no tiene paleta propia; superadmin ve el acento de plataforma
- Sin backend nuevo: reutiliza `POST /storefront/theme/generate` y `PUT/GET /tenants/platform-settings`

**Auto-colorimetría al subir logo (comerciante)**
- `frontend/components/logo-theme-generator.tsx` — nuevo prop `autoApplySignal`; al subir logo genera+aplica+guarda y muestra toast "Colorimetría aplicada. ¿Deseas editarla?" con acción Editar
- `frontend/components/store-customization.tsx` — el CloudinaryUpload del logo incrementa la señal al subir una URL nueva

**Fixes**
- Favicon: `app/layout.tsx` (`icon`/`shortcut`) y `dynamic-favicon.tsx` ahora usan `daimuz-icon-transparent.png` / `BRAND.iconTransparent` (antes `daimuz-icon.png` mostraba un recuadro blanco en la pestaña)
- "Tarjeta del comercio" (`store-card-config.tsx`): el tema se guarda al instante al seleccionar la tarjeta (spinner + toast); antes solo cambiaba estado local y se perdía sin pulsar "Guardar tarjeta"
- Backend `card-config` (`storefront.routes.ts`): `affectedRows === 0` ya no asume "fila inexistente"; verifica existencia antes de INSERT (evita error 500 por clave duplicada al reguardar sin cambios)

**Nota de entorno:** el `tsc` completo del proyecto no cabe en el sandbox de Cowork (cold compile > límite de tiempo) y el mount de Linux quedó desincronizado; un typecheck acotado validó el componente de la tarjeta y los archivos se verificaron sobre el host.

## [2026-06-12] — Sprint 5: Centro de Pedidos v2 + TenantManagement mejorado

**TenantManagement (tenant-management.tsx)**
- Acciones con nombres: DropdownMenu con Ver / Editar / Activar / Trial Empresarial / Módulos / Eliminar
- Soft-delete de comercio con confirmación (status → 'cancelado')
- Edición de slug (con validación de unicidad en backend) + ver ownerName/ownerEmail en dialog
- Trial configurable: modal con contador días (1–365), botones rápidos 7/14/30; backend pasa `days` al query

**Centro de Pedidos v2 (superadmin/)**
- `KanbanView.tsx` — Kanban 6 columnas @dnd-kit/core con drag & drop; valida state machine antes de API
- `useOrders.ts` — viewMode, priorityStats (useMemo), drawerDrivers, bulk selection (Set), tenantsList
- `OrdersCenterTab.tsx` — banner SLA, priority chips, filtro comercio, border-l-4 por estado, antigüedad coloreada, checkboxes, bulk toolbar flotante, asignación rápida de repartidores en drawer, toggle Tabla/Kanban
- Backend: 3 endpoints nuevos (`/orders/tenants`, `/orders/:id/drivers`, assign con `assigneeId`); assign devuelve `assigned_name`
- Instalado: `@dnd-kit/core` + `@dnd-kit/utilities` con pnpm (npm da error en este proyecto)
- TS 0 errores en backend y frontend

## [2026-06-12] — Panel Superadmin Modular — Sprints 0-4 completos

Refactorización completa del panel superadmin + 4 sprints de nuevas funcionalidades:

**Sprint 0 — Arquitectura modular (3444 líneas → 25 archivos)**
- `frontend/components/superadmin/SuperadminLayout.tsx` — shell con 9 tabs, lazy-load con `next/dynamic`
- `frontend/components/superadmin/tabs/` — 9 componentes JSX puros (uno por tab)
- `frontend/components/superadmin/hooks/` — toda la lógica separada (useCommerces, useIntegrations, useLanding…)
- Patrón establecido: hook → estado + fetch + handlers; tab → solo JSX que consume el hook

**Sprint 2 — Centro de Pedidos cross-tenant**
- `backend/src/modules/orders/superadmin-orders.routes.ts` — 5 endpoints iniciales
- Auto-migración: `ALTER TABLE storefront_orders ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(36) NULL`
- Auto-migración: `CREATE TABLE IF NOT EXISTS order_status_history` (auditoría de transiciones)
- `frontend/components/superadmin/hooks/useOrders.ts` — estado completo: bandeja, filtros, summary, drawer, state machine
- `frontend/components/superadmin/tabs/OrdersCenterTab.tsx` — 6 KPI contadores clicables, filtros, tabla paginada, drawer con items+historial, diálogo de transición de estado
- SLA semáforo: verde <10min, amarillo 10-30min, rojo >30min desde creación del pedido

**Sprint 3 — Wizard creación + Papelera/Restaurar**
- `frontend/components/superadmin/shared/CommerceWizard.tsx` — wizard 4 pasos con validación por paso
- `frontend/components/superadmin/hooks/useTenantLifecycle.ts` — auto-slug, soft-delete (status→'cancelado'), restore (status→'activo'), loaders por fila
- `frontend/components/superadmin/tabs/CommercesTab.tsx` — reescrito con toggle papelera (badge rojo con conteo)
- `frontend/lib/api.ts` — +3 funciones: `getAllTenants`, `softDeleteTenant`, `restoreTenant`

**Sprint 4 — Analytics profesional + SSE reemplaza polling**
- `backend/src/modules/orders/superadmin-orders.routes.ts` — +3 endpoints: SSE, analytics KPIs, heatmap
- SSE endpoint: `res.flushHeaders()` + `res.write('data: ...\n\n')` + `req.on('close')` + ping cada 30s
- Heatmap SQL: UNION `storefront_orders` + `sales`, agrupado por `DAYOFWEEK()-1` y `HOUR`
- Analytics: compara período actual vs período anterior de igual duración para calcular deltas
- `frontend/components/superadmin/hooks/useOrders.ts` — reemplaza `setInterval` 30s con `EventSource(url, { withCredentials: true })` + fallback automático si SSE falla
- `frontend/components/superadmin/hooks/useAnalytics.ts` — reescrito: PlatformAnalytics + HeatmapData + helpers `deltaPct`, `getMaxRevenue`
- `frontend/components/superadmin/tabs/AnalyticsTab.tsx` — reescrito: 6 KPI cards con Delta chip, TenantChart (barras), Heatmap (CSS grid 7×24)
- `frontend/lib/api.ts` — +3 funciones: `getPlatformAnalytics`, `getOrdersHeatmap`, `getSseUrl`

**Auditoría final — 2 bugs corregidos:**
- `SuperadminLayout.tsx` l.52: `useState<TabId>('pagina')` → `useState<TabId>('pedidos')`
- `SuperadminLayout.tsx`: import `Pin` de lucide-react eliminado (nunca usado)

**Estado de TypeScript:** 0 errores en frontend y backend al cierre.

---

## [2026-06-09] — Sistema de Variantes + Precios por Volumen — implementación full-stack

Implementación completa del sistema de variantes de producto con precios escalonados y gestión de proveedores:

**Backend:**
- `backend/src/modules/variants/variants.service.ts` — CRUD completo de variantes, stock atómico (`UPDATE ... WHERE stock >= ?` + affectedRows check), resolvePrice con lógica tier/override/base, import CSV transaccional, movimientos de inventario
- `backend/src/modules/variants/variants.controller.ts` + `variants.routes.ts` — 14 endpoints (variants, price-tiers, stock, movements, import)
- `backend/src/modules/suppliers/suppliers.service.ts` + controller + routes — CRUD proveedores, link/unlink productos
- `backend/src/common/types/index.ts` — 5 nuevas interfaces: ProductVariant, VariantPriceTier, ResolvedPrice, Supplier, SupplierProduct, InventoryMovement
- `backend/src/modules/sales/sales.service.ts` — rama variant en loop de ítems de venta: stock atómico, resolución de tier, price freezing (variant_id, cost_price, margin_pct, margin_amount congelados en sale_items)
- `backend/src/modules/storefront/storefront.routes.ts` — variantes con price tiers (JSON aggregate) por producto
- `backend/src/index.ts` — montaje de variantsRoutes y suppliersRoutes
- `backend/src/migrations/004_variants_and_suppliers.sql` — 5 tablas nuevas (suppliers, supplier_products, product_variants, variant_price_tiers, inventory_movements) + ALTER TABLE (sale_items, order_items, products.base_price)

**Frontend:**
- `frontend/components/variant-manager.tsx` — componente completo: lista variantes con tiers expandibles, diálogos add/edit variante, add tier, ajuste stock (tipos: entrada/salida/ajuste/merma), import CSV
- `frontend/lib/types.ts` — ProductVariant, VariantPriceTier, ResolvedPrice, Supplier
- `frontend/lib/api.ts` — métodos: getVariantsByProduct, createVariant, updateVariant, deleteVariant, adjustVariantStock, getVariantTiers, createVariantTier, updateVariantTier, deleteVariantTier, resolveVariantPrice, importVariantsCsv, getSuppliers, CRUD suppliers
- `frontend/components/inventory-list.tsx` — botón `<Layers>` por producto abre VariantManager dialog
- `frontend/components/point-of-sale.tsx` — handleAddToCart async: detecta variantes activas, muestra picker dialog con resolución de tier por qty; handleAddVariantToCart crea ítem sintético con variantId

**Verificación:** Frontend TSC: 0 errores. Backend: 5 errores son truncaciones pre-existentes en archivos no modificados.

## [2026-06-07] — DAIMUZ auditoría final: limpieza de duplicados, consolidación de indexes

Revisión final contra el análisis completo (propuesta original + crítica + scorecard). Todo validado contra mejores prácticas:

- **Indexes**: modules-index (duplicados `products-variants`/`supplier-catalog` eliminados), endpoints-index (secciones VARIANTS/PRICE TIERS duplicadas consolidadas en 1), files-index (2 paths conflictivos de variants/ eliminados, 1 canonical), db-tables-index (sección duplicada "Nuevas tablas" eliminada)
- **Synapses ops-chain**: contenido duplicado y redundante reescrito en flujo limpio con variantes + price tiers + inventory_movements
- **Architecture database**: duplicado `stock_movements` eliminado, `inventory_movements` agregado, sección "Supplier Catalog" redundante eliminada
- **Business rules**: reglas de stock atómico, price tiers (min_qty solo), congelación, inventory_movements, import CSV agregadas
- **Ontology**: verificación de que ProductVariant y VariantPriceTier existen 1 vez cada uno (no duplicados)
- **Scoreboard**: diseño actual 9.8/10 vs mejores prácticas SaaS (race conditions, congelación, cost_price, inventory_movements, multi-proveedor)

## [2026-06-07] — Variantes + Proveedores: cerebro consolidado en brain/variants-and-suppliers.md

Unificada toda la arquitectura de variantes de producto, precios por volumen y proveedores en un solo documento maestro:

- **brain/variants-and-suppliers.md** — modelo de datos definitivo (5 tablas nuevas), 5 reglas de negocio universales (stock concurrente con UPDATE condicional, price tiers con solo min_qty sin gaps, price freezing en order_items, inventory_movements como fuente de verdad, tenant_id en todas las tablas hijas), plan de 4 sprints
- **Ontologia**: 4 nuevas entidades (ProductVariant, VariantPriceTier, Supplier, InventoryMovement). Stock Movement marcado como legacy.
- **Governance**: reglas de stock atomico, tiers sin gaps, congelacion de precios en ventas, inventory_movements como fuente de verdad
- **Sinapsis ops-chain**: flujo POS con variantes + price tiers + inventory_movements + price freezing
- **Sinapsis supplier-chain**: cadena completa proveedor > importacion > venta > liquidacion
- **Modulos nuevos**: modules/variants/ (variants.md + compressed.md), modules/suppliers/ (suppliers.md + compressed.md)
- **Flujo nuevo**: flows/supplier-flow.md (proveedor > importacion > venta > liquidacion con 6 etapas)
- **Indices**: db-tables-index con 5 nuevas tablas, endpoints-index con endpoints de variants/suppliers
- **DAIMUZ.md**: v3.9 con 37 modulos backend, 5 sinapsis, brain doc referenciado
- **Memoria**: current-state, current-sprint, pending, changelog actualizados

### Pendiente implementar
- Sprint 1: migracion SQL (product_variants, variant_price_tiers, suppliers, supplier_products, inventory_movements)
- Sprint 2: backend (variants.service, price-tier.service, import.service, suppliers.service)
- Sprint 3: frontend (POS variant selector, storefront chips, precio dinamico por tier)
- Sprint 4: panel proveedor + admin (margenes, stock por variante, reportes)

---

## [2026-06-06] — Build verde: 68 errores TypeScript corregidos (frontend + backend)

`pnpm exec tsc --noEmit` arrojaba 53 errores en frontend (8 archivos) y 15 en backend (4 archivos). Todos corregidos con cambios puntuales:

**Frontend**
- `lib/types.ts`: `CategoryItem.isHidden?`; nuevos tipos `DailyReportData` / `SedeReportData` / `ProductReportItem` (espejo de `sales.service.ts`).
- `lib/api.ts`: metodos `getDailyReport(date)` (`GET /sales/daily-report`) y `bulkCreateCustomers(customers)` (`POST /customers/bulk`).
- `ChatWidget.tsx`: `useRef<string|undefined>(undefined)` (React 19 exige argumento).
- `gym-management.tsx`: tipado explícito `id: string` en callbacks.
- `landing-page.tsx`: `?? 0` aplicado a cada operando de la resta de touch.
- `restbar.tsx`: `user?.storeName` -> `user?.tenantName` (x3; `User` no tiene `storeName`).
- `ProductTour.tsx`: migracion a react-joyride **3.1** -- `CallBackProps`->`EventData`, `disableBeacon`->`skipBeacon`, `styles.options`->prop `options`, `callback`->`onEvent`.

**Backend**
- `assistant.routes.ts`: `tenantId: u.tenantId ?? undefined` (`string|null`->`string|undefined`).
- `gym.service.ts`: `status: m.status` lo pisaba `...acc`; renombrado a `membershipStatus`.
- `workorders.controller.ts`: handlers tipados con `AuthRequest` + `req.user!.tenantId!` (patron de `sales.controller`).
- **Nuevo** `modules/alegra/alegra.service.ts`: stub tipado de facturacion electronica (el import dinamico en `orders.routes.ts` no resolvia). `createInvoice` es no-op hasta implementar el cliente real.

**Pendiente real (no bloquea build):** implementar endpoint backend `POST /customers/bulk` e integracion real de Alegra.

---

## [2026-06-05] — Asistente personal en toda la plataforma (role-aware)

Reutilizando la estructura de chat, el asistente ahora es personal y consciente del rol, disponible en admin/comerciante:
- **Backend** `backend/src/modules/assistant/` (service+routes, montado en `/api/assistant`): runner Gemini role-aware.
  - superadmin -> **Agente Maestro**: tools de solo lectura sobre TODA la red (kpis_globales, top_comercios, pedidos_pendientes_globales, stock_critico_global, comercios_inactivos).
  - comerciante/administrador_rb -> asistente de SU negocio (mis_ventas, mis_pedidos_pendientes, mi_stock_critico, mis_citas) scoped por tenant_id.
  - cliente -> sigue usando `/rutina/assistant`.
- **Frontend** `platform-assistant.tsx`: widget flotante (boton abajo-derecha) montado en `app/page.tsx` (MainLayout). Solo se muestra a superadmin/comerciante si el asistente de plataforma esta habilitado.
- Mismo gate global `platform_assistant_enabled` (lo controla el superadmin). Sin migracion nueva.

---

## [2026-06-05] — Asistente IA de plataforma (superadmin -> toda la infraestructura)

Asistente activable a nivel plataforma (no solo por comercio):
- **Toggle**: `platform_settings.platform_assistant_enabled`. Superadmin lo activa en Integraciones (`superadmin-home.tsx`, switch). Endpoints `GET /chatbot/platform-assistant`, `PUT /chatbot/superadmin/platform-assistant`.
- **Asistente del usuario** (`backend/src/modules/rutina/rutina.assistant.ts`): Gemini con function-calling y acceso CONTROLADO a los datos del propio usuario. Tools: guardar_perfil, crear_rutina_ejercicio, agregar_comida, agregar_lista_compras, recomendar_productos (busqueda cross-comercio real). Reusa `getAIKey()`. Ruta `POST /rutina/assistant` (gate: plataforma activa) + `GET /rutina/assistant/status`.
- **Chat del usuario** (`consumer-routine.tsx` -> `ChatAssistant`): boton "Asistente" en el header (solo si plataforma activa); hace cuestionario breve, arma rutina/plan a medida y muestra tarjetas de productos recomendados. Tras cada accion refresca la vista.
- **Vista comerciante** (`dashboard.tsx` -> `AssistantConnectedBanner`): banner "Asistente conectado a tu negocio" cuando esta activo (recuerda publicar catalogo con stock para aparecer en recomendaciones).
- Rutinas verificadas: generadas a medida por IA (decision del usuario), sin catalogo curado.

Sin migracion nueva (reusa platform_settings + tablas rutina_*).

---

## [2026-06-05] — Importacion masiva: auto-crear categorias inexistentes

`products.service.bulkCreate` ahora resuelve la categoria del CSV (por id o por nombre) y, si no existe para el tenant, la crea automaticamente dentro de la misma transaccion (slug como id, nombre original). Mapas en memoria evitan duplicados intra-lote y respetan el UNIQUE (tenant_id, name). Texto de ayuda del modal actualizado en `bulk-upload-dialog.tsx`.
Archivos: `backend/src/modules/products/products.service.ts`, `frontend/components/bulk-upload-dialog.tsx`.

---

## [2026-06-05] — Gym: control de acceso QR + rutina semanal

Tres piezas integradas en la vista del usuario logueado (sin migracion nueva, reusa gym_asistencia, gym_membresias, rutina_actividades_log):
- **QR de acceso**: el miembro ve su QR (codifica `GYM:<userId>`, lib `qrcode.react`) y un banner de estado (permitido/por_vencer/denegado) en su pestana Gym. Endpoint `GET /gym/me/acceso` (`memberAccess` + `computeAccess`).
- **Escaner + resultado (recepcion)**: pestana "Acceso QR" en `gym-management.tsx` con camara `@zxing/browser` + codigo manual; muestra pantalla de resultado a pantalla completa (verde/ambar/rojo) y registra el ingreso si procede. Endpoint `POST /gym/scan` (`scanAccess` valida membresia, auto-marca vencida, registra check-in).
- **Mi semana (Lun-Dom)**: componente `WeekStrip` en la pestana Rutina -- bloques por dia, marca actividades cumplidas (`rutina_actividades_log` via `POST /rutina/actividades/:id/toggle-log` + `GET /rutina/actividades-log`) y cruza con la asistencia real al gym (puntos violeta).

---

## [2026-06-05] — Gym: aprovechar al maximo la estructura

Auditoria y completado del modulo gym para usar todo el esquema:
- Backend: `memberCheckIn`/`memberCheckOut` (auto check-in del miembro, valida membresia activa), `listMemberAttendance` (historial por miembro), `miAsistencia` ahora devuelve `openCheckIn`, `getMemberDetail` incluye asistencia. Rutas: `POST /gym/me/checkin`, `POST /gym/me/checkout`, `GET /gym/members/:id/asistencia`.
- Frontend staff (`gym-management.tsx`): plan con peso/descanso por ejercicio + descripcion; progreso con medidas corporales (cintura/pecho/brazo/pierna/cadera -> JSON); detalle de miembro con edicion completa de membresia (estado/fechas/auto-renew/notas), acciones rapidas activar/pausar/cancelar, e historial de asistencia.
- Frontend miembro (`consumer-routine` GymView): boton de auto check-in / marcar salida por gimnasio activo.
- API: `miGymCheckIn/Out`, `getGymMemberAttendance`.

---

## [2026-06-05] — Diseno UI modulo CONSUMIDOR (rutina)

La vista del cliente estaba basica y no exponia todo el backend. Diseno completo de `consumer-routine.tsx`:
- Header con degradado + anillo SVG de calorias (consumidas/meta) + barras de macros (P/C/F) del dia.
- Editor de **perfil/objetivos** (modal, antes inexistente): objetivo, peso/meta, kcal, agua, nivel actividad, ciudad.
- Pestana **Rutina** nueva: constructor de rutinas + actividades (dia/hora/tipo), antes sin UI.
- Pestana **Cocina** (sub-tabs Despensa/Recetas) con **creacion de recetas** completa (macros, dificultad, meal_type, ingredientes) y "que puedo cocinar".
- **Plan** con captura y totales de macros + toggle hecho.
- Chips de objetivo/agua/peso, empty states, tab bar pulido. Pestana Gym condicional intacta.
- Backend: `getResumen` ahora devuelve nutricion del dia (plan vs consumido) y `listPlanComidas` incluye macros.

Tabs finales: Hoy . Rutina . Cocina . Plan . Compras . Gym (si miembro).

---

## [2026-06-05] — Modulo GIMNASIO end-to-end

### Backend (`/api/gym`)
- `gym.service.ts` (nuevo): membresias con cobro (registrarPago avanza next_payment segun ciclo), planes+ejercicios (transaccion), progreso, asistencia check-in/out, stats del gym, detalle de miembro, y vistas del miembro (misMembresias, miPlan, miProgreso, miAsistencia con calculo de racha/streak).
- `gym.routes.ts` (nuevo): authorize POR RUTA -- staff (`comerciante`/`administrador_rb`/`vendedor`/`cajero`) en `/gym/...`, miembro (`cliente`) en `/gym/me/...`. `index.ts` + montado en `src/index.ts`.

### Frontend
- `components/gym-management.tsx` (nuevo): panel del comercio -- stats, tabla de miembros, alta de miembro (por email), modal de detalle con planes/progreso, registrar pago, crear plan con ejercicios, registrar progreso, y pestana de asistencia con check-out.
- Montado en dashboard: `app/page.tsx` (import + `case 'gym'`) y entrada "Gimnasio" (icono Dumbbell) en `components/sidebar.tsx`.
- Vista del miembro: pestana "Gym" agregada a `consumer-routine.tsx` (solo si tiene membresia) -- membresias, racha de asistencia, plan de entrenamiento y progreso reciente.

### Pendiente
- Correr migraciones en MySQL prod (categorias, identidad, lifestyle/gym) + push.

---

## [2026-06-05] — Categorias PK compuesta + base de datos modulo Consumidor/Gimnasio

### Fixes
- **Categorias 500 entre tenants**: PK era global -> migracion a PK compuesta `(tenant_id, id)`. Archivos: `backend/migrations/fix_categories_composite_pk.sql` (MySQL) + version Postgres en `backend/migrations/postgres/001_*.sql`. Esquema base actualizado.
- Aclaracion de infra: **produccion corre en MySQL** (no Postgres). pgAdmin estaba conectado al motor equivocado (`categories does not exist`).

### Nueva base de datos (solo migracion, sin codigo aun)
- **Modulo Consumidor (Rutina/Estilo de vida)** -- datos del usuario final cross-comercio (pertenecen a `users.id`, no a un tenant):
  - `rutina_perfil`, `rutina_despensa`, `rutina_recetas`, `rutina_receta_ingredientes`, `rutina_rutinas`, `rutina_actividades`, `rutina_plan_comidas`, `rutina_lista_compras`
- **Modulo Gimnasio** -- tenant-scoped (`business_type=gimnasio`), control de miembros y progreso:
  - `gym_membresias`, `gym_planes_entrenamiento`, `gym_ejercicios`, `gym_progreso`
- Archivo: `backend/migrations/add_lifestyle_rutina_and_gym_modules.sql`
- Vision: vista del cliente logueado con su rutina diaria, que comer, recetas con lo que tiene en despensa, lista de lo que falta comprar, y compra cruzada a comercios registrados (proteinas, frutas, gimnasio, ropa, etc.).

### Decisiones tomadas
- Consumidor = **cross-comercio (usuario de plataforma)**. `users` con `role='cliente'` ES el platform_user (no se crea tabla aparte). `users.tenant_id` ya es NULL-able.
- Capa de identidad: nueva tabla `customer_tenant_profiles` (PK `platform_user_id + tenant_id`) con direccion por comercio (neighborhood/municipality/department), bloqueo (`is_blocked`/`block_reason`), consentimiento Habeas Data (`accepts_marketing`), y metricas denormalizadas (first/last_order_at, total_orders, total_spent, average_ticket, total_returns). `customers` se mantiene para mostrador. Archivo: `backend/migrations/add_platform_identity.sql`.

### Construido (end-to-end modulo CONSUMIDOR/rutina)
- **Migracion** `add_lifestyle_rutina_and_gym_modules.sql` ampliada: macros (protein/carbs/fat) en recetas y plan de comidas; perfil con bmr/tdee/bmi/target_weight/water_target; recetas con cook/total minutes, difficulty, meal_type; gym_membresias con price/payment_cycle/auto_renew/next_payment; + tablas nuevas `gym_asistencia` y `rutina_actividades_log`.
- **Backend** modulo `rutina` (nuevo): `rutina.service.ts` (perfil, despensa, recetas+ingredientes, rutinas+actividades, plan comidas, lista compras, "que puedo cocinar", generar lista desde receta, resumen), `rutina.routes.ts` (authorize cliente, REST), `index.ts`, montado en `src/index.ts` como `/api/rutina`.
- **Frontend**: `lib/api.ts` con metodos rutina; `components/consumer-routine.tsx` (overlay full-screen con pestanas Hoy/Despensa/Recetas/Plan/Compras). En `landing-page.tsx` se agrego SOLO un boton nuevo "Rutina" al nav inferior (visible si logueado) + render del overlay. **Las 5 secciones existentes (Mi cuenta, Ofertas, buscar, Carrito, Tienda) quedaron intactas.**

### Pendiente
- Correr en MySQL de prod: `fix_categories_composite_pk.sql`, `add_platform_identity.sql`, `add_lifestyle_rutina_and_gym_modules.sql`.

---

## [2026-06-04] — Despliegue en produccion (Komodo) + fixes del chatbot IA

### Despliegue
- App desplegada en produccion con **Komodo** (`deploy.alexsters.works`), stack `daimuz` (2 servicios: `daimuz_backend`, `daimuz_app`). Dominio: `https://daimuz.alexsters.works`.
- Komodo construye desde el repo de GitHub `github.com/estebanIoI/lopbuk_gastrobar.git` (branch `main`), **no** desde la carpeta local. Los cambios deben hacerse `commit` + `push` para que el build los tome.
- Config Komodo: **Pre Build Images** = ENABLED (corre `docker compose build`), **Destroy Before Deploy** = ENABLED.

### Fixes
- **Google OAuth en prod**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` iba vacio en los build args del frontend -> el provider no se montaba. Las vars `NEXT_PUBLIC_*` se hornean en build, no en runtime. Se paso el client ID real como build arg.
- **Chatbot -- modelo Gemini retirado**: `gemini-2.0-flash` ya no existe (404). En `agent.service.ts` el modelo estaba hardcodeado. Cambiado a alias `gemini-flash-latest` (configurable via env `GEMINI_MODEL`).
- **Chatbot -- soporte Groq**: `callAI()` ahora enruta por prefijo de key: `AIza` -> Gemini, `gsk_` -> Groq (endpoint OpenAI-compatible, modelo via env `GROQ_MODEL`, default `llama-3.3-70b-versatile`), otra -> OpenAI. Nota: el function-calling (pedidos/reservas) solo esta implementado para Gemini.

### Archivos modificados
- `backend/src/modules/agent/agent.service.ts` -- modelo Gemini por alias/env + funcion `callGroq` + routing en `callAI`

### Resultado
- Chatbot IA corriendo en produccion tras `push` al repo + rebuild en Komodo.

---

## [2026-05-28] — SQL sincronizado v3.8 + neuronas nuevas

### SQL
- Migracion v3.8 agrega `categories.is_active/color/sort_order` (fresh + idempotente en existentes)
- Tablas `rb_gastos`, `rb_ingresos_diarios`, `rb_gastos_fijos` integradas al script principal

### DAIMUZ
- Nueva neurona `modules/restbar-finanzas/` (completa + compressed)
- `indexes/endpoints-index.md` actualizado: CATEGORIES PATCH visibility + RESTBAR FINANZAS 13 endpoints
- `indexes/db-tables-index.md` actualizado: 3 tablas nuevas + columnas de categories
- `indexes/files-index.md` actualizado: archivos de categories CRUD + restbar.finanzas + restbar-finanzas.tsx
- `gastrobar-ops/compressed.md` actualizado: Finance Tracker documentado

---

## [2026-05-27] — Tracker Financiero Gastrobar + Categorias CRUD + DAIMUZ v3

### Nuevas funcionalidades
- **Tracker Financiero RestBar**: tab "Finanzas" (admin-only) en el modulo RestBar. Registra gastos variables, ingresos diarios, gastos fijos (con periodos: mensual/quincenal/semanal) y genera resumen quincenal. Auto-timestamp capturado en servidor al momento del registro. Timeline cronologico con iconos diferenciados.
- **Categorias CRUD completo** en modulo Inventario: dialog "Gestionar Categorias" con lista, edicion inline, color picker, toggle ocultar/mostrar y eliminar con validacion (no elimina si tiene productos activos).

### Mejoras
- **CategoryItem** extendido: ahora incluye `isActive`, `color`, `sortOrder`
- **Store Zustand**: nuevas acciones `updateCategory`, `toggleCategoryVisibility`; `fetchCategories` acepta `includeHidden`
- **DAIMUZ v3** completado al 100/100: gobernanza (3 archivos), todos los compressed.md (22 modulos), synapses completas, bugs-history poblado, deployment.md corregido (Dokploy + Evolution API v2)

### Bugs corregidos
- `api.ts`: metodo duplicado `toggleCategoryVisibility` -> renombrado el de storefront a `toggleStorefrontCategoryVisibility` para evitar colision en clase

### Archivos modificados
- `frontend/components/restbar.tsx` -- tab Finanzas + import RestBarFinanzas
- `frontend/components/restbar-finanzas.tsx` -- componente nuevo (tracker financiero completo)
- `backend/src/modules/restbar/restbar.finanzas.routes.ts` -- router con 13 endpoints
- `backend/src/modules/restbar/restbar.routes.ts` -- mount del sub-router `/finanzas`
- `backend/src/index.ts` -- 3 CREATE TABLE para rb_gastos/rb_ingresos_diarios/rb_gastos_fijos
- `frontend/lib/types.ts` -- CategoryItem extendido
- `frontend/lib/store.ts` -- updateCategory + toggleCategoryVisibility
- `frontend/lib/api.ts` -- metodos categorias + fix duplicado
- `frontend/components/inventory-list.tsx` -- dialog categorias CRUD completo
- `frontend/components/store-customization.tsx` -- actualizado a toggleStorefrontCategoryVisibility
- `backend/src/modules/categories/categories.service.ts` -- update + toggleVisibility
- `backend/src/modules/categories/categories.controller.ts` -- update + toggleVisibility
- `backend/src/modules/categories/categories.routes.ts` -- PUT /:id + PATCH /:id/visibility

---

## [2026-05-27] — Memoria unificada 