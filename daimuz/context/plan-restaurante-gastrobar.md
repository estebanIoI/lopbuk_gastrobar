# Plan de Integración · Requerimientos Restaurante / GastroBar

> **Estado:** plan de integración, pendiente de aprobación. No implementar hasta validar.
> **Método:** igual que el resto de la sesión — auditar lo existente, reutilizar quirúrgicamente,
> ser honesto con el alcance. Estos módulos tocan sistemas **vivos y críticos** (POS RestBar,
> caja, mesas), así que cada fase debe ser aditiva y reversible.

---

## 0. Hallazgo de auditoría (qué YA existe)

| Requerimiento | Estado real en el código | Evidencia |
|---|---|---|
| **M1 · Unir mesas** | **Parcial** — el tag de grupo existe, la orden unificada NO | `rb_tables.merge_group` + rutas QR que setean/limpian `merge_group`. Pero cada mesa conserva su orden → es justo la queja del comerciante |
| **M2 · Usuarios vs Empleados** | **Casi completo** | Enum de roles ya distingue `mesero/cajero/cocinero/bartender/administrador_rb/...`; existen `employee_cargos`, `vendedores`, `cargos` |
| **M3 · Historial laboral** | **Piezas existen, falta la vista** | `employee_novelties`, `payroll_records`, `payroll_adjustments`, `cash_sessions` (apertura/cierre por usuario). Falta agregarlos en una "hoja de vida laboral" |
| **M4 · Tiqueteras (Meal Pass)** | **NO existe** — build nuevo real | sin tablas `meal_pass/tiquetera/convenio`, sin módulo |
| **M5 · Botón eliminar POS** | Existe, mal ubicado | `Trash2` ya en PosShell; es reposicionar UI |
| **M6 · Cierre enriquecido (libro de ventas)** | **Base existe, falta el libro** | `cashSessionsService.closeSession()` ya calcula totales; falta el desglose por producto del turno |
| **M7 · Adicionales/descuentos por empleado en cierre** | **YA EXISTE** | cash-sessions.service:597 "Bonos/descuentos por empleado del turno (reemplaza los previos del cierre)" |

**Conclusión:** de los 7 módulos, solo **M4 (Tiqueteras)** es realmente nuevo de punta a punta.
M1 y M6 son extensiones sobre base existente; M2/M3/M7 son mayormente conexión y superficie de UI.

---

## 1. Los 5 componentes → estrategia quirúrgica

### Componente A · Smart Tables (M1)
**Gap real:** hoy `merge_group` agrupa mesas pero mantiene N órdenes; el mesero elige a cuál agregar.
**Objetivo:** una **Mesa General** = UNA orden que absorbe las de las mesas unidas.

Estrategia (aditiva, sin romper el merge actual):
- Al unir: elegir/crear una `rb_orders` "principal" del grupo y **mover** los `rb_order_items` de las
  demás órdenes a ella (`UPDATE rb_order_items SET order_id = principal`). Las mesas quedan con
  `merge_group` y sin orden propia activa. Nuevos ítems entran siempre a la orden principal.
- Al desunir: repartir los ítems de vuelta según la mesa/comensal de origen. Requiere marcar el
  `origin_table_id` en cada ítem movido (columna nueva nullable) para poder revertir sin perder nada.
- **Riesgo:** ALTO — toca el corazón del POS RestBar. Debe ir con snapshot antes de mover y ser
  100% reversible. Las animaciones (fusión/explosión) son capa visual encima, no bloquean la lógica.

Columna nueva: `rb_order_items.origin_table_id VARCHAR(36) NULL` (para desunir sin ambigüedad).

### Componente B · Employee Management (M2 + M3 + M7)
**M7 ya existe** (bonos/descuentos por turno en el cierre). Falta:
- **M3 — Hoja de vida laboral:** una vista/servicio que agrega por empleado y mes: sesiones de caja
  donde abrió/cerró (`cash_sessions.opened_by/closed_by`), turnos, `employee_novelties`,
  adicionales/descuentos del cierre, total ganado. **Solo lectura + agregación**, sin tablas nuevas.
- **M2 — Separación conceptual:** ya está en datos (roles + tablas de empleado). Es sobre todo
  organización de UI: no mezclar "clientes/consumidores" con "empleados" en las mismas pantallas.
- **Riesgo:** BAJO — casi todo es query de agregación y reorganización de UI.

### Componente C · Meal Pass / Tiqueteras (M4)
**El build nuevo.** Modelo mínimo:

```sql
CREATE TABLE meal_passes (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  document VARCHAR(50) NULL,
  phone VARCHAR(50) NULL,
  convenio VARCHAR(160) NULL,          -- convenio / empresa
  empresa VARCHAR(160) NULL,
  total_meals INT NOT NULL DEFAULT 0,  -- comprados (histórico de recargas)
  remaining INT NOT NULL DEFAULT 0,    -- saldo restante
  purchased_at DATE NULL,
  expires_at DATE NULL,
  status ENUM('activa','agotada','vencida','anulada') NOT NULL DEFAULT 'activa',
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mp_tenant (tenant_id, status),
  INDEX idx_mp_doc (tenant_id, document),
  INDEX idx_mp_phone (tenant_id, phone)
);

CREATE TABLE meal_pass_movements (
  id VARCHAR(36) PRIMARY KEY,
  meal_pass_id VARCHAR(36) NOT NULL,
  type ENUM('recarga','consumo','ajuste','anulacion') NOT NULL,
  meals INT NOT NULL,                  -- + recarga / − consumo
  balance_after INT NOT NULL,
  order_id VARCHAR(36) NULL,           -- rb_orders del consumo
  order_item_id VARCHAR(36) NULL,      -- ítem específico descontado
  table_number VARCHAR(20) NULL,
  employee_id VARCHAR(36) NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mpm_pass (meal_pass_id, created_at)
);
```

Funciones: CRUD tiquetera, búsqueda rápida (nombre/documento/teléfono/convenio/empresa), recarga,
saldo, historial de consumos. Cada consumo es un `meal_pass_movements type='consumo'` que decrementa
`remaining` transaccionalmente (con guardas: no consumir de una vencida/agotada).

### Componente D · Smart Checkout (M4 en el POS)
**La parte más delicada de M4** — asignar ítems a tiquetera vs pago normal en el cobro.

Estrategia sin romper el checkout RestBar:
- Cada `rb_order_items` gana `meal_pass_id VARCHAR(36) NULL` (columna nueva). Un ítem asignado a
  tiquetera NO suma al total en efectivo; se descuenta como consumo al cobrar.
- Los tres casos del spec (un ítem, algunos ítems, toda la mesa) = distintas selecciones de ítems a
  marcar con `meal_pass_id` antes de cobrar. UI: botón "Asignar a tiquetera" por ítem + "toda la mesa".
- Al cobrar: los ítems con `meal_pass_id` generan movimientos de consumo (1 almuerzo por ítem-almuerzo)
  y se restan del total; el resto va a pago normal. El resumen del cobro muestra las dos columnas
  (pagado vs descontado de tiquetera), como en el spec.
- **Excedentes/adicionales** (aguacate extra) simplemente quedan como ítems de pago normal — ya lo son
  por defecto (sin `meal_pass_id`).
- **Riesgo:** ALTO — modifica el cálculo del cobro. Requiere que un ítem-almuerzo sepa que "vale 1
  cupo". Definir qué productos son "almuerzo" (flag `is_meal` en products o categoría).

Columnas nuevas: `rb_order_items.meal_pass_id`, `products.is_meal TINYINT DEFAULT 0`.

### Componente E · Advanced Cash Closing (M6)
Extender `closeSession()` para incluir el **libro de ventas del turno**: agregación de `sale_items`
(y/o `rb_order_items` cobrados) entre `opened_at` y `closed_at`, agrupado por producto con cantidad
y valor. Se guarda como parte del snapshot del cierre para poder consultarlo después ("busco
aguacate en el cierre del martes → 5 vendidos"). **Aditivo**: no cambia el cálculo de totales, solo
añade el desglose al payload/registro del cierre.

Posible columna: `cash_sessions.sales_book JSON NULL` (snapshot del libro al cerrar).

---

## 2. Orden de implementación recomendado

Priorizo por **valor × (1/riesgo)** y por lo que desbloquea pruebas reales pronto:

| Fase | Componente | Por qué primero | Riesgo |
|---|---|---|---|
| **F1** | **E · Cierre enriquecido (M6)** | Alto valor, aditivo puro, no toca flujos de escritura | Bajo |
| **F2** | **B · Hoja de vida laboral (M3) + M2** | Casi todo existe; es agregación + UI | Bajo |
| **F3** | **M5 · Reposicionar botón eliminar** | Trivial, mejora percibida inmediata | Muy bajo |
| **F4** | **C · Meal Pass CRUD (M4 backend)** | El módulo nuevo; se puede construir y probar aislado del POS | Medio |
| **F5** | **D · Smart Checkout (M4 en POS)** | Depende de F4; es la pieza más delicada | **Alto** |
| **F6** | **A · Smart Tables / Mesa General (M1)** | La más invasiva sobre el POS vivo; va al final, con red de reversión | **Alto** |

**Arranque sugerido:** F1 (cierre enriquecido) — entrega valor visible sin tocar nada crítico, y
sirve de calentamiento sobre el módulo de caja antes de las fases riesgosas.

---

## 3. Riesgos transversales

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | M1 y D/F5 tocan el POS RestBar en producción (donde acabamos de arreglar el KDS) | Columnas nuevas siempre nullable; el flujo actual sigue intacto si no se usa la feature; snapshot antes de mover ítems |
| R2 | Consumo de tiquetera con doble descuento (red/reintento) | Movimientos transaccionales con `balance_after`; idempotencia por `order_item_id` |
| R3 | Definir "qué es un almuerzo" para descontar cupos | Flag explícito `products.is_meal`; sin flag, no descuenta (falla seguro) |
| R4 | Desunir mesas y perder la asociación de pedidos | `origin_table_id` por ítem; sin él no se permite desunir con ambigüedad |
| R5 | **Drift de migraciones activo** | Igual que todo lo demás: tablas nuevas por catch-up idempotente; ver [[plan-migration-drift-loyalty]] antes de un deploy limpio |

---

## 4. Lo que este plan NO promete

- **Animaciones "épicas" de fusión de mesas**: son capa visual; se entregan después de que la
  lógica de Mesa General funcione y sea reversible. No bloquean el valor.
- **Reescribir el módulo de empleados**: M2/M3 reutilizan lo existente; no se rehace nómina.
- **M4 completo en una fase**: se parte en backend aislado (F4) y luego integración POS (F5), porque
  meter el cálculo de tiquetera en el cobro es lo más riesgoso de todo el paquete.

---

## 5. Resumen

Solo **Tiqueteras (M4)** es un módulo nuevo real; el resto son extensiones y conexiones sobre
sistemas que ya existen (`merge_group`, `cash_sessions`, `employee_novelties`, `payroll_records`,
roles). La integración quirúrgica es: **columnas nullable + servicios de agregación + una tabla
nueva para Meal Pass**, construidas con los mismos patrones probados esta sesión (aditivo,
reversible, catch-up idempotente, verificado contra BD real).

Empezando por **F1 (cierre enriquecido)**, se entrega valor sin tocar nada crítico, y se dejan las
dos fases de alto riesgo (Smart Checkout y Mesa General) para el final, con red de reversión.

---

**Relacionados:** [[plan-erp-manufactura]] (mismo método de integración quirúrgica) ·
[[plan-migration-drift-loyalty]] (bloqueo a resolver antes del deploy).
