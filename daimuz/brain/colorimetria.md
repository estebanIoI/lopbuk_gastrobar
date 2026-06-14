# 🎨 Colorimetría de marca (IA)

> Documento canónico del sistema de colorimetría. Si vas a crear o tocar un
> **tema** (home o tienda), lee esto primero.
> Regla de oro: **todo tema nuevo DEBE consumir la colorimetría. Nunca hardcodear
> colores de marca.**

---

## 🧭 Qué es

La IA analiza un logo y genera una paleta accesible (`primary`, `primary_hover`,
`secondary`, `background_store`, `surface_store`, `text_main`, `admin_accent`).
Esa paleta tiñe la interfaz pública. Hay **dos niveles**:

| Nivel | Quién la genera | Desde | Qué tiñe |
|---|---|---|---|
| **Plataforma** | Superadmin | Logo DAIMUZ | Home/marketplace + login + acento por defecto en paneles |
| **Comercio** | Comerciante | Su logo | Su tienda (full color) + solo acento en su panel |

**Jerarquía de acento:** comercio > plataforma > base.
Los **paneles operativos NO se colorizan por completo** (solo acento `--primary`/`--ring`)
para preservar contraste y legibilidad.

---

## 💾 Dónde se guarda

| Paleta | Almacenamiento | Clave |
|---|---|---|
| Plataforma | `platform_settings` | `platform_theme_colors` (JSON) |
| Comercio | `platform_settings` por tenant | `store_theme_colors:{tenantId}` (JSON) |

- **Generar:** `POST /storefront/theme/generate` (IA desde logo o imagen base64).
- **Guardar plataforma:** `api.updatePlatformSetting('platform_theme_colors', json)`.
- **Guardar comercio:** `api.saveStoreThemeColors(palette)`.
- **Leer público:** `GET /storefront/platform-settings` devuelve todas las claves
  (incl. `platform_theme_colors`). La tienda devuelve `themeColors` en su config.

Sin backend nuevo: reutiliza endpoints existentes.

---

## 🧩 Cómo se aplica (¡clave!)

Hay **dos mecanismos** según cómo el tema pinte sus colores. Un tema debe usar
**al menos uno** de los dos:

### A) Estilos inline → variables CSS con fallback  *(patrón del Tema 2)*

El componente define sus colores de marca como **referencias a variables CSS**:

```ts
const GREEN      = 'var(--brand-green, #00833E)'
const GREEN_DARK = 'var(--brand-green-dark, #005C2A)'
const GOLD       = 'var(--brand-gold, #F0A500)'
```

Y la **raíz del tema** inyecta las variables desde la paleta (prop `themeColors`):

```tsx
const brandVars = (themeColors?.primary || themeColors?.primary_hover)
  ? ({ '--brand-green': themeColors.primary,
       '--brand-green-dark': themeColors.primary_hover } as CSSProperties)
  : undefined
return <div style={brandVars}> … </div>
```

Así, **todos** los `style={{ background: GREEN }}` se tiñen sin tocarlos uno por
uno. Sin paleta → cae al verde DAIMUZ por defecto.
👉 `frontend/components/home-theme2.tsx` (`MarketplaceHomeGovCo`).

### B) Clases Tailwind → variables `--color-*` + remap  *(patrón del Tema 1 / landing)*

`landing-page.tsx` inyecta en un `<style>` las variables `--color-primary`,
`--color-secondary`, etc. desde `activeThemeColors`, **y además** remapea las
clases verde/emerald/teal hardcodeadas para que las consuman:

```css
.bg-green-500, .bg-emerald-500 { background-color: var(--color-primary) !important; }
.text-green-400 { color: var(--color-primary) !important; }
/* alpha preservado con color-mix; gradientes via --tw-gradient-* */
```

👉 `frontend/components/landing-page.tsx`.

### C) Paneles → solo acento

`applyAdminAccent(hex)` sobreescribe `--primary`/`--ring` de shadcn.
👉 `frontend/lib/theme-vars.ts`, `platform-theme-loader.tsx`, `merchant-panel.tsx`.

---

## 📁 Archivos

| Archivo | Rol |
|---|---|
| `frontend/lib/theme-vars.ts` | Tipos `ThemePalette`, `applyAdminAccent`, helpers hex→hsl |
| `frontend/lib/platform-theme.ts` | Leer/parsear/aplicar paleta de plataforma |
| `frontend/components/platform-theme-loader.tsx` | Aplica acento de plataforma app-wide |
| `frontend/components/platform-theme-generator.tsx` | UI superadmin (genera/guarda) |
| `frontend/components/logo-theme-generator.tsx` | UI comerciante (auto al subir logo) |
| `frontend/components/landing-page.tsx` | Tema 1: inyección `--color-*` + remap Tailwind |
| `frontend/components/home-theme2.tsx` | Tema 2: vars `--brand-*` desde prop `themeColors` |

---

## 🔒 Regla para temas nuevos

> **Cualquier tema de home o de tienda que se cree DEBE consumir la colorimetría.**

Checklist obligatorio al crear un tema:

1. ❌ **No** escribir hex de marca directo (`background: '#00833E'`) ni depender de
   `bg-green-*` "crudo" sin remap.
2. ✅ Usar el **patrón A** (constantes `var(--brand-*, fallback)` + setear las vars
   en la raíz desde la paleta) **o** el **patrón B** (vars `--color-*` + remap).
3. ✅ Recibir la paleta por prop (`themeColors`) o leerla de `platform-settings` /
   config de tienda.
4. ✅ Mantener **fallback** al verde DAIMUZ cuando no hay paleta.
5. ✅ Paneles operativos: solo acento (`applyAdminAccent`), nunca colorización total.

**Por qué importa:** los `style` inline NO se pueden sobreescribir con reglas CSS
de clases. Si un tema hardcodea colores inline, la colorimetría se genera y guarda
pero **la página nunca cambia** (bug real del Tema 2, jun 2026).

---

← [[DAIMUZ]] | → [[governance/universal-constraints]] | [[modules/storefront/storefront]]
