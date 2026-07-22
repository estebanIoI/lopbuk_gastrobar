# 🏛️ Revisión de Nivel Corporativo — Tema 2 (Home público) · 2026-07-22

> Auditoría de `frontend/components/home-theme2.tsx` como **cara pública** del marketplace.
> Enfoque: SEO/discoverabilidad, rendimiento (Core Web Vitals), accesibilidad (WCAG),
> confianza/conversión, y calidad de código. No es seguridad (eso vive en [[security/README]]).

## Veredicto rápido

**7.5 / 10 — sólido y por encima del promedio, con brechas que un sitio corporativo público debe cerrar.**
El diseño y la ingeniería del componente son buenos; lo que falta es sobre todo *discoverabilidad*
(SEO/SSR) y *accesibilidad*, más 2 bugs de enlaces. Cerrando los P0/P1 llega a ~9/10.

| Dimensión | Nota | Comentario |
|---|---|---|
| Diseño visual / UX | 9/10 | Glass sticky header, theming con contraste automático, rama móvil con bottom-nav. Muy pulido. |
| SEO / discoverabilidad | 5/10 | Componente 100% client-side; falta `<h1>` con banner; sin datos estructurados. |
| Rendimiento (CWV) | 7/10 | Hero sin CLS (buen truco de sizer), pero `<img>` sin dimensiones en tarjetas y todo CSR. |
| Accesibilidad (WCAG) | 6/10 | Buen contraste calculado, pero inputs sin label, foco poco visible, autoplay sin control. |
| Confianza / conversión | 7/10 | Empty states y métricas ok; copy "Acceder al OS" es jerga; contacto roto. |
| Calidad de código | 8/10 | Bien memoizado y tipado; componente monolítico (~1540 líneas) mantenible pero grande. |

---

## 🔴 P0 — Bloqueantes para "público corporativo"

### 1. La home es 100% client-side (`'use client'`) → mala SEO y LCP
El contenido (comercios, ofertas, hero) se hidrata en el cliente; el HTML inicial que ven Google,
WhatsApp/Meta (preview de link) y el primer paint es un **shell vacío + spinner**. Para la página
que "recibe al público" esto cuesta posicionamiento y hace que compartir el link no muestre nada.
- **Fix:** renderizar en el servidor al menos el hero + primeros comercios (Server Component o ISR),
  y añadir `generateMetadata()` en el `page.tsx` de la ruta con `title`, `description`, Open Graph e
  imagen. Verificar el archivo de ruta que monta este tema (no auditado aún — te lo reviso si quieres).

### 2. Falta `<h1>` cuando el hero tiene banner
El único `<h1>` está en el **fallback sin slides** (líneas 816 y 1192). Con el banner activo (caso
normal, p.ej. *nua*) la página **no tiene `<h1>`** — los títulos de slide son `<h2>`. Una página
pública debe tener exactamente un `<h1>` significativo.
- **Fix:** un `<h1>` siempre presente (puede ser `sr-only` con la propuesta de valor: p.ej.
  "DAIMUZ — Marketplace de comercios locales"), o promover el título del slide activo a `<h1>`.

### 3. Enlaces de contacto rotos (WhatsApp sin número)
`https://api.whatsapp.com/send` aparece **3 veces** (nav "Contacto" L1135, footer social L1527,
footer link L1542) **sin `?phone=`** → abre WhatsApp sin destinatario.
- **Fix:** `https://wa.me/57XXXXXXXXXX?text=Hola...` con el número real (de plataforma o del comercio),
  idealmente configurable desde superadmin como el resto del tema.

---

## 🟠 P1 — Importantes

### 4. Accesibilidad
- **Inputs de búsqueda sin label accesible**: solo `placeholder`, que además **rota cada 3.2 s**
  (L606). Un lector de pantalla no lo capta bien. → añadir `aria-label` fijo ("Buscar en el marketplace").
- **Foco de teclado poco visible**: muchos botones dependen de `hover`/`-translate-y`; falta un anillo
  `focus-visible` consistente. → añadir `focus-visible:ring-2` global a botones/enlaces.
- **Movimiento**: el carrusel hace autoplay y el placeholder parpadea; no respetan
  `prefers-reduced-motion`. → pausar autoplay y rotación si el usuario lo pide; el carrusel ya pausa
  en hover pero no en foco de teclado.

### 5. Imágenes sin `next/image` ni dimensiones (CLS + peso)
Las tarjetas usan `<img>` con `eslint-disable @next/next/no-img-element`. Los logos de comercio
(L407) traen `srcSet`+`sizes` (bien) pero **sin `width`/`height`** → riesgo de CLS y sin AVIF/優
optimización automática. El hero ya evita CLS con el sizer invisible.
- **Fix:** migrar a `next/image` (o reservar aspecto con `width`/`height`/`aspect-ratio`). Mantener
  Cloudinary vía `loader` custom.

### 6. Copy "Acceder al OS" (L908)
"OS" es jerga interna; para un consumidor final confunde. → "Ingresar" / "Iniciar sesión". (La barra
superior es buena; solo el término.)

---

## 🟡 P2 — Pulido

7. **Componente monolítico (~1540 líneas)** con ramas móvil+escritorio en un solo archivo. Mantenible
   pero conviene extraer `Header`, `Hero`, `StoresGrid`, `Footer` a subcomponentes.
8. **Autoplay del carrusel** sin botón de pausa visible ni parada en foco → añadir control accesible.
9. **`<img>` con eslint-disable**: decisión conocida (Cloudinary). Documentar el porqué o migrar (ver P1.5).
10. **Skeletons**: el estado de carga vive en el padre; considerar skeletons de hero/tarjetas para
    evitar el salto de layout al hidratar.

---

## 🟢 Lo que ya está a buen nivel (no tocar)
- Theming con **contraste calculado** (`readableOn`, `complementaryAccent`) — nivel alto, evita texto ilegible sobre paletas generadas por IA.
- **Rama móvil dedicada** con bottom-nav — buena UX real, no solo responsive.
- **Memoización** correcta de derivados (`visibleStores`, `rubros`, `allCategories`).
- `rel="noopener noreferrer"` en todos los enlaces externos.
- **Empty states** presentes ("No hay comercios disponibles aún").
- Hero **sin CLS** gracias al sizer invisible (buen detalle).

---

## Orden sugerido de ejecución
1. P0.2 (`<h1>`) y P0.3 (WhatsApp) — 15 min, cero riesgo.
2. P0.1 (SSR + metadata + OG + JSON-LD) — el de mayor impacto en SEO; requiere tocar el `page.tsx`.
3. P1.4 (a11y) y P1.5 (imágenes) — cierran el nivel corporativo.

← [[decisions/lopbuk-landing-qa-checklist]] | [[DAIMUZ]]
