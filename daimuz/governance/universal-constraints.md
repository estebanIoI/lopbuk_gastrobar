# 🔒 Governance — Restricciones Universales

> Estas reglas no se negocian. Si algo las viola, está mal arquitecturalmente.

---

## 🏢 Multi-tenancy

```typescript
// ✅ SIEMPRE — tenantId del JWT
const tenantId = req.user.tenantId

// ❌ NUNCA — puede ser manipulado
const tenantId = req.body.tenantId
const tenantId = req.params.tenantId
const tenantId = req.query.tenantId
```

**Toda query a la DB debe incluir `tenant_id = ?`** — sin excepción.  
El superadmin es la única excepción, y debe estar explícitamente codificada.

---

## 🗑️ Soft Delete

```sql
-- ✅ CORRECTO
UPDATE products SET is_active = 0 WHERE id = ? AND tenant_id = ?

-- ❌ NUNCA en datos de negocio
DELETE FROM products WHERE id = ?
```

Tablas con soft delete: `products`, `product_variants`, `variant_price_tiers`,
`users`, `customers`, `sedes`, `tenants`, `orders`, `sales` (cancelación)

---

## 📦 Stock

```typescript
// Stock nunca baja de 0 — UPDATE condicional (atómicamente seguro contra race conditions)
// ✅ CORRECTO — para productos con variantes
const [result] = await db.execute(
  'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND tenant_id = ? AND stock >= ?',
  [quantity, variantId, tenantId, quantity]
)
if (result.affectedRows === 0) {
  throw new AppError('Stock insuficiente', 400)
}

// ✅ CORRECTO — para productos sin variantes (stock directo en products)
if (product.stock < quantity) {
  throw new AppError('Stock insuficiente', 400)
}

// ❌ INCORRECTO — nunca hacer validate-then-update sin lock o condicional
// (abre ventana para race condition)
if (stock >= qty) { await db.execute('UPDATE ... SET stock = stock - ?', [qty]) }

// Todo movimiento requiere reason para auditoría
if (!reason) throw new AppError('Debe especificar el motivo del movimiento', 400)
```

## 🧬 Variantes y Precios Escalonados

```typescript
// ✅ Las variantes tienen su propio stock independiente
// ✅ Siempre se filtra por tenant_id en variantes y tiers
// ✅ Precio de tier se resuelve con min_qty DESC (NUNCA max_qty)
// ✅ Si no hay tier aplicable → se usa price_override o sale_price del producto base

// ❌ NUNCA usar rangos min_qty + max_qty → producen gaps
// ❌ NUNCA permitir DELETE físico en product_variants (soft delete con is_active)
// ❌ NUNCA leer precio de una venta antigua desde variant_price_tiers
//    (los precios deben estar congelados en sale_items en el momento de la compra)
```

---

## ⚡ Precios por Volumen (Tiers)

```sql
-- ✅ CORRECTO — solo min_qty, sin max_qty, sin gaps
SELECT price, tenant_margin_pct
FROM variant_price_tiers
WHERE variant_id = ? AND min_qty <= ? AND is_active = 1
ORDER BY min_qty DESC
LIMIT 1
```

- `min_qty` solo (NUNCA `max_qty`) — evita gaps entre rangos
- Si no hay tier para la cantidad → usar `price_override ?? base_price`
- `tenant_margin_pct` = comisión de la plataforma sobre el precio público
- `cost_price` = lo que cobra el proveedor (margen real calculable)

---

## 🧊 Congelación de Datos en Ventas

```sql
-- ✅ CORRECTO — cada sale_item congela los precios en el momento de la venta
INSERT INTO sale_items (
  sale_id, variant_id,
  product_name, variant_label, sku,         -- FROZEN
  quantity, unit_price, cost_price,         -- FROZEN
  margin_pct, margin_amount, subtotal       -- FROZEN
)

-- ❌ NUNCA — leer precios actuales para reportes históricos
SELECT price FROM variant_price_tiers  -- NO para ventas viejas
```

---

## 🏧 Caja

```
Sin cash_session activa → no se puede vender
Solo 1 sesión activa por sede
Los históricos de caja son inmutables — NUNCA se editan
```

---

## 🔐 Auth Pattern

```typescript
// ✅ CORRECTO — parámetros sueltos
router.get('/', verifyToken, authorize('admin', 'cajero'), controller.get)

// ❌ INCORRECTO — no acepta array
authorize(['admin', 'cajero'])  // no funciona

// ✅ Roles con acceso gastrobar
authorize('comerciante', 'superadmin')
```

---

## 📝 Código

```typescript
// ✅ Toda la lógica en service
// ❌ Nunca lógica en controller o routes

// ✅ Tipos explícitos en servicios
// ❌ No usar `any` en services (prohibido)

// ✅ AppError para errores con HTTP code correcto
throw new AppError('mensaje en español', 400)

// ✅ Respuesta estándar
res.json({ success: true, data: result })
res.status(201).json({ success: true, data: created })
```

---

## 🌐 API

```
Naming: kebab-case → /api/cash-sessions, /api/stock-movements
Métodos: GET=listar, POST=crear, PUT=reemplazar, PATCH=actualizar parcial, DELETE=eliminar
Los errores 4xx son del cliente, 5xx son del servidor
Mensajes de error en español (usuarios hispanohablantes)
```

---

## 🗄️ DB

```sql
-- Todo lo que tiene dueño tiene tenant_id (incluyendo variants y tiers)
-- PKs son UUID v4 (VARCHAR(36))
-- Timestamps en todas las tablas
-- Columnas booleanas: is_[estado] (is_active, is_completed)
-- FKs: [tabla_singular]_id (product_id, tenant_id, user_id)
```

---

## 🎨 Temas y colorimetría (frontend)

```tsx
// ✅ SIEMPRE — color de marca como variable CSS con fallback
const GREEN = 'var(--brand-green, #00833E)'
// …y la raíz del tema setea --brand-green desde la paleta (prop themeColors)

// ❌ NUNCA — hex de marca hardcodeado en estilos inline
<div style={{ background: '#00833E' }} />   // la colorimetría no puede sobreescribirlo
```

**Todo tema nuevo (home o tienda) DEBE consumir la colorimetría.** Patrón A
(variables `--brand-*` con estilos inline) o patrón B (variables `--color-*` +
remap de clases Tailwind). Siempre con fallback al verde DAIMUZ. Los paneles
operativos solo reciben acento (`applyAdminAccent`), nunca colorización total.
Detalle completo: [[brain/colorimetria]].

---

## ⚡ Lo que Claude NO puede hacer sin preguntar explícitamente

1. Cambiar el schema de la base de datos
2. Modificar `auth.middleware.ts`
3. Cambiar el formato de respuesta `{ success, data, error }`
4. Tocar archivos de config: `.env`, `database.ts`, `app.ts`
5. Refactorizar más código del que se pidió
6. Agregar dependencias npm sin avisar

---

← [[DAIMUZ]] | → [[governance/api-standards]]
