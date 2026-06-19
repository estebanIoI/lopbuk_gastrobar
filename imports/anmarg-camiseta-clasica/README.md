# Integración — Camiseta Clásica (AnMarg)

Carga de la **Camiseta Clásica** del proveedor **AnMarg** al sistema de variantes
(`product_variants` + `variant_price_tiers`). Un solo producto base con **90 variantes**
= 18 colores × 5 tallas.

## Ficha del producto

| Campo | Valor |
|---|---|
| Producto | Camiseta Clásica |
| Proveedor | AnMarg |
| Material | 100% Algodón · 160 g |
| Costo proveedor | $28.000 |
| Precio venta (retail) | $56.000 |
| Tallas | S · M · L · XL · 2XL |
| Colores | 18 (ver tabla de SKUs) |
| Handle | `camiseta-clasica` |

## Archivos

- `camiseta-clasica-anmarg.csv` — 90 variantes en el formato del importador.
- `camiseta-clasica-tiers.sql` — escalones de precio por volumen (correr **después** de importar).

## Cómo cargarlo

1. **Importar variantes** — sube el CSV a `POST /api/products/variants/import`
   (o desde el panel: módulo Inventario → importar variantes). El importador:
   - crea el producto base "Camiseta Clásica" (si no existe),
   - crea el proveedor "AnMarg" (si no existe),
   - inserta las 90 variantes con su SKU, color, talla, material, costo y stock,
   - crea el **tier base** `min_qty=1 → $56.000` por cada variante.

2. **Cargar tiers por volumen** — abre `camiseta-clasica-tiers.sql`, reemplaza
   `TU_TENANT_ID` por tu `tenant_id` y ejecútalo **una sola vez**. Agrega:

   | Cantidad | Precio | Margen vs costo $28.000 |
   |---|---|---|
   | 1+  | $56.000 | $28.000 |
   | 6+  | $52.000 | $24.000 |
   | 12+ | $48.000 | $20.000 |
   | 24+ | $44.000 | $16.000 |

3. **Cargar stock real** — el CSV trae `stock = 0` (no estaba en la ficha). Ajusta
   el stock por color/talla desde el panel (variant-manager) o con
   `PATCH /api/variants/:id/stock`. En la tienda **solo se muestran las variantes con
   stock > 0**, así que sin este paso el producto no aparece publicado.

## Guía de tallas (Ancho × Largo, cm)

> El esquema actual guarda la **talla** como etiqueta (S…2XL) pero no las medidas
> por talla. Esta tabla queda como referencia; si quieres mostrarla en tienda/POS
> hay que adaptar UI/schema (no incluido en esta entrega).

| Talla | Ancho | Largo |
|---|---|---|
| S | 48 | 68 |
| M | 52 | 71 |
| L | 56 | 74 |
| XL | 58 | 77 |
| 2XL | 62 | 82 |

## Convención de SKU

Formato: `CC-<COLOR>-<TALLA>` (ej. `CC-NEG-M`).

| Color | Código | Color | Código |
|---|---|---|---|
| Negro | NEG | Verde Pistacho | VPI |
| Blanco | BLA | Azul Navy | ANV |
| Gris Jaspe | GRJ | Azul Rey | ARY |
| Rosado | ROS | Azul Agua | AAG |
| Camel | CAM | Azul Medio | AME |
| Nude | NUD | Rojo | ROJ |
| Vainilla | VAI | Amarillo | AMA |
| Lila | LIL | Verde Militar | VML |
| Verde Botella | VBO | Verde Cali | VCA |

## Notas

- El nombre y el material van **sin tildes** en el CSV (`Camiseta Clasica`,
  `100% Algodon 160g`) porque el parser hace `split(',')` por línea y conviene
  evitar caracteres que rompan la carga. Renómbralos con tilde desde el panel si lo deseas.
- El importador deduplica el producto por **nombre** (minúsculas). Reimportar el mismo
  CSV reutiliza el producto pero **falla las variantes con SKU repetido** (las cuenta en
  `variantsFailed`), no las duplica.
- `tenant_margin_pct = 0` en todos los tiers: es producto propio del comercio, sin
  comisión de plataforma.
