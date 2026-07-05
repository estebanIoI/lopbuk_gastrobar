# 🧩 Módulo: Product Templates (Plantillas Dinámicas de Producto)

> Sistema tipo Shopify product templates: cada producto se convierte en una landing
> de venta configurable sin código. **JSON-driven**: la plantilla guarda estructura
> (`sections`), el contenido llega de `{{product.*}}` + `products.page_content`.
> Creado 2026-07-03. El hero de compra (galería/variantes/precio/CTA) NO se toca:
> las secciones se renderizan debajo.

## Arquitectura

```
product_templates (tenant)          products
  sections: [                         template_id  ──→ plantilla asignada
    { id, type, settings,             page_content ──→ contenido único (video,
      order, visible }                                beneficios, faqs, testimonios)
  ]
  status: draft|published|archived

Render público: GET /storefront/product-page/:productId
  → secciones de la plantilla PUBLICADA (visible=true) + page_content
  → caché en memoria 60s · sin plantilla o draft → { sections: [] }
```

## Tipos de sección (10 — contrato en `section-types.ts`, espejo en frontend)

`benefits` · `rich_text` (markdown-lite + imagen) · `video` (YouTube/TikTok/MP4) ·
`faq` (acordeón; suma `page_content.faqs`) · `testimonials` (reviews APROBADAS auto +
manuales) · `comparison` (tabla vs competencia) · `urgency` (stock real + countdown) ·
`guarantees` (trust badges) · `image_banner` (CTA) · `related` (reemplaza la nativa)

Variables: `{{product.title|price|compare_price|stock|brand|category|description}}`,
`{{store.name|whatsapp}}` — resueltas en `frontend/lib/template-vars.ts`.

## Archivos

| Archivo | Rol |
|---|---|
| `backend/src/modules/product-templates/section-types.ts` | Contrato + `normalizeSections()` (valida tipos, límites) |
| `backend/src/modules/product-templates/product-templates.service.ts` | CRUD, duplicar, estados, assign masivo, page_content, página pública con caché |
| `backend/src/modules/product-templates/product-templates.routes.ts` | Rutas del panel (`authorize('superadmin','comerciante')`) |
| `backend/src/modules/product-templates/default-templates.ts` | Semillas Moda/Tecnología/Belleza (nacen publicadas) |
| `frontend/components/product-template/SectionRenderer.tsx` | Render de las 10 secciones — MISMO código en tienda y preview del editor |
| `frontend/lib/template-vars.ts` | `resolveTemplateVars()` |
| `frontend/components/product-template-editor.tsx` | Editor visual: lista, secciones drag&drop (HTML5 nativo + flechas), settings por tipo, preview, asignación masiva, contenido por producto |

## Endpoints

```
GET    /api/product-templates                 lista con # productos asignados · auth
GET    /api/product-templates/:id             detalle · auth
POST   /api/product-templates                 crear (draft) · comerciante
POST   /api/product-templates/seed-defaults   crea Moda/Tech/Belleza si no hay ninguna
PUT    /api/product-templates/:id             actualizar nombre/secciones
PATCH  /api/product-templates/:id/status      draft | published | archived
POST   /api/product-templates/:id/duplicate   copia en draft (versionado ligero)
DELETE /api/product-templates/:id             soft delete (huérfanos ignorados con gracia)
PATCH  /api/product-templates/assign          { productIds[], templateId|null } masivo
PUT    /api/product-templates/products/:id/page-content   contenido único del producto
GET    /api/storefront/product-page/:productId             PÚBLICO · caché 60s
```

## Integración en el storefront

- **Detalle clásico** (`landing-page.tsx`): fetch al abrir el modal; secciones montadas
  en móvil (fin del layout móvil) y desktop (antes de relacionados). Si la plantilla
  trae sección `related`, la nativa se oculta. `renderTemplateSections(isLightBg)`.
- **Detalle ML**: mismas secciones debajo de `<ProductDetailML>` (fondo claro).
- **SEO ligero**: JSON-LD `Product` schema + `document.title` al abrir el detalle
  (client-side; Google lo lee vía JS).
- **Editor**: tab "Plantillas" en store-customization → `ProductTemplateEditor`.

## Panel del comerciante (flujo)

1. Tab Plantillas → "Crear ejemplos" (semillas) o "Nueva".
2. Editor: agregar secciones del catálogo, arrastrar/flechas para ordenar,
   duplicar/ocultar/eliminar, configurar settings, vista previa en vivo.
3. Guardar borrador o Publicar (solo published se renderiza en la tienda).
4. "Asignar" → buscar productos → asignación masiva (o quitar). Botón "Contenido"
   por producto → video/beneficios/FAQs/testimonios propios (page_content).

## Reglas

- La plantilla NUNCA guarda contenido de producto (precio/stock/nombre): solo variables.
- Solo `status='published'` se sirve al público; draft/archived → `sections: []`.
- Tipos de sección desconocidos se rechazan al guardar y se ignoran al renderizar
  (forward-compatible).
- `sections` máx 25, settings máx 20KB por sección (defensa de performance).

## Pendientes (declarados — Fases 2-3 del spec)

- [ ] SEO SSR: slugs + ruta `app/p/[slug]` + OG tags para crawlers.
- [ ] Responsive por breakpoint, animaciones, tabs, carrusel/lightbox como secciones.
- [ ] Bloques globales, historial de versiones completo, A/B testing, analytics por sección.
- [ ] Selector de plantilla dentro del form de edición de producto del inventario
  (hoy la asignación vive en el editor de plantillas, que además permite masivo).
- [ ] PageContentModal: precargar el page_content existente del producto (el GET de
  products no lo devuelve aún; hoy el modal inicia vacío y sobrescribe al guardar).

← [[DAIMUZ]] · [[modules/products/products]] · [[modules/storefront/storefront]]
