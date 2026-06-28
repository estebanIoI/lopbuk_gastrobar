# Plan técnico — Rediseño mobile-first del Home (Marketplace)

> Fecha: 2026-06-26
> Componente objetivo: `frontend/components/home-theme2.tsx` → `MarketplaceHomeGovCo`
> Consumido desde: `frontend/components/landing-page.tsx:2640`
> Tipo de decisión: refactor de UI/UX, sin cambios de datos ni de backend.

---

## 0. Diagnóstico (qué tenemos hoy)

El home es **un único componente responsive** (`MarketplaceHomeGovCo`) que sirve
desktop y móvil con clases Tailwind `sm:`. En móvil es un *desktop comprimido*:
hereda la jerarquía de un marketplace de escritorio y la apila verticalmente.

Orden actual de render en móvil (de arriba a abajo):

| # | Bloque | Líneas aprox. | Problema en móvil |
|---|--------|---------------|-------------------|
| 1 | Header: logo + search + hamburguesa | 664–690 | OK, pero search compite con logo |
| 2 | Navbar verde (Inicio · Categorías · Ofertas · Novedades · Contacto) | 693–738 | **1ª capa de navegación** (oculta tras hamburguesa) |
| 3 | Banner bienvenida | 741–757 | Bloque promocional extra |
| 4 | Hero split: carrusel + aside (destacado + "Únete") | 764–832 | En móvil = **3 bloques promo apilados** |
| 5 | Rail "Para ti" (cards producto + acción) | 834–892 | Cards con doble badge + "Disponible" |
| 6 | Tabs (Comercios · Ofertas · Novedades) | 899–905 | **2ª capa de navegación** (duplica navbar) |
| 7 | Chips de rubro (Todos · Tienda · Restaurante…) | 911–923 | **3ª capa de navegación** |
| 8 | Grids `grid-cols-2` comercios/ofertas/novedades | 924–975 | Cards apretadas, mucha metadata |
| 9 | Sidebar (stats + promos + CTA) | 979–1037 | Apilado al fondo, ruido |
| 10 | "Únete a DAIMUZ" (3 cards valor) | 1041–1086 | Sección densa |
| 11 | Footer 4 columnas | 1091–1140 | OK |

**Problemas raíz (coinciden con la crítica):**

1. **Triple navegación** redundante: navbar verde (#2) + tabs (#6) + chips (#7). Tres formas de filtrar lo mismo.
2. **Sobrecarga de hero**: carrusel + card destacado + card "Únete" = 3 promos antes de ver contenido real.
3. **Cards con exceso de metadata**: `StoreCard` (líneas 361–450) muestra cover, logo, nombre, verificado, descripción, MapPin, nº sedes, ciudad, estado abierto/cerrado, próxima apertura. `ProductCard` y las cards de "Para ti" llevan badge de etiqueta + badge de oferta + pill "Disponible" (líneas 850–869).
4. **`grid-cols-2` en móvil**: dos cards por fila → todo comprimido, fotos pequeñas.
5. **Sin respiración**: `space-y-7` global pero demasiados bloques compitiendo.
6. **Sin navegación inferior**: la navegación vive arriba tras una hamburguesa; en móvil moderno se espera bottom nav fija.

**Restricciones que el plan NO puede romper:**

- **Configurabilidad superadmin**: `heroSplit`, `heroRight` (`producto`/`comercio`/`cta`), `promoConfig`, `welcomeEnabled/Title/Subtitle`, `brandLogo`. Todo debe seguir funcionando.
- **Paleta IA**: el tinte por CSS vars (`--brand-green`, `--brand-gold`, …) inyectado vía `brandVars` (líneas 645–659) y el `<style>` de `landing-page.tsx`. Ningún color nuevo puede ser hardcode fuera de ese sistema.
- **Datos sin cambios**: mismos props (`stores`, `products`, `featured`, `offers`, `heroSlides`). Es refactor de presentación.
- **Mismo componente responsive**: no se crea un home móvil separado; se usa un branch `isMobile` + breakpoints. Desktop se mantiene como está.

---

## 1. Nueva arquitectura visual (mobile-first)

Objetivo: pasar de *directorio administrativo* a *experiencia tipo TikTok Shop / Zara / Pinterest commerce*. Menos opciones por viewport, más foco, scroll progresivo.

### 1.1 Jerarquía nueva (orden de render en móvil)

```
┌─ Top bar fija (compacta)        search + acceder
├─ Categorías scroll horizontal   (chips circulares = ÚNICA navegación de filtro)
├─ Hero único                     1 carrusel limpio, 1 CTA máx.
├─ Sección "Trending"            scroll horizontal, máx 8
├─ Sección "Tiendas destacadas"  1 col, cards grandes, máx 4 + "ver todas"
├─ Sección "Ofertas del día"     scroll horizontal
├─ Sección "Nuevos ingresos"     1 col / 2 col opcional
├─ Bloque "Únete a DAIMUZ"       1 card colapsable (no 3)
└─ Footer minimal
   + Bottom nav flotante         Explorar · Tiendas · Ofertas · Cuenta
```

Diferencia clave: **se elimina la pestaña/tabs y se sustituye la navegación por
secciones verticales independientes** ("scrollable stories"). El filtro por rubro
queda como **una sola fila de chips horizontales** arriba; el bottom nav cubre el
salto entre vistas macro.

### 1.2 Principio de render

- En desktop (`lg:`) se conserva el layout actual (hero split + tabs + sidebar). **No se toca.**
- En móvil se introduce un branch: `const [isMobile] = useMediaQuery('(max-width: 767px)')` → renderiza `MobileHome` (subcomponente nuevo dentro del mismo archivo) que reusa `StoreCard`/`ProductCard` refactorizadas y los mismos datos.

---

## 2. Qué eliminar / fusionar (mapa exacto de cambios)

### Eliminar en móvil

- **Navbar verde** (693–738): en móvil no se muestra; su función la asumen los chips de categoría + bottom nav. (En desktop se mantiene.)
- **Tabs** (899–905): se eliminan en móvil. Comercios/Ofertas/Novedades pasan a ser **secciones verticales con título**, no pestañas.
- **Pill "Disponible"** (867–869): fuera. La disponibilidad ya está implícita (stock=0 no se publica, regla del módulo storefront).
- **Banner bienvenida** (741–757): en móvil se fusiona dentro del hero como subtítulo, no como bloque aparte.
- **Card "Únete a DAIMUZ" del hero aside** (824–830): se elimina del hero; su contenido vive solo en la sección "Únete" del fondo.
- **Sidebar de stats/promos** (979–1037): en móvil no se apila completo; "Promos del momento" se fusiona con "Ofertas del día"; "Estadísticas" se omite o pasa a una línea discreta.

### Fusionar

- **Hero (3 bloques → 1)**: carrusel + destacado + CTA → **un solo carrusel** (si hay slides) **o** una sola card hero (si no hay slides). El "destacado" (`topFeatured`/`topStore`) se reubica como **primer ítem de la sección "Trending"**, no como segundo bloque del hero.
- **Filtros (navbar + tabs + chips → chips)**: una única fila `overflow-x-auto` de chips de rubro arriba del contenido.

### Refactor de cards (ver §4)

- `StoreCard` y `ProductCard` ganan una variante "minimal" para móvil.

---

## 3. Spacing system (respiración)

Definir una escala consistente y aplicarla solo en móvil:

| Token | Valor | Uso |
|-------|-------|-----|
| Section gap | `space-y-8` (32px) entre secciones | hoy `space-y-7` con bloques de más |
| Section padding-x | `px-4` (16px) constante | evitar `-mx-1 px-1` que descuadra |
| Card gap (rail) | `gap-3` (12px) | OK |
| Card inner padding | `p-3` mínimo, `p-4` en cards grandes | |
| Heading → contenido | `mb-3` | |
| Items visibles por viewport | **máx 4–6** | hoy se ven 8+ |

Regla: **menos cards por viewport = percepción premium**. En vez de `grid-cols-2`
denso, secciones de 1 columna (cards grandes) o scroll horizontal (rails).

---

## 4. Card system (nuevo)

### 4.1 ProductCard minimal (móvil)

Quitar todo menos lo esencial:

```
┌──────────────┐
│              │
│   imagen     │   aspect-[3/4], object-cover (foto grande tipo Zara)
│              │
├──────────────┤
│ Nombre       │   line-clamp-1
│ $99.900      │   precio (1 línea)
└──────────────┘
```

- **Un solo badge** y solo si aplica: `-20%` (oferta) **o** `Nuevo`, nunca ambos.
- Eliminar: `storeName` (476), pill "Disponible", uppercase metadata.
- Imagen más grande: pasar de `aspect-[4/3]` a `aspect-[3/4]` en móvil.

### 4.2 StoreCard minimal (móvil)

- Mantener: cover, logo, nombre, verificado, **un** indicador de estado (punto abierto/cerrado pequeño).
- Quitar en móvil: descripción larga, MapPin + nº sedes + ciudad + próxima apertura (eso va dentro de la tienda). Líneas 432–446 se condicionan a `sm:`.
- En sección "Tiendas destacadas": card grande a 1 columna con cover a sangre.

### 4.3 Cards "Para ti" (834–892)

- Quitar badge de etiqueta + "Disponible" (851, 867–869). Dejar solo imagen + nombre + precio + (opcional) `-x%`.

---

## 5. Hero simplificado

Reescribir la sección 764–832 con branch móvil:

- **Con slides** (`heroSlides`): solo `<HomeHeroCarousel>` con `isMobile` activado, bordes `rounded-2xl`, sin aside.
- **Sin slides**: una sola card hero (imagen lifestyle o gradiente de marca) con título corto + **1 CTA** (`Explorar`). Sin stickers, sin segundo CTA.
- El `heroRight` (producto/comercio/cta) configurado por superadmin se respeta **solo en desktop**; en móvil ese contenido se degrada a "primer ítem de Trending" para no duplicar promos.
- El banner de bienvenida se inyecta como subtítulo del hero, no como bloque aparte.

---

## 6. Secciones horizontales (rails)

Patrón reutilizable `<HScrollSection title items renderItem seeAllHref>`:

- `flex gap-3 overflow-x-auto snap-x scrollbar-hide` (ya existe el patrón en "Para ti", 843).
- Header con título + link "Ver todo" (no flechas en móvil; las flechas 838–841 quedan `hidden sm:flex`).
- Aplicar a: **Trending** (featured), **Ofertas del día** (offers), **Nuevos ingresos** (products recientes).
- "Tiendas destacadas" va en bloque vertical (cards grandes), no rail.

Cada rail: **máx 8 ítems** + "Ver todo" que navega a la vista de esa categoría (vía bottom nav / filtro).

---

## 7. Navegación inferior (bottom nav)

Nuevo componente `MobileBottomNav` (puede vivir en `home-theme2.tsx` o `components/consumer/`):

- `fixed bottom-0 inset-x-0 z-50`, fondo `backdrop-blur` + borde superior suave, safe-area (`pb-[env(safe-area-inset-bottom)]`).
- 4 destinos: **Explorar** (home), **Tiendas** (tab comercios), **Ofertas** (tab ofertas), **Cuenta** (`onGoToLogin`).
- Ícono activo más grande / con color de marca (`--brand-green`).
- Sustituye la hamburguesa (686–688) en móvil. El `landing-page.tsx` ya reserva `pb-16 md:pb-0` (línea 2672), así que hay espacio para una barra fija — reutilizar esa convención.
- Estado activo sincronizado con `tab`/`businessTypeFilter` existentes (no se inventa estado nuevo).

---

## 8. Skeleton loading & lazy rendering

- **Skeleton**: ya existe para comercios (924–932). Extender el patrón a cada rail (Trending/Ofertas/Nuevos) con placeholders del mismo tamaño de card para evitar layout shift. Componente `<CardSkeleton variant="product|store" />`.
- **Lazy rendering**: las secciones bajo el fold (Ofertas, Nuevos, Únete, Footer) se montan con `IntersectionObserver` (hook `useInView`) o `content-visibility: auto` en el contenedor de cada sección para reducir el coste de render inicial en móvil.
- **Imágenes**: mantener `loading="lazy"` (ya está en carrusel) y añadirlo a las cards de rails; `fetchpriority="high"` solo en la primera imagen del hero.

---

## 9. Prioridades de interacción (foco de atención)

Orden de peso visual en móvil (mayor → menor):

1. Search (acción nº1 en marketplace).
2. Hero (1 mensaje, 1 CTA).
3. Trending (deseo visual inmediato).
4. Chips de categoría (filtro rápido).
5. Resto de secciones (scroll progresivo).
6. Bottom nav (siempre accesible, peso constante).

Todo lo demás (stats, promos sidebar, triple CTA "Únete") baja de prioridad o se elimina.

---

## 10. Responsive strategy

- **Breakpoint**: `< 768px` (móvil) usa `MobileHome`; `≥ 768px` mantiene el layout actual intacto.
- Implementación: hook `useIsMobile()` (matchMedia con guard SSR) **o**, si se prefiere CSS puro, duplicar markup con `block md:hidden` / `hidden md:block`. Recomendado el hook para no montar dos árboles pesados.
- **SSR**: el home público es SSR (regla del módulo storefront). El branch por JS puede causar hydration mismatch → arrancar con un layout neutro y resolver `isMobile` en `useEffect`, o usar el enfoque CSS `hidden/block` (sin mismatch). **Recomendado: CSS `hidden md:block` para las partes estructurales** y branch JS solo para el bottom nav (que es cliente).
- Subcomponentes nuevos (`MobileHome`, `MobileBottomNav`, `HScrollSection`, `CardSkeleton`) viven en el mismo archivo o en `components/consumer/` para mantener cohesión.

---

## 11. Referencia estética objetivo

| App | Qué tomar |
|-----|-----------|
| Zara / Nike mobile | foto grande, card minimal, mucho blanco, tipografía fuerte |
| Pinterest / TikTok Shop | rails horizontales, scroll de descubrimiento, 1 badge |
| Temu/Shein nuevo | bottom nav con presencia, CTA claro |

Evitar: grids densos, interfaz tipo dashboard, badges múltiples, metadata administrativa.

---

## 12. Fases de implementación

**Fase 1 — Estructura y limpieza (bajo riesgo)**
1. Extraer `MobileHome` con branch responsive (sin cambiar datos).
2. Eliminar en móvil: tabs, navbar, pill "Disponible", banner bienvenida suelto.
3. Reordenar a secciones verticales.

**Fase 2 — Card system + spacing**
4. Variantes minimal de `ProductCard`/`StoreCard`.
5. Aplicar spacing system y `aspect-[3/4]`.
6. Reducir badges a uno.

**Fase 3 — Hero + rails**
7. Hero único (carrusel/CTA).
8. `HScrollSection` para Trending/Ofertas/Nuevos.

**Fase 4 — Bottom nav + performance**
9. `MobileBottomNav` flotante.
10. Skeletons por sección + lazy rendering (IntersectionObserver / content-visibility).

**Fase 5 — QA**
11. Verificar configurabilidad superadmin intacta (heroSplit/heroRight/promoConfig/welcome).
12. Verificar paleta IA (cambiar `themeColors` y confirmar tinte).
13. Lighthouse móvil (LCP del hero, CLS por skeletons), prueba en 360–414px.

> Orden recomendado: este plan → mockup (Fase 1–3 visual) → implementación. Así no se rehace el frontend dos veces.

---

## Archivos afectados

- `frontend/components/home-theme2.tsx` (principal)
- `frontend/components/landing-page.tsx` (consumo / padding bottom nav)
- Posibles nuevos en `frontend/components/consumer/` (`MobileBottomNav`, `HScrollSection`, `CardSkeleton`)

## Lo que NO se toca

- Backend, endpoints, datos, props del componente.
- Layout desktop (`≥ md`).
- Sistema de paleta IA / CSS vars.
- Configuración superadmin del home.
