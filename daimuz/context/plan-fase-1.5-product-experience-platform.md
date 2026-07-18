# Plan · Fase 1.5 — Product Experience Platform Refactor

> **Estado:** propuesta técnica, pendiente de validación. No implementar hasta aprobación.
> **Objetivo:** eliminar la deuda arquitectónica del `ProductTemplateEditor` para que agregar un
> bloque cueste minutos y un solo archivo. **No se agrega ningún bloque en esta fase.**
> **Módulo:** [[modules/product-templates/product-templates]]

---

## 0. Punto de partida (auditoría Fase 1)

Lo que **ya funciona** y no se toca:

| Capacidad | Estado |
|---|---|
| 10 bloques cableados 1:1 (backend ≡ editor ≡ renderer) | ✅ |
| Drag & drop + flechas ↑↓ con reindexado de `order` | ✅ |
| Duplicar plantilla y duplicar sección (deep copy) | ✅ |
| Preview con el **mismo** `SectionRenderer` de la tienda | ✅ |
| Asignación masiva a productos + `page_content` por producto | ✅ |
| Seeds por industria (Moda, Tecnología, Belleza) | ✅ |
| Validación estructural en backend (`normalizeSections`, tope 25) | ✅ |
| `default: return null` → tipos desconocidos se ignoran con gracia | ✅ |

Deuda a cerrar:

| # | Deuda | Severidad |
|---|---|---|
| D1 | 3 fuentes de verdad por bloque (`SECTION_TYPES` / `SECTION_CATALOG` / `switch`) | Alta |
| D2 | `settings: Record<string, unknown>` sin schema ni validación | Alta |
| D3 | Sin versionado: publicar sobrescribe la fila viva, sin rollback | Alta |
| D4 | "Volver" descarta cambios en silencio (sin dirty state) | Media |
| D5 | Preview con `SAMPLE_CTX` fijo e `isLightBg: true` | Media |
| D6 | Testimonios manuales salen con 5★ e indistinguibles de reseñas reales | **Confianza** |

---

## 1. Arquitectura objetivo del Block Registry

### 1.1 La restricción que define el diseño

Un registry **literalmente único compartido por backend y frontend no es alcanzable hoy** sin un
refactor de despliegue:

- No hay monorepo ni workspace: `frontend/` y `backend/` son **paquetes independientes**, cada uno
  con su propio `Dockerfile` que copia solo su directorio.
- `zod` está declarado en `frontend` (3.25.76) pero **nunca se importa**; en `backend` no existe.

Un paquete compartido (`packages/product-blocks`) obligaría a: `pnpm-workspace.yaml`, reescribir
**ambos Dockerfiles** y tocar el pipeline (Dokploy/Komodo). Es decir, **poner el despliegue en
riesgo para resolver un problema de organización de código**. Se descarta.

### 1.2 Decisión: un registry + una lista tonta

> **El backend no necesita saber qué es un Hero. Necesita saber que el array está bien formado.**

| Capa | Responsabilidad | Fuente de verdad |
|---|---|---|
| **Frontend** `lib/product-blocks/` | tipo · schema · defaults · editor · render · label · categoría · icono | **El registry (única)** |
| **Backend** `section-types.ts` | allowlist plana de strings + validación estructural (`id`,`type`,`order`,`visible`, ≤25) | Lista de strings |
| **DB** | `settings` = JSON opaco por bloque | — |

Pasamos de **3 fuentes duplicadas → 1 registry + 1 lista de strings**. La lista se blinda con un
**test de contrato** que falla si backend y registry divergen. Sin ese test, la lista vuelve a
ser deuda.

### 1.3 Forma del registry

```ts
// frontend/lib/product-blocks/registry.ts
export const BLOCKS = defineBlocks([
  defineBlock({
    type: 'benefits',
    label: '✓ Beneficios',
    category: 'contenido',
    icon: CheckCircle,
    schema: BenefitsSchema,   // zod → deriva defaults Y validación
    Editor: BenefitsEditor,   // form de settings
    Render: BenefitsSection,  // usado por tienda Y preview
  }),
  // …
])
```

De ahí se **derivan automáticamente**:

- **Catálogo del editor** → `BLOCKS.map(b => b.label)` (muere `SECTION_CATALOG`)
- **Defaults** → `b.schema.parse({})` (mueren los `defaults` duplicados)
- **Form de settings** → `BLOCKS[type].Editor` (muere el `switch` de `SectionSettingsForm`)
- **Render** → `BLOCKS[type].Render` (muere el `switch` del `SectionRenderer`)
- **Validación y serialización** → `b.schema`

`SectionRenderer.tsx` queda en ~20 líneas: buscar en el registry y renderizar.

**Agregar un bloque = 1 archivo nuevo + 1 línea en el array + 1 string en el backend.**

### 1.4 Regla de oro (se preserva)

> *La plantilla guarda ESTRUCTURA, nunca contenido del producto.*

**Tensión detectada con el Hero Block de Fase 2:** su spec incluye título, descripción, precio
actual, precio anterior y descuento — eso es **contenido del producto**, no estructura. El Hero
debe referenciar `{{product.*}}` y `page_content`, no almacenar valores. Un `schema` que permita
escribir un precio literal rompe la regla de oro y desincroniza la landing del inventario.
El registry debe hacer esto **imposible por diseño**, no por disciplina.

---

## 2. Modelo de schemas por bloque

### 2.1 Principio: tolerante a la entrada, estricto en la salida

Las filas existentes tienen `settings` con formas viejas. Un `zod.parse()` estricto **rompería
tiendas en producción**. Regla obligatoria para todo schema del registry:

1. **Todo campo lleva `.default()`** → un campo ausente nunca es error.
2. **Todo schema cierra con `.catch(fallback)`** → settings corruptos degradan a defaults, no
   tumban la página.
3. **Nunca `.strict()`** → claves desconocidas se preservan (no se destruye data de una versión
   futura o de un rollback).

```ts
export const BenefitsSchema = z.object({
  title:   z.string().default(''),
  columns: z.union([z.literal(2), z.literal(3)]).default(2),
  items:   z.array(z.object({
    icon: z.string().default(''),
    text: z.string().default(''),
  })).default([]),
}).catch({ title: '', columns: 2, items: [] })
```

`schema.parse({})` produce los defaults → **la duplicación `defaults` vs `schema` desaparece por
construcción**, no por convención.

### 2.2 Dónde se valida

| Momento | Qué pasa |
|---|---|
| Editor (escritura) | `safeParse` → feedback inmediato al comerciante |
| Backend (persistencia) | Solo estructura; `settings` opaco |
| Render (lectura) | `schema.parse()` con `.catch()` → **jamás lanza** |

El punto (3) es lo que hace el refactor seguro: aunque la DB tenga basura, la tienda no cae.

---

## 3. Diseño del sistema de versionado

Se replica el patrón ya probado en Gym (`routine_versions`), que este equipo ya opera.

### 3.1 Tabla nueva

```sql
CREATE TABLE IF NOT EXISTS product_template_versions (
  id           VARCHAR(36)  NOT NULL,
  template_id  VARCHAR(36)  NOT NULL,
  version      INT          NOT NULL DEFAULT 1,
  sections     JSON         NOT NULL,          -- el contenido vive AQUÍ
  status       VARCHAR(12)  NOT NULL DEFAULT 'draft',
  published_at DATETIME     NULL,
  created_at   TIMESTAMP    DEFAULT (NOW()),
  PRIMARY KEY (id),
  UNIQUE KEY uk_ptv (template_id, version),
  KEY idx_ptv_status (template_id, status)
);
```

`product_templates` conserva **identidad** (id, tenant_id, name, description, is_active) y
**cede el contenido**. Invariante (igual que Gym): **como máximo una versión `published` por
plantilla**.

### 3.2 Operaciones

| Acción | Efecto |
|---|---|
| Editar | escribe sobre la versión `draft`; si no hay, crea `v(max+1)` en draft |
| Publicar | `draft → published`; la anterior `published → archived`; `published_at = NOW()` |
| **Rollback** | copia `sections` de `vN` en una **versión nueva** `v(max+1)` y la publica |
| Duplicar plantilla | copia identidad + la versión publicada como `v1` draft |

**Rollback crea, nunca revive.** Volver a publicar una fila vieja rompería el histórico y el
`unique(template_id, version)`. Crear una versión nueva deja traza de que hubo rollback.

**SLA real de rollback: hasta 60 s.** El endpoint público `GET /storefront/product-page/:id`
cachea 60 s. El rollback no es instantáneo, y el documento no debe prometer que lo sea. Si se
necesita inmediato, hay que invalidar la caché al publicar (fuera del alcance de esta fase).

---

## 4. Estrategia de migración (sin romper nada)

Principio rector: **dual-write y cero DDL destructivo** → el rollback es solo de código.

| Paso | Acción | Reversible |
|---|---|---|
| **M1** | Crear `product_template_versions` (idempotente, patrón catch-up del proyecto) | Sí (tabla sin uso) |
| **M2** | **Backfill**: por cada `product_templates`, insertar `v1` con sus `sections` y su `status` | Sí (solo inserta) |
| **M3** | **Lectura** pasa a versiones, con *fallback* a `product_templates.sections` si no hay fila | Sí (flag de código) |
| **M4** | **Escritura dual**: escribe en versiones **y** espeja la publicada en `product_templates.sections` | Sí |
| **M5** | Tras verificación en prod, `sections` queda legacy (solo lectura) | — |
| **M6** | *(fase futura, nunca en este release)* eliminar la columna | — |

**M4 es la clave**: mientras el espejo exista, el código viejo sigue funcionando y **revertir el
deploy no pierde datos**. La columna `sections` **no se elimina en esta fase** — es el seguro.

### 4.1 Compatibilidad de bloques existentes

No hace falta migrar datos de `settings`: los schemas son tolerantes (§2.1). Un `benefits`
guardado hace meses se parsea con defaults para lo que falte. **Migración de datos = 0.**

---

## 5. Guardado seguro (D4) y preview (D5)

**Dirty state**: `useRef` del snapshot serializado al cargar vs estado actual.
- Indicador "Cambios sin guardar" en el header.
- `beforeunload` + confirmación al pulsar "Volver".
- Autosave configurable (debounce ~5 s) escribiendo **solo sobre el draft** — nunca sobre lo
  publicado. Sin versionado, el autosave sería *peligroso*: publicaría en vivo cada tecla.
  **Por eso el versionado (§3) es prerequisito del autosave, no al revés.**

**Preview**: `SAMPLE_CTX` deja de ser constante y pasa a ser estado:
selector de producto real (reusa `api.getProducts`) o el de ejemplo · toggle móvil/desktop
(ancho del contenedor) · toggle claro/oscuro (`isLightBg`). El renderer ya recibe todo por `ctx`,
así que **no requiere tocar los bloques**.

---

## 6. Los dos hallazgos de confianza

### 6.1 Testimonios (D6) — corregir en esta fase

Hoy: el editor pide solo `name` + `text`; el renderer hace `rating: t.rating || 5` → **todo
testimonio manual sale con 5★**, mezclado en la misma grilla con reseñas aprobadas, sin forma de
distinguirlos. El badge "compra verificada" no existe, pero el efecto sí.

Propuesta:

1. **Separación visual explícita**: las reseñas reales llevan distintivo **"Compra verificada"**
   (derivado de una orden real, nunca de un check manual). Los testimonios manuales van sin él.
2. **Rating explícito u omitido**: se agrega campo de calificación al editor; si el comerciante no
   lo pone, el testimonio se muestra **sin estrellas** en vez de inventar 5★. Cambio de una línea
   (`t.rating || 5` → `t.rating ?? null`).
3. **Orden**: reseñas verificadas primero.

Esto es corrección de un defecto de credibilidad ya en producción, no una funcionalidad nueva.

### 6.2 Urgency — principio confirmado, sin cambios

El bloque actual ya es honesto: usa `ctx.product.stock` real y `deadline` real, y hace
`return null` si no hay nada real que mostrar. **Se conserva tal cual.** El registry **no debe
exponer ningún setting que permita un contador simulado.** Fase 5 (Social Proof Engine) alimentará
estos bloques desde pedidos, órdenes, stock y Socket.io — datos reales o nada.

---

## 7. Plan incremental e impacto

Cada paso es entregable, testeable y reversible por separado.

| Paso | Alcance | Archivos | Blast radius |
|---|---|---|---|
| **P1** | Registry + schemas de los **10 bloques actuales**; `SectionRenderer` y editor derivan de él. Sin cambios de comportamiento. | +12 nuevos · 2 refactor · 1 backend | **Alto** — toca el render de tiendas vivas |
| **P2** | Test de contrato backend ↔ registry | +1 | Nulo |
| **P3** | Tabla de versiones + backfill + lectura con fallback (M1–M3) | +1 migración · 2 backend | Medio |
| **P4** | Escritura dual + UI de versiones y rollback (M4) | 2 backend · 1 frontend | Medio |
| **P5** | Dirty state + autosave sobre draft | 1 frontend | Bajo |
| **P6** | Preview: producto real · viewport · tema | 1 frontend | Bajo |
| **P7** | Fix de testimonios (§6.1) | 2 frontend | Bajo |

**P1 es el paso peligroso**: es refactor puro sobre código que ya sirve tiendas en producción. Va
solo, sin mezclarse con features. La red de seguridad es que el JSON persistido **no cambia de
forma** — solo cambia quién lo interpreta.

**Nota de contexto:** hay **2734 errores de lint preexistentes** y el UI del PDP no se ha validado
visualmente nunca. El registry no los arregla ni los empeora, pero **P1 no tiene red de tests**.
Antes de P1 conviene decidir si se valida el editor en navegador (Fase 1 quedó como auditoría de
código, no visual).

---

## 8. Riesgos y rollback

| # | Riesgo | Mitigación | Rollback |
|---|---|---|---|
| R1 | P1 rompe el render de tiendas vivas | El JSON no cambia de forma; `.catch()` en todo schema; `default: return null` ya existe | Revertir código; datos intactos |
| R2 | zod strippea claves desconocidas → **pérdida silenciosa** | Prohibido `.strict()`; nunca reescribir settings al leer | — (prevención) |
| R3 | Backfill duplica versiones si corre 2× | Idempotente por `unique(template_id, version)` + patrón catch-up | `DELETE` por template_id |
| R4 | Deriva backend ↔ registry | Test de contrato (P2) | — |
| R5 | Rollback percibido como "no funcionó" | Caché de 60 s: comunicarlo en la UI | — |
| R6 | Autosave publica en vivo | Autosave **solo** sobre draft; depende de P3/P4 | Desactivar autosave |
| R7 | Hero (Fase 2) guarda precios → rompe regla de oro | El schema no debe permitir precio literal | — (diseño) |

**Estrategia global de rollback:** mientras exista el espejo de M4 y no se elimine
`product_templates.sections`, **cualquier reversión es solo de código**. Ninguna migración de esta
fase es destructiva.

---

## 9. Criterios de aceptación

- [ ] Agregar un bloque nuevo = 1 archivo + 1 línea en el registry + 1 string en backend.
- [ ] `SECTION_CATALOG` y ambos `switch` eliminados; `Record<string, unknown>` eliminado.
- [ ] Test de contrato backend ↔ registry en verde.
- [ ] Toda plantilla existente renderiza **idéntica** antes y después (verificación visual).
- [ ] Rollback a versión anterior en un clic (≤60 s por caché).
- [ ] Imposible perder cambios: dirty state + confirmación.
- [ ] Preview con producto real, móvil/desktop y claro/oscuro.
- [ ] Testimonios manuales distinguibles de reseñas verificadas.
- [ ] Sin contadores simulados en ningún bloque.
- [ ] `tsc` en 0 errores (frontend y backend).

---

## 10. Decisiones que requieren tu visto bueno

1. **Registry en frontend + lista tonta en backend** (§1.2), descartando el monorepo por riesgo de
   despliegue. ¿Se acepta que el backend no valide `settings` por bloque?
2. **Adoptar zod de verdad** — hoy está instalado pero sin usar; sería su primer uso real.
3. **`product_templates.sections` no se elimina** en esta fase (es el seguro de rollback).
4. **Hero no podrá guardar precios ni textos de producto** (regla de oro) — condiciona Fase 2.
5. **¿Validar el editor en navegador antes de P1?** Es refactor sin red de tests sobre código vivo.
