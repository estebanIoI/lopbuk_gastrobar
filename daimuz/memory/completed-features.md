# ✅ Features Completados

## Variantes en storefront: selección dinámica + reserva atómica + preventa (2026-06-18)

- **`attachVariants()` compartido** (`storefront.routes.ts`): adjunta `variants` + `hasVariants` a TODOS los endpoints públicos de producto (lista, ofertas, novedades, destacados de plataforma, drops, featured/trending). Devuelve todas las variantes activas con `stock`/`reserved_stock`/tiers/`min_price`.
- **Visibilidad por variante:** la lista muestra productos con `products.stock = 0` si alguna variante tiene disponibilidad (`EXISTS` sobre `product_variants`).
- **Selección dinámica en ambos themes:** `VariantSelector` (color swatches + chips talla/material, resuelve variante exacta, precio/imagen/stock en vivo, tiers por cantidad). Integrado en Tema 1 (`landing-page`) y Tema 2 (`theme2-order-flow`). Carrito/WhatsApp/ticket/pedido llevan la variante; `variantId` en el payload.
- **Reserva atómica de stock** (`variants.service.ts`): `reserveForPublicOrder()` (incrementa `reserved_stock` race-safe `WHERE (stock - reserved_stock) >= qty`, transaccional, movimiento `'reserva'` con `reference_id = orderId`) + `releaseForOrder()` (cancelación/rollback, movimiento `'liberacion'`). `POST /orders/public` separa ítems con/ sin variante; `cancel-gateway` libera.
- **Preventa (backorder):** `allowOutOfStock` en `VariantSelector` (agotadas seleccionables, "Disponible en preventa"); ítems `isPreorder` no reservan stock (venta ilimitada) — para embudos masivos.
- **Datos de carga AnMarg:** `imports/anmarg-camiseta-clasica/` (CSV 90 variantes, SQL tiers 6+/12+/24+, README).
- **Asiento al confirmar** (`settleVariantForSale`): al entregar el pedido, descuenta `product_variants.stock`, libera la reserva, registra movimiento `'salida'` y congela `variant_id`/costo/margen en `sale_items`.
- **Cupo de preventa:** `product_variants.preorder_limit` (NULL = ilimitado) + `preorder_count`; enforce atómico en la reserva; campo "Cupo de preventa" en `variant-manager`.
- **Reserva en pasarelas:** MP/ADDI/Sistecrédito reservan variante + persisten `variant_id` + liberan en webhooks de rechazo.
- **Trazabilidad:** `variant_id` persistido en `storefront_order_items` y `sale_items` (migración idempotente en `index.ts`).
- **Estado:** integración completa, tsc back+front 0 errores. Solo queda arrancar backend (migraciones) + cargar AnMarg + Deploy en Komodo.

## Centro de Pedidos v2 + TenantManagement v2 — Sprint 5 (2026-06-12)

**TenantManagement (tenant-management.tsx)**
- Acciones con labels: DropdownMenu (Ver, Editar, Activar/Suspender, Trial, Módulos, Eliminar)
- Soft-delete con confirmación; edición de slug con validación de unicidad
- Trial configurable: body `{ days }` en backend, modal con contador y botones rápidos

**Centro de Pedidos v2**
- `KanbanView.tsx`: Kanban 6 columnas con `@dnd-kit/core` drag-to-column; valida transiciones antes de llamar API
- `useOrders.ts`: viewMode, priorityStats (useMemo: sinAsignar/retrasados/enRiesgo), drawerDrivers, tenantsList, bulk selection (Set), handleBulkStatusChange/Assign/Cancel
- `OrdersCenterTab.tsx`: banner SLA, priority chips, filtro comercio (Select), border-l-4 por estado, antigüedad coloreada por SLA, checkboxes, bulk toolbar flotante, asignación rápida en drawer
- Backend: endpoints `/orders/tenants`, `/orders/:id/drivers`, assign acepta `assigneeId` + devuelve `assigned_name`

## Panel Superadmin Modular — Sprints 0-4 (2026-06-12)
- **Sprint 0**: `superadmin-home.tsx` (monolito 3444 líneas) → `superadmin/` (25 archivos: 1 layout + 9 tabs + 5 hooks + shared)
- **Sprint 2**: Centro de Pedidos cross-tenant — bandeja filtrable, SLA semáforo, drawer con historial, state machine de estados, asignación de operador
- **Sprint 3**: Wizard 4 pasos para crear comercios (Comercio → Plan → Propietario → Confirmar) + papelera/restaurar tenants (soft-delete)
- **Sprint 4**: Dashboard analítica (6 KPIs con deltas %, gráficas por tenant, heatmap 7×24 CSS grid) + SSE reemplaza polling con fallback automático
- **Patrón establecido**: hook = estado + fetch + handlers; tab = JSX puro que consume el hook; lazy-load con `next/dynamic`
- **Backend**: `superadmin-orders.routes.ts` — 8 endpoints, auto-migración al montar rutas

## Variantes + Precios por Volumen (2026-06-09)
- `product_variants` — color/size/material/SKU/stock con stock atómico (race-safe)
- `variant_price_tiers` — precios escalonados por min_qty sin gaps, resolución `WHERE min_qty <= qty ORDER BY min_qty DESC LIMIT 1`
- `suppliers` + `supplier_products` — N:N para multi-proveedor
- `inventory_movements` — audit log inmutable como fuente de verdad
- Price freezing en sale_items (cost_price, margin_pct, margin_amount congelados al vender)
- Backward compatible: productos sin variantes no cambian
- Import CSV masivo transaccional (por fila, no aborta todo si 1 falla)
- Frontend: VariantManager, picker en POS con resolución de tier live, botón Layers en inventario

## Sistema Core
- Multi-tenancy por columna (`tenant_id`)
- Sistema de roles y permisos (10 roles)
- Auth JWT + httpOnly cookie + Google OAuth
- Módulos activables por tenant
- Multi-sede (sucursales)

## Operaciones de Negocio
- POS con carrito, descuentos por ítem/global, múltiples métodos de pago
- Cierres de caja con arqueo y diferencias
- Kardex completo con tipos: entrada, salida, ajuste, merma, transferencia
- Recetas BOM con cálculo automático de food cost
- Control de merma con justificaciones
- Niveles PAR y alertas de reorden
- Compras a proveedores con líneas de detalle

## Clientes y Ventas
- CRM básico con historial de compras
- Fiados y créditos con control de cupo
- Pagos parciales de crédito
- Cupones de descuento
- Reseñas de clientes

## Gastrobar
- Mesas con estados (libre, ocupada, reservada)
- Comandas por mesa con ítems y estado individual por ítem
- Reservas de mesas (online, WhatsApp notify)
- Panel de cocina (cola de pedidos)
- Panel de bartender
- Panel de mesero
- **Cajero — División de cuenta igualitaria**: divide el total entre N personas con contador interactivo y grid de acceso rápido (en `cajero-panel.tsx`)
- **RestBar Caja — Dividir cuenta en partes iguales**: nueva opción en selector de cobro de `restbar.tsx`. Panel ámbar con +/− personas, muestra "cada persona paga $XXX" y desglose por persona. Solo frontend, sin cambios backend.
- **Tracker Financiero RestBar** (admin-only): gastos variables, ingresos diarios, gastos fijos, resumen quincenal P&L

## Delivery
- Pedidos con estados completos
- Asignación de conductores
- Panel de despachador
- Panel de conductor
- Mapa de pedidos (OrdersMap)
- Gestión de flota (vehículos)

## Digital
- Storefront público por slug único
- Checkout de tienda online
- Menú digital público
- Landing page personalizable
- Portafolio de proyectos/servicios
- Links personalizados (como Linktree)

## Integraciones
- Stripe (pagos + suscripciones SaaS)
- WhatsApp Business API
- Google OAuth
- Cloudinary (imágenes)
- Impresoras térmicas

## Analytics
- Dashboard con KPIs (ventas hoy, semana, mes)
- Top productos más vendidos
- Alertas de inventario bajo
- Historial de ventas con filtros avanzados
- Reportes exportables

## RRHH / Nómina
- **Vendedores**: comisiones (%, fijo por venta, fijo por ítem), metas mensuales, bonos
- **Nómina**: generación quincenal con `payroll_records` y `payroll_adjustments`
- **Novedades**: ausencias, permisos, incapacidades, vacaciones con saldo anual

## Módulos Verticales
- **Inmobiliaria**: propiedades, leads CRM, contratos, pagos de arriendo, multimedia
- **Tapicería/WorkOrders**: órdenes de trabajo con materiales, pagos parciales, fotos entrada/salida
- **Cargos personalizados**: el tenant crea sus propios cargos con permisos RBAC

## IA y Comunicaciones
- **Agente IA (Fase 1)**: RAG + function calling con Claude API
- **Agente IA (Fase 2)**: WhatsApp con Evolution API v2 (webhook + respuestas)
- **ChatWidget**: chat en storefront público

## Categorías (CRUD completo)
- Edición inline con color picker
- Toggle visibilidad (is_active) sin eliminar
- Sort order configurable
- Delete con validación (bloquea si tiene productos activos)

## Infraestructura
- **Offline-first**: ventas y compras con campo `synced` para subida diferida
- **RBAC granular**: permisos por cargo (employee_cargos.permissions JSON)
- **Encriptación AES-256**: campos PII (phone, cedula, address) en users y storefront_orders
- **Refresh tokens**: rotación segura de JWT (tabla `refresh_tokens`)
- **Audit log**: trazabilidad con severity levels

## Multi-API Key + cifrado en reposo para Agente IA (2026-06-15)

- **3 campos separados** en Integraciones del superadmin: Gemini / OpenAI / Groq, cada uno con su toggle show/hide y badge "Configurado".
- **Selector de proveedor default**: 3 botones con iconos (Sparkles/Brain/Cpu) — el agente usa este proveedor para todas las respuestas.
- **Cifrado AES-256-CBC en reposo**: las API keys se cifran al guardarse en `platform_settings` y se descifran al leerse.
- **`getAIKeys()`**: nueva función que devuelve las 3 keys + provider default con fallback a env vars.
- **Routing explícito por provider**: Gemini → `callGeminiWithTools()` (function calling), OpenAI → `callOpenAI()`, Groq → `callGroq()`.
- **Entorno**: `.env` con OpenAI key; `.env.example` con las 3 nuevas vars; docker-compose actualizados.

---

← [[current-state]] | [[DAIMUZ]] | → [[lessons-learned]]
