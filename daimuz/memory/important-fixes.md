# 🔧 Fixes Importantes

> Bugs críticos resueltos. Sirven como referencia para no repetirlos.

## Template para agregar un fix

```markdown
### [YYYY-MM-DD] — Título del bug
**Síntoma:** qué pasaba
**Causa:** por qué pasaba
**Fix:** cómo se resolvió
**Archivos:** qué se modificó
**Regla:** qué aprender de esto
```

---

## Historial

### [2026-06-14] — Colorimetría no teñía el home (Tema 2)
**Síntoma:** El superadmin generaba y guardaba la paleta, pero el home seguía verde.
**Causa:** El Tema 2 (`MarketplaceHomeGovCo`) pintaba la marca con estilos **inline** (`style={{ background: GREEN }}`, constante JS fija) y nunca recibía la paleta. Los estilos inline NO se pueden sobreescribir con reglas CSS de clases.
**Fix:** Constantes de marca como variables CSS con fallback (`var(--brand-green, #00833E)`); la raíz del tema inyecta `--brand-green`/`--brand-green-dark` desde la prop `themeColors`; `landing-page.tsx` se la pasa.
**Archivos:** `frontend/components/home-theme2.tsx`, `frontend/components/landing-page.tsx`
**Regla:** Todo tema consume la colorimetría vía variables CSS. Nunca hex de marca inline. Ver [[brain/colorimetria]].

### [2026-06-14] — Favicon de pestaña no cambiaba
**Síntoma:** La pestaña seguía mostrando un icono viejo pese a configurar `metadata.icons`.
**Causa:** En el App Router de Next, `app/favicon.ico` se sirve automáticamente en `/favicon.ico` y **tiene prioridad** sobre `metadata.icons`. Existía un `.ico` antiguo.
**Fix:** Se regeneró `app/favicon.ico` desde `public/daimuz-icon.png` (ICO multi-tamaño 16→256).
**Archivos:** `frontend/app/favicon.ico`, `frontend/app/layout.tsx`, `frontend/components/dynamic-favicon.tsx`
**Regla:** Si hay `app/favicon.ico`, ese manda sobre el metadata. Cambiar el icono = regenerar ese archivo. Requiere hard-refresh (cache de navegador).

### [2026-05] — Token en memoria vs localStorage
**Síntoma:** Al refrescar la página se perdía la sesión  
**Causa:** El token estaba solo en memoria (auth-store), no persistía  
**Fix:** Se usa httpOnly cookie como fuente de verdad, el token en memoria es solo para el header Authorization como fallback  
**Archivos:** `frontend/lib/auth-store.ts`, `frontend/lib/api.ts`  
**Regla:** La cookie httpOnly es la sesión real. El token en JS es solo un cache.

---

### [2026-05] — WhatsApp webhook formato Evolution API v2
**Síntoma:** Los mensajes de WhatsApp no llegaban al agente IA  
**Causa:** `setWebhook` enviaba el payload en formato nested (con sub-objeto webhook), pero Evolution API v2 espera el formato plano  
**Fix:** `backend/src/modules/whatsapp/whatsapp.service.ts` — `setWebhook()` corregido a formato plano  
**Archivos:** `backend/src/modules/whatsapp/whatsapp.service.ts`  
**Regla:** Siempre verificar el formato exacto de payload con la versión exacta de la API externa. v1 y v2 de Evolution API tienen formatos diferentes.

---

### [2026-05] — Agente IA respondía con productos no pedidos
**Síntoma:** El agente incluía sugerencias de productos en respuestas a preguntas genéricas (envíos, horarios, etc.)  
**Causa:** El RAG incluía el catálogo de productos en el contexto de TODOS los mensajes  
**Fix:** `agent.service.ts` — función `isProductQuery()` detecta si la intención del mensaje es sobre productos. Solo entonces se incluye el catálogo en el contexto RAG.  
**Archivos:** `backend/src/modules/agent/agent.service.ts`  
**Regla:** El RAG debe ser intencional y selectivo. Más contexto ≠ mejor respuesta.

---

> Agrega nuevos fixes aquí cuando los resuelvas. Fecha + descripción corta.

---

### [2026-06-05] — Panel "Mi cuenta" mobile quedaba flotando sobre el fondo
**Síntoma:** En mobile, estando en "Mi cuenta", abrir el menú lateral y tocar Inicio actualizaba el fondo pero el panel de cuenta seguía en primer plano.
**Causa:** Los botones del menú mobile cambiaban los flags `show*` pero no reseteaban `mobileActiveTab`, que seguía en `'cuenta'`; el panel está gated por `mobileActiveTab === 'cuenta'`.
**Fix:** Agregar `setMobileActiveTab('tienda')` a los botones de navegación del menú (Inicio, Catálogo, Sedes, Nuevos Lanzamientos, Servicios, Drop, Ofertas).
**Archivos:** `frontend/components/landing-page.tsx`
**Regla:** En la vista mobile, cualquier navegación debe resetear `mobileActiveTab`, no solo los flags `show*`.

---

### [2026-06-05] — Módulo gym no aparecía en el modal de activación
**Síntoma:** El gimnasio no salía en "Módulos — [tenant]" del superadmin ni se podía activar por comercio.
**Causa:** Se registró en `sidebar.tsx` y `page.tsx` pero NO en `lib/modules.ts` (`ALL_MODULES`), que es la fuente del modal de activación y del gating del sidebar (`activeModules.includes(item.id)`).
**Fix:** Agregar `{ id:'gym', name:'Gimnasio', group:'ops' }` a `ALL_MODULES` + presets gimnasio/fitness/crossfit en `BUSINESS_PRESETS`.
**Archivos:** `frontend/lib/modules.ts`
**Regla:** Un módulo nuevo del comerciante requiere 3 lugares: `lib/modules.ts` (registro/toggle), `sidebar.tsx` (menú) y `app/page.tsx` (render por `case`).

---

### [2026-06-05] — Plan de comidas 500: columna user_id ambigua
**Síntoma:** `GET /api/rutina/plan-comidas` 500 → `ER_NON_UNIQ_ERROR: Column 'user_id' in where clause is ambiguous`.
**Causa:** `listPlanComidas` hace `JOIN rutina_recetas r`; ambas tablas tienen `user_id`, y el WHERE usaba `user_id`/`plan_date` sin calificar.
**Fix:** Calificar con alias: `pc.user_id`, `pc.plan_date` en el WHERE dinámico.
**Archivos:** `backend/src/modules/rutina/rutina.service.ts`
**Regla:** En cualquier SELECT con JOIN, SIEMPRE calificar columnas (`alias.columna`) en WHERE/ORDER, no solo en el SELECT.

---

### [2026-06-05] — Categorías: colisión de PRIMARY KEY entre tenants
**Síntoma:** `POST /api/categories` 500 → `ER_DUP_ENTRY 'opa' for key 'categories.PRIMARY'`. Dos comerciantes distintos creando una categoría con el mismo nombre chocaban.
**Causa:** `categories.id` (VARCHAR(50)) se genera como slug del nombre y era PRIMARY KEY global. Distintos tenants con el mismo nombre → mismo id → choque, ignorando el aislamiento multi-tenant.
**Fix:** PK compuesta `(tenant_id, id)`. Seguro: sin FKs hacia `categories(id)`, ids únicos globalmente al migrar, y el service ya validaba unicidad por `id + tenant_id`. Solo migración de BD, sin rebuild.
**Archivos:** `backend/migrations/fix_categories_composite_pk.sql` (nuevo), `backend/inventarioEsteban_v3_multitenant.sql` (esquema base)
**Regla:** En multi-tenant, cualquier id derivado de datos del usuario (slug, nombre) debe ser único POR tenant. La PK debe incluir `tenant_id`, no confiar solo en un UNIQUE secundario.

---

### [2026-06-04] — Google OAuth no carga en producción
**Síntoma:** "Google OAuth components must be used within GoogleOAuthProvider" en el login en prod
**Causa:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` iba vacío en los `build args` del frontend. En Next.js las vars `NEXT_PUBLIC_*` se compilan en el build, no se leen en runtime; con valor vacío el provider no se monta.
**Fix:** Pasar el client ID real como build arg en el compose (y `ARG`+`ENV` en el Dockerfile antes de `npm run build`). Rebuild de la imagen, no solo redeploy.
**Archivos:** `docker-compose` (Komodo), `frontend/Dockerfile`
**Regla:** Toda var `NEXT_PUBLIC_*` debe ir como build arg y reconstruir la imagen. Ponerla en `environment:` (runtime) no sirve.

---

### [2026-06-04] — Chatbot 500: modelo Gemini retirado
**Síntoma:** `POST /api/chatbot/message` 500. Log: `gemini-2.0-flash is no longer available` (404).
**Causa:** Nombre de modelo hardcodeado en `agent.service.ts`; Google retiró `gemini-2.0-flash`.
**Fix:** Usar alias `gemini-flash-latest` (no fija versión), configurable con env `GEMINI_MODEL`.
**Archivos:** `backend/src/modules/agent/agent.service.ts`
**Regla:** No fijar versión exacta de modelos de IA; usar alias `-latest` o env var. Ojo: el código desplegado por Komodo viene del repo GitHub, hay que `commit`+`push` para que el fix llegue al build (resuelto: push + rebuild → chatbot OK).

---

← [[lessons-learned]] | [[DAIMUZ]] | → [[bugs-history]]
