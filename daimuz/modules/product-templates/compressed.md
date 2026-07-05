# 🧩 product-templates — compressed

**Qué es:** Plantillas dinámicas de producto (tipo Shopify): landing de venta JSON-driven por producto, sin código. Hero de compra intacto; secciones debajo.

- **DB:** `product_templates` (sections JSON `{id,type,settings,order,visible}`, status draft/published/archived) + `products.template_id`/`page_content` (migración 0011).
- **10 secciones:** benefits, rich_text, video, faq, testimonials (reviews auto), comparison, urgency (stock real), guarantees, image_banner, related. Variables `{{product.*}}`/`{{store.*}}`.
- **Backend:** `modules/product-templates/` — CRUD + duplicar + estados + assign masivo + page_content + seeds Moda/Tech/Belleza. Público: `GET /storefront/product-page/:id` (caché 60s; draft/sin plantilla → `[]`).
- **Frontend:** `product-template/SectionRenderer.tsx` (mismo render en tienda y preview) + `lib/template-vars.ts` + `product-template-editor.tsx` (tab Plantillas: drag nativo + flechas, settings por tipo, preview, asignación masiva, contenido por producto).
- **Integrado:** detalle clásico (móvil + desktop, oculta related nativa si la plantilla trae la suya) y detalle ML. SEO: JSON-LD Product client-side.
- **Regla de oro:** la plantilla guarda ESTRUCTURA, nunca contenido del producto.

Detalle: [[modules/product-templates/product-templates]]
