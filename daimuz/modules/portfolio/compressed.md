# portfolio — compressed

> 5 líneas. Módulo sin doc completo aún.

- **Qué es**: portafolio público de la marca DAIMUZ/Lopbuk — landing pública en `/portfolio` que muestra tenants destacados y planes
- **Singleton**: tabla `portfolio_config` siempre tiene `id = 1` — 1 solo registro de configuración global
- **Config**: hero_title, hero_subtitle, hero_image_url, contact_email/whatsapp/instagram, accent_color, featured_tenant_ids (JSON array)
- **`show_featured_stores`**: si activo, muestra las tiendas de los tenants en `featured_tenant_ids` como casos de éxito
- **Equipo**: tarjetas = carnet 3D `Lanyard` (Spline/three) con foto + banda configurable (`portfolio_team_cards`, col `band_image_url`)
- **Robot IA**: `<spline-viewer>` (CDN) + chat público vía `POST /chatbot/platform-assistant/message` (`runPublicAssistant`, requiere asistente habilitado). Escena en `portfolio_config.robot_spline_url`
- **Archivos**: `portfolio.routes.ts`, `app/portfolio/page.tsx`, `components/portfolio/{lanyard,lanyard-showpiece,robot-assistant}.tsx` · Tablas: `portfolio_config`, `portfolio_team_cards`

---

← [[DAIMUZ]] | [[indexes/modules-index]]
