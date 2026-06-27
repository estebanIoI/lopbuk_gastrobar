# Comunidad Daimuz

Feed público tipo Instagram/blog gestionado por un rol nuevo `comunidad_admin`.
Los posts llevan media (imagen/video/gif) y pueden adjuntar productos de tiendas
públicas como "anuncios". Visitantes y usuarios reaccionan (like/save) y comentan.

## Rol nuevo

`comunidad_admin` — usuario **global** (tenant_id = NULL), creado por el SuperAdmin.
Añadido a `UserRole` en backend (`common/types`) y frontend (`lib/types`).
Al iniciar sesión se redirige a `/comunidad/admin` (login + guard en panel).

## Base de datos — `backend/src/migrations/add_community_module.sql`

`community_posts`, `community_post_media`, `community_post_ads`,
`community_reactions` (like/save, único por usuario/tipo), `community_comments`
(con `parent_id` para respuestas y soft delete). `users.role` es VARCHAR → el
valor `comunidad_admin` no requiere DDL.

## Backend — `backend/src/modules/community/community.routes.ts`

Registrado en `src/index.ts` → `app.use('/api/community', communityRoutes)`.

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/community/posts` | público (feed paginado, `sort`/`category`/`q`) |
| GET | `/api/community/posts/:id` | público |
| GET | `/api/community/posts/:id/comments` | público |
| GET | `/api/community/products/public` | público (buscar productos para adjuntar) |
| POST | `/api/community/posts/:id/react` | usuario (toggle like/save) |
| POST | `/api/community/posts/:id/comments` | usuario |
| GET | `/api/community/admin/posts` | comunidad_admin |
| POST | `/api/community/posts` | comunidad_admin |
| PUT | `/api/community/posts/:id` | comunidad_admin |
| DELETE | `/api/community/posts/:id` | comunidad_admin (soft) |
| GET | `/api/community/admin/comments` | comunidad_admin |
| DELETE | `/api/community/comments/:id` | comunidad_admin (moderar) |
| GET | `/api/community/admin/stats` | comunidad_admin |
| POST | `/api/community/admins` | superadmin (crear comunidad_admin) |
| GET | `/api/community/admins` | superadmin |
| GET | `/api/community/superadmin/stats` | superadmin |

`{ success, data }`. Las reacciones/contadores se actualizan de forma atómica.

## Frontend

| Pieza | Archivo |
|---|---|
| Feed público | `app/comunidad/page.tsx` → `components/community/community-feed.tsx` + `post-card.tsx` |
| Panel admin | `app/comunidad/admin/page.tsx` → `components/community/community-admin.tsx` |
| Cliente API | `components/community/api.ts` |
| Tab SuperAdmin | `components/superadmin/tabs/CommunityTab.tsx` (registrado en `SuperadminLayout.tsx`) |
| Redirect rol | `app/login/page.tsx` + guard en `components/merchant-panel.tsx` |

- **Feed:** filtros Reciente/Populares/Noticias/Videos + búsqueda; cada post con
  media (carrusel + embed YouTube), like/save, comentarios y anuncios con link a
  `/t/:slug`. Reaccionar/comentar sin sesión redirige a login.
- **Panel admin:** Mis publicaciones · Nueva/editar (título, contenido, media via
  Cloudinary + video por URL, categoría, **adjuntar productos públicos**) ·
  Moderar comentarios · Estadísticas.
- **SuperAdmin → tab "Comunidad":** crear `comunidad_admin`, listar admins,
  métricas globales (posts, reacciones, comentarios, admins).

## Flujo

SuperAdmin crea `comunidad_admin` → ese usuario entra y es llevado a
`/comunidad/admin` → crea un post con texto + media → busca productos públicos y
los adjunta como anuncio → publica. El visitante ve `/comunidad`, da like, comenta,
guarda y desde el anuncio va a la tienda (`/t/:slug`).

## Extras

- **Scroll infinito:** el feed (`community-feed.tsx`) carga la siguiente página
  automáticamente con un `IntersectionObserver` (sentinel + guard anti-doble-carga),
  reemplazando el botón "Cargar más".
- **Notificaciones al comercio:** cuando un post **publicado** adjunta un producto
  como anuncio, se crea una notificación para el comercio dueño del producto.
  - Migración: `backend/src/migrations/add_notifications.sql` (tabla `notifications`).
  - Backend: `backend/src/modules/notifications/notifications.routes.ts`
    (`GET /api/notifications`, `/unread-count`, `POST /:id/read`, `/read-all`) +
    helper `createNotification(tenantId, …)` reutilizable. La emisión ocurre en
    `community.routes.ts` al crear un post publicado o al publicar un borrador con anuncios.
  - Frontend: `components/notifications-bell.tsx` (campana con contador y dropdown,
    auto-refresh cada 60s), integrada en el header clásico (`header.tsx`) y en el
    tema comerciante (`panel-comerciante-shell.tsx`).

## Cómo probar

1. Aplicar `add_community_module.sql` y `add_notifications.sql`.
2. SuperAdmin → tab **Comunidad** → crear un admin de comunidad.
3. Entrar con ese usuario (redirige a `/comunidad/admin`) → crear un post, adjuntar
   un producto de una tienda pública y **publicar**.
4. El comercio dueño del producto verá la notificación en la campana de su panel.
5. Abrir `/comunidad` para ver el feed, hacer scroll (carga infinita) e interactuar.
