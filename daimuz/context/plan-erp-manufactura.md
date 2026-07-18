# Plan Maestro · ERP de Manufactura Ligera (vertical inicial: tapicería)

> **Estado:** plan de arquitectura, pendiente de aprobación. No implementar hasta validar.
> **Tesis:** NO es un módulo nuevo desde cero. El ~70% ya existe en Lopbuk como piezas
> desconectadas. La integración quirúrgica consiste en **conectarlas** con una capa fina de
> modelo/versionado/paramétrico, no en construir un ERP paralelo.

---

## 0. Hallazgo de la auditoría (lo que YA existe)

Antes de diseñar nada, mapeo la visión contra el código real. Cada fila es reutilización directa:

| Pieza de la visión | Ya existe en Lopbuk | Evidencia |
|---|---|---|
| "Modelo = receta" (BOM + manual) | **`recipe_pages`** | `steps` JSON (tipo IKEA), `image_url`, `prep_time_minutes` (= tiempo fabricación), `difficulty`, `total_cost`, ligado a un `product_id` |
| Consumo de materiales (tela 7.5m, espuma 3 láminas) | **`recipe_page_ingredients`** | `product_id` + `quantity` DECIMAL(10,3) + `unit` + `notes` + `sort_order` |
| Materiales (tela, espuma, madera…) | **`products` con `is_ingredient=1`** | columnas `material`, `dimensions`, `weight`, `technical_specs`, `purchase_price` |
| Catálogo comercial (fotos, video, medidas, garantía) | **`products` + Product Experience Builder** | bloques `hero`/`multimedia`/`feature_grid` (=medidas)/`before_after`; `warranty_months`, `images` |
| Tela / color / tamaño configurable | **`product_variants`** | `color`, `colorHex`, `size`, `attributes` JSON, `images`, `price_override`, `stock` |
| Órdenes de producción + pipeline del taller | **`work_orders`** | máquina de estados `recibido→cotizado→aprobado→en_proceso→listo→entregado→cancelado`, `customer`, `quoted_price`, `advance_paid`, `photos_in/out`, `assigned_to`, `sale_id` |
| Inventario inteligente (descuento automático) | **`stock_movements` + `inventory_movements`** | `inventory.service.ts` ya descuenta stock |
| Compra / reposición | **`purchase_invoices` + `purchase_invoice_items` + `suppliers`** | `reorder_point` en productos |
| Versionado de modelos (v1→v2→v3) | **Patrón ya implementado** | `routine_versions` (gym) + `product_template_versions` (Fase 1.5) — mismo patrón, probado |
| Captura IA desde fotos | **Módulo `ai` con VISIÓN** | `orchestrator.service.ts`: `VISION_PROMPT`, imagen→texto cacheada (tier IA2) |
| Fotos / renders / videos / planos / plantillas PDF | **Media library + `images` JSON + Cloudinary** | ya en uso en productos y recetas |

**Conclusión:** el motor de recetas del restaurante ES el motor de manufactura. Un tapicero
"cocina" muebles. La palabra del usuario lo confirma: *"Así como un restaurante tiene recetas,
un tapicero tiene modelos."* Literalmente es la misma tabla.

### Lo que realmente FALTA (el 30%)
1. **Escalado paramétrico**: recalcular consumo/costo al cambiar tamaño (2.20 m → factor).
2. **Versionado de modelos**: aplicar el patrón existente a `recipe_pages`.
3. **Orden ligada a modelo**: hoy `work_orders` es texto libre (`item_description`); falta que
   apunte a un modelo + variante + opciones y "congele" la receta al vender.
4. **Piezas del producto** (base, brazo, respaldo…) con sus plantillas de corte: hoy la receta
   tiene ingredientes planos, no piezas jerárquicas.
5. **Pipeline especializado** (kanban de taller) sobre los estados de `work_orders`.
6. **Costeo automático en vivo** desde precios reales del inventario (parcial: `total_cost` es
   estático).
7. **Predicción / producción para stock** (analítica sobre `sale_items` + modelos).
8. **Control de calidad** (checklists + evidencias).

---

## 1. Decisión de arquitectura

### 1.1 Genérico, no "tapicería"
Como pide el usuario: un **motor de manufactura ligera** reutilizable (carpintería, cocinas,
colchonería, metalmecánica, impresión 3D). Tapicería es el primer vertical, no el techo.

Nombre del módulo backend: **`production`** (no `upholstery`). El dominio es "fabricar bajo
receta", agnóstico del producto.

### 1.2 Reutilizar el motor de recetas, no duplicarlo
El "Modelo de Producción" **es** un `recipe_page` enriquecido. Dos caminos:

- **Opción A (recomendada):** extender `recipe_pages` con las columnas de manufactura
  (versionado, piezas, tiempos por operación, mano de obra) vía columnas nullable + tablas
  satélite. Cero duplicación; el restaurante sigue usando la misma tabla con esas columnas
  vacías. **Riesgo bajo, máxima reutilización.**
- **Opción B:** tabla nueva `production_models` que "es-un" recipe. Más limpia conceptualmente
  pero duplica el CRUD, el costeo y el consumo de inventario ya probados. **Se descarta** salvo
  que el acoplamiento con el dominio "receta de comida" moleste al equipo.

Este plan asume **Opción A**: el Modelo de Producción es un `recipe_page` con `kind='manufactura'`
(columna nueva, default `'cocina'` para no tocar lo existente).

### 1.3 El catálogo comercial ya está resuelto
La ficha comercial del modelo (fotos, video, medidas, precio, garantía, "cambia color/tela")
**no requiere nada nuevo**: es un `product` + sus `product_variants` (tela/color/tamaño) +
una plantilla del Product Experience Builder (bloques hero/multimedia/feature_grid). La pieza
que falta es el puente **producto ↔ receta ↔ orden**.

---

## 2. Mapa quirúrgico de los 9 módulos de la visión

| # | Módulo de la visión | Estrategia | Esfuerzo |
|---|---|---|---|
| 1 | **Catálogo de Modelos** | `products` (comercial) + `recipe_pages kind='manufactura'` (técnico). Puente `product.model_recipe_id`. | Bajo |
| 2 | **Ingeniería del Producto** | `recipe_page_ingredients` (BOM) + tabla nueva `model_pieces` (piezas jerárquicas con plantilla de corte) + `steps` (manual armado, ya existe) | Medio |
| 3 | **Captura IA de diseños** | Módulo `ai` (visión ya existe) → prompt estructurado que devuelve borrador de modelo (tipo, estilo, medidas estimadas) | Medio |
| 4 | **Órdenes de Producción** | Extender `work_orders`: FK a modelo + variante + `frozen_bom` JSON (receta congelada al vender) | Bajo-Medio |
| 5 | **Planeación y Capacidad** | Kanban sobre estados de `work_orders` + vista de carga por empleado (`assigned_to`) | Medio |
| 6 | **Inventario Inteligente** | Reusar `stock_movements` + consumo por receta ya existente; disparar descuento al pasar orden a "en_proceso" | Bajo |
| 7 | **Costeo y Rentabilidad** | Servicio que calcula costo en vivo: Σ(ingrediente.quantity × material.purchase_price) + mano de obra + overhead; margen vs `sale_price` | Medio |
| 8 | **Control de Calidad** | Tabla nueva `production_qc` (checklist JSON + evidencias foto) ligada a la orden | Bajo |
| 9 | **Analítica e IA** | Consultas sobre `sale_items` + modelos: demanda por modelo, mezcla de telas, sugerencia de compra y de producción para stock | Alto |

---

## 3. Modelo de datos (nuevo, mínimo y no destructivo)

Solo lo que el 30% faltante exige. Todo aditivo; nada rompe el restaurante ni la tapicería actual.

```sql
-- Columnas nuevas en recipe_pages (nullable → el restaurante las ignora)
ALTER TABLE recipe_pages
  ADD COLUMN kind ENUM('cocina','manufactura') NOT NULL DEFAULT 'cocina',
  ADD COLUMN labor_cost DECIMAL(12,2) NULL,        -- mano de obra
  ADD COLUMN overhead_cost DECIMAL(12,2) NULL,     -- electricidad/transporte/etc
  ADD COLUMN base_size JSON NULL,                  -- {alto,ancho,prof,...} de referencia
  ADD COLUMN suggested_price DECIMAL(12,2) NULL,
  ADD COLUMN warranty_months INT NULL;

-- Versionado del modelo (mismo patrón que product_template_versions / routine_versions)
CREATE TABLE production_model_versions (
  id VARCHAR(36) PRIMARY KEY,
  recipe_page_id VARCHAR(36) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  snapshot JSON NOT NULL,               -- receta + ingredientes + piezas congelados
  status VARCHAR(12) NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pmv (recipe_page_id, version),
  INDEX idx_pmv_status (recipe_page_id, status)
);

-- Piezas del producto (base, brazo, respaldo…) con plantilla de corte
CREATE TABLE model_pieces (
  id VARCHAR(36) PRIMARY KEY,
  recipe_page_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  dimensions JSON NULL,                 -- {largo,ancho} de corte
  material_product_id VARCHAR(36) NULL, -- de qué material se corta
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  cut_pattern_url VARCHAR(500) NULL,    -- PDF de patrón (media library)
  photo_url VARCHAR(500) NULL,
  assembly_order INT NOT NULL DEFAULT 0,
  notes VARCHAR(255) NULL,
  INDEX idx_mp_recipe (recipe_page_id, assembly_order)
);

-- Orden de producción = extensión de work_orders (columnas nuevas nullable)
ALTER TABLE work_orders
  ADD COLUMN model_recipe_id VARCHAR(36) NULL,   -- qué modelo se fabrica
  ADD COLUMN model_version INT NULL,             -- versión congelada
  ADD COLUMN variant_id VARCHAR(36) NULL,        -- tela/color/tamaño elegido
  ADD COLUMN custom_size JSON NULL,              -- medidas a medida del cliente
  ADD COLUMN frozen_bom JSON NULL,               -- receta+consumo congelado al vender
  ADD COLUMN computed_cost DECIMAL(12,2) NULL;   -- costo calculado a la fecha de venta

-- Control de calidad por orden
CREATE TABLE production_qc (
  id VARCHAR(36) PRIMARY KEY,
  work_order_id VARCHAR(36) NOT NULL,
  checklist JSON NOT NULL,              -- [{item, ok, note}]
  photos JSON NULL,
  passed TINYINT NOT NULL DEFAULT 0,
  inspected_by VARCHAR(36) NULL,
  inspected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qc_order (work_order_id)
);
```

**Regla de oro (heredada del Product Experience Builder):** el modelo guarda ESTRUCTURA y
consumo; los precios se calculan en vivo desde el inventario. La orden **congela** (`frozen_bom`,
`computed_cost`) al vender, para que un cambio futuro de precio no altere una orden ya cotizada.
Misma filosofía "espejo/snapshot" que ya funciona en versionado de plantillas.

---

## 4. El concepto clave: escalado paramétrico

Es el corazón de "cambia tamaño → el sistema calcula". El modelo guarda consumo para una
`base_size`. Al pedir otra medida, se escala:

```
factor = medida_pedida / medida_base   (por eje relevante: lineal para tela, área para espuma)
consumo_real = consumo_base × factor
costo_real   = Σ(consumo_real × precio_material_actual) + labor + overhead
```

El factor por material se define en el ingrediente (`scaling: 'linear' | 'area' | 'fixed'`),
porque la tela escala lineal, la espuma por área y los tornillos son fijos. Esto va como un
campo nuevo en `recipe_page_ingredients` (columna `scaling` nullable, default `'fixed'` para no
alterar recetas de cocina).

---

## 5. Plan incremental (vertical, reversible, cada fase usable)

Mismo método que funcionó en el Product Experience Builder: cortes verticales que dejan algo
usable y se pueden revertir solos.

| Fase | Entrega usable | Reutiliza | Riesgo |
|---|---|---|---|
| **F1 · Modelo técnico** | `recipe_pages kind='manufactura'` + costeo en vivo desde inventario. El tapicero crea "Sofá Oslo" con BOM y ve costo/margen real. | recetas, ingredientes, inventario | Bajo |
| **F2 · Catálogo comercial** | Producto + variantes (tela/color/tamaño) + plantilla PDP ligados al modelo. Cliente ve la ficha. | products, variants, block registry | Bajo |
| **F3 · Paramétrico** | Cambiar tamaño recalcula consumo y precio en vivo. | F1 + campo `scaling` | Medio |
| **F4 · Versionado** | Modelo v1→v2→v3 con rollback. | patrón `*_versions` ya probado | Bajo |
| **F5 · Orden de producción** | Vender = crear `work_order` ligada a modelo+variante, con BOM congelado. Descuento de inventario automático. | work_orders, stock_movements | Medio |
| **F6 · Kanban del taller** | Pipeline visual sobre los estados de `work_orders` + carga por empleado. | work_orders.status, assigned_to | Medio |
| **F7 · Piezas + plantillas de corte** | `model_pieces` con PDF de patrón; manual de armado paso a paso (steps ya existe). | steps JSON, media library | Medio |
| **F8 · Control de calidad** | Checklist + evidencias por orden. | tabla nueva `production_qc` | Bajo |
| **F9 · Compra automática** | Sugerencia de compra cuando el consumo proyectado supera el stock. | reorder_point, purchase_invoices | Medio |
| **F10 · Captura IA** | Subir fotos → borrador de modelo (tipo/estilo/medidas). Ajustar, no crear de cero. | módulo `ai` (visión) | Alto |
| **F11 · Analítica y producción para stock** | Demanda por modelo, mezcla de telas, sugerencia de producción anticipada. | sale_items, modelos | Alto |

**Orden recomendado de arranque:** F1 → F2 → F5. Con esas tres el taller ya deja de improvisar:
modelo con costo real, ficha vendible, y orden que congela la receta. El resto es refinamiento.

---

## 6. Riesgos y mitigación

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Acoplar "receta de comida" con "modelo de mueble" confunde el dominio | `kind` separa comportamientos; el editor muestra campos según `kind`. Si molesta, Opción B (tabla propia) queda como salida |
| R2 | Escalado paramétrico da consumos irreales (espuma no escala lineal) | `scaling` por material (linear/area/fixed); validación del tapicero antes de publicar la versión |
| R3 | Cambiar precio de material altera órdenes viejas | La orden **congela** `frozen_bom` + `computed_cost` al vender (patrón snapshot ya probado) |
| R4 | `work_orders` ya está en producción con datos reales | Todas las columnas nuevas son **nullable**; el flujo actual de texto libre sigue funcionando intacto |
| R5 | La IA estima medidas erróneas | Es un **borrador**: el humano confirma. Nunca crea un modelo publicado automáticamente |
| R6 | Migraciones | **Bloqueo activo:** el drift de `0050` (ver `plan-migration-drift-loyalty.md`) impide `migrate()` completo. Este ERP añade tablas nuevas → van por el mismo catch-up idempotente que Fase 1.5/3/4, pero el drift debe resolverse antes de un deploy limpio |
| R7 | Alcance: la visión completa (gemelo digital 3D, IA predictiva) es enorme | El plan separa MVP (F1–F5, quirúrgico) de la visión aspiracional (F10–F11, I+D). No se promete el gemelo digital 3D en el corto plazo |

---

## 7. Lo que este plan NO promete (honestidad de alcance)

- **Gemelo digital 3D**: fuera del MVP. Requiere motor 3D y modelado que hoy no existe en el
  stack. Se deja como visión a largo plazo, no como entregable.
- **IA predictiva de demanda / producción para stock**: F11 es I+D real, depende de tener
  historial suficiente (meses de `sale_items` por modelo). No se activa hasta tener datos.
- **Captura IA "mágica"**: la visión actual es imagen→texto; estimar medidas desde fotos sin
  referencia de escala es aproximado. Se entrega como asistente de borrador, no como medición.

---

## 8. Resumen ejecutivo

El taller no necesita un ERP nuevo: necesita **conectar lo que Lopbuk ya tiene**. El motor de
recetas (BOM, pasos, costo), el catálogo con variantes, el pipeline de `work_orders`, el
inventario con consumo y compra, el patrón de versionado y la visión IA **ya existen**. La
integración quirúrgica es una capa fina —modelo técnico con `kind`, escalado paramétrico,
versionado, y la unión orden↔modelo con BOM congelado— construida con los mismos patrones que
ya probamos en el Product Experience Builder (registry, snapshot/espejo, versiones con rollback,
catch-up idempotente).

Empezando por **F1+F2+F5**, en pocos cortes verticales el tapicero pasa de "fabricar a ciegas" a
tener costo real, ficha vendible y órdenes que siguen una receta. Cada modelo nuevo alimenta la
biblioteca y hace el siguiente más barato y rápido — exactamente la ventaja competitiva que
describe la visión, construida sobre cimientos que ya están en el repositorio.

---

**Relacionados:** [[plan-fase-1.5-product-experience-platform]] (patrón de versionado y registry
reutilizado) · [[plan-migration-drift-loyalty]] (bloqueo de migraciones a resolver antes del deploy).
