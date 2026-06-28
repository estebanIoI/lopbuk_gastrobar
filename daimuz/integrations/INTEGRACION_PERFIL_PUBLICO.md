# Tema 3 — Perfil Público del Tenant

Página pública tipo "perfil de red social" por negocio: banner + foto + nombre +
tagline + links, secciones dinámicas ordenables (drag & drop) y un mini-catálogo
de productos públicos de la tienda. Integrado como **theme3** del sistema de temas
existente y como URL propia `/p/:slug`.

## Base de datos

Migración: `backend/src/migrations/add_tenant_profile.sql`

- **`tenant_profile`** — datos fijos (1 por tenant): `cover_url`, `profile_photo_url`,
  `display_name`, `tagline`, `about_text`, `instagram`, `whatsapp`, `website`,
  `accent_color`, `is_published`. (`UNIQUE(tenant_id)`)
- **`profile_sections`** — secciones dinámicas: `section_type`
  (`image_text|video|gif|description|gallery`), `order_index`, `content` (JSON
  según tipo), `is_active`.

El tema de tienda vive en `store_info.store_theme` y ahora admite `theme3`.

## Backend — `backend/src/modules/profile/profile.routes.ts`

Registrado en `src/index.ts` → `app.use('/api/profile', profileRoutes)`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/profile/:slug` | No | Perfil público completo (solo si publicado) |
| GET | `/api/profile/:slug/products` | No | Productos públicos de la tienda |
| GET | `/api/profile` | Sí | Perfil del propio comercio (para el editor) |
| PUT | `/api/profile` | Sí | Actualizar datos fijos (upsert) |
| POST | `/api/profile/sections` | Sí | Crear sección |
| PUT | `/api/profile/sections/order` | Sí | Reordenar (array de ids) |
| PUT | `/api/profile/sections/:id` | Sí | Editar sección |
| DELETE | `/api/profile/sections/:id` | Sí | Eliminar sección |

`{ success, data }`, `tenant_id` siempre desde el JWT. La ruta `/sections/order`
se registra antes de `/sections/:id` para evitar colisión de parámetros.

## Frontend — `frontend/components/profile-theme3/`

| Archivo | Rol |
|---|---|
| `profile-theme-three.tsx` | Layout completo (viewer). Acepta `data` para preview. |
| `profile-header.tsx` | Banner + foto + nombre + tagline + links (IG/WA/Web). |
| `section-renderer.tsx` | Renderiza cada sección según su tipo. |
| `products-showcase.tsx` | Grid de productos públicos. |
| `profile-editor.tsx` | Editor admin: datos fijos + secciones con **drag & drop** + ↑/↓ + publicar + vista previa. |
| `types.ts` | Tipos + helpers (API_URL, ytEmbed, formatCOP). |

Rutas/puntos de entrada:
- **Pública:** `app/p/[slug]/page.tsx` → `lopbuk.com/p/:slug`.
- **Tema de tienda:** `app/t/[slug]/page.tsx` renderiza `ProfileThemeThree` cuando
  el tema es `theme3` (junto a theme1/theme2).
- **Editor:** sección `perfil` del panel del comercio
  (`merchant-panel.tsx`, `sidebar.tsx`, `lib/modules.ts`, `lib/panel-sections.ts`).
- **Selector de tema:** `store-card-config.tsx` ahora ofrece "Tema 3 · Perfil público"
  (validado y persistido en el backend storefront).

## Cómo probar

1. Aplicar `add_tenant_profile.sql`.
2. Panel del comercio → activar módulo **Perfil público** (Tienda Online).
3. Sección **Perfil público**: completar datos, agregar/ordenar secciones, **Publicar**.
4. Abrir `/p/<slug>` (o elegir "Tema 3" en la config de tienda y abrir `/t/<slug>`).

## Notas

- **Subida de imágenes:** portada, foto de perfil, imagen de "Imagen + Texto", GIF
  y galería usan el uploader existente `CloudinaryUpload` (botón "Subir imagen" a
  Cloudinary + opción de pegar URL + preview). El video sigue siendo un link
  (YouTube/MP4). Requiere que el superadmin configure Cloudinary en Integraciones.
- El reordenamiento usa **drag & drop nativo HTML5** + botones ↑/↓ (sin dependencias).
- Los productos del showcase salen de `products` con `published_in_store = 1` y `stock > 0`.
- Quedó un archivo huérfano inofensivo en `components/profile-theme3/types.ts` (raíz
  del repo, fuera de `frontend/`, no se importa) por un guardado inicial en ruta
  equivocada; puede borrarse manualmente.
