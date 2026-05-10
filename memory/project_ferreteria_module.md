---
name: Módulo Ferretería - Plan de implementación
description: Plan completo para el módulo de ferretería con flota de vehículos, despacho por peso, rol despachador y conductor, y extensiones de storefront/POS
type: project
---

Plan acordado para implementar el módulo de ferretería con flota vehicular.

**Why:** El comerciante de ferretería necesita gestionar inventario especializado, una flota de camiones con asignación por peso, control de despacho en pista, y domicilio con ubicación exacta en la tienda online.

**How to apply:** Implementar en 9 fases respetando la arquitectura multitenant existente. Reusar delivery module, driver-panel, y sistema de roles. No romper funcionalidad existente.

## Bases ya disponibles
- Productos con tipo `ferreteria` y campos: dimensions, weight, caliber, resistance, finish, recommended_use
- Módulo `delivery` con statuses: sin_asignar → asignado → recogido → en_camino → entregado
- `driver-panel.tsx` existente
- Rol `repartidor` existente
- Geolocalización en `storefront_orders`
- `billing-pos.tsx` con carrito completo
- `LocationPicker.tsx` y `ModalExito.tsx` en checkout

## Fases de implementación

### FASE 1: Base de datos
- Tabla `fleet_vehicles`: id, tenant_id, name, plate, type (planta|ligera|moto), max_weight_kg, status (disponible|en_ruta|mantenimiento|inactivo), notes
- Tabla `fleet_maintenance`: id, vehicle_id, tenant_id, type (preventivo|correctivo), description, scheduled_date, completed_date, cost, status
- Tabla `fleet_vehicle_metrics`: pedidos_hoy, peso_transportado, km_recorridos (calculado)
- Extensión `storefront_orders`: +vehicle_id, +dispatch_status (pendiente|en_pista|cargado|despachado|entregado), +total_weight_kg, +dispatch_notes, +dispatch_assigned_at, +dispatched_at
- Extensión `sales`: +vehicle_id, +dispatch_status, +total_weight_kg
- Extensión productos: confirmar weight_kg capturado para ferretería
- Nuevo rol: `despachador`

### FASE 2: Backend - Módulo fleet (nuevo)
- CRUD vehículos: GET/POST/PUT/DELETE /api/fleet/vehicles
- CRUD mantenimientos: GET/POST/PUT /api/fleet/maintenance
- Métricas: GET /api/fleet/metrics (rendimiento por vehículo)
- Asignación automática por peso: función weightBasedAssignment(weight_kg) → vehicle_id
  - Camión planta: max >500kg
  - Camión ligero: max 100-500kg
  - Moto/domicilio: max <100kg
- Endpoints despachador: PUT /api/fleet/assign (orden→vehículo), PUT /api/fleet/dispatch-status

### FASE 3: Backend - Extensiones módulos existentes
- Módulo `orders`: calcular peso total al crear orden (sum product.weight_kg * qty)
- Módulo `sales`: misma lógica de peso en POS
- Módulo `delivery`: aceptar vehicle_id además de driver_id
- Módulo `products`: weight_kg campo requerido para tipo ferretería

### FASE 4: Frontend - Panel Despachador (nuevo componente)
- Ruta: visible para rol `despachador`
- Vista: lista de órdenes agrupadas por estado de despacho
- Por orden: factura, peso total, vehículo asignado (auto o manual), botones de estado
- Estados en UI: "En pista" → "Cargado" → "Despachado" (marca salida al conductor)
- Puede reasignar vehículo antes de marcar salida
- Al marcar "Despachado": driver-panel del conductor se actualiza

### FASE 5: Frontend - Driver Panel (extensión)
- Ver pedido asignado con dirección + mapa
- Estado visible: "Esperando salida" → "En ruta" → marcar "Entregado"
- Reusar ModalExito o crear ModalEntregado
- Historial del día por vehículo

### FASE 6: Frontend - Inventario ferretería
- Formulario de producto con peso_kg prominente y requerido para tipo ferretería
- Selector de unidades: kg, ton, lb (conversión automática a kg)
- Vista resumen: peso total del inventario disponible

### FASE 7: Frontend - Storefront cliente
- Modal de producto: mostrar peso (en ferreterías)
- Carrito: mostrar peso acumulado
- Mínimo de compra configurable (por comerciante) para activar domicilio
- Cuando se alcanza el mínimo → modal "¿Quieres domicilio? Nuestra flota lo llevará"
- LocationPicker ya existe → reusar para capturar ubicación exacta
- Al confirmar pedido: mostrar vehículo asignado estimado

### FASE 8: Frontend - POS (billing-pos)
- Calcular peso total del carrito en tiempo real
- Indicador visual de peso acumulado
- Auto-sugerir vehículo según peso
- Selector manual de vehículo (dropdown con disponibles)
- Mostrar vehículo en el recibo/factura

### FASE 9: Frontend - Gestión de Flota (sección comerciante)
- Sub-sección en panel del comerciante: "Mi Flota"
- CRUD vehículos con tipo, capacidad, placa, estado
- Lista/calendario de mantenimientos con alertas de próximos
- Dashboard: pedidos por vehículo, peso transportado, disponibilidad
- Mapa en tiempo real de vehículos en ruta (usando geolocalización del pedido)
- Reportes: rendimiento mensual por vehículo
