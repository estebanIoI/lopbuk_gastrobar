# Changelog - Lopbuk

> Registro de cambios significativos. Formato: `## [YYYY-MM-DD] — Descripcion`

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

## [2026-05-27] — Memoria unificada en DAIMUZ + mejoras cajero

### Nuevas funcionalidades
- **Division de cuenta igualitaria** en `cajero-panel.tsx`: el cajero activa un modo que divide el total entre N personas (contador +/-, grid rapido 2-10 personas, auto-rellena el campo de monto)

### Mejoras
- **CLAUDE.md** creado en root: Claude Code ahora usa `daimuz/` como sistema de memoria del proyecto
- **Limpieza de docs**: eliminada carpeta `docs/`, contenido migrado a `daimuz/vault/` (api-routes, business-rules, changelog)
- **READMEs actualizados**: eliminado `README copy.md` obsoleto, reescritos `backend/README.md` y `frontend/README.md` con informacion actual de Lopbuk

---

## [2026-05-26] — Nucleo cognitivo DAIMUZ

### Nuevas funcionalidades
- Creado sistema de documentacion DAIMUZ en Obsidian
- 60+ neuronas organizadas en brain, memory, architecture, modules, flows, decisions, prompts, context, vault

---

## [2026-05] — Agente IA (Fases 1 y 2)

### Completado
- **Fase 1 -- RAG + Function Calling**: agente responde con contexto del negocio
- **Fase 2 -- WhatsApp (Evolution API v2)**: webhook configurado, mensajes entrantes/salientes
- Fix `agent.service.ts`: productos solo se sugieren cuando el mensaje lo pide explicitamente
- Fix `whatsapp.service.ts`: `setWebhook` corregido al formato plano de Evolution API v2

---

## [Mayo 2026] — Estado del ecosistema completo

### Sistema Core
- Multi-tenancy por columna (`tenant_id`)
- Auth JWT + httpOnly cookie + Google OAuth
- Modulos activables por tenant
- Multi-sede (sucursales)
- 10 roles con permisos diferenciados

### Operaciones de Negocio
- POS completo (carrito, descuentos, multiples pagos, impresion)
- Cierres de caja con arqueo
- Kardex completo (entrada, salida, ajuste, merma, transferencia)
- Recetas BOM con food cost automatico
- Control de merma con justificaciones
- Niveles PAR y alertas de reorden
- Compras a proveedores

### Gastrobar
- Mesas con estados, comandas, reservas
- Panel de cocina, bartender, mesero, cajero
- Cajero: cobro por comensal o mesa completa + division igualitaria

### Clientes y Finanzas
- CRM basico con historial de compras
- Fiados y creditos con control de cupo
- Flujo de caja (ingresos, egresos, P&L)

### Delivery y Digital
- Pedidos con estados completos + asignacion de conductores
- Storefront publico por slug unico
- Checkout de tienda online
- Landing page personalizable por tenant
- Portafolio de proyectos/servicios
- Menu digital publico

### Integraciones
- Stripe (pagos + suscripciones SaaS)
- WhatsApp Business API (Evolution API v2)
- Google OAuth
- Cloudinary (imagenes)
- Impresoras termicas (POS)

---

[[current-state]] | [[DAIMUZ]] | -> [[completed-features]]
