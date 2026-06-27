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

### [2026-06-19] (p4) — Borrar un producto no borraba sus variantes → SKU bloqueado para siempre
**Síntoma:** "Producto creado, pero 50 variante(s) fallaron: El SKU de la variante ya existe" — TODAS las variantes de un producto recién creado chocaban.
**Causa:** `productsService.delete()`/`bulkDelete()` hacían `DELETE FROM products` pero nunca tocaban `product_variants` — quedaban huérfanas (producto ya no existe, pero la fila sigue `is_active=1` con su SKU original). Al recrear un producto con el mismo SKU base (`generateNextSku` lo vuelve a generar porque el producto borrado ya no cuenta), sus variantes nuevas chocan contra las huérfanas en el `UNIQUE KEY (sku, tenant_id)`. Por separado, `variantsService.softDelete()` tampoco liberaba el SKU al desactivar una variante (la unicidad no distingue `is_active`).
**Fix:**
- `productsService.delete()`/`bulkDelete()` ahora borran `product_variants` + `variant_price_tiers` del producto ANTES de borrar el producto.
- `variantsService.softDelete()` renombra el SKU (`sku + '-DEL-' + id[:8]`) al desactivar, liberándolo de verdad.
- `create()`/`update()` filtran `is_active = 1` en el chequeo de SKU duplicado (ya no bloquean contra variantes eliminadas).
- Limpieza única en `ensureTables()`: borra variantes/tiers huérfanas existentes + renombra SKUs de variantes ya desactivadas que quedaron sin renombrar (corrige el estado actual sin esperar a que el usuario las toque una por una).
**Archivos:** `backend/src/modules/products/products.service.ts`, `backend/src/modules/variants/variants.service.ts`.
**Regla:** soft-delete + UNIQUE KEY es una combinación peligrosa — si el campo único (aquí `sku`) no se libera/renombra al desactivar, queda bloqueado para siempre. Y borrar un "padre" (producto) SIEMPRE debe arrastrar a sus "hijos" (variantes, tiers) — nunca asumir que no hace falta solo porque no hay FK CASCADE definida.

### [2026-06-19] (p3) — `ER_CANT_AGGREGATE_2COLLATIONS` al crear/leer variantes (collation mismatch)
**Síntoma:** "Error interno del servidor" en **todas** las variantes al crear un producto con horma; en backend: `Illegal mix of collations (utf8mb4_unicode_ci,IMPLICIT) and (utf8mb4_0900_ai_ci,IMPLICIT) for operation '='` (errno 1267) en `findById`/`findByProduct` (el JOIN `products p ON p.id = pv.product_id`).
**Causa:** el `ensureTables()` que se agregó hoy (parte 4) para auto-crear `product_variants`/`variant_price_tiers`/`inventory_movements`/`suppliers`/`supplier_products` usaba `DEFAULT CHARSET=utf8mb4` **sin `COLLATE` explícito** (igual que el `004_variants_and_suppliers.sql` original). El servidor MySQL le puso su collation default (`utf8mb4_0900_ai_ci`, típico de MySQL 8), mientras `products` ya existía con `utf8mb4_unicode_ci`. Cualquier JOIN/comparación entre las dos truena.
**Fix:** las 5 `CREATE TABLE` ahora especifican `COLLATE=utf8mb4_unicode_ci` explícito. Como las tablas ya habían quedado creadas con el collation malo en el intento anterior, se agregó además un `ALTER TABLE ... CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` idempotente (corre una vez por arranque, no-op si ya está bien) para corregir las que ya existían.
**Archivos:** `backend/src/modules/variants/variants.service.ts` (`ensureTables()`).
**Regla:** **nunca** especificar `DEFAULT CHARSET=utf8mb4` en un `CREATE TABLE` sin su `COLLATE` — el default del servidor puede no coincidir con el de las tablas existentes (especialmente en MySQL 8+, cuyo default cambió a `utf8mb4_0900_ai_ci`). Siempre fijar `COLLATE=utf8mb4_unicode_ci` explícito para que combine con el resto del esquema (mismo patrón ya usado en `hormasService.ensureTables()`).

### [2026-06-19] (p2) — SKU colisionaba para "Azul Navy/Rey/Agua/Medio" → variantes fallaban en silencio
**Síntoma:** producto creado pero el toast decía "con 0 variante(s)" (o menos de las esperadas), sin error visible.
**Causa:** el SKU autogenerado por combinación (`ProductFormDialog.handleSubmit`) abreviaba el color a solo **4 caracteres** (`ab(color)`). La paleta real de la horma "Camiseta Clásica" tiene "Azul Navy", "Azul Rey", "Azul Agua", "Azul Medio" — los 4 abrevian a **"AZUL"**, generando el mismo SKU para una talla → el backend rechazaba el duplicado con `400 El SKU de la variante ya existe`, y el loop del frontend lo absorbía sin mostrarlo (solo contaba éxitos).
**Fix:** abreviación subida a 6 caracteres + red de seguridad que desambigua (`-2`, `-3`...) si dos combinaciones generan igual SKU. Además, el loop de creación de variantes ahora junta los fallos y los muestra en un `toast.error` + `console.error` (antes se perdían).
**Archivos:** `frontend/components/inventory-list.tsx` (`ProductFormDialog.handleSubmit`, `onSubmit` del diálogo "Agregar Producto").
**Regla:** cualquier slug/abreviación derivado de texto libre (nombres de color, talla, etc.) necesita o suficientes caracteres o una red de seguridad anti-colisión — nunca asumir que un recorte corto es único. Y todo loop que cree N recursos debe **mostrar** los fallos individuales, no solo contar éxitos.

### [2026-06-19] — Al crear producto con horma, faltaban variantes (solo creaba las celdas con stock)
**Síntoma:** al elegir una horma en "Agregar Producto" y dejar vacías las celdas de stock que aún no se manejan, esas combinaciones color×talla **no se creaban como variante** — solo entraban las celdas con un número.
**Causa:** `ProductFormDialog.handleSubmit` (inventory-list.tsx) hacía `if (raw === undefined || raw === '') continue` al armar el array de variantes — saltaba toda celda vacía en vez de crear la variante con stock 0.
**Fix:** se quitó ese `continue`; ahora se crea **una variante por cada combinación color × talla de la horma**, siempre, con `stock = Number(raw) || 0`. Texto de ayuda en el formulario actualizado para reflejarlo.
**Archivos:** `frontend/components/inventory-list.tsx` (`ProductFormDialog.handleSubmit`).
**Regla:** cuando un producto usa horma, la horma define el universo completo de variantes (todo color × toda talla) — el formulario de creación nunca debe omitir combinaciones por falta de stock inicial.

### [2026-06-19] — `ER_NO_SUCH_TABLE: product_variants` (migración manual nunca corrida)
**Síntoma:** `Error: Table 'stockpro_db.product_variants' doesn't exist` al cargar variantes (ej. expandible de inventario).
**Causa:** `004_variants_and_suppliers.sql` crea `product_variants`, `variant_price_tiers`, `inventory_movements`, `suppliers`, `supplier_products` + `products.base_price`, pero es una migración **manual** (no corre sola al arrancar el backend). En tenants donde nunca se ejecutó, el módulo de variantes truena apenas se usa.
**Fix:** `variants.service.ts` → `ensureTables()` (auto-heal idempotente, mismo patrón que `hormasService`), llamado al inicio de todos sus métodos públicos. `import.service.ts` y `suppliers.service.ts` (tocan las mismas tablas directo) llaman `variantsService.ensureTables()` antes de su primera query.
**Archivos:** `backend/src/modules/variants/variants.service.ts`, `import.service.ts`; `backend/src/modules/suppliers/suppliers.service.ts`.
**Regla:** cualquier módulo nuevo que dependa de una migración SQL "para correr a mano" (`backend/src/migrations/*.sql` o `backend/migrations/*.sql`) necesita su propio `ensureTables()` de respaldo — no asumir que el tenant ya la corrió. `purchases.service.ts` también lee `suppliers` directo y quedó pendiente de este mismo parche si llega a fallar igual.

### [2026-06-14] — Archivos truncados por mezclar `sed` con el editor (build roto)
**Síntoma:** `next build` falla con `Unterminated block comment` en `app/portfolio/page.tsx:1697`. Varios archivos del portafolio quedaron truncados en disco (page.tsx, lanyard.tsx, package.json, usePortfolio.ts, PortfolioTab.tsx, portfolio.routes.ts).
**Causa:** Se editó `page.tsx` con `sed -i` mientras la vista del editor y el disco estaban desincronizados; `sed` reescribió una copia cortada y se commiteó. Otras escrituras quedaron truncadas por el mismo desfase.
**Fix:** Restaurar `page.tsx` desde el último commit íntegro (`60f4f77`) y reaplicar los cambios de forma atómica; reescribir `lanyard.tsx` completo; restaurar el resto desde HEAD con `git show HEAD:ruta > ruta`. Verificar en disco: fin-de-archivo + balance de llaves + `tsc`.
**Archivos:** portafolio (frontend + backend), `frontend/package.json`
**Regla:** Nunca `sed -i` / `>` para parchar archivos existentes; usar el editor y verificar en disco. Ver [[lessons-learned]].

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
**Regla:** En multi-tenant, cualquier id derivado de datos del usuario (slug, nombre) debe ser único POR tenant. La PK debe incluir `tenant_id`, no conf