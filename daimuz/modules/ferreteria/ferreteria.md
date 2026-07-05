# 🔩 Módulo: Ferretería

> Estado: **🟢 Sistema Operativo Logístico implementado (2026-07-05)** — rutas agrupadas,
> centro de operaciones en vivo, perfil empresarial del vehículo (SOAT/tecno/seguro/odómetro),
> gastos reales, alertas automáticas y analítica de rentabilidad. Detalle abajo en
> "Sistema Operativo Logístico". Pendientes originales de storefront/POS siguen en [[context/pending]].

## 🚛 Sistema Operativo Logístico (2026-07-05)

**DB (migraciones 0012/0013):** `dispatch_routes` (rutas agrupadas: vehículo+conductor+auxiliares,
estados planificada→cargando→en_ruta→retornando→cerrada) · `fleet_vehicle_expenses` (combustible/
peajes/repuestos con galones y odómetro) · `fleet_vehicles` + soat/tecno/seguro/odómetro/volumen/
mantenimiento-cada-km · `storefront_orders.route_id/route_sequence/sede_id` ·
`courier_availability.status` (disponible/en_ruta/descargando/almuerzo/fuera_turno/incapacidad) ·
`merchant_notifications` enum + `fleet_alert`.

**Backend** (`fleet/logistics.routes.ts`, montado bajo `/api/fleet` · `fleet/alerts.job.ts` diario):
- `GET /fleet/routes/suggestions` — agrupa pedidos pendientes por barrio/municipio, propone
  vehículo más ajustado o **sumar a ruta activa con capacidad** (el ahorro real), y # auxiliares por peso.
- `POST /fleet/routes` — crea ruta validando capacidad (sobrepeso → 400) + vincula paradas con secuencia.
- `PATCH /fleet/routes/:id/status` — **cascada** a pedidos (cargado/despachado/entregado) + vehículo
  en espejo + `order_status_history` + WhatsApp transaccional al cliente ("salió"/"entregado").
- `PATCH /fleet/routes/:id/stops/:orderId/delivered` — entrega por parada; la última **cierra la ruta
  y libera el vehículo** automáticamente (también desde el flujo del repartidor en delivery.routes).
- `GET /fleet/ops-board` — kanban con minutos de espera, vehículos con % de carga, personal con estado.
- `GET /fleet/analytics` — por vehículo: entregas, **facturación movilizada, costos reales, utilidad
  estimada, costo/entrega**; ranking de conductores (min/entrega); operación (tiempos promedio).
- `POST /fleet/expenses` (el conductor también puede) · `PUT /fleet/vehicles/:id/profile` ·
  `PUT /fleet/staff-status`.
- **Alertas diarias** → merchant_notifications: SOAT/tecno/seguro ≤15 días o vencidos, mantenimiento
  vencido por km, consumo >30% sobre el promedio de la flota. Dedupe por día.
- **Tiempo real**: `emitOps()` publica `dispatch-changed`/`staff-status-changed` en el canal
  Socket.io `ops:{tenantId}` existente (el pedido aparece al facturarse).

**Frontend** (`logistics-board.tsx`):
- `<LogisticsOps/>` en la pestaña **"🛰️ Centro"** de `dispatch-panel.tsx` (rol despachador):
  sugerencias de agrupación con un clic → modal crear ruta (vehículo/conductor/auxiliares),
  kanban con semáforo (verde/>30min ámbar/>60min rojo), rutas activas con avance de estado y
  paradas, vehículos con barra de carga, personal con selector de estado.
- `<FleetInsights/>` en la pestaña **"📊 Rentabilidad & Docs"** de `fleet-management.tsx`
  (comerciante): tabla de rentabilidad por vehículo, ranking de conductores, KPIs de operación
  (7/30/90 días), y por vehículo: documentos con vencimientos + registro/histórico de gastos.

**Verificado E2E 11/11** (HTTP real con JWT): sugerencia agrupa zona, sobrepeso rechazado, ruta
creada, cascada de estados + historial, cierre automático en última parada, gasto+odómetro,
alerta SOAT, analítica (300k movilizado − 80k combustible = 220k utilidad), tablero ops.

**Siguiente iteración:** GPS histórico por vehículo en mapa ops · optimización de orden de paradas ·
firma/foto como evidencia formal de entrega · sede origen con regla automática por zona · pedidos
web de ferretería con peso en carrito.

---

> Plan original (pre-implementación):
> Ver backlog: [[context/pending]]

## Qué hace

Extiende Lopbuk para ferreterías: inventario especializado (peso, dimensiones, calibre), flota de vehículos con asignación por peso, despacho en pista, y storefront con cálculo de peso y sugerencia de vehículo de entrega.

## Por qué

El comerciante de ferretería necesita gestionar inventario especializado, una flota de camiones con asignación por peso, control de despacho en pista, y domicilio con ubicación exacta en la tienda online.

## Bases ya disponibles (reusar)

- Productos con tipo `ferreteria` y campos: `dimensions`, `weight`, `caliber`, `resistance`, `finish`, `recommended_use`
- Módulo `delivery` con statuses completos
- `driver-panel.tsx` existente
- Rol `repartidor` existente
- Geolocalización en `storefront_orders`
- `billing-pos.tsx` con carrito completo
- `LocationPicker.tsx` y `ModalExito.tsx` en checkout

---

## Plan — 9 Fases

### FASE 1 — Base de Datos
- Tabla `fleet_vehicles`: `id, tenant_id, name, plate, type (planta|ligera|moto), max_weight_kg, status (disponible|en_ruta|mantenimiento|inactivo), notes`
- Tabla `fleet_maintenance`: `id, vehicle_id, tenant_id, type (preventivo|correctivo), description, scheduled_date, completed_date, cost, status`
- Tabla `fleet_vehicle_metrics`: pedidos_hoy, peso_transportado, km_recorridos
- Extender `storefront_orders`: `+vehicle_id, +dispatch_status (pendiente|en_pista|cargado|despachado|entregado), +total_weight_kg, +dispatch_notes, +dispatch_assigned_at, +dispatched_at`
- Extender `sales`: `+vehicle_id, +dispatch_status, +total_weight_kg`
- Nuevo rol: `despachador`

### FASE 2 — Backend: Módulo `fleet` (nuevo)
```
GET/POST/PUT/DELETE /api/fleet/vehicles      → CRUD vehículos
GET/POST/PUT        /api/fleet/maintenance   → CRUD mantenimientos
GET                 /api/fleet/metrics       → rendimiento por vehículo
PUT                 /api/fleet/assign        → asignar orden → vehículo
PUT                 /api/fleet/dispatch-status → cambiar estado despacho
```
- Lógica: `weightBasedAssignment(weight_kg) → vehicle_id`
  - Camión planta: > 500 kg
  - Camión ligero: 100–500 kg
  - Moto / domicilio: < 100 kg

### FASE 3 — Backend: Extensiones módulos existentes
- `orders`: calcular peso total al crear (sum `product.weight_kg × qty`)
- `sales`: misma lógica de peso en POS
- `delivery`: aceptar `vehicle_id` además de `driver_id`
- `products`: `weight_kg` requerido para tipo ferretería

### FASE 4 — Frontend: Panel Despachador (`dispatch-panel.tsx`)
- Visible para rol `despachador`
- Lista de órdenes agrupadas por estado de despacho
- Por orden: factura, peso total, vehículo asignado (auto o manual)
- Flujo: "En pista" → "Cargado" → "Despachado" (actualiza driver-panel)
- Puede reasignar vehículo antes de marcar salida

### FASE 5 — Frontend: Driver Panel (extensión)
- Ver pedido asignado con dirección + mapa
- Estados: "Esperando salida" → "En ruta" → marcar "Entregado"
- Historial del día por vehículo

### FASE 6 — Frontend: Inventario ferretería
- Formulario con `peso_kg` prominente y requerido
- Selector de unidades: kg, ton, lb (conversión automática a kg)
- Vista resumen: peso total del inventario disponible

### FASE 7 — Frontend: Storefront cliente
- Modal de producto: mostrar peso
- Carrito: peso acumulado visible
- Mínimo de compra configurable → activa domicilio
- Modal "¿Quieres domicilio?" al superar mínimo
- Reusar `LocationPicker` para capturar ubicación exacta
- Al confirmar: mostrar vehículo asignado estimado

### FASE 8 — Frontend: POS (`billing-pos.tsx`)
- Peso total del carrito en tiempo real
- Indicador visual de peso acumulado
- Auto-sugerir vehículo según peso
- Selector manual de vehículo
- Mostrar vehículo en el recibo/factura

### FASE 9 — Frontend: Gestión de Flota (panel comerciante)
- Sub-sección "Mi Flota" en panel del comerciante
- CRUD vehículos: tipo, capacidad, placa, estado
- Calendario de mantenimientos con alertas
- Dashboard: pedidos por vehículo, peso transportado, disponibilidad
- Mapa en tiempo real de vehículos en ruta
- Reportes: rendimiento mensual por vehículo

---

## Dependencias
- [[modules/delivery/delivery]] — reusar lógica de delivery
- [[modules/inventory/inventory]] — weight_kg en productos
- [[modules/orders/orders]] — cálculo de peso al crear orden
- [[modules/storefront/storefront]] — checkout con peso y vehículo

---

← [[DAIMUZ]] | → [[context/pending]]
