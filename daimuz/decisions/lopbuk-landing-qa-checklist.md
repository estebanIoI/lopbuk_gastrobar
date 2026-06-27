# QA — Landing /lopbuk editable (Fase E)

> Fecha: 2026-06-26
> Cubre Fases A–D ya implementadas. Marca cada ítem al probar con el server arriba.

## 0. Verificación automatizada (ya hecha ✓)
- [x] Typecheck acotado backend (`lopbuk-landing.service.ts`, `lopbuk-landing.routes.ts`) → 0 errores.
- [x] Typecheck acotado frontend (`app/lopbuk/page.tsx`, `media-upload.tsx`, `useLopbukLanding.ts`, `LopbukLandingTab.tsx`) → 0 errores.
- [x] Parser de sintaxis en todos los archivos nuevos/modificados → 0 errores.
- [ ] `cd backend && npm run build` (o `tsc --noEmit`) sin errores. *(correr local: no entra en sandbox)*
- [ ] `cd frontend && npm run build` sin errores. *(correr local)*

## 1. Fallback (sin config / sin backend)
- [ ] Con la tabla `lopbuk_landing` vacía o el backend apagado, abrir `/lopbuk`: se ven los mockups CSS (laptop, monitores de pasos, gradiente de oferta) y los textos por defecto. No hay pantalla en blanco ni error en consola.
- [ ] `GET /api/lopbuk-landing` devuelve `{ success: true, data: {} }` cuando no hay fila.

## 2. Idioma (i18n + autodetección)
- [ ] Navegador en español → la página carga en ES. En inglés (`en-US`) → carga en EN.
- [ ] El selector de la nav (🇪🇸/🇺🇸) cambia todos los textos al instante.
- [ ] La elección queda persistida (recargar mantiene el idioma elegido → `localStorage.lopbuk_lang`).
- [ ] Si superadmin define `defaultLang` y el visitante NO eligió idioma, se respeta ese idioma por defecto.

## 3. Superadmin — tab Lopbuk
- [ ] Entrar al panel como **superadmin** → aparece la pestaña **Lopbuk** (icono cohete).
- [ ] Un usuario NO superadmin recibe 403 al hacer `PUT /api/lopbuk-landing` (probar con token de otro rol).
- [ ] "Recargar" trae la config guardada; "Guardar" muestra toast de éxito.

## 4. Medios por slot (subida + validación + preview)
- [ ] Subir imagen en **Hero · fondo** → preview de imagen; al guardar y abrir `/lopbuk`, la imagen se ve a sangre detrás del hero.
- [ ] Subir gif/imagen en **dentro del PC** → aparece dentro del recuadro del laptop del hero.
- [ ] Subir imagen en **oferta** → reemplaza el mockup del bloque "¿Qué ofrece?".
- [ ] En un paso, subir **video** → preview con `<video controls>`; en `/lopbuk` el paso muestra el video (autoplay, muted, loop) con prioridad sobre la imagen.
- [ ] En un paso, subir solo **imagen** (sin video) → se muestra la imagen.
- [ ] Validación: intentar subir un archivo > límite (img 2/4 MB, video 12 MB) → mensaje de error y NO sube.
- [ ] Validación: elegir un archivo de tipo equivocado (p.ej. imagen en slot de video) → mensaje de error.
- [ ] Botón "X" limpia el slot → vuelve al mockup CSS de fallback.
- [ ] Pegar una URL externa (sin subir) también funciona y se previsualiza.

> Requisito Cloudinary: el Upload Preset debe ser **Unsigned** y permitir **video** para subir videos por archivo. Si no, usar el campo de URL.

## 5. Textos por idioma
- [ ] Editar título/lead del hero + banda en ES y EN, guardar → se reflejan en `/lopbuk` según el idioma activo.
- [ ] Completar los **3** títulos de pasos para sobrescribir; con menos de 3, se conservan los pasos por defecto (comportamiento esperado).

## 6. SSR / SEO / responsive
- [ ] `/lopbuk` renderiza el contenido base en el HTML inicial (ver "ver código fuente").
- [ ] Sin warnings de hidratación en consola.
- [ ] Móvil (≤768px): nav colapsa a hamburguesa, grids a 1–2 columnas, pasos apilados.

## 7. Regresión
- [ ] El resto del panel superadmin y otras rutas siguen funcionando (el CSS de la landing está scoped en `.lpk`; las rutas nuevas son aditivas).
- [ ] La migración `add_lopbuk_landing.sql` corre sin error (o la tabla se auto-crea en el primer PUT).

## Endpoints de referencia
- `GET  /api/lopbuk-landing` — público, `{ success, data }`.
- `PUT  /api/lopbuk-landing` — superadmin, body `{ "config": { defaultLang, media, i18n } }`.
