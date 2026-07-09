# 📍 Estado Actual — Julio 2026

> Actualiza este archivo después de cada sesión de trabajo significativa.

## 🆕 [2026-07-08] F5+F6 — tracking del cliente + dashboard gerencial: PLAN FERRETERÍA COMPLETO (✅ E2E 23/23)

> Cierre del plan de la auditoría ferretería (6/6 fases). Detalle en `changelog.md`.

- ✅ F5: GPS del conductor (ping cada 3 min), prueba de entrega (foto + receptor), portal público **/seguimiento/:token** con link por WhatsApp (migraciones 0020/0021).
- ✅ F6: módulo **"Gerencia"** — ventas + embudo en vivo + logística + talento + inventario en una pantalla; mapa de calor por zona; sugerencia de compra por consumo real.
- ✅ **Plan completo**: multibodega, cotizaciones, picking, tiempos, tracking, gerencia. Migraciones 0015–0021.
- ✅ **Pendientes cerrados [07-08] (E2E 15/15, migr. 0022/0023)**: pedidos descuentan sede · recepción de compras con bodega destino · alerta min_stock por sede · mantenimiento preventivo km/fecha · promesa de entrega automática.
- ✅ **Cierre de vacíos de auditoría** (plan A–G): **A ✅ 8/8** · **B ✅ 19/19** (migr. 0024) · **C ✅ 9/9** (migr. 0025) · **D ✅ 10/10** (migr. 0026) · **E ✅ 9/9** (sin migración). **F 2FA pospuesto** por el comerciante. **G DIAN pendiente** (falta elegir proveedor; fase aparte). Todo lo accionable sin decisiones externas está cerrado. Migraciones totales del proyecto: 0015–0026.
- ⏳ Redeploy (back+front) a producción pendiente.

## 🆕 [2026-07-07] Tiempos F4 — cuellos de botella + pedidos en riesgo + recepción (✅ E2E 17/17)

> Fase 4 del plan ferretería. Detalle en `changelog.md`.

- ✅ `order_stage_events` con logStage enganchado en picking + despacho (migración 0019); duración precalculada.
- ✅ Módulo "Tiempos Operación": min por etapa con cuello resaltado + ciclo total; pedidos en riesgo (promesa vencida/tiempo) con WhatsApp; recepción por proveedor.
- ✅ promised_at en pedidos + arrival_at/received_at en compras.
- ⏳ Fase 5 del plan: GPS conductor + prueba de entrega foto + portal de seguimiento del cliente.

## 🆕 [2026-07-07] Picking F3 — cola de bodega + ubicaciones + productividad (✅ E2E 20/20)

> Fase 3 del plan ferretería. Detalle en `changelog.md`.

- ✅ Módulo "Picking Bodega": tablero pendientes/en preparación/preparadas con cronómetros, generar tareas 1-clic desde pedidos confirmados, take atómico multi-auxiliar (migración 0018).
- ✅ Ubicaciones pasillo-bloque-nivel por sede (editable en Inventario → Bodegas); el snapshot de la tarea sale ordenado = ruta de recorrido.
- ✅ Completar avanza el pedido a "preparando" (Centro de Comando) + socket picking-changed.
- ✅ Productividad por auxiliar (tareas, min promedio) en el tablero y en el dossier de Jerarquía.
- ⏳ Fase 4 del plan: tiempos por etapa + recepción de compras + alertas de riesgo.

## 🆕 [2026-07-07] Cotizaciones F2 — reserva por sede + facturar 1-clic (✅ E2E 24/24)

> Fase 2 del plan ferretería. Detalle en `changelog.md`.

- ✅ Módulo "Cotizaciones" (menú Ventas/Operaciones): KPIs de conversión del mes, crear con precio negociado + validez + promesa de entrega + sede.
- ✅ Aceptar = reserva `products.reserved_stock` + `sede_stock.reserved_stock` (migraciones 0016+0017); cancelar/vencer libera; vencimiento lazy.
- ✅ Facturar 1-clic → venta real (salesService) con sede; WhatsApp transaccional; vista imprimible.
- ⏳ Fase 3 del plan: picking + ubicaciones + productividad de auxiliares.

## 🆕 [2026-07-07] Multibodega F1 — stock por sede + transferencias (✅ E2E 28/28)

> Fase 1 del plan "auditoría ferretería" (6 fases: multibodega → cotizaciones → picking →
> tiempos por etapa → tracking → dashboard gerencial). Detalle en `changelog.md`.

- ✅ `sede_stock` = desglose por sede; `products.stock` sigue siendo el total (flujos existentes intactos). Migración **0015** aplicada en dev.
- ✅ Sedes tipadas (punto_venta/bodega/mixta) + encargado + soft delete; `users.sede_id` asignable desde el dossier de Jerarquía.
- ✅ Transferencias entre sedes con cascada auditada (solicitada→en_transito→recibida|cancelada) y validación de disponibilidad bajo lock.
- ✅ Venta POS descuenta total + desglose de su sede (sedeId explícito o sede del vendedor); anulación devuelve.
- ✅ UI: botón "Bodegas" en Inventario (matriz editable + transferencias); POS "¿Dónde hay stock?".
- ⏳ Fase 2 del plan: **cotizaciones con promesa de entrega** (reserva por sede, conversión a venta). Pendiente F1.5: compras con sede destino, storefront descuenta sede.

## 🆕 [2026-07-05] Sistema Operativo Logístico — flota, rutas y rentabilidad (✅ E2E 11/11)

> El módulo fleet pasó de básico a sistema logístico empresarial para ferretería multi-sede.
> Detalle en [[modules/ferreteria/ferreteria]] § Sistema Operativo Logístico y `changelog.md`.

- ✅ Rutas agrupadas por zona con sugeridor (vehículo ajustado + # auxiliares + sumar a ruta activa), cascada de estados con historial, cierre automático en última parada.
- ✅ Centro de operaciones "🛰️ Centro" en el dispatch-panel: kanban con semáforo de espera, vehículos con carga, personal con 6 estados; eventos en vivo por Socket.io.
- ✅ Vehículo empresarial: SOAT/tecno/seguro/odómetro, gastos reales (el conductor reporta), alertas diarias automáticas.
- ✅ Analítica "📊 Rentabilidad & Docs" en flota: facturación movilizada, costos reales, utilidad por vehículo, ranking de conductores.
- ✅ WhatsApp transaccional al cliente (salió / entregado). Migraciones 0012 + 0013 aplicadas en dev.
- ⏳ Siguiente: GPS en mapa ops, orden de paradas optimizado, evidencia de entrega, peso obligatorio en ferretería.

## 🆕 [2026-07-04] Plantillas Dinámicas de Producto — MVP tipo Shopify (✅ E2E 9/9)

> Cada producto puede ser una landing de venta configurable sin código. Detalle en
> [[modules/product-templates/product-templates]] y `changelog.md`.

- ✅ `product_templates` (JSON sections, draft/published/archived) + `products.template_id/page_content` (migración 0011 aplicada en dev).
- ✅ 10 secciones (beneficios, texto, video, FAQ, testimonios auto de reviews, comparación, urgencia con stock real, garantías, banner, relacionados) con variables `{{product.*}}`.
- ✅ Render en detalle clásico (móvil+desktop) y ML, debajo del hero de compra intacto. Endpoint público con caché 60s.
- ✅ Editor visual en tab "Plantillas": drag&drop, settings por tipo, preview en vivo, publicar, asignación masiva, contenido por producto. Semillas Moda/Tech/Belleza.
- ✅ SEO ligero: JSON-LD Product + document.title.
- ⏳ Siguiente iteración: SEO SSR con slugs, selector de plantilla en el form de producto, precarga de page_content en el modal, responsive por breakpoint, A/B.

## 🆕 [2026-07-02] Chat Vendedor — agente IA asesor y cerrador (5 fases ✅, E2E 16/16)

> El chatbot de tienda (web + WhatsApp) ahora vende con datos reales. Detalle en
> [[modules/agent/agent]] § Upgrade Chat Vendedor y `changelog.md`.

- ✅ Variantes con disponibilidad real en búsqueda y prompt; pedido con validación de stock + reserva atómica + envío real + cupón server-side + consentimiento Ley 1581 (cierra el pendiente del chatbot).
- ✅ Palancas de cierre: ofertas, cupones, envío gratis, upsell (order bump), cliente recurrente ("¿misma dirección?" resuelta server-side), objeciones con datos.
- ✅ Widget: quick replies (chips), "Agregar al carrito" real, markdown ligero, link de privacidad.
- ✅ Panel comerciante: conversaciones + "Atender yo" (takeover) + respuesta manual (web por polling, WhatsApp por Evolution).
- ⏳ Siguiente iteración: streaming SSE · pago Wompi dentro del chat · follow-up post-venta.

## 🆕 [2026-07-02] Blindaje de Privacidad — Ley 1581 / RGPD (6 fases ✅, verificado E2E)

> Módulo `privacy` completo + consentimiento en checkout + derecho al olvido + retención.
> Detalle en [[modules/privacy/privacy]] y `changelog.md`. Reglas nuevas en
> [[governance/universal-constraints]] § Protección de Datos.

**Listo y verificado (rama `esteban`, migración `0010_tense_turbo` aplicada en dev):**
- ✅ **DB:** `consent_records` (inmutable) + `data_subject_requests` (SLA 10 días hábiles); `customers.is_active/deleted_at/anonymized_at`; `storefront_orders.consent_id`; `store_info.privacy_policy_version/cookies_content`.
- ✅ **Checkout:** las 4 rutas públicas (`/public`, MP, ADDI, Sistecrédito) exigen `acceptsDataPolicy=true` (probado: 400 sin él, 201 con él + 3 consent_records + consent_id en la orden). Checkbox obligatorio + opcional WhatsApp en CheckoutView y CheckoutWizardML.
- ✅ **Meta Pixel gated:** solo se inyecta con consentimiento de marketing (banner `CookieConsentBanner` + `lib/consent.ts`).
- ✅ **Derecho al olvido:** `eraseCustomer()` anonimiza cliente + órdenes + ventas POS + chat, conserva montos, audita `pii_erasure` (probado E2E). CRM delete = soft delete ahora.
- ✅ **Derechos del titular:** export JSON (acceso), formulario público en footer, panel de solicitudes en CRM con SLA.
- ✅ **Retención diaria:** chatbot 12m, delivery chat 6m, GPS entregados 90d (`retention.job.ts`).
- ✅ **WhatsApp opt-out:** "BAJA"/"STOP" revoca marketing; `sendMarketingMessage()` para campañas futuras.
- ✅ **Fugas:** payload Wompi minimizado; `redactPII()` en logs de orders; guard anti-PII en `agent.rag.ts`.
- ✅ Plantillas legales Ley 1581 por defecto (`frontend/lib/legal-templates.ts`) con fallback en el footer; nota "valida con tu abogado" en store-customization.

**⏳ PENDIENTE (negocio/próximas sesiones):**
1. Firmar DPAs con Wompi/Cloudinary/Evolution/MercadoPago/ADDI/Sistecrédito.
2. Validación jurídica de las plantillas legales.
3. Consentimiento en pedidos creados por el chatbot (`agent.tools.ts`).
4. Deploy: la migración `0010` corre sola en el CMD de Docker (`migrate.js`).

## 🆕 [2026-06-27] Drizzle Kit — Baseline completo + DDL de runtime congelado (FASE 1 y 2 ✅)

> El esquema ahora es **migraciones versionadas**; **prohibido DDL en runtime**. Detalle en `changelog.md` y `daimuz/decisions/drizzle-migrations-plan.md`.

**Listo y validado (local, MySQL 8.4.3 Laragon):**
- ✅ Scaffolding Drizzle en `backend/src/db/` (cliente, `runMigrations()`, schema TS, migrations). Convive con `mysql2`/SQL raw.
- ✅ **Baseline `0000_nervous_norman_osborn.sql` = esquema COMPLETO** (201 tablas + 6 vistas + 196 FKs + 2672 columnas) que **reconstruye la BD 1:1**. Incluye `schema_FULL.sql` + TODO el DDL que antes vivía en runtime. FK con nombres cortos nativos (evita límite 64 chars); snapshot canónico → `generate` limpio.
- ✅ **DDL de runtime ELIMINADO**: bloque de `index.ts` (255-1472) excisado; `ensure*` con `return` temprano; DDL inline en handlers comentado. `tsc` 0 errores; **boot real OK** (arranca, `runMigrations` salta el baseline marcado).
- ✅ `src/db/baseline-mark-applied.sql` (hash `2d6234c6…`) para marcar BDs existentes sin recrear. Aplicado/validado en `stockpro_db`.
- ✅ Flujo en `CLAUDE.md`: editar `schema.ts` → `npm run db:generate` → `npm run migrate`.

**⏳ PENDIENTE:**
1. **Prod/staging:** correr `src/db/baseline-mark-applied.sql` UNA vez (marca el 0000, no recrea). NO correr `migrate()` al boot en prod.
2. **Dev local:** `stockpro_db` está incompleta (100 tablas) y marcada. Para un dev limpio con las 201: `drop` + `npm run migrate`. (El DDL de runtime ya no autocrea tablas.)
3. **Limpieza opcional:** archivar `schema_FULL.sql` y `src/migrations/*.sql` (representados en el 0000). `stockpro_truth` quedó como BD de referencia. ✅ El código muerto de las funciones `ensure*` ya se borró (ahora son no-op limpios de 1 línea).

## 🆕 [2026-06-25] Workout Engine — Progression + Runtime + Workout Mode UI

> Construido pero **NO deployado**. Verificar `pnpm exec tsc --noEmit` (front+back) antes de push + Komodo. Migraciones al boot. Detalle en `changelog.md` y `current-sprint.md`.

El botón "Iniciar rutina" ahora SÍ lleva a un modo entrenamiento real con progresión inteligente, construido como sistema **determinístico por capas** (la IA interpreta, el motor ejecuta).

**Listo (código en disco, verificado tsc 0 errores + 31 tests):**
- ✅ **Progression Engine** (`backend/src/modules/progression/`) — núcleo puro, sin deps, hipertrofia + double progression. RuleEngine centralizado (única fuente de reglas fitness), strategies desacopladas, contratos validados, decisiones auditables (`reasons`). 19 tests. `strength`/`endurance` lanzan a propósito (V2/V3).
- ✅ **Workout Runtime** (`backend/src/modules/workout/`) — scope consumidor (user, NO tenant). State machine, persistencia (sessions/exercises/sets + `exercise_progressions` snapshot), repository transaccional, services lifecycle/set-tracking, **progression-bridge** (conecta runtime↔motor al completar), eventos. 12 tests. Endpoints `/api/workouts/*`.
- ✅ **Workout Mode UI** (`frontend/`) — `lib/workout-api.ts`, `components/workout/*` (sesión inmersiva, set tracker, rest timer, summary con progresión), ruta `/workout/session/[id]`, botón "Iniciar rutina" cableado. Front NO calcula: renderiza decisiones del backend.

**⏳ PENDIENTE (próxima sesión / próximo agente):**
1. **Deploy:** `pnpm exec tsc --noEmit` front+back → push → Komodo. Migraciones al boot: `workout_sessions`, `workout_exercises`, `workout_sets`, `exercise_progressions`.
2. **Probar loop en vivo:** "Iniciar rutina" → `/workout/session/:id` → completar sets → rest timer → completar → ver progresión (+2.5kg) + PRs.
3. **Decisión de producto pendiente:** hoy `start-today` usa **templates** de ejercicios (Tren superior/inferior/Full body por keyword del título) porque `rutina_actividades` no tiene ejercicios estructurados con cargas. Evaluar si los ejercicios deben salir de la rutina real del usuario (requeriría estructurar la rutina con sets/reps/peso).
4. **Siguientes capas del plan (NO hechas):** RestTimer/volumen ya están en UI; faltan fatigue engine, PR system avanzado, gamificación XP enganchada a los eventos workout (el publisher ya existe, falta suscriptor), IA coach (presentational), objetivos fuerza/resistencia (nuevas strategies en el engine).

## 🆕 [2026-06-22] DAIMUZ Fitness Lifestyle OS — Fases 2, 3 y 4.1

> Construido pero **NO deployado** (push + Komodo Deploy pendientes del usuario). Verificar `pnpm exec tsc --noEmit` en front y back antes. Las migraciones corren al boot del backend. Detalle en `context/current-sprint.md` y `changelog.md`.

**Listo (código en disco):**
- ✅ **Coach Economy (Fase 2) T1–T8** — programas, contratación Wompi, comisión híbrida 20%/mín100k, delivery + feed async, payouts del coach, portal `/coach`, reviews + Transformation Score + ranking.
- ✅ **Vault / Access Ecosystem (Fase 3) V1–V4** — Vault Keys que desbloquean interfaces ocultas (`AccessGate`), Drops como eventos (cupos en vivo Socket.io + claim transaccional + checkout Wompi + 10% al curador), Logros de cliente (badges), portal curador `/promotor`. Tabs superadmin: **Vault** y **Drops**.
- ✅ **Adaptive OS (Fase 4.1)** — `/adaptive/me` + `AdaptiveCards` en Today (nudges reactivos priorizados).

**⏳ PENDIENTE (próxima sesión):**
1. **Deploy:** correr `tsc --noEmit` (front+back), push, Komodo Deploy. Migraciones al boot: `trainer_withdrawals`, `vault_keys`/`vault_key_redemptions`/`consumer_vault_unlocks`, `drops`/`drop_claims`, `consumer_achievements`.
2. **Probar en vivo** el loop completo: emitir Vault Key (superadmin o `/promotor`) → canjear en OS → drop en vivo → claim → pagar → comisión al curador → badges → adaptive cards.
3. **Fase 4 (resto):** predictive commerce (necesita historial de compras de consumibles), AI transformation tracking (peso/fotos/medidas → progress score + body trend), drops sugeridos por el adaptive engine.
4. **Fase 5 — Community Layer:** leaderboards sociales (rachas/adherencia/transformaciones), guilds/teams, retos de temporada ("Summer Cut Challenge"), social feed.
5. **Pendientes finos:** marcar `coach_feed_entries.is_read` al abrir el feed (hoy el nudge "coach te escribió" depende de is_read); UI de waiting room más inmersiva; comisión por conversión configurable por tier (hoy fija 10%); `founder` achievement no tiene trigger automático (otorgar manual a los primeros).

## Qué está funcionando al 100%

- ✅ **Auth** — Login local + Google OAuth + roles + multi-tenant
- ✅ **Dashboard** — KPIs, gráficas, métricas en tiempo real
- ✅ **POS** — Ventas, descuentos por ítem y global, múltiples pagos
- ✅ **Inventario** — Kardex completo, movimientos, alertas de stock
- ✅ **Caja** — Apertura/cierre, arqueo, historial inmutable
- ✅ **Ventas** — Historial con filtros, cancelaciones con auditoría
- ✅ **Clientes** — CRM básico, historial de compras
- ✅ **Créditos/Fiados** — Control de cupo, pagos parciales
- ✅ **Finanzas** — Flujo de caja, ingresos/egresos
- ✅ **Gastrobar** — Mesas, comandas, reservas, recetas BOM, food cost, merma
- ✅ **Compras** — Órdenes de compra, facturas de entrada
- ✅ **Delivery** — Pedidos, asignación de conductores, tracking básico
- ✅ **Flota** — Gestión de vehículos y conductores
- ✅ **Storefront** — Tienda online pública, checkout, pedidos online
- ✅ **WhatsApp** — Integración básica con WhatsApp Business
- ✅ **Stripe** — Pagos y suscripciones SaaS
- ✅ **Multi-tenant** — Sistema completo de tenants y módulos activables
- ✅ **Multi-sede** — Sedes con inventario y caja independientes
- ✅ **Colorimetría por IA** — Paleta desde el logo: tienda del comercio (full), panel (solo acento), plataforma (home/login/default). Ambos temas de home la consumen (Tema 1 vía remap Tailwind→`--color-primary`; Tema 2 vía variables `--brand-*`). Regla: todo tema nuevo debe consumirla → [[brain/colorimetria]]

## ✅ Implementado: Talla/Color como filtro real + edición en grupo de variantes (2026-06-21)

- **Filtro real:** elegir talla/color en el picker rápido de `inventory-list.tsx` ahora también filtra la tabla de variantes de la fila expandida (antes solo mostraba el stock de esa combinación exacta). Combina con el filtro de horma. Chips removibles para ver/limpiar.
- **Edición en grupo (bulk):** botón "Editar en grupo" → checkboxes por variante + "Seleccionar grupo visible" (toma el filtro talla/color/horma activo). Diálogo aplica de una vez: ajuste de stock (sumar/restar/exacto + motivo), precio override, costo, stock mínimo — campos opt-in.
- **Backend:** `POST /variants/bulk-update` (`variantsService.bulkUpdate`) — por-variante, no transaccional entre ellas, reporta updated/failed.
- Ver `[2026-06-21]` en `memory/changelog.md` para detalle completo de archivos.

## ✅ Implementado: Variantes — 4 imágenes por color + inventario expandible (2026-06-19 p3)

- **Galería de 4 imágenes por color** en `variant-manager.tsx` (antes solo 1 URL). Cap de 4 validado también en el backend (`variants.service.ts`).
- **Inventario expandible:** cada producto en la tabla/cards de `inventory-list.tsx` se puede expandir para ver sus variantes (color con swatch, talla, SKU, stock) sin abrir el modal de Variantes. Carga lazy vía `api.getVariantsByProduct`.

## ✅ Implementado: Hormas — campo Composición (2026-06-19 p2)

- **`hormas.composition`** (texto libre, ej. "100% Algodón"), separado de `weight_grams` que sigue numérico. Auto-migración + `v45_hormas_composicion.sql`. Input en el form de `horma-manager.tsx`; la tabla muestra "Peso / Composición" apilados.

## ✅ Implementado: Hormas — campo Sexo + paleta de colores con círculos seleccionables (2026-06-19)

- **`hormas.sexo`** (ENUM `unisex`/`hombre`/`mujer`, default `unisex`): auto-migración + migración manual `v44_hormas_sexo.sql`. Selector en el form de `horma-manager.tsx` + columna en la tabla.
- **Paleta de colores:** ya no es solo texto libre. Se muestran círculos clicables con **todos los colores ya usados** en cualquier horma del tenant (deduplicados); clic los agrega/quita de la horma actual. Colores sin `hex` guardado reciben un color de respaldo (mapa de nombres conocidos + hash estable) para que el círculo siempre se vea. Sigue habiendo input manual + `<input type=color>` para colores nuevos con hex exacto.
- Ver `daimuz/brain/horma-architecture.md` para el modelo completo de hormas (precio/costo heredado, tabla de medidas, validación de paleta por variante).

## ✅ Implementado: Multi-API Key para Agente IA + cifrado en reposo (2026-06-15)

**Problema:** El superadmin tenía un solo campo `openai_api_key`. El agente soporta Gemini/OpenAI/Groq pero solo se podía tener 1 key a la vez y la selección era implícita por prefijo.

**Solución:**
- **Frontend** (`IntegrationsTab.tsx`): 3 campos separados (Gemini/OpenAI/Groq) con toggle show/hide, badges "Configurado", y selector de proveedor default con botones.
- **Backend** (`chatbot.routes.ts`): GET/PUT `integrations` ahora maneja `geminiApiKey`, `openaiApiKey`, `groqApiKey` y `defaultAiProvider`. Las API keys se **cifran en reposo** (AES-256-CBC via `crypto.ts`).
- **`agent.service.ts`**: `getAIKeys()` devuelve las 3 keys + provider default. `processAgentMessage()` usa routing explícito por provider (Gemini → function calling, OpenAI/Groq → chat directo).
- **Entorno**: `.env` creado con la OpenAI key provista. `.env.example` actualizado con `OPENAI_API_KEY`, `GROQ_API_KEY`, `AI_DEFAULT_PROVIDER`. Docker-compose dev + production incluyen las nuevas vars.

## ✅ Implementado: color exacto por variante, bulk inventario, auto-fallback IA, logo size, posición Lanyard (2026-06-18 p3)

- **Color exacto por variante:** `color_hex` separado del nombre (paleta en el admin; swatch exacto en la tienda; auto-heal de columna).
- **SKU duplicado:** aviso proactivo + bloqueo de Guardar + el form ahora SÍ muestra el error real del backend.
- **Borrado masivo en Inventario:** `DELETE /products/bulk` + botón "Seleccionar" con checkboxes/overlay.
- **IA solo con la clave:** `getAIKeys` auto-usa el proveedor que tenga clave (Groq→Gemini→OpenAI). El 500 del chatbot era **OpenCode sin saldo**.
- **Tamaño del logo de la tienda:** `store_info.logo_size` + slider en Info Tienda → aplicado al nav (Tema 1 y 2).
- **Posición/tamaño del Lanyard:** `portfolio_config.lanyard_offset_x/_y/_scale` + flechas y slider en el tab Portafolio del superadmin.
- ⚠️ Pendiente operativo: commitear SIN el ruido CRLF (ver `.gitattributes`) + **Deploy en Komodo**.

## ✅ Implementado: Variantes en todo el storefront + selección dinámica + reserva atómica + preventa (2026-06-18)

- **Variantes visibles en todo el embudo:** helper `attachVariants()` centralizado en `storefront.routes.ts`, aplicado a lista, `/offers`, `/new-launches`, `/platform-featured`, `/drop/:id` y `featured`/`trending` de `store-config`. Antes solo la lista las adjuntaba → el detalle abría sin variantes hasta recargar. **Resuelto.**
- **Visibilidad por variante:** la lista ahora incluye productos cuyo `products.stock = 0` si alguna variante tiene stock (`EXISTS` sobre `product_variants`). Sin esto, los productos con variantes no salían en la tienda.
- **Selección dinámica en Tema 2:** `VariantSelector` integrado en `theme2-order-flow.tsx` (precio/imagen/stock al instante, bloqueo hasta elegir, variante en carrito/WhatsApp/pedido). Tema 1 ya lo tenía; se le agregó `variantId` al payload.
- **Reserva atómica de stock en `/orders/public`:** `variants.service.reserveForPublicOrder()` (incrementa `reserved_stock` race-safe, transaccional, movimiento `'reserva'`) + `releaseForOrder()` (cancelación/rollback). `checkStockAvailability` ignora ítems con `variantId`. La tienda oculta el combo agotado al instante (filtra `stock - reserved_stock`).
- **Preventa (backorder):** variantes agotadas seleccionables (`allowOutOfStock` en `VariantSelector`); en `/orders/public`, ítems de variante con `isPreorder` NO reservan stock (venta ilimitada). Para embudos de venta masivos.
- **Producto AnMarg** (Camiseta Clásica): datos de carga en `backend/imports/anmarg-camiseta-clasica/` (CSV 90 variantes + SQL tiers + README). No cargado en BD todavía.
- **(2026-06-18 parte 2) Integración COMPLETA:** asiento al confirmar (`settleVariantForSale` descuenta stock de variante + congela `variant_id`/costo/margen en `sale_items`); reserva en las 3 pasarelas (MP/ADDI/Sistecrédito) con liberación en webhooks; columna `variant_id` en `storefront_order_items` + congeladas en `sale_items` (migración idempotente); cupo de preventa por variante (`preorder_limit`/`preorder_count`, enforce atómico, campo en panel). tsc back+front 0 errores.
- ⚠️ **Solo queda operativo:** arrancar backend (corre migraciones idempotentes) + cargar AnMarg + **Deploy en Komodo**.

## ✅ Implementado: Afiliados (backend S1–4) + tarjetas externas + imagen por variante + barra config (2026-06-17)

- **Módulo Afiliados/Promotores — backend Sprints 1–4** (`/api/affiliates`): schema (10 tablas, migración
  inline en `index.ts`), core (auth propia del promotor, campañas con token, conversiones/comisiones,
  retiros, leaderboard, misiones, superadmin, comercio), paquetes con **pago inmediato al wallet**, y
  **atribución por enlace** (`?ref=` → `attributeOrder` en `/orders/public`) + auto-aprobación. Pendiente:
  tier engine, cron, y todo el **frontend** (portal `/promotor`, tab superadmin, panel comercio). Ver
  `context/roadmap-afiliados.md`.
- **Tarjetas externas**: comercios fuera del aplicativo creables desde superadmin (logo/portada/descripción/link);
  aparecen en la home y redirigen al link. Tabla `marketplace_external_cards`.
- **Imagen por variante**: cada color puede tener su imagen; en la tienda la foto principal cambia al elegir color.
- **Barra de bienvenida (Tema 2)**: activable + editable desde superadmin (`platform_settings`).
- **Tema 2 cerrado**: pantalla de éxito (holo + ticket), fix de pedidos duplicados, carrito minimalista,
  tarjeta premium; confirmación al cliente desde el módulo de pedidos (WhatsApp prellenado).
- **Home móvil**: carrusel sin franjas, bienvenida sin recorte, sección "Únete a DAIMUZ" (3 públicos).
- ⚠️ Todo necesita **Deploy en Komodo** para verse en producción.

## ✅ Implementado: Tema 2 (reservas/pedidos) + QR de mesa administrable (2026-06-16)

- **Reservas Tema 2** ahora **guardan** en `rb_reservations` (visible en el panel) vía `POST
  /restbar/reservations/public-quick`, con pantalla de éxito + botón opcional de WhatsApp.
- **Pedidos Tema 2** ya no fallan en silencio: si el guardado en `storefront_orders` falla, se muestra el error
  y NO se abre WhatsApp. Confirmado que el pedido se guarda con el `tenantId` correcto.
- **"Ordenar Ahora" (Favoritos)** abre el flujo con el producto ya en el carrito.
- **QR de mesa = panel de administración** (no solo generar): ver quién está en la mesa y el **consumo de cada
  persona** (parseado de la etiqueta `[nombre]` en `item_notes`), total, compartir (copiar/WhatsApp/share),
  regenerar y eliminar. Endpoints auth `GET/POST /restbar-qr/tables/:id/session(/close)`.
- ⚠️ Todo esto está en código pero **falta Deploy en Komodo** para verse en producción.

## ✅ Implementado: Colorimetría de marca por IA + fixes (2026-06-14)

**Arquitectura de colorimetría (2 niveles):**
- Paleta de **plataforma** (superadmin, desde el logo DAIMUZ) → tiñe la home/marketplace + login y es el acento por defecto de los paneles de comercios sin paleta propia.
- Paleta **individual del comercio** (desde su logo) → tiñe su tienda (full color) y solo el acento de su panel.
- Jerarquía de acento en panel: acento propio del comercio > acento de plataforma > base. Decisión: los paneles operativos NO se colorizan por completo (solo acento) para no romper contraste/legibilidad.

**Colorimetría en superadmin (`platform-theme-generator.tsx`)**
- Nueva tarjeta "Colorimetría de la plataforma (IA)" junto al logo en LandingConfigTab; genera/previsualiza/guarda en `platform_settings` clave `platform_theme_colors`.
- `lib/platform-theme.ts` (helper: getPlatformPalette / applyPlatformAccentDefault / parsePlatformPalette) + `platform-theme-loader.tsx` montado en `app/layout.tsx` (acento default app-wide).
- `landing-page.tsx` tiñe la home con la paleta de plataforma cuando no hay tienda seleccionada; `merchant-panel.tsx` usa acento de plataforma como fallback.
- Sin cambios de backend: se reutilizan `/storefront/theme/generate` y `/tenants/platform-settings`.

**Auto-colorimetría al subir logo (comerciante)**
- `logo-theme-generator.tsx` + `store-customization.tsx`: al subir un logo nuevo se genera+aplica+guarda la paleta automáticamente y aparece el toast "Colorimetría aplicada. ¿Deseas editarla?" con acción Editar.

**Fixes**
- **Favicon**: usaba `daimuz-icon.png` (recuadro blanco en la pestaña) → ahora `daimuz-icon-transparent.png` en `layout.tsx` (`icon`/`shortcut`) y `BRAND.iconTransparent` en `dynamic-favicon.tsx`.
- **Tarjeta del comercio (`store-card-config.tsx`)**: el tema ahora se guarda al instante al seleccionarlo (antes solo cambiaba estado local y se perdía si no se pulsaba "Guardar tarjeta").
- **Backend `card-config` (`storefront.routes.ts`)**: corregido bug donde `affectedRows === 0` (guardado sin cambios) disparaba un INSERT que fallaba por clave duplicada (500); ahora verifica existencia de la fila antes de crear.

## ✅ Implementado: Sprint 5 — Centro de Pedidos v2 (2026-06-12)

**TenantManagement mejorado (tenant-management.tsx — legacy panel)**
- Acciones con nombres: 5 icon-buttons → `DropdownMenu` con 6 ítems etiquetados
- Eliminar comercio: soft-delete con confirmación (status → 'cancelado')
- Editar todo el comercio: diálogo expandido con slug editable, ownerName/ownerEmail (solo lectura)
- Trial configurable: confirmación con contador de días (−/+ y botones 7/14/30); backend acepta `{ days }` en body
- Backend: `tenants.service.ts` — `update()` acepta `slug` con unicidad; `activateTrial()` acepta `days: number`

**Centro de Pedidos v2 (OrdersCenterTab.tsx)**
- Banner alerta SLA — aparece cuando hay retrasados o sin asignar en la página actual
- Priority chips — "X sin asignar", "X retrasados >30min", "X en riesgo 10–30min" (calculados via `useMemo`)
- Filtro por comercio — Select con tenants activos (nuevo endpoint `GET /superadmin/orders/tenants`)
- Bordes de fila — `border-l-4` por color de estado (amarillo/azul/morado/índigo/verde/rojo)
- Antigüedad coloreada — verde/amarillo/rojo+pulso según SLA en columna Pedido
- Checkboxes + bulk action toolbar flotante — cambiar estado / asignarme / cancelar en selección múltiple
- Toggle Tabla/Kanban — botones en el header
- Asignación rápida en drawer — lista de repartidores del comercio del pedido; click asigna directo
- `KanbanView.tsx` — Kanban 6 columnas con @dnd-kit; drag cards entre columnas valida state machine
- 3 endpoints nuevos en backend (`/orders/tenants`, `/orders/:id/drivers`, assign con `assigneeId`)
- Instalado: `@dnd-kit/core` + `@dnd-kit/utilities` vía pnpm

## ✅ Implementado: Panel Superadmin Modular — Sprints 0-4 (2026-06-12)

**Sprint 0 — Refactor monolito superadmin-home.tsx (3444 líneas → arquitectura modular)**
- `superadmin/SuperadminLayout.tsx` — shell con 9 tabs lazy-loaded (`next/dynamic`)
- 9 tabs en `superadmin/tabs/` — cada una es JSX puro que consume un hook
- Hooks en `superadmin/hooks/` — toda la lógica/estado separada de la UI

**Sprint 2 — Centro de Pedidos cross-tenant**
- Backend: `backend/src/modules/orders/superadmin-orders.routes.ts` (5 endpoints)
- Auto-migración: columna `assigned_to` en `storefront_orders` + tabla `order_status_history`
- Frontend: `useOrders.ts` + `OrdersCenterTab.tsx` (bandeja, SLA semáforo, drawer, state machine)

**Sprint 3 — Wizard creación + Papelera/Restaurar tenants**
- `CommerceWizard.tsx` — wizard 4 pasos (Comercio → Plan → Propietario → Confirmar)
- `useTenantLifecycle.ts` — soft-delete (→ status: 'cancelado') + restore (→ status: 'activo')
- `CommercesTab.tsx` — reescrito con sección "activos" + toggle papelera con badge rojo

**Sprint 4 — Analytics profesional + SSE reemplaza polling**
- Backend: 3 endpoints nuevos en `superadmin-orders.routes.ts` (SSE + analytics + heatmap)
- `useOrders.ts` — EventSource con `withCredentials: true`, fallback polling automático
- `useAnalytics.ts` — KPIs plataforma, heatmap 7×24
- `AnalyticsTab.tsx` — 6 KPI cards con Delta chip + TenantChart + Heatmap CSS grid

**Bugs encontrados y corregidos en auditoría final:**
- Tab por defecto corregido: `'pagina'` → `'pedidos'`
- Import `Pin` de lucide-react eliminado (nunca usado)

## En ajuste / desarrollo activo

- 🔄 **Agente IA** — RAG funcionando, mejorando respuestas y herramientas
- 🔄 **Inmobiliaria** — Módulo base listo, refinando flujos
- 🔄 **Tapicería/WorkOrders** — Módulo listo, refinando UX

## ✅ Implementado: Sistema de Variantes + Precios por Volumen (2026-06-09)

Implementación full-stack completa. Ver `daimuz/brain/variants-implementation-plan.md`.

**Backend nuevo:**
- `modules/variants/variants.service.ts` — CRUD variantes, stock atómico, price tiers, resolvePrice, import CSV
- `modules/variants/variants.controller.ts` + `variants.routes.ts`
- `modules/suppliers/suppliers.service.ts` — CRUD proveedores + link productos
- `modules/suppliers/suppliers.controller.ts` + `suppliers.routes.ts`
- `common/types/index.ts` — ProductVariant, VariantPriceTier, ResolvedPrice, Supplier, InventoryMovement
- `modules/sales/sales.service.ts` — rama variant en loop de venta (stock atómico + price freezing + inventory_movement)
- `modules/storefront/storefront.routes.ts` — variantes con price tiers en storefront
- `migrations/004_variants_and_suppliers.sql` — 5 tablas nuevas + ALTER TABLE sale_items/order_items/products

**Frontend nuevo:**
- `components/variant-manager.tsx` — gestión completa: CRUD variantes, tiers, ajuste stock, import CSV
- `lib/types.ts` — ProductVariant, VariantPriceTier, ResolvedPrice, Supplier
- `lib/api.ts` — todos los métodos para variantes, tiers y proveedores
- `components/inventory-list.tsx` — botón Layers por producto abre VariantManager
- `components/point-of-sale.tsx` — handleAddToCart async detecta variantes, picker dialog con resolución de tier por qty

## En planificación (DAIMUZ completo, sin codificar)

## Pendiente / Backlog

- ⏳ Ver [[context/pending]] para la lista priorizada

## Últimos cambios

> Agrega aquí cada vez que termines algo significativo

- `[2026-06-18 p2]` — **Integración de variantes COMPLETA**: asiento al confirmar (`settleVariantForSale`), reserva en pasarelas (MP/ADDI/Sistecrédito) + liberación en webhooks, columna `variant_id` en `storefront_order_items` + congeladas en `sale_items` (migración idempotente en `index.ts`), cupo de preventa por variante (`preorder_limit`/`preorder_count`, enforce atómico, campo en `variant-manager`). tsc back+front 0 errores. Solo queda arrancar backend + cargar AnMarg + Deploy en Komodo.
- `[2026-06-18]` — **Variantes en todo el storefront + selección dinámica (Tema 2) + reserva atómica + preventa**: helper `attachVariants()` aplicado a todos los endpoints públicos de producto (fix: variantes no cargaban hasta recargar); visibilidad por variante en la lista (`EXISTS` sobre `product_variants`, los productos con `stock=0` ya aparecen); `VariantSelector` integrado en `theme2-order-flow.tsx`; reserva atómica de `reserved_stock` en `POST /orders/public` (`reserveForPublicOrder`/`releaseForOrder` en `variants.service.ts`, `checkStockAvailability` ignora `variantId`, libera en `cancel-gateway`); preventa backorder (`allowOutOfStock` en selector; ítems `isPreorder` no reservan stock). Producto AnMarg en `backend/imports/anmarg-camiseta-clasica/`. tsc back+front 0 errores. Falta Deploy en Komodo.
- `[2026-06-16]` — **Modo Chat Daimuz (slice Restbar)**: el agente opera mesas por chat (`/api/daimuz-chat`, página `/modo-chat`) con confirmación antes de ejecutar (abrir mesa / tomar pedido / enviar a cocina). Además: asistentes ahora aceptan OpenAI (`sk-`) con base URL configurable, y las AI keys se enmascaran en el panel con opción 'revelar'. Base de la visión 'el panel se vuelve chat y mueve los módulos'. Pendiente: cobrar, más módulos, Gemini, y el toggle de panel completo.
- `[2026-06-14]` — **Colorimetría de marca por IA (2 niveles) + fixes**: paleta de plataforma (superadmin → home/login/default paneles) y paleta individual del comercio (tienda full + acento de panel); auto-colorimetría al subir el logo del comercio con toast "Colorimetría aplicada ¿desea editar?". Nuevos: `lib/platform-theme.ts`, `components/platform-theme-loader.tsx`, `components/platform-theme-generator.tsx`. Editados: `app/layout.tsx`, `superadmin/tabs/LandingConfigTab.tsx`, `logo-theme-generator.tsx`, `store-customization.tsx`, `landing-page.tsx`, `merchant-panel.tsx`. Fixes: favicon → `daimuz-icon-transparent.png`; "Tarjeta del comercio" guarda el tema al instante (`store-card-config.tsx`); backend `card-config` ya no falla con INSERT duplicado al reguardar sin cambios (`storefront.routes.ts`). Sin cambios de schema (reutiliza `platform_settings` y `/storefront/theme/*`).
- `[2026-06-12]` — **Panel Superadmin — Sprints 0-4 completados**: refactor monolito (3444 líneas → 25 archivos modulares), Centro de Pedidos cross-tenant con SSE, wizard creación de comercios, papelera/restaurar tenants, dashboard analítica con heatmap. Backend: 8 endpoints `/api/superadmin/*`. DB: columna `assigned_to` en `storefront_orders` + tabla `order_status_history`.
- `[2026-06-09]` — **Sistema de Variantes + Precios por Volumen — implementación full-stack completa**: backend (variants.service, suppliers.service, controllers, routes), actualización de sales.service (stock atómico + price freezing), storefront con variantes+tiers, migración 004_variants_and_suppliers.sql (5 tablas), frontend (variant-manager.tsx, api.ts, inventory-list con botón variantes, point-of-sale con picker dialog y resolución de tiers). TypeScript frontend: 0 errores. Errores backend son truncaciones pre-existentes no relacionadas.
- `[2026-06-07]` — **DAIMUZ auditado contra análisis completo**: indexes limpiados (modules, endpoints, files, db-tables), sinapsis ops-chain reescrita sin duplicados, reglas de variantes en vault business-rules, architecture/database consolidado. Scorecard final verificado: 9.8/10.
- `[2026-06-07]` — **Arquitectura de variantes completa en DAIMUZ**: diseñado e integrado el modelo `products → product_variants → variant_price_tiers` con todas las mejores prácticas. Creado `decisions/variant-architecture.md` (8 decisiones formales), `flows/variant-flow.md` (5 flujos), actualizados governance, business-rules, ontology (limpieza de duplicados), synapses (ops-chain + delivery-chain + variants-chain), e indexes. Pendiente: implementar código backend y frontend.
- `[2026-06-06]` — **Build TypeScript verde**: corregidos 68 errores de `tsc --noEmit` (53 frontend / 15 backend). Tipos del reporte de cierre diario en `lib/types.ts`, métodos `getDailyReport`/`bulkCreateCustomers` en `lib/api.ts`, migración de `ProductTour.tsx` a react-joyride 3.1, `User.tenantName` en restbar, y en backend: `AuthRequest` en `workorders.controller`, fix de spread en `gym.service`, `tenantId ?? undefined` en assistant, y nuevo stub `modules/alegra/alegra.service.ts`. Pendiente: endpoint `POST /customers/bulk` e integración real de Alegra. Backend verificado limpio; frontend validado por revisión (el `tsc` completo no cabe en el sandbox de Cowork).
- `[2026-06-05]` — **Módulo CONSUMIDOR (rutina) end-to-end** + capa de identidad cross-comercio. Backend `/api/rutina` (service+routes montados), frontend `consumer-routine.tsx` como overlay con botón nuevo "Rutina" en el nav (sin tocar las 5 secciones existentes). Migraciones: `add_platform_identity.sql` (customer_tenant_profiles), `add_lifestyle_rutina_and_gym_modules.sql` (rutina_* + gym_* + macros + asistencia + log cumplimiento). Falta correr migraciones en prod + push. Módulo GIMNASIO: solo tablas, sin código aún.
- `[2026-06-04]` — **PRODUCCIÓN viva en Komodo** (`https://daimuz.alexsters.works`): stack `daimuz` con backend + frontend. Komodo buildea desde el repo GitHub `estebanIoI/lopbuk_gastrobar` (main). Pre Build Images + Destroy Before Deploy activos. Fix de Google OAuth en prod (client ID como build arg). Chatbot funcionando: modelo Gemini cambiado a alias `gemini-flash-latest` (env `GEMINI_MODEL`) + soporte Groq en `callAI` (env `GROQ_MODEL`). Deploy aplicado vía push al repo + rebuild en Komodo.
- `[2026-05-28]` — **Dividir cuenta en partes iguales — RestBar Caja** (`restbar.tsx`): nueva opción en el selector de cobro de la sección Caja. Muestra un panel ámbar con contador +/− de personas, calcula "cada persona paga $XXX", desglose por persona numerado. Solo frontend, sin cambios en backend. El cobro sigue procesándose como pago de mesa completa. Disponible para todas las mesas (con o sin comensales asignados). Selector ahora siempre muestra las opciones al elegir mesa (antes auto-saltaba a modo tabla si no había split de comensales).
- `[2026-06-16]` — **Fase 4 Restaurante (reportes)**: sub-router `restbar.reports.routes.ts` (`/api/restbar/reports/summary`) → resumen de pagos, top productos, rendimiento mesero/mesa, KPIs. Página `/reportes-restaurante` con rango de fechas y export PDF. Marketing/promos ya cubierto por `store_banners`+home `/r/[slug]`. Incluye **backup/restore** (`/api/restbar/backup` + página `/respaldos`): export de solo lectura y restore con upsert de SOLO catálogo/config (nunca pedidos/pagos), con vista previa + frase `RESTAURAR`. **Roadmap restaurante COMPLETO (Fases 1–4); integración Sirius cerrada.** tsc front 0; backend sin errores en archivos propios.
- `[2026-06-15]` — **Fase 3 Restaurante COMPLETA (fidelización)**: módulo `loyalty` (`/api/loyalty`) con reglas de puntos configurables (puntos por $1.000), recompensas CRUD, cuentas por teléfono, acúmulo (`/earn`, sin tocar pagos) y canje desde la sesión del cliente (`/mesa/[token]` → código de canje). Panel admin `/fidelizacion`. Roadmap: Fase 1 ✅ · 2 ✅ · 3 ✅; falta Fase 4 (marketing + reportes). tsc front 0.
- `[2026-06-15]` — **Fase 2 Restaurante COMPLETA**: **prioridad de cocina** (comandas urgentes primero en los paneles cocinero/bar, badge 🔥 + botón ⚡; columna `rb_orders.priority`, `PATCH /restbar/orders/:id/priority`) y **regalo entre mesas** (el cliente envía productos a la comanda de otra mesa ocupada; `GET/POST /restbar-qr/session/:token/tables|gift`). Además: **reservas online avisan al comercio** (notificación) y **jukebox** (el cliente pide canción al superar un umbral de consumo; staff la gestiona en `/jukebox`). **Fase 2 cerrada.** tsc front 0.
- `[2026-06-15]` — **Fase 1 Restaurante (QR de mesa) COMPLETA**: el cliente escanea el QR de su mesa (`/mesa/[token]`), entra con su nombre, ve el menú con disponibilidad real, pide desde su celular (entra al KDS real) y **sigue el estado de su pedido en vivo**. La sesión se invalida al cobrar/cancelar. Nueva **home del restaurante** `/r/[slug]` (promos/eventos desde `store_banners`, destacados, CTAs menú/reservar). Backend: `restbar-qr.routes.ts` (`/api/restbar-qr`) + tablas `rb_table_sessions`/`rb_table_guests`. tsc 0. Plan completo en `context/plan-integracion-sirius.md` (secciones 5–7).
- `[2026-05-28]` — **SQL principal sincronizado** (`inventarioEsteban_v3_multitenant.sql`): migración v3.8 agrega `categories.is_active/color/sort_order` + tablas `rb_gastos`, `rb_ingresos_diarios`, `rb_gastos_fijos`. SQL ahora está full para levantar desde 0.
- `[2026-05-27]` — **Tracker Financiero Gastrobar** (`restbar-finanzas.tsx` + `restbar.finanzas.routes.ts`): tab "Finanzas" (admin-only) en RestBar con timeline, gastos variables, ingresos diarios, gastos fijos y resumen quincenal. Auto-timestamp en servidor. 3 tablas nuevas: `rb_gastos`, `rb_ingresos_diarios`, `rb_gastos_fijos`.
- `[2026-05-27]` — **Categorías CRUD completo** en módulo Inventario: backend (PUT /:id, PATCH /:id/visibility), frontend dialog con lista de categorías + edición inline + color picker + hide/show + delete con validación. `CategoryItem` actualizado con `isActive`, `color`, `sortOrder`. Store con `updateCategory`, `toggleCategoryVisibility`.
- `[2026-05-27]` — **daimuz v3** (100/100): gobernanza completa, todos los compressed.md, synapses completas, bugs-history poblado, deployment.md corregido (Dokploy + E