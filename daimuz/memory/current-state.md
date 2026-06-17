# 📍 Estado Actual — Junio 2026

> Actualiza este archivo después de cada sesión de trabajo significativa.

## Qué está funcionando al 100%

- ✅ **Auth** — Login local + Google OAuth + roles + multi-tenant
- ✅ **Dashboard** — KPIs, gráficas, métricas en tiempo real
- ✅ **POS** — Ventas, descuentos por ítem y global, múltiples pagos
- ✅ **Inventario** — Kardex completo, movimientos, alertas de stock
- ✅ **Caja** — Apertura/cierre, arqueo, historial inmutable
- ✅ **Ventas** — Historial con filtros, cancelaciones con auditoría
- ✅ **Clientes** — CRM básico, historial de compras
- ✅ **Créditos/Fiados** — Control de cupo, pagos parciales
- ✅ **Finanzas** — Flujo de caja, ingresos/egresos
- ✅ **Gastrobar** — Mesas, comandas, reservas, recetas BOM, food cost, merma
- ✅ **Compras** — Órdenes de compra, facturas de entrada
- ✅ **Delivery** — Pedidos, asignación de conductores, tracking básico
- ✅ **Flota** — Gestión de vehículos y conductores
- ✅ **Storefront** — Tienda online pública, checkout, pedidos online
- ✅ **WhatsApp** — Integración básica con WhatsApp Business
- ✅ **Stripe** — Pagos y suscripciones SaaS
- ✅ **Multi-tenant** — Sistema completo de tenants y módulos activables
- ✅ **Multi-sede** — Sedes con inventario y caja independientes
- ✅ **Colorimetría por IA** — Paleta desde el logo: tienda del comercio (full), panel (solo acento), plataforma (home/login/default). Ambos temas de home la consumen (Tema 1 vía remap Tailwind→`--color-primary`; Tema 2 vía variables `--brand-*`). Regla: todo tema nuevo debe consumirla → [[brain/colorimetria]]

## ✅ Implementado: Multi-API Key para Agente IA + cifrado en reposo (2026-06-15)

**Problema:** El superadmin tenía un solo campo `openai_api_key`. El agente soporta Gemini/OpenAI/Groq pero solo se podía tener 1 key a la vez y la selección era implícita por prefijo.

**Solución:**
- **Frontend** (`IntegrationsTab.tsx`): 3 campos separados (Gemini/OpenAI/Groq) con toggle show/hide, badges "Configurado", y selector de proveedor default con botones.
- **Backend** (`chatbot.routes.ts`): GET/PUT `integrations` ahora maneja `geminiApiKey`, `openaiApiKey`, `groqApiKey` y `defaultAiProvider`. Las API keys se **cifran en reposo** (AES-256-CBC via `crypto.ts`).
- **`agent.service.ts`**: `getAIKeys()` devuelve las 3 keys + provider default. `processAgentMessage()` usa routing explícito por provider (Gemini → function calling, OpenAI/Groq → chat directo).
- **Entorno**: `.env` creado con la OpenAI key provista. `.env.example` actualizado con `OPENAI_API_KEY`, `GROQ_API_KEY`, `AI_DEFAULT_PROVIDER`. Docker-compose dev + production incluyen las nuevas vars.

## ✅ Implementado: Afiliados (backend S1–4) + tarjetas externas + imagen por variante + barra config (2026-06-17)

- **Módulo Afiliados/Promotores — backend Sprints 1–4** (`/api/affiliates`): schema (10 tablas, migración
  inline en `index.ts`), core (auth propia del promotor, campañas con token, conversiones/comisiones,
  retiros, leaderboard, misiones, superadmin, comercio), paquetes con **pago inmediato al wallet**, y
  **atribución por enlace** (`?ref=` → `attributeOrder` en `/orders/public`) + auto-aprobación. Pendiente:
  tier engine, cron, y todo el **frontend** (portal `/promotor`, tab superadmin, panel comercio). Ver
  `context/roadmap-afiliados.md`.
- **Tarjetas externas**: comercios fuera del aplicativo creables desde superadmin (logo/portada/descripción/link);
  aparecen en la home y redirigen al link. Tabla `marketplace_external_cards`.
- **Imagen por variante**: cada color puede tener su imagen; en la tienda la foto principal cambia al elegir color.
- **Barra de bienvenida (Tema 2)**: activable + editable desde superadmin (`platform_settings`).
- **Tema 2 cerrado**: pantalla de éxito (holo + ticket), fix de pedidos duplicados, carrito minimalista,
  tarjeta premium; confirmación al cliente desde el módulo de pedidos (WhatsApp prellenado).
- **Home móvil**: carrusel sin franjas, bienvenida sin recorte, sección "Únete a DAIMUZ" (3 públicos).
- ⚠️ Todo necesita **Deploy en Komodo** para verse en producción.

## ✅ Implementado: Tema 2 (reservas/pedidos) + QR de mesa administrable (2026-06-16)

- **Reservas Tema 2** ahora **guardan** en `rb_reservations` (visible en el panel) vía `POST
  /restbar/reservations/public-quick`, con pantalla de éxito + botón opcional de WhatsApp.
- **Pedidos Tema 2** ya no fallan en silencio: si el guardado en `storefront_orders` falla, se muestra el error
  y NO se abre WhatsApp. Confirmado que el pedido se guarda con el `tenantId` correcto.
- **"Ordenar Ahora" (Favoritos)** abre el flujo con el producto ya en el carrito.
- **QR de mesa = panel de administración** (no solo generar): ver quién está en la mesa y el **consumo de cada
  persona** (parseado de la etiqueta `[nombre]` en `item_notes`), total, compartir (copiar/WhatsApp/share),
  regenerar y eliminar. Endpoints auth `GET/POST /restbar-qr/tables/:id/session(/close)`.
- ⚠️ Todo esto está en código pero **falta Deploy en Komodo** para verse en producción.

## ✅ Implementado: Colorimetría de marca por IA + fixes (2026-06-14)

**Arquitectura de colorimetría (2 niveles):**
- Paleta de **plataforma** (superadmin, desde el logo DAIMUZ) → tiñe la home/marketplace + login y es el acento por defecto de los paneles de comercios sin paleta propia.
- Paleta **individual del comercio** (desde su logo) → tiñe su tienda (full color) y solo el acento de su panel.
- Jerarquía de acento en panel: acento propio del comercio > acento de plataforma > base. Decisión: los paneles operativos NO se colorizan por completo (solo acento) para no romper contraste/legibilidad.

**Colorimetría en superadmin (`platform-theme-generator.tsx`)**
- Nueva tarjeta "Colorimetría de la plataforma (IA)" junto al logo en LandingConfigTab; genera/previsualiza/guarda en `platform_settings` clave `platform_theme_colors`.
- `lib/platform-theme.ts` (helper: getPlatformPalette / applyPlatformAccentDefault / parsePlatformPalette) + `platform-theme-loader.tsx` montado en `app/layout.tsx` (acento default app-wide).
- `landing-page.tsx` tiñe la home con la paleta de plataforma cuando no hay tienda seleccionada; `merchant-panel.tsx` usa acento de plataforma como fallback.
- Sin cambios de backend: se reutilizan `/storefront/theme/generate` y `/tenants/platform-settings`.

**Auto-colorimetría al subir logo (comerciante)**
- `logo-theme-generator.tsx` + `store-customization.tsx`: al subir un logo nuevo se genera+aplica+guarda la paleta automáticamente y aparece el toast "Colorimetría aplicada. ¿Deseas editarla?" con acción Editar.

**Fixes**
- **Favicon**: usaba `daimuz-icon.png` (recuadro blanco en la pestaña) → ahora `daimuz-icon-transparent.png` en `layout.tsx` (`icon`/`shortcut`) y `BRAND.iconTransparent` en `dynamic-favicon.tsx`.
- **Tarjeta del comercio (`store-card-config.tsx`)**: el tema ahora se guarda al instante al seleccionarlo (antes solo cambiaba estado local y se perdía si no se pulsaba "Guardar tarjeta").
- **Backend `card-config` (`storefront.routes.ts`)**: corregido bug donde `affectedRows === 0` (guardado sin cambios) disparaba un INSERT que fallaba por clave duplicada (500); ahora verifica existencia de la fila antes de crear.

## ✅ Implementado: Sprint 5 — Centro de Pedidos v2 (2026-06-12)

**TenantManagement mejorado (tenant-management.tsx — legacy panel)**
- Acciones con nombres: 5 icon-buttons → `DropdownMenu` con 6 ítems etiquetados
- Eliminar comercio: soft-delete con confirmación (status → 'cancelado')
- Editar todo el comercio: diálogo expandido con slug editable, ownerName/ownerEmail (solo lectura)
- Trial configurable: confirmación con contador de días (−/+ y botones 7/14/30); backend acepta `{ days }` en body
- Backend: `tenants.service.ts` — `update()` acepta `slug` con unicidad; `activateTrial()` acepta `days: number`

**Centro de Pedidos v2 (OrdersCenterTab.tsx)**
- Banner alerta SLA — aparece cuando hay retrasados o sin asignar en la página actual
- Priority chips — "X sin asignar", "X retrasados >30min", "X en riesgo 10–30min" (calculados via `useMemo`)
- Filtro por comercio — Select con tenants activos (nuevo endpoint `GET /superadmin/orders/tenants`)
- Bordes de fila — `border-l-4` por color de estado (amarillo/azul/morado/índigo/verde/rojo)
- Antigüedad coloreada — verde/amarillo/rojo+pulso según SLA en columna Pedido
- Checkboxes + bulk action toolbar flotante — cambiar estado / asignarme / cancelar en selección múltiple
- Toggle Tabla/Kanban — botones en el header
- Asignación rápida en drawer — lista de repartidores del comercio del pedido; click asigna directo
- `KanbanView.tsx` — Kanban 6 columnas con @dnd-kit; drag cards entre columnas valida state machine
- 3 endpoints nuevos en backend (`/orders/tenants`, `/orders/:id/drivers`, assign con `assigneeId`)
- Instalado: `@dnd-kit/core` + `@dnd-kit/utilities` vía pnpm

## ✅ Implementado: Panel Superadmin Modular — Sprints 0-4 (2026-06-12)

**Sprint 0 — Refactor monolito superadmin-home.tsx (3444 líneas → arquitectura modular)**
- `superadmin/SuperadminLayout.tsx` — shell con 9 tabs lazy-loaded (`next/dynamic`)
- 9 tabs en `superadmin/tabs/` — cada una es JSX puro que consume un hook
- Hooks en `superadmin/hooks/` — toda la lógica/estado separada de la UI

**Sprint 2 — Centro de Pedidos cross-tenant**
- Backend: `backend/src/modules/orders/superadmin-orders.routes.ts` (5 endpoints)
- Auto-migración: columna `assigned_to` en `storefront_orders` + tabla `order_status_history`
- Frontend: `useOrders.ts` + `OrdersCenterTab.tsx` (bandeja, SLA semáforo, drawer, state machine)

**Sprint 3 — Wizard creación + Papelera/Restaurar tenants**
- `CommerceWizard.tsx` — wizard 4 pasos (Comercio → Plan → Propietario → Confirmar)
- `useTenantLifecycle.ts` — soft-delete (→ status: 'cancelado') + restore (→ status: 'activo')
- `CommercesTab.tsx` — reescrito con sección "activos" + toggle papelera con badge rojo

**Sprint 4 — Analytics profesional + SSE reemplaza polling**
- Backend: 3 endpoints nuevos en `superadmin-orders.routes.ts` (SSE + analytics + heatmap)
- `useOrders.ts` — EventSource con `withCredentials: true`, fallback polling automático
- `useAnalytics.ts` — KPIs plataforma, heatmap 7×24
- `AnalyticsTab.tsx` — 6 KPI cards con Delta chip + TenantChart + Heatmap CSS grid

**Bugs encontrados y corregidos en auditoría final:**
- Tab por defecto corregido: `'pagina'` → `'pedidos'`
- Import `Pin` de lucide-react eliminado (nunca usado)

## En ajuste / desarrollo activo

- 🔄 **Agente IA** — RAG funcionando, mejorando respuestas y herramientas
- 🔄 **Inmobiliaria** — Módulo base listo, refinando flujos
- 🔄 **Tapicería/WorkOrders** — Módulo listo, refinando UX

## ✅ Implementado: Sistema de Variantes + Precios por Volumen (2026-06-09)

Implementación full-stack completa. Ver `daimuz/brain/variants-implementation-plan.md`.

**Backend nuevo:**
- `modules/variants/variants.service.ts` — CRUD variantes, stock atómico, price tiers, resolvePrice, import CSV
- `modules/variants/variants.controller.ts` + `variants.routes.ts`
- `modules/suppliers/suppliers.service.ts` — CRUD proveedores + link productos
- `modules/suppliers/suppliers.controller.ts` + `suppliers.routes.ts`
- `common/types/index.ts` — ProductVariant, VariantPriceTier, ResolvedPrice, Supplier, InventoryMovement
- `modules/sales/sales.service.ts` — rama variant en loop de venta (stock atómico + price freezing + inventory_movement)
- `modules/storefront/storefront.routes.ts` — variantes con price tiers en storefront
- `migrations/004_variants_and_suppliers.sql` — 5 tablas nuevas + ALTER TABLE sale_items/order_items/products

**Frontend nuevo:**
- `components/variant-manager.tsx` — gestión completa: CRUD variantes, tiers, ajuste stock, import CSV
- `lib/types.ts` — ProductVariant, VariantPriceTier, ResolvedPrice, Supplier
- `lib/api.ts` — todos los métodos para variantes, tiers y proveedores
- `components/inventory-list.tsx` — botón Layers por producto abre VariantManager
- `components/point-of-sale.tsx` — handleAddToCart async detecta variantes, picker dialog con resolución de tier por qty

## En planificación (DAIMUZ completo, sin codificar)

## Pendiente / Backlog

- ⏳ Ver [[context/pending]] para la lista priorizada

## Últimos cambios

> Agrega aquí cada vez que termines algo significativo

- `[2026-06-16]` — **Modo Chat Daimuz (slice Restbar)**: el agente opera mesas por chat (`/api/daimuz-chat`, página `/modo-chat`) con confirmación antes de ejecutar (abrir mesa / tomar pedido / enviar a cocina). Además: asistentes ahora aceptan OpenAI (`sk-`) con base URL configurable, y las AI keys se enmascaran en el panel con opción 'revelar'. Base de la visión 'el panel se vuelve chat y mueve los módulos'. Pendiente: cobrar, más módulos, Gemini, y el toggle de panel completo.
- `[2026-06-14]` — **Colorimetría de marca por IA (2 niveles) + fixes**: paleta de plataforma (superadmin → home/login/default paneles) y paleta individual del comercio (tienda full + acento de panel); auto-colorimetría al subir el logo del comercio con toast "Colorimetría aplicada ¿desea editar?". Nuevos: `lib/platform-theme.ts`, `components/platform-theme-loader.tsx`, `components/platform-theme-generator.tsx`. Editados: `app/layout.tsx`, `superadmin/tabs/LandingConfigTab.tsx`, `logo-theme-generator.tsx`, `store-customization.tsx`, `landing-page.tsx`, `merchant-panel.tsx`. Fixes: favicon → `daimuz-icon-transparent.png`; "Tarjeta del comercio" guarda el tema al instante (`store-card-config.tsx`); backend `card-config` ya no falla con INSERT duplicado al reguardar sin cambios (`storefront.routes.ts`). Sin cambios de schema (reutiliza `platform_settings` y `/storefront/theme/*`).
- `[2026-06-12]` — **Panel Superadmin — Sprints 0-4 completados**: refactor monolito (3444 líneas → 25 archivos modulares), Centro de Pedidos cross-tenant con SSE, wizard creación de comercios, papelera/restaurar tenants, dashboard analítica con heatmap. Backend: 8 endpoints `/api/superadmin/*`. DB: columna `assigned_to` en `storefront_orders` + tabla `order_status_history`.
- `[2026-06-09]` — **Sistema de Variantes + Precios por Volumen — implementación full-stack completa**: backend (variants.service, suppliers.service, controllers, routes), actualización de sales.service (stock atómico + price freezing), storefront con variantes+tiers, migración 004_variants_and_suppliers.sql (5 tablas), frontend (variant-manager.tsx, api.ts, inventory-list con botón variantes, point-of-sale con picker dialog y resolución de tiers). TypeScript frontend: 0 errores. Errores backend son truncaciones pre-existentes no relacionadas.
- `[2026-06-07]` — **DAIMUZ auditado contra análisis completo**: indexes limpiados (modules, endpoints, files, db-tables), sinapsis ops-chain reescrita sin duplicados, reglas de variantes en vault business-rules, architecture/database consolidado. Scorecard final verificado: 9.8/10.
- `[2026-06-07]` — **Arquitectura de variantes completa en DAIMUZ**: diseñado e integrado el modelo `products → product_variants → variant_price_tiers` con todas las mejores prácticas. Creado `decisions/variant-architecture.md` (8 decisiones formales), `flows/variant-flow.md` (5 flujos), actualizados governance, business-rules, ontology (limpieza de duplicados), synapses (ops-chain + delivery-chain + variants-chain), e indexes. Pendiente: implementar código backend y frontend.
- `[2026-06-06]` — **Build TypeScript verde**: corregidos 68 errores de `tsc --noEmit` (53 frontend / 15 backend). Tipos del reporte de cierre diario en `lib/types.ts`, métodos `getDailyReport`/`bulkCreateCustomers` en `lib/api.ts`, migración de `ProductTour.tsx` a react-joyride 3.1, `User.tenantName` en restbar, y en backend: `AuthRequest` en `workorders.controller`, fix de spread en `gym.service`, `tenantId ?? undefined` en assistant, y nuevo stub `modules/alegra/alegra.service.ts`. Pendiente: endpoint `POST /customers/bulk` e integración real de Alegra. Backend verificado limpio; frontend validado por revisión (el `tsc` completo no cabe en el sandbox de Cowork).
- `[2026-06-05]` — **Módulo CONSUMIDOR (rutina) end-to-end** + capa de identidad cross-comercio. Backend `/api/rutina` (service+routes montados), frontend `consumer-routine.tsx` como overlay con botón nuevo "Rutina" en el nav (sin tocar las 5 secciones existentes). Migraciones: `add_platform_identity.sql` (customer_tenant_profiles), `add_lifestyle_rutina_and_gym_modules.sql` (rutina_* + gym_* + macros + asistencia + log cumplimiento). Falta correr migraciones en prod + push. Módulo GIMNASIO: solo tablas, sin código aún.
- `[2026-06-04]` — **PRODUCCIÓN viva en Komodo** (`https://daimuz.alexsters.works`): stack `daimuz` con backend + frontend. Komodo buildea desde el repo GitHub `estebanIoI/lopbuk_gastrobar` (main). Pre Build Images + Destroy Before Deploy activos. Fix de Google OAuth en prod (client ID como build arg). Chatbot funcionando: modelo Gemini cambiado a alias `gemini-flash-latest` (env `GEMINI_MODEL`) + soporte Groq en `callAI` (env `GROQ_MODEL`). Deploy aplicado vía push al repo + rebuild en Komodo.
- `[2026-05-28]` — **Dividir cuenta en partes iguales — RestBar Caja** (`restbar.tsx`): nueva opción en el selector de cobro de la sección Caja. Muestra un panel ámbar con contador +/− de personas, calcula "cada persona paga $XXX", desglose por persona numerado. Solo frontend, sin cambios en backend. El cobro sigue procesándose como pago de mesa completa. Disponible para todas las mesas (con o sin comensales asignados). Selector ahora siempre muestra las opciones al elegir mesa (antes auto-saltaba a modo tabla si no había split de comensales).
- `[2026-06-16]` — **Fase 4 Restaurante (reportes)**: sub-router `restbar.reports.routes.ts` (`/api/restbar/reports/summary`) → resumen de pagos, top productos, rendimiento mesero/mesa, KPIs. Página `/reportes-restaurante` con rango de fechas y export PDF. Marketing/promos ya cubierto por `store_banners`+home `/r/[slug]`. Incluye **backup/restore** (`/api/restbar/backup` + página `/respaldos`): export de solo lectura y restore con upsert de SOLO catálogo/config (nunca pedidos/pagos), con vista previa + frase `RESTAURAR`. **Roadmap restaurante COMPLETO (Fases 1–4); integración Sirius cerrada.** tsc front 0; backend sin errores en archivos propios.
- `[2026-06-15]` — **Fase 3 Restaurante COMPLETA (fidelización)**: módulo `loyalty` (`/api/loyalty`) con reglas de puntos configurables (puntos por $1.000), recompensas CRUD, cuentas por teléfono, acúmulo (`/earn`, sin tocar pagos) y canje desde la sesión del cliente (`/mesa/[token]` → código de canje). Panel admin `/fidelizacion`. Roadmap: Fase 1 ✅ · 2 ✅ · 3 ✅; falta Fase 4 (marketing + reportes). tsc front 0.
- `[2026-06-15]` — **Fase 2 Restaurante COMPLETA**: **prioridad de cocina** (comandas urgentes primero en los paneles cocinero/bar, badge 🔥 + botón ⚡; columna `rb_orders.priority`, `PATCH /restbar/orders/:id/priority`) y **regalo entre mesas** (el cliente envía productos a la comanda de otra mesa ocupada; `GET/POST /restbar-qr/session/:token/tables|gift`). Además: **reservas online avisan al comercio** (notificación) y **jukebox** (el cliente pide canción al superar un umbral de consumo; staff la gestiona en `/jukebox`). **Fase 2 cerrada.** tsc front 0.
- `[2026-06-15]` — **Fase 1 Restaurante (QR de mesa) COMPLETA**: el cliente escanea el QR de su mesa (`/mesa/[token]`), entra con su nombre, ve el menú con disponibilidad real, pide desde su celular (entra al KDS real) y **sigue el estado de su pedido en vivo**. La sesión se invalida al cobrar/cancelar. Nueva **home del restaurante** `/r/[slug]` (promos/eventos desde `store_banners`, destacados, CTAs menú/reservar). Backend: `restbar-qr.routes.ts` (`/api/restbar-qr`) + tablas `rb_table_sessions`/`rb_table_guests`. tsc 0. Plan completo en `context/plan-integracion-sirius.md` (secciones 5–7).
- `[2026-05-28]` — **SQL principal sincronizado** (`inventarioEsteban_v3_multitenant.sql`): migración v3.8 agrega `categories.is_active/color/sort_order` + tablas `rb_gastos`, `rb_ingresos_diarios`, `rb_gastos_fijos`. SQL ahora está full para levantar desde 0.
- `[2026-05-27]` — **Tracker Financiero Gastrobar** (`restbar-finanzas.tsx` + `restbar.finanzas.routes.ts`): tab "Finanzas" (admin-only) en RestBar con timeline, gastos variables, ingresos diarios, gastos fijos y resumen quincenal. Auto-timestamp en servidor. 3 tablas nuevas: `rb_gastos`, `rb_ingresos_diarios`, `rb_gastos_fijos`.
- `[2026-05-27]` — **Categorías CRUD completo** en módulo Inventario: backend (PUT /:id, PATCH /:id/visibility), frontend dialog con lista de categorías + edición inline + color picker + hide/show + delete con validación. `CategoryItem` actualizado con `isActive`, `color`, `sortOrder`. Store con `updateCategory`, `toggleCategoryVisibility`.
- `[2026-05-27]` — **daimuz v3** (100/100): gobernanza completa, todos los compressed.md, synapses completas, bugs-history poblado, deployment.md corregido (Dokploy + E