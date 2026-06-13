# 🎓 Lecciones Aprendidas

> Lo que el proyecto nos enseñó. Actualizar cuando algo sale mal o muy bien.

## Tooling

### ⚠️ Usar pnpm — npm falla en este proyecto
- `npm install` da error "Cannot read properties of null (reading 'matches')" al intentar instalar nuevos paquetes
- **Siempre usar `pnpm add <paquete>`** para instalar dependencias en `/frontend`
- El proyecto tiene `pnpm-lock.yaml` y config `shamefully-hoist` que indica pnpm como gestor principal

### ✅ @dnd-kit para Kanban sin dependencias pesadas
- `@dnd-kit/core` + `@dnd-kit/utilities` — drag & drop con ~15KB, sin conflictos con React 19
- Patrón "drag to column": `useDraggable` en tarjeta + `useDroppable` en columna (no `SortableContext`)
- `PointerSensor` con `activationConstraint: { distance: 8 }` evita drags accidentales en clicks

## Arquitectura

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
| Bugs en runtime por falta de contexto | 2-3 | 0 |
| Bugs detectados en pre-lectura | Raro | 1 (duplicado api.ts) |

### Por qué funcionó
- El `context/current-sprint.md` + el summary de sesión anterior tenían exactamente qué archivos tocar
- Los `compressed.md` de cada módulo dijeron el patrón sin leer código
- `endpoints-index.md` confirmó qué backend ya existía sin explorar routes
- `governance/universal-constraints.md` evitó errores de patrón (tenant_id, service-only logic)

### Regla derivada
> **Antes de implementar, leer:** compressed.md del módulo → endpoints-index → files-index → el archivo específico.
> Eso reemplaza 20-30 minutos de exploración ciega.

---

← [[completed-features]] | [[DAIMUZ]] | → [[important-fixes]]
