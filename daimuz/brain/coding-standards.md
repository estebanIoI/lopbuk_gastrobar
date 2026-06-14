# 🔤 Estándares de Código

## Estructura de Módulo Backend

```
modules/[nombre]/
├── [nombre].routes.ts      ← endpoints + middlewares
├── [nombre].controller.ts  ← request → service → response
├── [nombre].service.ts     ← TODA la lógica de negocio
└── index.ts                ← re-export
```

## Patrón Service (regla de oro)

```typescript
// ✅ CORRECTO — lógica en service
export class InventoryService {
  async addMovement(tenantId: string, data: MovementDto) {
    // valida, calcula, guarda
    const [product] = await db.execute(
      'SELECT stock FROM products WHERE id = ? AND tenant_id = ?',
      [data.productId, tenantId]
    )
    if (!product[0]) throw new AppError('Producto no encontrado', 404)
    // ... lógica
  }
}

// ❌ INCORRECTO — lógica en controller
async addMovement(req, res) {
  const product = await db.execute(...) // NUNCA
}
```

## Naming Conventions

| Cosa | Convención | Ejemplo |
|---|---|---|
| Archivos backend | kebab-case | `cash-sessions.service.ts` |
| Archivos frontend | kebab-case | `point-of-sale.tsx` |
| Clases | PascalCase | `AuthService`, `SalesController` |
| Funciones/vars | camelCase | `fetchProducts`, `tenantId` |
| Tablas DB | snake_case plural | `stock_movements` |
| Columnas DB | snake_case | `created_at`, `tenant_id` |
| Endpoints | kebab-case | `/api/cash-sessions` |
| Componentes React | PascalCase | `PointOfSale`, `CashRegister` |

## TypeScript Estricto

```typescript
// ✅ Tipos explícitos en servicios
async login(email: string, password: string): Promise<{ user: User; token: string }>

// ✅ Interfaces para DB rows
interface ProductRow extends RowDataPacket {
  id: string
  tenant_id: string
  name: string
  price: number
}

// ❌ No usar any
const data: any = ... // prohibido en services
```

## Queries SQL

```typescript
// ✅ Siempre con tenant_id
await db.execute(
  'SELECT * FROM products WHERE tenant_id = ? AND is_active = 1',
  [tenantId]
)

// ✅ Parámetros preparados (nunca concatenar strings)
// ❌ NUNCA: `WHERE id = '${id}'`  → SQL injection
```

## Respuestas API

```typescript
// ✅ Formato estándar
res.json({ success: true, data: result })
res.status(201).json({ success: true, data: created })

// ✅ Errores con AppError
throw new AppError('Mensaje claro en español', 400)

// Formato error automático:
// { success: false, error: 'Mensaje claro en español' }
```

## Componentes React

```typescript
// ✅ Llamadas siempre via Zustand store o api.ts
const { products, fetchProducts } = useStore()

// ❌ NUNCA fetch directo en componentes
fetch('/api/products') // prohibido
```

## Temas y colores de marca

```tsx
// ✅ Color de marca como variable CSS con fallback (lo tiñe la colorimetría)
const GREEN = 'var(--brand-green, #00833E)'
<div style={brandVars}>…</div>   // raíz setea --brand-green desde la paleta

// ❌ Hex de marca hardcodeado inline → la colorimetría no puede sobreescribirlo
<div style={{ background: '#00833E' }} />
```

Todo tema (home/tienda) consume la colorimetría. Ver [[colorimetria]].

## Commits

```
feat: agrega módulo de reservas
fix: corrige cálculo de food cost en recetas
refactor: extrae lógica de merma a service
docs: actualiza DAIMUZ con módulo delivery
```

---

← [[philosophy]] | [[DAIMUZ]] | → [[ai-behavior]]
