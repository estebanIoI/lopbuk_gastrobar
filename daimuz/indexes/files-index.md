# 📁 Files Index — Mapa de Archivos Críticos

> Encuentra cualquier archivo en segundos. Ruta relativa desde la raíz del proyecto.

## Backend — `backend/src/` completo

```
backend/src/
├── index.ts                            ← startServer(), registra todas las rutas
├── common/
│   ├── middleware/
│   │   ├── auth.middleware.ts           ← verifyToken, requireRole, authorize
│   │   └── error.middleware.ts          ← AppError handler global
│   └── types/index.ts                  ← tipos compartidos (UserRole, etc.)
├── config/
│   ├── database.ts                     ← Pool MySQL con mysql2/promise
│   └── env.ts                          ← variables de entorno tipadas
├── utils/
│   ├── audit-logger.ts                 ← escribe en audit_log (acción + severity)
│   ├── crypto.ts                       ← AES-256-CBC cifrado PII (phone, cedula, address)
│   ├── formatters.ts                   ← helpers de formato (fechas, moneda)
│   ├── migrate-encrypt.ts              ← migración idempotente de datos no cifrados
│   ├── permissions.ts                  ← RBAC: verifica permisos del cargo
│   └── validators.ts                   ← validaciones de entrada
└── modules/
    ├── auth/
    │   ├── auth.routes.ts
    │   ├── auth.controller.ts
    │   └── auth.service.ts              ← login, google OAuth, JWT, refresh tokens
    ├── users/
    │   ├── users.routes.ts
    │   ├── users.controller.ts
    │   └── users.service.ts             ← CRUD usuarios del tenant + cambio rol
    ├── tenants/
    │   ├── tenants.routes.ts
    │   └── tenants.service.ts           ← CRUD + módulos activables por tenant
    ├── sedes/
    │   └── sedes.routes.ts              ← CRUD de sucursales del tenant
    ├── cargos/
    │   ├── cargos.routes.ts
    │   ├── cargos.controller.ts
    │   └── cargos.service.ts            ← cargos personalizados (FK users.cargo_id)
    ├── dashboard/
    │   ├── dashboard.routes.ts
    │   ├── dashboard.controller.ts
    │   └── dashboard.service.ts         ← KPIs: ventas, stock, pedidos
    ├── products/
    │   ├── products.routes.ts
    │   ├── products.controller.ts
    │   └── products.service.ts          ← CRUD producto base + bulk + barcode
    ├── customers/
    │   ├── customers.routes.ts
    │   ├── customers.controller.ts
    │   └── customers.service.ts         ← CRM + historial de compras
    ├── credits/
    │   ├── credits.routes.ts
    │   ├── credits.controller.ts
    │   └── credits.service.ts           ← fiados + abonos parciales
    ├── finances/
    │   ├── finances.routes.ts
    │   ├── finances.controller.ts
    │   └── finances.service.ts          ← ingresos/egresos, P&L, presupuestos
    ├── coupons/
    │   └── coupons.routes.ts            ← CRUD cupones de descuento por tenant
    ├── reviews/
    │   ├── reviews.routes.ts
    │   ├── reviews.controller.ts
    │   └── reviews.service.ts           ← reseñas storefront (moderar: aprobar/rechazar)
    ├── gastrobar-ops/
    │   ├── gastrobar.routes.ts
    │   └── gastrobar.service.ts         ← modoDueno, foodCost, purchaseSuggestions
    ├── restbar/
    │   ├── restbar.routes.ts
    │   ├── restbar.controller.ts
    │   ├── restbar.service.ts           ← mesas, comandas, pagos + división cuenta
    │   ├── restbar.finanzas.routes.ts   ← tracker financiero (13 endpoints, solo admin)
    │   ├── reservations.routes.ts
    │   └── reservations.service.ts      ← reservas online con WhatsApp notify
    ├── recipes/
    │   ├── recipes.routes.ts
    │   ├── recipes.controller.ts
    │   └── recipes.service.ts           ← CRUD recetas + calculateCost (BOM)
    ├── merma/
    │   ├── merma.routes.ts
    │   ├── merma.controller.ts
    │   └── merma.service.ts             ← registrar merma + PAR levels
    ├── orders/
    │   ├── orders.routes.ts             ← pedidos mesa/delivery + socket.emit a cocina
    │   └── superadmin-orders.routes.ts  ← 8 endpoints cross-tenant (pedidos + SSE + analytics + heatmap)
    ├── variants/
    │   ├── variants.routes.ts           ← CRUD variantes + price tiers + import
    │   ├── variants.controller.ts
    │   ├── variants.service.ts          ← CRUD variantes, descuento atómico de stock
    │   ├── price-tier.service.ts        ← resolvePrice(variantId, qty, tenantId)
    │   └── import.service.ts            ← CSV con Handle → product + variant bulk insert
    ├── suppliers/
    │   ├── suppliers.routes.ts          ← CRUD proveedores + asociar productos
    │   ├── suppliers.controller.ts
    │   └── suppliers.service.ts
    ├── scanner/
    ├── delivery/
    │   └── delivery.routes.ts           ← asignar conductor, actualizar estado pedido
    ├── fleet/
    │   └── fleet.routes.ts              ← CRUD vehículos, mantenimientos
    ├── storefront/
    │   └── storefront.routes.ts         ← tienda pública por slug (sin auth)
    ├── client/
    │   └── client.routes.ts             ← perfil cliente, direcciones, pedidos propios
    ├── services/
    │   ├── services.routes.ts
    │   ├── services.controller.ts
    │   └── services.service.ts          ← catálogo citas/asesorías + disponibilidad + bookings
    ├── portfolio/
    │   └── portfolio.routes.ts          ← config portafolio público DAIMUZ (singleton)
    ├── media-library/
    │   └── media-library.routes.ts      ← subida/lista/elimina imágenes en Cloudinary
    ├── chatbot/
    │   └── chatbot.routes.ts            ← config chatbot por tenant (superadmin activa)
    ├── agent/
    │   ├── agent.service.ts             ← orchestrator IA (Claude API)
    │   ├── agent.rag.ts                 ← búsqueda semántica (RAG)
    │   └── agent.tools.ts              ← function calling tools
    ├── whatsapp/
    │   ├── whatsapp.routes.ts
    │   └── whatsapp.service.ts          ← Evolution API v2 (envío/webhook)
    ├── vendedores/
    │   ├── vendedores.routes.ts
    │   ├── vendedores.controller.ts
    │   └── vendedores.service.ts        ← comisiones, metas, generación nómina quincenal
    ├── novedades/
    │   ├── novedades.routes.ts
    │   ├── novedades.controller.ts
    │   └── novedades.service.ts         ← ausencias, permisos, incapacidades, vacaciones
    ├── subscriptions/
    │   ├── subscriptions.routes.ts
    │   ├── subscriptions.controller.ts
    │   └── subscriptions.service.ts     ← planes SaaS + control acceso por módulo
    ├── stripe/
    │   ├── stripe.routes.ts
    │   ├── stripe.controller.ts
    │   └── stripe.service.ts            ← webhook Stripe + payment intents
    ├── dev-requests/
    │   ├── dev-requests.routes.ts
    │   ├── dev-requests.controller.ts
    │   └── dev-requests.service.ts      ← tenants solicitan features (CRM interno Lopbuk)
    ├── sync/
    │   ├── sync.routes.ts
    │   ├── sync.controller.ts
    │   └── sync.service.ts              ← sube ventas/compras offline (synced=0 → synced=1)
    ├── realestate/
    │   ├── realestate.routes.ts
    │   ├── realestate.controller.ts
    │   └── realestate.service.ts        ← propiedades, leads CRM, contratos, arriendo
    └── workorders/
        ├── workorders.routes.ts
        ├── workorders.controller.ts
        └── workorders.service.ts        ← órdenes tapicería con materiales y pagos parciales
```

## Frontend — `frontend/app/` y `frontend/components/` completos

### Rutas públicas — `app/`

```
app/
├── layout.tsx                          ← Root layout con providers
├── page.tsx                            ← Landing pública (homepage)
├── portfolio/
│   └── page.tsx                        ← Portafolio público de la marca DAIMUZ
├── links/[slug]/
│   └── page.tsx                        ← Tienda online pública del tenant (storefront)
├── menu/[slug]/
│   └── page.tsx                        ← Menú digital público del gastrobar (QR)
├── reservar/[slug]/
│   └── page.tsx                        ← Reservas online del restaurante (público)
├── inmobiliaria/[slug]/
│   └── page.tsx                        ← Portal inmobiliario público del tenant
├── s/[storeSlug]/[sectionSlug]/
│   └── page.tsx                        ← Secciones HTML personalizadas del storefront
└── scanner-remote/[sessionId]/
    └── page.tsx                        ← Escáner de barras remoto vía QR (móvil)
```

### Panel de administración — `components/`

```
components/

── LAYOUT / NAVEGACIÓN ──────────────────────────────────────────────────
├── main-layout.tsx                     ← Shell principal: sidebar + header + content
├── sidebar.tsx                         ← Menú lateral con navegación por módulo/rol
├── header.tsx                          ← Barra superior: usuario, notificaciones, tema
├── dashboard.tsx                       ← Panel principal con KPIs y acceso a módulos
├── settings.tsx                        ← Configuración del tenant (store_info, módulos)
├── AppGuide.tsx                        ← Tour de onboarding para nuevos usuarios
├── ProductTour.tsx                     ← Tour paso a paso de features específicos
├── dynamic-favicon.tsx                 ← Favicon dinámico según tenant/marca
├── analytics.tsx                       ← Panel de analíticas (gráficas avanzadas)
├── superadmin-home.tsx                 ← Home exclusivo del superadmin

── AUTH ─────────────────────────────────────────────────────────────────
├── auth-form.tsx                       ← Login / registro con email+password
├── google-oauth-wrapper.tsx            ← Botón Google OAuth
├── register-modal.tsx                  ← Modal de registro desde storefront
├── profile-modal.tsx                   ← Editar perfil del usuario logueado
├── preferences-modal.tsx               ← Preferencias de la cuenta

── POS / VENTAS ─────────────────────────────────────────────────────────
├── point-of-sale.tsx                   ← POS principal: carrito, búsqueda, cobro
├── billing-pos.tsx                     ← POS con facturación y datos fiscales
├── cajero-panel.tsx                    ← Panel cajero: caja, cobro mesa, división cuenta
├── cash-register.tsx                   ← Apertura/cierre de caja con arqueo
├── sales-history.tsx                   ← Historial de ventas con filtros y cancelación
├── fiado-checkout.tsx                  ← Checkout para ventas a crédito/fiado
├── fiados.tsx                          ← Gestión de fiados: cupo, historial, abonos
├── credits.tsx                         ← Vista de créditos pendientes (alias fiados)
├── invoicing.tsx                       ← Facturación electrónica / impresión
├── daily-closing-report.tsx            ← Reporte de cierre del día
├── accounting-report.tsx               ← Reporte contable / P&L

── INVENTARIO / PRODUCTOS ───────────────────────────────────────────────
├── inventory-list.tsx                  ← Inventario + Kardex + CRUD categorías
├── purchase-invoices.tsx               ← Facturas de compra a proveedores
├── variant-selector.tsx                ← Selector de variante en POS (color/talla)
├── volume-pricing.tsx                  ← Badge y tabla de precios escalonados
├── bulk-upload-dialog.tsx              ← Importación masiva de productos CSV
├── bulk-image-upload-dialog.tsx        ← Subida masiva de imágenes de productos
├── bulk-upload-customers-dialog.tsx    ← Importación masiva de clientes CSV
├── barcode-scanner.tsx                 ← Escáner código de barras (cámara local)
├── remote-scanner.tsx                  ← Escáner remoto controlado desde escritorio
├── sync-status-bar.tsx                 ← Indicador offline/online + ventas pendientes

── CLIENTES / CRM ───────────────────────────────────────────────────────
├── customers.tsx                       ← CRM: lista, historial compras, crédito
├── cupones.tsx                         ← CRUD cupones de descuento

── GASTROBAR ────────────────────────────────────────────────────────────
├── restbar.tsx                         ← Mesas, comandas, piso (tab Finanzas integrado)
├── restbar-finanzas.tsx                ← Tracker financiero (gastos, ingresos, P&L quincenal)
├── restbar-reservations.tsx            ← Reservas online: lista, confirmar, cancelar
├── gastrobar-ops.tsx                   ← Centro de mando: food cost, PAR, tendencias
├── recipes.tsx                         ← Recetas BOM: ingredientes, food cost real
├── merma.tsx                           ← Registro de merma con justificación
├── cocinero-panel.tsx                  ← Cola de cocina (Socket.io tiempo real)
├── bartender-panel.tsx                 ← Cola de barra (Socket.io tiempo real)
├── mesero-panel.tsx                    ← Toma de pedidos en mesa

── DELIVERY / LOGÍSTICA ─────────────────────────────────────────────────
├── pedidos.tsx                         ← Gestión de pedidos con estados y filtros
├── driver-panel.tsx                    ← Panel conductor: pedidos asignados, tracking
├── dispatch-panel.tsx                  ← Panel despachador: asignar vehículos, pistas
├── fleet-management.tsx                ← Gestión de flota: vehículos, mantenimientos
├── MiniMap.tsx                         ← Mapa mini para ubicación de entregas
├── OrdersMap.tsx                       ← Mapa de pedidos activos en tiempo real

── TIENDA ONLINE ────────────────────────────────────────────────────────
├── StoreBuilder.tsx                    ← Constructor visual de la tienda online
├── store-customization.tsx             ← Personalización: colores, banners, secciones
├── landing-page.tsx                    ← Página pública del negocio (hero, catálogo)
├── tienda.tsx                          ← Vista de tienda desde el panel admin
├── reviews-panel.tsx                   ← Moderación de reseñas de productos
├── about-modal.tsx                     ← Modal "Acerca de" del negocio
├── contact-modal.tsx                   ← Modal de contacto del negocio
├── data-policy-modal.tsx               ← Modal de política de datos

── CHECKOUT (subcarpeta) ────────────────────────────────────────────────
├── storefront/variant-picker.tsx       ← Chips de color/talla en tienda online
├── storefront/volume-pricing.tsx       ← Tabla de precios escalonados en product page
├── checkout/CheckoutView.tsx           ← Flujo completo de checkout de la tienda
├── checkout/LocationPicker.tsx         ← Selector de dirección en mapa
├── checkout/ModalExito.tsx             ← Modal confirmación pedido exitoso

── SERVICIOS / CITAS ────────────────────────────────────────────────────
├── services-management.tsx             ← CRUD de servicios/citas ofrecidos
├── service-booking-modal.tsx           ← Modal de reserva de cita (desde storefront)

── RRHH / NÓMINA ────────────────────────────────────────────────────────
├── vendedores-panel.tsx                ← Comisiones, metas, generación nómina
├── developer-requests.tsx             ← Solicitudes de features enviadas al equipo

── VERTICALES ───────────────────────────────────────────────────────────
├── realestate.tsx                      ← Módulo inmobiliaria: propiedades, leads, contratos
├── tapiceria.tsx                       ← Módulo tapicería: órdenes de trabajo

── ADMIN SaaS ───────────────────────────────────────────────────────────
├── superadmin/                         ← Panel superadmin modular (Sprint 0-4)
│   ├── SuperadminLayout.tsx            ← Shell: 9 tabs lazy-loaded, default 'pedidos'
│   ├── tabs/
│   │   ├── OrdersCenterTab.tsx         ← Centro pedidos: kanban/tabla, bulk, alertas SLA, filtro comercio, asignación rápida
│   │   ├── CommercesTab.tsx            ← Gestión comercios: wizard creación + papelera/restaurar
│   │   ├── AnalyticsTab.tsx            ← Dashboard analítica: KPIs + gráficas + heatmap
│   │   ├── LandingConfigTab.tsx        ← Config landing page pública
│   │   ├── FeaturedProductsTab.tsx     ← Productos destacados en landing
│   │   ├── IntegrationsTab.tsx         ← Config chatbot, asistente, WhatsApp, Stripe
│   │   ├── SubscriptionsTab.tsx        ← Gestión suscripciones SaaS
│   │   ├── PortfolioTab.tsx            ← Config portafolio DAIMUZ
│   │   └── DevRequestsTab.tsx          ← Solicitudes de features de tenants
│   ├── hooks/
│   │   ├── useOrders.ts                ← Estado bandeja + SSE + drawer + kanban + bulk selection + drivers
│   │   ├── useAnalytics.ts             ← KPIs plataforma + timeline + heatmap
│   │   ├── useTenantLifecycle.ts       ← Wizard 4-pasos + papelera + restore
│   │   ├── useCommerces.ts             ← Marketplace cards + toggle estado tenant
│   │   └── useIntegrations.ts          ← Config chatbot/asistente/WhatsApp/Stripe
│   └── shared/
│       ├── CommerceWizard.tsx          ← Wizard 4 pasos: Comercio → Plan → Propietario → Confirmar
│       └── KanbanView.tsx              ← Kanban 6 columnas con @dnd-kit drag & drop
├── tenant-management.tsx               ← (legacy) Superadmin: gestión de tenants
├── printers.tsx                        ← Config impresoras POS por tenant

── CHAT / IA ─────────────────────────────────────────────────────────────
└── ChatWidget.tsx                      ← Widget flotante del chatbot IA

── UI (shadcn/ui base) ──────────────────────────────────────────────────
ui/alert-dialog · badge · button · card · checkbox · dialog
ui/dropdown-menu · input · label · select · switch · table · tabs · textarea
ui/cloudinary-upload.tsx                ← Upload directo a Cloudinary
ui/animated-theme-toggler.tsx           ← Toggle dark/light mode animado
```

### Lib — `lib/`

```
lib/
├── api.ts              ← HTTP client: todos los métodos de la API (fetch wrapper tipado)
├── store.ts            ← Zustand global store (products, sales, inventory, categories…)
├── auth-store.ts       ← Estado de autenticación (user, token, logout)
├── types.ts            ← Tipos TypeScript compartidos del frontend
├── socket.ts           ← Socket.io client (pedidos, cocina, tiempo real)
├── modules.ts          ← Config de módulos activables (nombre, ícono, ruta, rol requerido)
├── product-config.ts   ← Presets de campos de producto por tipo de industria
└── utils.ts            ← Helpers: formato moneda/fecha, construcción URLs storefront
```

## Archivos de Configuración

```
raíz del proyecto/
├── CLAUDE.md                        ← Entry point para Claude Code → daimuz/
├── docker-compose.dev.yml           ← MySQL local en Docker
├── backend/
│   ├── .env                         ← Variables de entorno backend
│   ├── inventarioEsteban_v3_multitenant.sql  ← Script SQL completo para levantar desde 0
│   └── tsconfig.json
└── frontend/
    ├── .env.local                   ← Variables de entorno frontend
    ├── next.config.js
    └── tailwind.config.ts
```

---

← [[indexes/db-tables-index]] | [[DAIMUZ]]
