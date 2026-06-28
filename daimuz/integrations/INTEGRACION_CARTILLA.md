# Integración módulo CARTILLA (Cartilla Digital) en Lopbuk

Portado e integrado desde el proyecto **cartilladigitalinga** (React+Express JS)
hacia la arquitectura multi-tenant de **Lopbuk** (Next.js 16 + Express TS + MySQL).

## Qué hace

Sección **independiente y global** `/cartilla-inga` donde **cualquier comercio
(tenant)** publica **cartillas, libros o cursos**. Cada cartilla puede ser
**gratis** o **con precio**. Al abrir una cartilla gratis (o ya adquirida) el
usuario interactúa con **todo su contenido**: módulos, actividades interactivas
(completar, emparejar, V/F, ordenar), secciones, audios/imágenes, vocabulario/
traductor, comunidad (publicaciones, likes, comentarios) y gamificación
(puntos, retos diarios, ranking). La cartilla activa se ve en
`/cartilla-inga/(slug)` → **cartilla-(slug viendo)**.

## Backend (`backend/src/modules/cartillas/`)

- `cartillas.service.ts` — toda la lógica (catálogo, lector, actividades+puntos,
  retos, comunidad, vocabulario, compra/desbloqueo, CRUD staff). Multi-tenant:
  el `tenant_id` de negocio se deriva SIEMPRE de la cartilla (área cross-tenant).
- `cartillas.routes.ts` — rutas públicas (auth opcional), de miembro (autenticado)
  y de staff/comerciante. Respuestas `{ success, data }`.
- Registrado en `src/index.ts` → `app.use('/api/cartillas', cartillasRoutes)` y
  en `src/modules/index.ts`.
- Migración: `backend/src/migrations/add_cartilla_module.sql` (tablas `cartillas`,
  `cartilla_modulos`, `cartilla_actividades` (+detalles), `cartilla_modulo_*`,
  `cartilla_vocabulario`, `cartilla_retos` + `cartilla_usuario_retos`,
  `cartilla_progreso`, `cartilla_usuario_modulos`, `cartilla_usuario_respuestas`,
  `cartilla_publicaciones`/`cartilla_comentarios`/`cartilla_publicacion_likes`,
  `cartilla_compras`). Soft delete con `is_active`.

### Endpoints principales (`/api/cartillas`)

Público / miembro:
- `GET  /catalogo` · `GET /catalogo/:slug` — catálogo global y detalle (con acceso)
- `GET  /:cartilla/modulos` · `GET /:cartilla/modulos/:clave` — índice y lector (gated)
- `POST /:cartilla/modulos/:clave/responder` — responder actividad (+puntos/retos)
- `GET  /:cartilla/retos|top|activos|stats|progreso`
- `GET/POST /:cartilla/comunidad`, `POST /comunidad/:id/like`, `.../comentarios`
- `GET  /:cartilla/vocabulario?q=` — traductor
- `POST /:cartilla/comprar` · `GET /mis-compras` — compra/desbloqueo

Staff (comerciante):
- `GET/POST/PUT/DELETE /admin/cartillas[...]` · `.../modulos` · `.../actividades`
- `/admin/vocabulario` · `/admin/retos` · `/admin/ventas` · `/admin/compras/:id/confirmar`

### Pago (integrado con Lopbuk)

`comprarCartilla` registra una `cartilla_compras`. Gratis → acceso inmediato.
Con precio → compra `pendiente`; si `STRIPE_SECRET_KEY` está configurada y el
método es `stripe`, crea una sesión de **Stripe Checkout** y devuelve `checkoutUrl`.
El acceso se concede al confirmar el pago (`/admin/compras/:id/confirmar`, pensado
para webhook de Stripe o confirmación manual del comercio).

## Frontend

- Área pública (Next app router):
  - `app/cartilla-inga/page.tsx` → catálogo global (`cartilla-inga/CatalogoCartillas.tsx`)
  - `app/cartilla-inga/[slug]/page.tsx` → cartilla activa con muro de pago
    (`cartilla-inga/CartillaPage.tsx` → `CartillaIngaDigital.tsx`)
- Experiencia portada en `cartilla-inga/` (context, hooks, views, components),
  con `services/api.ts` reescrito para el backend Lopbuk (envelope `{success,data}`,
  cookie httpOnly, scope por cartilla activa vía `setActiveCartilla`).
- Panel del comercio: `components/cartilla-management.tsx` (CRUD de cartillas,
  precio/gratis, publicar, módulos y actividad). Conectado en
  `components/merchant-panel.tsx` (`case 'cartilla'`).
- Módulo activable: añadido a `lib/modules.ts`, `lib/panel-sections.ts` y al
  sidebar (`components/sidebar.tsx`) en el grupo **Tienda Online**.

## Cómo probar

1. Backend: aplicar la migración `add_cartilla_module.sql` a la BD MySQL.
2. Activar el módulo `cartilla` para el comercio (Configuración → Módulos).
3. Panel → **Tienda Online → Cartilla Digital**: crear una cartilla, marcarla
   gratis o con precio, añadir módulos y una actividad, y **Publicar**.
4. Abrir `/cartilla-inga` (catálogo) y entrar a la cartilla para interactuar.

## Pendiente / siguiente iteración

- Webhook real de Stripe para `confirmarCompra` (hoy queda el endpoint listo).
- Editor admin avanzado (secciones/audios/imágenes por módulo desde la UI;
  el backend ya expone los endpoints).
