# 🚦 Quality Gate — Tema 2 · Auditoría CTO / UX Lead / Staff Frontend · 2026-07-22

> Revisión final "como si mañana lo evaluara ingeniería + diseño de Shopify/Stripe/Vercel/Linear".
> Ejecutada la **división en subcomponentes** exigida. Nota de ingeniería (repetida por honestidad):
> este entorno **no compila** (`next build`) ni corre Lighthouse; la validación final es tuya.

---

## 🔨 Lo que refactoricé (ejecutado)

`home-theme2.tsx` estaba en **1640 líneas** con todo mezclado (tokens, utils, tipos, iconos, 4
componentes y la página). Lo dividí en un módulo por responsabilidad, **moviendo el código verbatim**
(sin cambiar lógica) y preservando el **contrato de exportación** que consume `landing-page.tsx`:

```
components/
├── home-theme2.tsx          1640 → 1170 líneas (solo la página + re-exports)
└── marketplace/
    ├── theme.ts     (94)   tokens de marca + color/contraste + fmtCOP + waLink + reduced-motion
    ├── types.ts     (84)   HeroSlide, MarketStore, MarketProduct, RubroCategory, PromoCardConfig, catálogos
    ├── icons.tsx    (42)   RUBRO_ICONS + rubroIcon
    ├── cards.tsx   (142)   StoreCard + ProductCard
    └── hero.tsx    (148)   HomeHeroCarousel + HomeCategoryRail
```

- **Contrato público intacto**: `landing-page.tsx` importa `HomeHeroCarousel`, `HomeCategoryRail`,
  `MarketplaceHomeGovCo`, `HeroSlide`, `PromoCardConfig` desde `home-theme2` → todo se re-exporta.
  Verificado que ningún otro símbolo externo se rompe (StoreCard/ProductCard/utils eran privados).
- **Separación de responsabilidades**: tokens/utilidades puras (testables en aislamiento), tipos,
  presentación (cards, hero) y orquestación (la página) quedan separados.
- **Reutilización**: `theme.ts` y `cards.tsx`/`hero.tsx` ya son reutilizables por otros temas (D1, etc.).

## ⚡ Lo que optimicé
- **Poda de imports muertos**: eliminados 14 imports sin uso (`UtensilsCrossed`, `Pill`, `Apple`,
  `Wrench`, `Scissors`, `Dog`, `Wine`, `Croissant`, `Coffee`, `Shirt`, `Gem`, `Flower2`, `Bell`, `cldSrcSet`).
- **`loading="lazy"` / `decoding="async"`** en las imágenes de producto que faltaban.
- **Cifras** del sidebar con separador de miles (`es-CO`).
- **`prefers-reduced-motion`** respetado (carrusel + placeholder + CSS global).
- **Tipografía consistente**: el marco de bienvenida ahora usa Montserrat (antes "Inter").
- **Franja de confianza** con datos reales (verificados, ofertas), sin relleno inventado.

## 🔎 Lo que encontré (y su estado)
| Hallazgo | Estado |
|---|---|
| Archivo monolítico de 1640 líneas | ✅ Dividido en 6 módulos |
| Utilidades/tokens repetibles enterrados en el componente | ✅ Extraídos a `theme.ts` |
| Imports sin uso | ✅ Podados (14) |
| Imágenes de producto sin lazy | ✅ Corregido |
| Jerarquía de headings / H1 | ✅ (pasadas previas) 1 H1, sin saltos |
| WhatsApp roto | ✅ (pasada previa) configurable, sin links muertos |
| SEO server-side (metadata/JSON-LD/robots/sitemap) | ✅ (pasada previa) |
| Accesibilidad (foco, nombres, skip-link, reduced-motion) | ✅ (pasadas previas) |

## 🧭 Lo que decidí NO tocar (y por qué)
- **No fusioné StoreCard (oscura) y ProductCard (clara) en un estilo único.** El contraste tienda-oscura /
  producto-claro es una decisión de diseño deliberada y con carácter; homogeneizar restaría personalidad.
- **No extraje Header/Footer/HeroSection de la página a subcomponentes.** Dependen de mucho estado y
  handlers locales; extraerlos generaría *prop-drilling* de 10+ props y **más** complejidad, no menos.
  El límite sano del split es el que hice (presentación pura fuera; orquestación dentro).
- **No migré a `next/image` ni hice SSR de datos.** Requieren `next build` para validarse; documentado
  en [[decisions/theme2-corporate-implementation-2026-07-22]]. Hacerlo a ciegas sobre la home de
  producción es el tipo de cambio que debe pasar por CI, no por un commit sin compilar.
- **No inventé testimonios/logos.** El contenido de confianza real lo aporta el negocio; falsificarlo
  resta credibilidad ante el mismo comité que evaluaría el producto.

## ⚠️ Riesgos futuros
1. **Este refactor no está compilado aquí.** Es import-compatible por construcción y los cuerpos son
   verbatim, pero **debe pasar `next build` + smoke test antes de desplegar**. Si algo falla, estará
   aislado en los ~6 encabezados de import de los módulos nuevos (fáciles de ajustar); la versión previa
   está en el historial de git como fallback.
2. `next.config.ts` tiene `typescript.ignoreBuildErrors: true` → un error de tipos no rompe el build pero
   tampoco te avisa. Recomendado correr `tsc --noEmit` en CI aparte.
3. La home pública sigue siendo CSR (deuda de SSR de datos) → techo de SEO/LCP hasta abordarla.

## 💳 Deuda técnica restante
- SSR de datos del landing (arquitectura) · migración a `next/image` · pruning fino de `any` (queda 1
  `as any` interno en el callback de `StoresSection`) · URLs sociales reales · og-image 1200×630.
- Componente página aún ~1170 líneas (aceptable para una home con doble branch móvil/desktop, pero es el
  siguiente candidato si se quiere bajar de 800: extraer `MobileHome` y `DesktopHome` como archivos).

---

## 🏁 Calificación final: **8.5 / 10**

**Justificación objetiva.** A nivel de **código y arquitectura** el Tema 2 está ahora en un estado que
pasaría una revisión de Staff Frontend: modular, tipado, con responsabilidades separadas, accesible
(WCAG AA en lo verificable), con SEO server-side, sin imports muertos y sin links rotos. Eso vale un 8.5.

**Por qué no un 10 (honestamente):** los 1.5 puntos restantes **no se pueden cerrar desde aquí**, y
fingir que sí sería el tipo de deshonestidad que un comité de Stripe detectaría al instante:
- **−0.7** verificación real: sin `next build` + Lighthouse + QA visual en navegador no puedo *certificar*
  "0 warnings" ni el pixel-polish final (espaciados/timing) que separa un 9 de un 10.
- **−0.5** SSR de datos + `next/image` (arquitectura pendiente).
- **−0.3** contenido de marca real (fotografía, testimonios, redes) que no es código.

**Criterio de salida:** a nivel de refactor y calidad de código, **no encuentro más mejoras razonables
sin cambiar el producto funcionalmente o sin un navegador delante.** Considero el Tema 2 **listo para el
Quality Gate**, condicionado a que corras el build + un vistazo visual. Con eso, subiría a 9–9.5.

← [[decisions/theme2-refinement-pass2-2026-07-22]] | [[DAIMUZ]]
