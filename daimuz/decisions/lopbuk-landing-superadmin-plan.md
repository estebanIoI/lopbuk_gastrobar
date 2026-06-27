# Plan de integración — Landing /lopbuk editable desde superadmin

> Fecha: 2026-06-26
> Objetivo: que la sección `/lopbuk` (estilo Simplest) sea editable desde el panel
> superadmin: textos por idioma, imágenes, gifs y videos por sección (hero, pasos,
> oferta), sin tocar código.
> Archivo de la landing: `frontend/app/lopbuk/page.tsx`

---

## 0. Estado actual (ya implementado)

La landing ya está preparada para recibir contenido externo:

- **i18n**: diccionario `DICT.es` / `DICT.en`, con autodetección por `navigator.language` (región del navegador) + selector manual en la nav + persistencia en `localStorage('lopbuk_lang')`.
- **Slots de medios**: objeto `MEDIA` con `heroImage`, `heroGif`, `offerImage`, `steps[].image`, `steps[].video`. Si un slot es `null` → cae al mockup/gradiente CSS (fallback). Render condicional ya escrito (`<img>` / `<video>` / mockup).

Hoy `DICT` y `MEDIA` son constantes en el archivo. La integración consiste en
**reemplazar esas constantes por una config remota** servida por el backend y
editable en superadmin. Mientras no haya config remota, los defaults siguen vivos.

> Geo real por país: `navigator.language` da el idioma del dispositivo (suficiente
> para "según la región"). Si se quiere geo-IP estricto, se resuelve en backend con
> el header de país del proxy/CDN y se devuelve `defaultLang` en la config (ver §6).

---

## 1. Modelo de datos (singleton global, patrón portfolio)

La landing es de plataforma (no por tenant), igual que el portfolio. Se guarda como
**un único registro de configuración JSON**.

Tabla nueva `lopbuk_landing` (o fila en la tabla de config de plataforma existente):

| Campo | Tipo | Nota |
|-------|------|------|
| `id` | INT PK | siempre 1 (singleton) |
| `config` | JSON / LONGTEXT | toda la config (abajo) |
| `updated_at` | DATETIME | auditoría |
| `updated_by` | VARCHAR | user superadmin |

Forma del JSON `config` (refleja `DICT` + `MEDIA` de la landing):

```jsonc
{
  "defaultLang": "es",
  "media": {
    "heroImage": "https://.../hero-verde.png",   // imagen verde limpia de fondo
    "heroGif":   "https://.../demo.gif",          // gif dentro del recuadro del PC
    "offerImage": null,
    "steps": [
      { "image": null, "video": "https://.../paso1.mp4" },
      { "image": "https://.../paso2.jpg", "video": null },
      { "image": null, "video": null }
    ]
  },
  "i18n": {
    "es": { "heroTitle": "...", "heroLead": "...", "steps": [["t","d"],...], ... },
    "en": { "heroTitle": "...", ... }
  }
}
```

> Regla del proyecto: lógica solo en `*.service.ts`, respuestas `{ success, data }`,
> `throw new AppError(...)`. No es multi-tenant (singleton de plataforma), así que NO
> lleva `tenant_id`.

---

## 2. Backend (patrón `portfolio.routes.ts`)

Crear `backend/src/modules/lopbuk-landing/`:

- `lopbuk-landing.service.ts`
  - `getConfig()` → lee la fila singleton; si no existe, devuelve `DEFAULTS` (los mismos defaults que hoy viven en la landing, movidos a un JSON compartido).
  - `saveConfig(partial, user)` → merge profundo + validación + persiste.
- `lopbuk-landing.routes.ts`
  - `GET /api/lopbuk-landing` → **público** (sin auth), para que la landing lo consuma en SSR.
  - `PUT /api/lopbuk-landing` → **solo superadmin** (auth + guard de rol), guarda la config.
- Registrar el router en el index de rutas del backend.

Validaciones clave: URLs de media con extensión/мime permitido, longitudes de texto,
estructura de `steps` (exactamente 3), idiomas soportados.

---

## 3. Media: imágenes, gifs y videos

Reusar lo que ya existe en el repo:

- `frontend/components/ui/cloudinary-upload.tsx` (`CloudinaryUpload`) — ya se usa en `LandingConfigTab` para subir imágenes; acepta imagen y gif.
- `backend/src/modules/media-library/media-library.routes.ts` — para videos (mp4/webm) y biblioteca reutilizable.

Reglas por slot:
- `heroImage`: imagen estática (png/jpg/webp), "verde limpia" de fondo a sangre.
- `heroGif`: gif **o** mp4 corto; se renderiza dentro del marco del laptop (`.media-fill`, `object-fit:cover`).
- `steps[].video`: mp4/webm (autoplay, muted, loop) — tiene prioridad sobre `image`.
- `steps[].image`: jpg/png de la escena.
- `offerImage`: imagen del bloque "¿Qué ofrece?".

Límites sugeridos: imágenes ≤ 1MB (hero a sangre ≤ 400KB webp), gif ≤ 3MB (preferir mp4), video ≤ 8MB / 10s, loop.

---

## 4. Frontend — Tab de superadmin

Crear, replicando `LandingConfigTab` + `useLandingConfig`:

- `frontend/components/superadmin/tabs/LopbukLandingTab.tsx`
- `frontend/components/superadmin/hooks/useLopbukLanding.ts`

Secciones del tab:
1. **Idiomas**: idioma por defecto + editor de textos por idioma (acordeón ES / EN), agrupado por sección (hero, pasos, oferta, beneficios, métricas, testimonios, footer).
2. **Medios**: un `CloudinaryUpload` por slot (`heroImage`, `heroGif`, `offerImage`, y por cada paso `image`/`video`), con preview y botón "quitar" (vuelve a fallback).
3. **Guardar** → `PUT /api/lopbuk-landing`.

Añadir la tab al layout de superadmin (junto a `LandingConfigTab`, `PortfolioTab`).

---

## 5. Conectar la landing a la config remota

En `frontend/app/lopbuk/page.tsx`:

1. Mover los `DICT`/`MEDIA` actuales a `lopbuk-landing.defaults.ts` (fuente única de verdad de los fallbacks; el backend usa el mismo JSON).
2. Convertir la página a **server component contenedor** (SSR) que hace `fetch('/api/lopbuk-landing')` y pasa la config a un client component `LopbukLandingView` (el actual), o mantenerla client y hacer fetch en `useEffect` con los defaults como estado inicial (sin parpadeo porque el fallback ya es válido).
3. `DICT = config.i18n ?? DEFAULTS.i18n`, `MEDIA = config.media ?? DEFAULTS.media`. El resto del render no cambia (ya es data-driven).
4. `defaultLang`: si el usuario no eligió idioma, usar `config.defaultLang` antes de `navigator.language`.

SSR es importante para SEO (la landing es pública), igual que el resto del storefront.

---

## 6. i18n — detalle

- Idiomas iniciales: `es`, `en`. La estructura admite añadir `pt`, etc. agregando una clave en `i18n` y una entrada en `LANGS`.
- Detección: `localStorage('lopbuk_lang')` → si no, `config.defaultLang` → si no, `navigator.language`.
- Geo-IP estricto (opcional): el backend lee el país del header del CDN/proxy (`cf-ipcountry`, `x-vercel-ip-country`, etc.) y devuelve `defaultLang` mapeado por país. La landing nunca hace geo-IP en cliente.

---

## 7. Fases de implementación

**Fase A — Backend**
1. Tabla `lopbuk_landing` (singleton) + migración.
2. Módulo `lopbuk-landing` (service + routes GET público / PUT superadmin).
3. `defaults` compartido (mismos textos/medios que la landing hoy).

**Fase B — Landing data-driven**
4. Extraer `DICT`/`MEDIA` a `defaults` y consumir `GET /api/lopbuk-landing` (SSR) con fallback.

**Fase C — Superadmin**
5. `useLopbukLanding` + `LopbukLandingTab` (textos por idioma + uploads por slot).
6. Añadir tab al panel.

**Fase D — Media avanzada**
7. Soporte video (media-library), límites/optimización, preview en el tab.

**Fase E — QA**
8. Probar fallback (config vacía → mockups CSS), cambio de idioma, SSR/SEO, y subida de imagen/gif/video por slot.

---

## Archivos afectados / nuevos

- `frontend/app/lopbuk/page.tsx` (consumir config)
- `frontend/app/lopbuk/lopbuk-landing.defaults.ts` (nuevo)
- `frontend/components/superadmin/tabs/LopbukLandingTab.tsx` (nuevo)
- `frontend/components/superadmin/hooks/useLopbukLanding.ts` (nuevo)
- `backend/src/modules/lopbuk-landing/*` (nuevo)
- Migración DB `add_lopbuk_landing.sql` (nuevo)

## Lo que NO cambia
- Estilo/estructura visual de la landing (verde Simplest).
- Sistema de auth y multi-tenant (esto es singleton de plataforma).
