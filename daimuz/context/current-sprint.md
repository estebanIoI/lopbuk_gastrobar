# Sprint / Foco Actual

> Actualiza este archivo al inicio de cada sesion de trabajo.

## Sprint activo: Junio 2026

### ✅ Completado [2026-06-12]: Sprint 5 — Centro de Pedidos v2 + TenantManagement

| Sprint | Estado | Descripción |
|---|---|---|
| Sprint 5a — TenantManagement | ✅ Completo | DropdownMenu acciones con labels, eliminar, editar slug, trial configurable con días |
| Sprint 5b — Kanban + Bulk | ✅ Completo | KanbanView con @dnd-kit, acciones masivas, bulk toolbar flotante |
| Sprint 5c — Quick wins SLA | ✅ Completo | Banner alerta, priority chips, filtro comercio, border-l-4, antigüedad coloreada |
| Sprint 5d — Asignación rápida | ✅ Completo | Drawer muestra repartidores del tenant, asigna por driverId directo |

**Archivos clave:**
- `frontend/components/superadmin/shared/KanbanView.tsx` (nuevo — @dnd-kit)
- `frontend/components/superadmin/hooks/useOrders.ts` (expandido — bulk, drivers, kanban, priorityStats)
- `frontend/components/superadmin/tabs/OrdersCenterTab.tsx` (reescrito)
- `frontend/components/tenant-management.tsx` (mejorado — DropdownMenu, delete, slug, trial days)
- `backend/src/modules/orders/superadmin-orders.routes.ts` (3 endpoints nuevos, assign con assigneeId)
- `backend/src/modules/tenants/tenants.service.ts` (update acepta slug; activateTrial acepta days)
- Dep nueva: `@dnd-kit/core` + `@dnd-kit/utilities` (instalado con pnpm, npm da error en este proyecto)

### ✅ Completado [2026-06-12]: Panel Superadmin Modular (Sprints 0-4)

| Sprint | Estado | Descripción |
|---|---|---|
| Sprint 0 — Refactor monolito | ✅ Completo | 3444 líneas → 25 archivos, arquitectura hook+tab |
| Sprint 2 — Centro de Pedidos | ✅ Completo | Bandeja cross-tenant, SSE, state machine, drawer |
| Sprint 3 — Wizard + Papelera | ✅ Completo | Wizard 4 pasos, soft-delete, restore tenants |
| Sprint 4 — Analytics + SSE | ✅ Completo | KPIs plataforma, heatmap 7×24, SSE reemplaza polling |

**Archivos clave del resultado:**
- Backend: `superadmin-orders.routes.ts` (ahora 11 endpoints)
- Frontend: `frontend/components/superadmin/` (26 archivos tras Sprint 5)
- DB: `storefront_orders.assigned_to` (col) + `order_status_history` (tabla)

---

### ✅ Completado [2026-06-09]: Variantes + Precios por Volumen

### Estado Variantes

| Sprint | Estado | Proximo paso |
|---|---|---|
| DAIMUZ - Arquitectura disenada | Completo | En DAIMUZ |
| Sprint 1 - Schema DB | Pendiente | Migracion SQL |
| Sprint 2 - Backend | Pendiente | services + endpoints |
| Sprint 3 - Frontend POS + Storefront | Pendiente | selectores + precio dinamico |
| Sprint 4 - Panel Proveedor + Admin | Pendiente | vista proveedor + margenes |

### Sesion [2026-06-07] - Arquitectura Variantes en DAIMUZ
- **Modulo variants** -> `daimuz/modules/variants/variants.md` (completo + compressed.md)
- **Flujo** -> `daimuz/flows/variant-flow.md` (ciclo import -> storefront -> venta -> auditoria)
- **Sinapsis** -> `daimuz/synapses/variants-chain.md` (cadena impacto + matriz + flujo transaccional)
- **Plan definitivo** -> `daimuz/brain/variants-implementation-plan.md` (analisis critico, scorecard, roadmap 4 sprints)
- **Indexes**: modules-index (duplicados limpiados), db-tables-index (3 tablas nuevas + ALTERs), endpoints-index (endpoints variants + tiers + import + suppliers)
- **Governance**: universal-constraints.md con reglas de stock atomico, price tiers (min_qty solo), congelacion en ventas, inventory_movements como fuente de verdad
- **Ontologia**: entities.md con ProductVariant, VariantPriceTier, Supplier, SupplierProduct, InventoryMovement
- **Pending**: consolidado en 1 entrada con 4 sprints + migracion legacy
- **Scorecard**: diseno actual 9.4/10, plan 9.8/10 vs mejores practicas SaaS
- Pendiente: ejecutar migracion SQL, codificar services, endpoints, frontend

### Sesión [2026-06-09] — Integración análisis crítico externo + corrección de inconsistencias

- **Análisis externo integrado**: propuesta original (8.0/10) → crítica refinada (9.6/10) → DAIMUZ ya estaba en 9.4/10 → confirmado y corregido a 9.8/10
- ✅ **`variants-implementation-plan.md`**: `variant_price_tiers` ahora incluye `tenant_id` en DDL (antes solo en nota); unificado `attribute_1/2` → `color`/`size`/`material`; timestamps explícitos
- ✅ **`db-tables-index.md`**: `product_variants` ahora incluye `reserved_stock`, `min_stock`, `images`, `sort_order`; `platform_margin_pct` → `tenant_margin_pct`; `supplier_products` con timestamps
- ✅ **Estado confirmado**: race conditions, min_qty sin gaps, cost_price, inventory_movements, price freezing — TODO ya estaba en DAIMUZ antes de este análisis
- Pendiente: ejecutar migraciones SQL, codificar services, endpoints, frontend (Sprints 1-4)

### Sesión [2026-06-07] — Plan variants consolidado en DAIMUZ (ronda 2)
- ✅ **Módulo variants**: `daimuz/modules/variants/variants.md` + `compressed.md` creados
- ✅ **Synapse**: `daimuz/synapses/variants-chain.md` con flujo variante → venta → stock atómico
- ✅ **Ontología limpiada**: entidades duplicadas (ProductVariant x3, PriceTier x4) consolidadas en 10 entidades únicas
- ✅ **db-tables-index**: esquemas completos de `product_variants`, `variant_price_tiers`, `suppliers`, `supplier_products`
- ✅ **files-index**: variants + suppliers services + frontend components agregados
- ✅ **endpoints-index**: variantes consolidado en una sola sección (eliminados 3 duplicados)
- ✅ **Arquitectura**: min_qty sin gaps, UPDATE atómico `WHERE stock >= ?`, congelar precios en sale_items, cost_price para margen real

### Sesiones anteriores (IA Agent)

| Fase | Estado |
|---|---|
| Fase 1 - RAG + Function Calling | Completo |
| Fase 2 - WhatsApp (Evolution API) | Completo |
| Fase 3 - Voz IA (Vapi) | Pendiente |
| Fase 4 - Panel Admin del Agente | Pendiente |

---

## Template para nueva sesion

```markdown
## [YYYY-MM-DD]

### Objetivo de hoy
[que quiero lograr]

### Archivos que voy a tocar
- [archivo 1]
- [archivo 2]

### Resultado
[que logre al final]
```

---

[[context/pending]] | [[DAIMUZ]] | -> [[context/environment]]
