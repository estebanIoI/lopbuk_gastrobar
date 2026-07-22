# 🏛️ Implementación Corporativa — Tema 2 (Home público) · 2026-07-22

> Ejecución de las mejoras de [[decisions/theme2-corporate-review-2026-07-22]]. Se **aplicó código
> real** (no solo análisis). Nota de ingeniería honesta: **este entorno no puede correr `next build`,
> ESLint ni Lighthouse** (sin `node_modules`, sin egress a npm), así que las métricas finales las
> generas tú con los comandos del final. No hay números inventados.

## Archivos modificados / creados

| Archivo | Cambio |
|---|---|
| `frontend/app/layout.tsx` | SEO: `title` template, **canonical**, **robots**, OG `es_CO` + imagen 1200×630, **Twitter `summary_large_image`**, **JSON-LD** (Organization + WebSite + SearchAction) server-rendered, viewport `viewport-fit: cover`. |
| `frontend/app/robots.ts` | **Nuevo.** `robots.txt` generado por Next: permite público, bloquea `/panel`, `/login`, `/api`, etc. + sitemap. |
| `frontend/app/sitemap.ts` | **Nuevo.** `sitemap.xml` base (raíz + portfolio; extensible a tiendas por slug). |
| `frontend/app/globals.css` | **Accesibilidad global**: `:focus-visible` consistente, `prefers-reduced-motion` (neutraliza animaciones/transición/scroll), estilos de `.skip-link`. |
| `frontend/components/home-theme2.tsx` | H1 único + jerarquía, WhatsApp funcional/configurable, `aria-label`s, skip-link, reduced-motion en carrusel y placeholder, copy comercial. |

---

## ✅ Ejecutado (P0 + gran parte de P1)

### P0.1 — SEO server-side (lo viable sin re-arquitectura)
- `generateMetadata` equivalente vía `metadata` en el layout (Server Component): **canonical**, **robots**
  (index/follow + googleBot max-image-preview large), **Open Graph** completo (locale `es_CO`, imagen
  1200×630), **Twitter `summary_large_image`**.
- **Datos estructurados JSON-LD** (Organization + WebSite con **SearchAction** → sitelinks searchbox)
  emitidos en el `<head>` **desde el servidor**.
- **`robots.ts` + `sitemap.ts`** (App Router) → server-generated, compatibles con Google Search Console.

### P0.2 — H1 único + jerarquía
- Un **único `<h1>`** (accesible, `sr-only`) siempre presente con la propuesta de valor. Como los
  banners son imágenes, el H1 vive en el DOM para SEO/lectores de pantalla.
- Los titulares de hero-fallback pasaron de `<h1>` a `<h2>`; secciones en `<h2>`. Sin saltos H1→H2→H3.

### P0.3 — WhatsApp funcional
- Helper `waLink()` + número **configurable por `NEXT_PUBLIC_WHATSAPP`** (o prop `contactWhatsApp`).
- **Eliminados los 3 `api.whatsapp.com/send` rotos** (navbar, footer social, footer link). Si no hay
  número, el enlace cae a un ancla interna `#contacto` (footer con `id="contacto"`) — **cero links rotos**.

### P1 — Accesibilidad (WCAG AA)
- **`:focus-visible`** visible y consistente en todo interactivo (globals.css).
- **`prefers-reduced-motion`**: global (CSS) + guard explícito en el **autoplay del carrusel** y en la
  **rotación del placeholder**.
- **Skip-link** "Saltar al contenido" (→ `<main id="contenido">`) en móvil y escritorio.
- **`aria-label`** en inputs de búsqueda (el placeholder rota, ahora hay nombre accesible estable),
  botón de carrito, e iconos sociales; iconos decorativos marcados `aria-hidden`.
- `type="search"` en los buscadores.

### Copy
- **"Acceder al OS" → "Ingresar"** (con `aria-label` "Ingresar a tu cuenta"). Jerga eliminada del top bar.

### Código
- Quitado un `as any` del ring del input (→ `CSSProperties`).

---

## ⏳ Diferido a propósito (con plan) — requiere tu build o una decisión

> No lo dejo a medias por pereza: lo dejo documentado porque **hacerlo a ciegas sobre tu home de
> producción, sin poder compilar, sería irresponsable**. Cada uno con su camino:

### 1. SSR **de los datos** del landing (no solo metadata)
Hoy `/` (`app/page.tsx`) es `'use client'` y **gatea por autenticación** (cookies/localStorage); el
público ve `<LandingPage>` con los datos fetch-eados en cliente. Server-renderizar el contenido exige
**des-acoplar el marketplace público del gate de auth**. Opción recomendada: una ruta pública dedicada
(p.ej. Server Component que haga `fetch` de `stores`/`platform-settings` con `revalidate` ISR y pase los
datos ya renderizados al Tema 2), y que `/` redirija/streamee según sesión. Es un cambio de arquitectura
que **debe** compilarse y probarse. Lo abordamos como tarea propia cuando quieras.

### 2. Migración a **`next/image`**
`next.config.ts` ya permite cualquier host https, así que es viable. No la apliqué en masa porque en una
página pública que no puedo compilar, un `fill`/`sizes` mal puesto rompe imágenes en producción. El CLS
hoy está **acotado** (contenedores de alto fijo + el truco del sizer en el hero). Plan: migrar por tipo
de tarjeta (`StoreCard`, `ProductCard`, hero) con `fill` + `sizes`, validando en `next build`.

### 3. Confianza (testimonios, logos, sellos)
No inventé testimonios ni logos falsos (eso empeora la percepción "plantilla" y la confianza). La página
**ya tiene** señales reales: barra de métricas (comercios/ofertas), badge "MÁS POPULAR", verificados,
tarjetas de rol. Recomendado añadir con contenido **real**: 2–3 testimonios, sellos de pago, y garantía.

### 4. Skeletons de carga
El estado de carga vive en el **padre** (`LandingPage`), no en el Tema 2. Recomendado: skeletons de hero
+ grid usando el prop `loadingStores` que el componente ya recibe.

---

## 📊 Antes / Después

Cualitativo (verificable por inspección):

| Área | Antes | Después |
|---|---|---|
| H1 | Ausente cuando hay banner | Exactamente 1, jerarquía correcta |
| WhatsApp | 3 enlaces rotos | 0 rotos; configurable |
| Metadata social | OG básico, Twitter `summary` | OG `es_CO` + 1200×630, Twitter large image |
| Datos estructurados | Ninguno | Organization + WebSite + SearchAction |
| robots / sitemap | No | Sí (server-generated) |
| Foco de teclado | Inconsistente | `:focus-visible` global |
| Reduced motion | No respetado | Global + carrusel + placeholder |
| Skip-link | No | Sí |
| Nombres accesibles inputs | Solo placeholder rotativo | `aria-label` estable |
| Copy | "Acceder al OS" (jerga) | "Ingresar" |

> **Lighthouse / Core Web Vitals**: no los mido aquí (no hay build). Estos cambios atacan directamente
> **SEO** (metadata, JSON-LD, H1, sitemap) y **Accesibilidad** (foco, nombres, contraste de foco,
> reduced-motion, skip-link), que son las auditorías donde estaban las brechas. Mídelos así ⤵

---

## 🔧 Verificación (en tu entorno)

```bash
cd frontend
# 1) Configurar el WhatsApp real (y opcional og-image 1200x630 en /public/og-image.png)
echo "NEXT_PUBLIC_WHATSAPP=573001234567" >> .env.local

# 2) Tipos + lint + build de producción
npx tsc --noEmit
npm run lint
npm run build && npm run start

# 3) Lighthouse (Chrome) contra la home
npx --yes lighthouse http://localhost:3000 --only-categories=seo,accessibility,best-practices,performance --view

# 4) Validar datos estructurados y robots/sitemap
#    https://search.google.com/test/rich-results  (pega la URL o el HTML)
#    http://localhost:3000/robots.txt   y   http://localhost:3000/sitemap.xml
```

Objetivo tras verificar: SEO ≥ 95, Accesibilidad ≥ 95, Best Practices ≥ 95. Si Lighthouse marca algo,
me pasas el reporte y lo cierro.

---

## ▶️ Siguiente
Cuando corras el build y me confirmes que compila, cerramos los 4 diferidos (SSR de datos, next/image,
confianza real, skeletons) y el Tema 2 queda a nivel Shopify/Stripe. Luego, como acordamos, arrancamos
la **seguridad** (IDOR, authz, hardening, OWASP).

← [[decisions/theme2-corporate-review-2026-07-22]] | [[DAIMUZ]]
