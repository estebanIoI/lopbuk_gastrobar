# 🧠 Arquitectura: Horma (Silueta / Plantilla de Producto)

> Decisión arquitectónica del 2026-06-19. Extiende [[brain/variants-and-suppliers]] agregando la **horma** como entidad plantilla por encima del producto. La horma define la **tabla de medidas**, el **costo y precio base** y la **paleta de colores permitida**. Color y talla siguen siendo los ejes de variante con stock atómico.

---

## ⚠️ El problema que resuelve

Hoy `products` apunta a `product_variants (color/talla)` y el precio vive en `base_price` / `price_override` / `variant_price_tiers`. Pero falta una capa que agrupe lo que en confección se llama **horma** (silueta o fit): "Oversize Fit", "Oversize Americana", "Camiseta Clásica", etc.

La horma no es un tercer eje de variante como color o talla. Es un nivel **superior**, porque define tres cosas que ni el color ni la talla definen:

1. **Tabla de medidas** — ancho/largo/manga por talla (cada horma tiene su propia geometría).
2. **Costo y precio base** — una Oversize Fit cuesta $36.000 y se vende a $72.000; una Acidwash cuesta $51.000 y se vende a $102.000.
3. **Paleta de colores permitida** — la Clásica admite 16 colores; la Acidwash solo 6.

Modelar la horma como columna en `product_variants` duplicaría la tabla de medidas y la paleta en cada fila. Por eso se modela como **entidad padre** que el producto referencia y de la que **hereda** precio (con override).

---

## 🏛️ Modelo de datos

```sql
-- Horma: plantilla/silueta. Define geometría, precio base y paleta.
hormas (
  id, tenant_id,
  name,              -- "Oversize Fit", "Oversize Americana", "Camiseta Clásica"
  slug,              -- "oversize-fit"
  base_cost,         -- costo base que NOS cuesta (ej: 36000)
  base_price,        -- precio de venta base (ej: 72000)
  size_chart,        -- JSON: medidas por talla (ver formato abajo)
  has_sleeves,       -- BOOL: 0 para esqueleto (sin manga)
  sort_order,
  is_active
)
-- INDEX: (tenant_id), UNIQUE (tenant_id, slug)

-- Colores permitidos por horma (paleta)
horma_colors (
  id, tenant_id, horma_id,
  color,             -- "Negro", "Vino Botella", "Azul Navy"
  hex,               -- opcional: "#000000" (consume colorimetría — ver brain/colorimetria)
  sort_order,
  is_active
)
-- INDEX: (horma_id, tenant_id)

-- products gana una FK opcional a la horma
products (
  ...
  horma_id,          -- FK → hormas.id (NULL si el producto no usa horma)
  base_price,        -- si NULL → hereda hormas.base_price
  cost,              -- si NULL → hereda hormas.base_cost
  ...
)
```

> `product_variants` **no cambia**. El stock sigue siendo atómico por color×talla. La horma solo agrega contexto de plantilla y herencia de precio/costo.

### Formato de `size_chart` (JSON)

```json
{
  "S":   { "ancho": 51, "largo": 70, "manga": 24 },
  "M":   { "ancho": 53, "largo": 71, "manga": 25 },
  "L":   { "ancho": 56, "largo": 74, "manga": 26 },
  "XL":  { "ancho": 58, "largo": 76, "manga": 27 },
  "XXL": { "ancho": 62, "largo": 80, "manga": 30 }
}
```

Si `has_sleeves = 0` (esqueleto), se omite la clave `manga`.

---

## 🧬 Reglas de negocio

### 1. Herencia de precio (cascada definitiva)

El precio se resuelve de lo más específico a lo más general. La horma **solo aporta el piso base**; nunca congela el precio del producto.

```
1. variant_price_tiers   (por cantidad)         ← más específico
2. product_variants.price_override              ← override por variante
3. products.base_price                          ← override por producto
4. hormas.base_price                            ← base de la horma (fallback)  ← más general
```

Esto cumple el requisito: *"La horma debe tener un precio base, pero cada producto debe poder sobrescribirlo."* Un producto que use Oversize Fit hereda $72.000, pero puede subirse a $92.000 o $110.000 sin afectar las demás camisetas de esa misma horma.

> El costo sigue la misma cascada: `product_variants.cost_price` → `products.cost` → `hormas.base_cost`.

### 2. Stock por color × talla (no por producto)

Sin cambios respecto a [[brain/variants-and-suppliers]]: el stock vive en `product_variants` con UPDATE atómico.

```
Producto → Color → Talla → Stock
```

Una Oversize Fit Negra M y una Oversize Fit Negra XL son **inventarios distintos** (dos filas en `product_variants`). La horma no almacena stock.

### 3. Validación de paleta

Al crear una variante, su `color` **debe existir** en `horma_colors` de la horma del producto. Evita crear una "Acidwash Vainilla" si la Acidwash no la ofrece.

### 4. Multi-tenant y soft delete (universales)

- `tenant_id` en `hormas` y `horma_colors`, siempre filtrado desde `req.user.tenantId`.
- Soft delete: `is_active = 0`, nunca DELETE físico.
- Respuestas `{ success, data }` y errores `throw new AppError(...)` en el service.

---

## 🌱 Datos semilla (las 6 hormas iniciales)

| # | Horma | Costo | Venta | Mangas | Colores |
|---|---|---|---|---|---|
| 1 | Oversize Fit | $36.000 | $72.000 | Sí | Negro, Blanco, V. Botella, Vainilla, Rojo |
| 2 | Oversize Americana | $42.000 | $84.000 | Sí | Negro, Blanco, V. Botella, Vainilla, Rojo |
| 3 | Camiseta Overline | $42.000 | $84.000 | Sí | Negro, Blanco, V. Botella, Vainilla, Rojo |
| 4 | Oversize Acidwash | $51.000 | $102.000 | Sí | Negro, Gris, Pardo, Verde, Lila, Azul |
| 5 | Esqueleto Acidwash | $44.000 | $88.000 | **No** | Negro, Gris, Pardo, Verde, Lila, Azul |
| 6 | Camiseta Clásica | $28.000 | $56.000 | Sí | Negro, Blanco, Gris Jaspe, Rosado, Camel, Nude, Vainilla, Lila, V. Militar, V. Botella, V. Cali, V. Pistacho, Azul Navy, Azul Rey, Azul Agua, Azul Medio |

### Tablas de medidas (cm)

**1 · Oversize Fit**

| | S | M | L | XL | XXL |
|---|---|---|---|---|---|
| Ancho | 51 | 53 | 56 | 58 | 62 |
| Largo | 70 | 71 | 74 | 76 | 80 |
| Manga | 24 | 25 | 26 | 27 | 30 |

**2 · Oversize Americana**

| | S | M | L | XL | XXL |
|---|---|---|---|---|---|
| Ancho | 58 | 60 | 62 | 65 | 68 |
| Largo | 75 | 76 | 78 | 80 | 82 |
| Manga | 24 | 26 | 28 | 30 | 32 |

**3 · Camiseta Overline**

| | S | M | L | XL | XXL |
|---|---|---|---|---|---|
| Ancho | 58 | 60 | 62 | 65 | 68 |
| Largo | 75 | 76 | 78 | 80 | 82 |
| Manga | 24 | 26 | 28 | 30 | 32 |

> ⚠️ Overline y Americana tienen medidas idénticas. Si es intencional, ok; si no, revisar la tabla de Overline.

**4 · Oversize Acidwash**

| | S | M | L | XL | XXL |
|---|---|---|---|---|---|
| Ancho | 56 | 58 | 60 | 64 | 66 |
| Largo | 72 | 74 | 76 | 78 | 80 |
| Manga | 26 | 28 | 30 | 32 | 34 |

**5 · Esqueleto Acidwash** *(sin mangas)*

| | S | M | L | XL | XXL |
|---|---|---|---|---|---|
| Ancho | 56 | 58 | 60 | 64 | 66 |
| Largo | 72 | 74 | 76 | 78 | 80 |

**6 · Camiseta Clásica**

| | S | M | L | XL | XXL |
|---|---|---|---|---|---|
| Ancho | 48 | 52 | 56 | 58 | 62 |
| Largo | 68 | 71 | 74 | 77 | 82 |
| Manga | 20* | 21* | 22* | 23* | 24* |

> \* **Manga estimada — por confirmar.** No venía en los datos. Estimación basada en tablas estándar de camiseta clásica manga corta (rango típico 20–24 cm, progresivo por talla, más corto que la línea Oversize cuya manga arranca en 24). Reemplazar con la medida real de patronaje antes de publicar.

---

## 📐 Mapeo con el modelo actual

| Antes | Después |
|---|---|
| `products.base_price` (obligatorio) | `products.base_price` opcional → hereda `hormas.base_price` |
| `products.cost` | opcional → hereda `hormas.base_cost` |
| Medidas: no existían | `hormas.size_chart` (JSON por talla) |
| Colores: texto libre en variante | validados contra `horma_colors` |
| Producto sin agrupación de silueta | `products.horma_id` |

**Productos sin horma:** `horma_id = NULL` → funcionan igual que hoy (leen su propio `base_price`). La horma es opcional, no rompe el modelo existente.

---

## 🗺️ Plan de implementación sugerido

### Sprint A — Schema
- Migración: tablas `hormas`, `horma_colors`; columna `products.horma_id` (FK, nullable).
- Seed de las 6 hormas + sus `horma_colors` + `size_chart`.
- Índices: `(tenant_id, slug)` único en hormas, `(horma_id, tenant_id)` en horma_colors.

### Sprint B — Backend
- `horma.service.ts` — CRUD con tenant filter, gestión de paleta y size_chart.
- Extender `price-tier.service.ts` / `resolvePrice()`: agregar `hormas.base_price` como último fallback.
- Validación: color de variante ∈ `horma_colors`.
- Endpoints REST (ver propuesta abajo).

### Sprint C — Frontend
- Selector de horma al crear producto (autocompleta costo/precio/paleta).
- Vista de tabla de medidas en storefront (guía de tallas por horma).
- Chips de color limitados a la paleta de la horma.

### Endpoints propuestos

```
GET    /api/hormas                      → lista hormas del tenant
POST   /api/hormas                      → crea horma { name, baseCost, basePrice, sizeChart, hasSleeves }
PUT    /api/hormas/:id                  → actualiza horma
DELETE /api/hormas/:id                  → soft delete
GET    /api/hormas/:id/colors           → paleta de la horma
POST   /api/hormas/:id/colors           → agrega color { color, hex }
DELETE /api/horma-colors/:id            → quita color de la paleta
```

---

## 🔗 Referencias cruzadas

- Base: [[brain/variants-and-suppliers]] — variantes color/talla + tiers + stock atómico
- Módulo: [[modules/variants/variants]] — resolvePrice, descuento de stock
- Colorimetría: [[brain/colorimetria]] — `horma_colors.hex` debe consumir el sistema de color
- Governance: [[governance/universal-constraints]] — tenant_id, soft delete, stock concurrente
- Ontología: [[ontology/entities]] — agregar entidad **Horma**
- DB Index: [[indexes/db-tables-index]] — nuevas tablas `hormas`, `horma_colors`
- Endpoints: [[indexes/endpoints-index]] — nuevos endpoints de horma

---

⬡ DAIMUZ — Arquitectura Horma (silueta/plantilla) · 2026-06-19
