# ⏳ Backlog — Pendientes

> Actualiza según prioridades. P1 = crítico, P2 = importante, P3 = mejora.

## 🔴 P1 — Crítico

### Variantes + Precios por Volumen + Proveedores

Arquitectura completa en [[brain/variants-and-suppliers]]. Decisiones formales en [[decisions/variant-architecture]].

> **✅ Estado real (2026-06-18, integración completa):** el sistema de variantes está **implementado, integrado y auditado** (full-stack desde 2026-06-09; storefront + selección dinámica + reserva atómica + preventa + asiento + cupo desde 2026-06-18). Cerrado en esta sesión:
> - [x] **Asiento al confirmar** (pedido→venta): para variantes descuenta `product_variants.stock`, libera la reserva y congela `variant_id`/costo/margen en `sale_items` (`variants.service.settleVariantForSale`).
> - [x] **Reserva en flujos de pasarela** (MP/ADDI/Sistecrédito): reservan variante y persisten `variant_id`; liberan en sus webhooks de rechazo + `cancel-gateway`.
> - [x] **Columna `variant_id` en `storefront_order_items`** + columnas congeladas en `sale_items` (migración idempotente en `index.ts`).
> - [x] **Cupo máximo de preventa por variante** (`product_variants.preorder_limit` + `preorder_count`): enforce atómico en la reserva; campo en `variant-manager`.
> - tsc backend + frontend: **0 errores totales**.
>
> **Solo queda (operativo):**
> - [ ] Ejecutar el arranque del backend (corre las migraciones idempotentes) + cargar el producto AnMarg (`imports/anmarg-camiseta-clasica/`).
> - [ ] **Deploy en Komodo**.

**Sprint 1 — Schema DB:**
- [ ] Migración: `CREATE TABLE product_variants` (tenant_id, product_id, sku UNIQUE, barcode, color, size, stock, reserved_stock, cost_price, price_override, supplier_id, is_active)
- [ ] Migración: `CREATE TABLE variant_price_tiers` (tenant_id, variant_id, min_qty, price, tenant_margin_pct, is_active)
- [ ] Migración: `CREATE TABLE inventory_movements` (tenant_id, variant_id, product_id, type, quantity, reason, cost, reference_type, reference_id, created_by)
- [ ] Migración: `ALTER TABLE sale_items ADD COLUMN` frozen columns (variant_id, frozen_product_name, frozen_sku, frozen_cost, frozen_margin_pct, frozen_margin_amount)
- [ ] Migración: `ALTER TABLE order_items ADD COLUMN` frozen columns (mismo esquema)
- [ ] Migración: `ALTER TABLE storefront_order_items ADD COLUMN` frozen columns (mismo esquema)
- [ ] Migración de datos: productos existentes con color/talla → crear variante base automática
- [ ] Migración: crear tier base (min_qty=1) para cada variante con precio actual
- [ ] Feature flag: `variants_enabled` en tenant para rollout controlado
- [ ] Índices: `(product_id, tenant_id)`, `(tenant_id, sku)` UNIQUE, `(variant_id, min_qty)`

**Sprint 2 — Backend (todos con tenant_id, AppError, { success, data }):**
- [ ] `variants.service.ts` — findByProduct, findById, create (valida SKU único), update, softDelete
- [ ] `variants.service.ts` — `adjustStock(variantId, qty, reason, tenantId)`: UPDATE atómico `SET stock = stock - ? WHERE id = ? AND stock >= ?` + verificar affectedRows + INSERT inventory_movement
- [ ] `variants.controller.ts` + `variants.routes.ts` — GET/POST/PUT/DELETE + PATCH /:id/stock
- [ ] `price-tier.service.ts` — `resolvePrice(variantId, qty, tenantId)`: `SELECT ... WHERE min_qty <= ? ORDER BY min_qty DESC LIMIT 1` + fallback a price_override/base_price
- [ ] `price-tier.service.ts` — setTiers (reemplazo atómico), deleteTier
- [ ] Endpoints tiers: GET /:id/price-tiers, POST /:id/price-tiers, DELETE /price-tiers/:id, POST /resolve-price
- [ ] `import.service.ts` — CSV con formato Handle | ProductName | Color | Size | SKU | Stock | CostPrice. Agrupa por Handle, upsert product + bulk insert variants
- [ ] Refactor `products.service.ts` — migrar columnas color/size/stock/cost legacy
- [ ] Refactor `sales.service.ts` — createSale() usa variants si variant_id presente, stock atómico
- [ ] Refactor `storefront.routes.ts` — queries con variants + price tiers
- [ ] Refactor `inventory.service.ts` — soporte inventory_movements
- [ ] Registrar rutas en `modules/index.ts`

**Sprint 3 — Frontend POS + Storefront:**
- [ ] `variant-selector.tsx` — chips color/talla después de elegir producto en POS
- [ ] POS: actualizar precio automático al cambiar cantidad (resolvePrice)
- [ ] Storefront: mostrar variantes con `stock - reserved_stock > 0`
- [ ] Storefront: chips de color seleccionables con disponibilidad visual
- [ ] Storefront: badge automático "Mejor precio desde N uds."
- [ ] Storefront: recalcular precio en tiempo real al cambiar cantidad
- [ ] `price-tier-manager.tsx` — admin puede crear/editar/eliminar tiers por variante
- [ ] `lib/types.ts` — Variant, PriceTier interfaces
- [ ] `lib/api.ts` — métodos para variants + tiers
- [ ] `lib/store.ts` — variant state en Zustand

**Sprint 4 — Panel Proveedor + Admin:**
- [ ] Vista proveedor: productos activos, stock por variante, ventas generadas
- [ ] Admin: configurar margen (tenant_margin_pct) por tier
- [ ] Panel de importación CSV en frontend
- [ ] Reportes: utilidad real por producto (price - cost_price)
- [ ] Dashboard: KPIs por variante (más vendido por color/talla)

**Migración legacy:**
- [ ] Productos existentes con color/talla → crear variantes automáticamente
- [ ] Migrar `stock_movements` legacy a `inventory_movements` donde corresponda
- [ ] Remover columnas obsoletas de products (después de validar que nada las usa)

### Infraestructura
- [ ] Configurar Evolution API en Dokploy y conectar con backend
  - Crear servicio Compose en Dokploy → repo devalexcode/shell-evolution-api
  - Completar `.env` backend: EVOLUTION_API_URL, EVOLUTION_API_KEY, API_BASE_URL

## 🟡 P2 — Importante

### Agente IA
- [ ] **Fase 3 — Voz IA (Vapi)**
  - Crear `backend/src/modules/voice/vapi.routes.ts`
  - Crear `backend/src/modules/voice/vapi.service.ts`
  - Migración SQL: voice_enabled, vapi_phone_id, vapi_assistant_id en chatbot_config
  - Agregar VAPI_API_KEY al .env
  - Registrar ruta en index.ts

- [ ] **Fase 4 — Panel Admin del Agente**
  - `frontend/app/agente/page.tsx` con tabs
  - `AgentConfig.tsx` — configuración web / WhatsApp / voz
  - `AgentConversations.tsx` — sesiones + botón "Tomar control"
  - `AgentActions.tsx` — historial de tool calls
  - `AgentAnalytics.tsx` — KPIs 30 días

### Otros módulos
- [ ] **Módulo Ferretería** — plan completo de 9 fases acordado → ver [[modules/ferreteria/ferreteria]]
  - Fase 1: DB (fleet_vehicles, fleet_maintenance, extensiones storefront_orders y sales)
  - Fase 2: Backend módulo `fleet` con asignación por peso
  - Fases 3–9: frontend (panel despachador, driver, inventario, storefront, POS, gestión flota)
- [ ] Completar flujos del módulo inmobiliaria
- [ ] Mejorar UX del módulo tapicería/workorders

## 🟢 P3 — Mejoras

- [ ] **Fase 5 — n8n automatizaciones**
  - Confirmaciones automáticas de reserva por WhatsApp
  - Cobros automáticos a créditos vencidos
  - Seguimiento de leads no convertidos
- [ ] Exportación avanzada de reportes (Excel nativo)
- [ ] Notificaciones push para pedidos nuevos
- [ ] Dashboard de superadmin con métricas globales SaaS
- [ ] Sistema de onboarding interactivo por tipo de negocio

## 💡 Ideas / Futuro

- [ ] **Fase 6 — Gemini Live + Qdrant** (voz en tiempo real por WebSocket)
- [ ] Integración con contabilidad (Siigo, Alegra)
- [x] ~~Módulo de nómina básica~~ → **YA EXISTE**: módulo `vendedores` con comisiones, metas y `payroll_records`
- [ ] App cliente nativa (iOS/Android)
- [ ] Integración con plataformas de delivery (Rappi, iFood)
- [ ] Plataforma SaaS de agentes IA para vender como servicio mensual

---

← [[context/current-sprint]] | [[DAIMUZ]] | → [[context/environment]]
