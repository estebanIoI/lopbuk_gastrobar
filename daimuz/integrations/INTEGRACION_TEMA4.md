# Tema 4 — Servicios Profesionales (Adaptable)

Tema de tienda (`store_info.store_theme = 'theme4'`) para empresas de servicios.
Se adapta por **tipo de negocio**: `transport`, `software` o `general`. El comercio
activa las secciones que necesita. Conectado a la Comunidad vía la barra de like/save.

## Base de datos — `backend/src/migrations/add_theme4.sql`

`theme4_config` (tipo, hero, CTA, contacto, flags `show_*`, contadores, publicado),
`theme4_services`, `theme4_fleet` (transporte), `theme4_routes` (transporte),
`theme4_projects` (software), `theme4_stats`, `theme4_steps`, `theme4_team`,
`theme4_testimonials`, `theme4_reactions` (like/save de la CommunityBar).
Multi-tenant, IDs UUID, JSON para listas (features, stops, screenshots, tech_stack).

## Backend — `backend/src/modules/theme4/theme4.routes.ts`

Registrado en `src/index.ts` → `app.use('/api/theme4', theme4Routes)`.

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/theme4/:slug` | público (perfil completo, solo si publicado) |
| GET | `/api/theme4/:slug/projects` · `/fleet` · `/routes` | público |
| POST | `/api/theme4/:slug/react` | usuario (like/save) |
| GET | `/api/theme4/admin/me` | comercio (editor) |
| PUT | `/api/theme4/config` | comercio (upsert) |
| POST/PUT/DELETE | `/api/theme4/:entity[/:id]` | comercio |

`:entity` ∈ services, fleet, routes, projects, stats, steps, team, testimonials.
El backend usa un **CRUD genérico** (`makeCrud`) que mapea camelCase↔columna y
serializa los campos JSON.

## Frontend — `frontend/components/theme4/`

| Archivo | Contenido |
|---|---|
| `theme4-layout.tsx` | Orquestador (fetch + composición por tipo/flags). Acepta `data` para preview. |
| `sections.tsx` | Theme4Hero, StatsBanner, ServicesGrid, ProcessSteps, TeamGrid, TestimonialsCarousel, ContactSection, **CommunityBar**, TechStack |
| `specialized.tsx` | FleetShowcase, RoutesPanel (transporte) · ProjectsPortfolio con modal (software) |
| `theme4-editor.tsx` | Editor del comercio: Config (tipo, hero, contacto, toggles) + gestores CRUD por sección (genéricos por esquema) |
| `types.ts` | Tipos + cliente API + helpers |

Integración:
- **Viewer:** `app/t/[slug]/page.tsx` renderiza `Theme4Layout` cuando el tema es `theme4`.
- **Editor:** sección `servicios-pro` del panel (`merchant-panel.tsx`, `sidebar.tsx`,
  `lib/modules.ts`, `lib/panel-sections.ts`).
- **Selector de tema:** `store-card-config.tsx` añade "Tema 4 · Servicios Pro"
  (validado/persistido en el backend storefront, que ahora acepta theme4).

## Conexión con Comunidad

La **CommunityBar** (al pie del perfil) permite like/save del perfil (tabla
`theme4_reactions`, contadores en `theme4_config`), botón Compartir y enlace a
`/comunidad`. Un visitante autenticado reacciona; sin sesión se le envía a login.
(El `comunidad_admin` puede además destacar el comercio en el feed adjuntando sus
productos como anuncios — ver `INTEGRACION_COMUNIDAD.md`.)

## Cómo probar

1. Aplicar `add_theme4.sql`.
2. Panel → activar módulo **Servicios Pro** (Tienda Online).
3. Sección **Servicios Pro**: elegir tipo (transporte/software/general), completar
   hero/contacto, agregar servicios, stats, rutas+flota o proyectos, equipo,
   testimonios; marcar **Publicado**.
4. Configuración → Tema de la tienda → **Tema 4** y abrir `/t/<slug>`.
