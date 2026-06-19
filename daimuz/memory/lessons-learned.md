# 🎓 Lecciones Aprendidas

> Lo que el proyecto nos enseñó. Actualizar cuando algo sale mal o muy bien.

## Tooling

### ⚠️ Usar pnpm — npm falla en este proyecto
- `npm install` da error "Cannot read properties of null (reading 'matches')" al intentar instalar nuevos paquetes
- **Siempre usar `pnpm add <paquete>`** para instalar dependencias en `/frontend`
- El proyecto tiene `pnpm-lock.yaml` y config `shamefully-hoist` que indica pnpm como gestor principal

### ⚠️ NO editar archivos con `sed -i` ni rewrites de shell — usar el editor
- Mezclar ediciones del editor con `sed -i` / redirecciones `>` sobre el mismo archivo **corrompió/truncó** varios archivos (jun 2026): el disco y la vista del editor se desincronizaron y `sed` reescribió una **copia cortada** → build roto (`Unterminated block comment`, `'}' expected`).
- Reglas:
  - Editar **siempre con el editor** (no `sed -i`, no `>` para "parchar" un archivo existente).
  - Si hay que reescribir un archivo entero, hacerlo **de una sola vez con el contenido completo**.
  - Tras tocar muchos archivos, **verificar en disco** que cada uno termina bien (último token) y está balanceado — NO confiar solo en `tsc`, que puede leer una vista distinta del disco.
  - Recuperación: `git show <commit-bueno>:ruta > ruta` restaura una versión íntegra.

### ✅ @dnd-kit para Kanban sin dependencias pesadas
- `@dnd-kit/core` + `@dnd-kit/utilities` — drag & drop con ~15KB, sin conflictos con React 19
- Patrón "drag to column": `useDraggable` en tarjeta + `useDroppable` en columna (no `SortableContext`)
- `PointerSensor` con `activationConstraint: { distance: 8 }` evita drags accidentales en clicks

## Arquitectura

### ⚠️ Productos con variantes tienen `products.stock = 0` — la visibilidad y el stock viven en `product_variants`
- El stock real de un producto con variantes está en `product_variants`, no en `products.stock` (queda en 0).
- **Trampa 1 (visibilidad):** cualquier `WHERE p.stock > 0` oculta el producto entero. La lista del storefront lo hacía → los productos con variantes no aparecían. Fix: `OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 AND (pv.stock - pv.reserved_stock) > 0)`.
- **Trampa 2 (pedidos):** `checkStockAvailability` validaba `products.stock` → 409 falso en todo pedido con variante. Regla: los ítems con `variantId` se validan/reservan contra `product_variants`, NO contra `products`.
- **Reserva suave:** usar `reserved_stock` (incremento atómico `WHERE (stock - reserved_stock) >= qty`) replica los `inventory_holds` de productos: oculta el combo agotado al instante y es reversible al cancelar. Preventa = `isPreorder` salta la reserva (backorder).

### ⚠️ Adjuntar datos derivados (variantes) en UN solo endpoint genera inconsistencia
- Las variantes se adjuntaban solo en `/storefront/products`. Otras secciones (`/offers`, `/new-launches`, `/platform-featured`, drops, featured/trending) devolvían el producto "pelado" → al abrir el detalle desde esas secciones no había selector hasta recargar (cuando la lista principal ya estaba en memoria).
- **Lección:** cuando varios endpoints devuelven la misma entidad, el enriquecimiento (variantes, imágenes, etc.) debe ser un **helper compartido** (`attachVariants`) aplicado a todos, no copiado/omitido por endpoint.

### ✅ Lo que funcionó bien
- **Separar service de controller** desde el día 1 → facilita testing y refactoring
- **MySQL directo con mysql2** → más control que ORM, queries optimizables
- **Zustand** → simplicidad perfecta para este tamaño, sin Redux overhead
- **Socket.io** para tiempo real → implementación limpia para pedidos en vivo

### ⚠️ Lo que hubiera cambiado
- Definir interfaces TypeScript de DB desde el inicio (se fue agregando después)
- Estandarizar respuestas API desde el día 1 (algunos endpoints tienen formato diferente)

## Multi-Tenancy

- **Lección clave:** El `tenant_id` debe estar en TODO desde el inicio. Agregarlo después es costoso.
- Los módulos activables deben validarse en BACKEND, no solo ocultar en frontend

## Auth

- **JWT en httpOnly cookie** es más seguro que localStorage — no negociable
- Tener token también en memoria (auth-store) es necesario para el header Authorization como fallback
- Google OAuth necesita manejar el caso "usuario ya existe con email diferente"

## Frontend

- **Los componentes grandes (POS, Dashboard)** deben dividirse en subcomponentes cuando superan ~300 líneas
- El sidebar dinámico por rol+módulos es poderoso pero necesita buena documentación
- Cloudinary upload directo desde frontend (sin pasar por backend) = mejor performance
- ⚠️ **Los estilos inline (`style={{ ... }}`) NO se pueden sobreescribir con reglas CSS de clases.** Si un tema hardcodea colores inline, la colorimetría no lo tiñe. Solución: color de marca como `var(--brand-green, #fallback)` y setear la variable en la raíz desde la paleta. Ver [[brain/colorimetria]].
- ⚠️ **`app/favicon.ico` (Next App Router) tiene prioridad sobre `metadata.icons`.** Para cambiar el favicon hay que regenerar ese archivo, no basta con el metadata. Y el navegador lo cachea fuerte (hard-refresh).
- Para teñir clases Tailwind hardcodeadas (`bg-green-500`) sin reescribir el markup: remap en un `<style>` a `var(--color-primary)`, con `color-mix` para conservar el alpha (`/10`, `/20`, …) y `--tw-gradient-*` para gradientes.

## Base de Datos

- Soft delete (`is_active`) es esencial para datos financieros y de ventas
- Los UUIDs como PK son más seguros pero más lentos en joins — para este tamaño es aceptable
- Siempre crear índices en `tenant_id` y `created_at` en tablas de alto volumen

## Desarrollo

- Documentar el módulo ANTES de construirlo ahorra tiempo
- Los bugs más costosos fueron en módulos sin documentación de reglas de negocio
- Trabajar con Claude es 3x más rápido cuando tienes el contexto correcto listo

### TypeScript / deuda de tipos (2026-06-06)
- **`req.user` en controllers** SIEMPRE tipar el handler con `AuthRequest` (de `common/middleware`) y usar `req.user!.tenantId!` — `tenantId` es `string | null` en `JWTPayload`, los services esperan `string`. Patrón de referencia: `sales.controller.ts`.
- **Tipos compartidos front/back**: cuando el front consume un endpoint, replicar el tipo del service backend en `frontend/lib/types.ts` (ej. `DailyReportData`/`SedeReportData`) en vez de dejar `any`; evita la cascada de `TS18046 'is of type unknown'`.
- **react-joyride 3.x rompió la API v2**: ya no hay `callback`/`CallBackProps`/`styles.options`/`disableBeacon`. Equivalencias: `onEvent`+`EventData`, prop `options`, `skipBeacon`. Fijar major version antes de actualizar librerías de UI.
- Los imports dinámicos (`await import('...')`) también fallan el build si el módulo no existe (`TS2307`); si una integración queda pendiente, dejar un **stub tipado** en vez de un import a un archivo inexistente.

## Eficiencia DAIMUZ — Datos Medidos

### Sesión 2026-05-27 (primera sesión con DAIMUZ v3 al 100/100)

| Métrica | Sin DAIMUZ | Con DAIMUZ v3 |
|---|---|---|
| Tiempo total estimado | ~45 min | ~18 min |
| Files explorados para orientarse | 8-12 | 3 |
| Backtracking / re-lecturas | Frecuente | 0 |
| Bu