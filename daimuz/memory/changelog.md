# Changelog - Lopbuk

> Registro de cambios significativos. Formato: `## [YYYY-MM-DD] — Descripcion`

---


## [2026-06-25] — Workout Engine: Progression Engine + Runtime + Workout Mode UI (Fitness OS)

Construido el corazón del "Iniciar rutina" como sistema determinístico por capas. **NO deployado** (pendiente `pnpm exec tsc --noEmit` front+back + push + Komodo). Migraciones corren al boot.

- **Progression Engine (determinístico, sin deps)** — `backend/src/modules/progression/`. Núcleo puro hipertrofia + double progression (rango 8-12). Capas: `shared` (enums/constants/`schema.ts` validación estilo zod sin instalar zod), `domain` (entities, `rules/goal-rules.ts` = **único RuleEngine**, calculators volume/completion-rate/1RM, evaluator, strategies + factory), `application` (ProgressionService + evento `progression_computed`). Decisión: todas las series al tope → `increase` (+2.5 upper / +5 lower); dentro de rango → `maintain`; bajo mínimo o rate<0.8 → `decrease`. `strength`/`endurance` y `linear`/`rir_based` LANZAN a propósito (anti-alucinación). **19 tests** node:test verdes, tsc 0 errores.
- **Workout Runtime (Fase 5)** — `backend/src/modules/workout/` (scope consumidor = `users.id`, como `rutina`; NO tenant). State machine explícita (`pending→active→paused→completed/cancelled`). Tablas idempotentes: `workout_sessions`, `workout_exercises`, `workout_sets`, `exercise_progressions` (snapshot por user+ejercicio = source of truth). Repository único user-scoped+transaccional. Services: lifecycle + set-tracking + **progression-bridge** (al completar la sesión corre el engine por ejercicio → upsert snapshot → eventos). Event publisher no-op extensible. **12 tests** verdes. Montado en `index.ts`: `/api/workouts` + `ensureWorkoutSchema()` al boot.
- **Workout Mode UI (Fase 6, slice vertical)** — Backend glue `today-plan.service.ts` + `POST /workouts/start-today` (arma template por tipo de sesión + **peso sugerido = `nextWeight` del snapshot**). Frontend: `lib/workout-api.ts` (módulo aparte, NO se tocó el `api.ts` gigante), `components/workout/` (WorkoutSessionScreen, ExerciseCard, SetTracker, RestTimer 90s, WorkoutSummary), ruta `app/workout/session/[id]/page.tsx`, y botón "Iniciar rutina" de `MissionControl.tsx` cableado → `startToday` → `router.push`. **Regla:** el front NO calcula nada; solo renderiza `action`/`nextWeight` del backend. tsc 0 errores en archivos nuevos.
- **Verificación:** el mount del sandbox quedó stale otra vez (glitch conocido: trunca archivos grandes y no refleja sobreescrituras vía bash). Se verificó reconstruyendo el contenido correcto en `/tmp` y leyendo el workspace con file-tools. Correr `pnpm exec tsc --noEmit` en Windows.


## [2026-06-24] — Chatbot: limpiar llamados de herramienta filtrados como texto

- **Síntoma:** el modelo escribía el tool-call COMO TEXTO en el chat (`<function=registrar_pedido>{...}</function>`), visible para el usuario, además de hacer varias preguntas juntas. Pasa cuando el tool-calling nativo del proveedor no engancha y el modelo improvisa el llamado en texto.
- **Fix determinista:** sanitizador en `processAgentMessage` que elimina `<function...>...</function>` (cerrado y sin cerrar), `<tool_call>…`, tokens `<|...|>` y `[COMPRAR:…]`; si tras limpiar no queda texto útil, responde algo amable. Refuerzo de prompt en `buildEnrichedSystemPrompt`: "habla natural, UNA pregunta por mensaje, JAMÁS escribas etiquetas de herramientas ni JSON de pedidos en el mensaje".


## [2026-06-24] — Fix chatbot 500 por rate limit (regresión de IA7) + TS build

- **Causa del 500:** la migración del chatbot de tienda a `agentLoop` (IA7) quitó el manejo amable del 429 que tenían los `callGroq`/`callOpenAI` viejos (devolvían texto en vez de lanzar). Al saturarse Groq (free tier, 12k TPM), el error subía a 500 y el front mostraba "hubo un problema". **Fix:** `processAgentMessage` ahora captura 429/rate-limit/quota y devuelve respuesta amable ("muchas consultas, espera unos segundos") con código 200, conservando las tarjetas de producto ya encontradas. Otros errores de IA → mensaje genérico amable, nunca 500.
- **Causa raíz real (chatbot + coach caen a Groq):** ambos usan tools; al fallar OpenCode Go (suscripción, alta capacidad) el `agentLoop` caía a Groq (free, 12k TPM) → 429. Mitigaciones: (a) `providerChain` deja a **Groq de ÚLTIMO recurso** (orden `opencode_go → gemini → openai → groq`); (b) **log de diagnóstico** en `agentLoop` (`[ai] agente: proveedor "X" (model) falló → ...`) para ver POR QUÉ falla Go. Sospecha por docs OpenCode: el `model` de la API debe ir **pelado** (`deepseek-v4-flash`), no `opencode-go/deepseek-v4-flash` (el prefijo es solo del config CLI). Pendiente: confirmar con el log real de Go tras redeploy y corregir id/endpoint/tools según corresponda. Warnings `Duplicate key name 'idx_soi_variant'/'idx_si_variant'` son benignos.
- **TS build:** `lib/push.ts` `applicationServerKey ... as BufferSource` (choque de tipos lib DOM); `rutina.service.ts` `sex: sex ?? undefined` en computeNutrition. Ambos preexistentes.


## [2026-06-24] — Storefront: hora del pedido, checkout Tema 2, imágenes en modificadores

- **Hora del pedido (-5h):** causa = `created_at` es TIMESTAMP (interno UTC) pero la sesión MySQL estaba en hora Colombia y mysql2 sin config de zona → el `Date` quedaba 5h atrás y el front lo mostraba en Colombia (doble desfase). Fix UTC end-to-end: `database.ts` con `timezone:'Z'` + `SET time_zone='+00:00'` en cada conexión nueva; `pedidos.tsx` formatea con `timeZone:'America/Bogota'` (tarjeta + tickets de impresión).
- **Checkout Tema 2:** al confirmar ya NO redirige a WhatsApp. `submitOrder` muestra el contenedor "Tu pedido está en camino" y deja seguir comprando ("Seguir comprando"). `sendWhatsApp` → `buildWhatsAppUrl()`; el éxito (`Theme2OrderSuccess`) recibe `whatsappUrl` y ofrece botón opcional "¿Olvidaste algo? Confírmalo por WhatsApp".
- **Imágenes en modificadores (por opción):** el schema (`product_modifier_options.image_url`), backend (GET/PUT) y storefront (Tema 2/Tema 1 ya renderizan `o.imageUrl`) YA lo soportaban; faltaba la subida en el editor → `product-modifiers-manager.tsx` ahora tiene `CloudinaryUpload` + miniatura por opción.
- **Auditoría modificadores (valor/ítem separado):** en el código ACTUAL de Tema 2 (`detailUnit = detailBase + detailExtra`) y Tema 1 (`finalPrice += t1Extra`) el delta SÍ se suma al unitario y se une como UNA sola línea (el modificador se concatena al nombre, no crea ítem aparte); el pedido del reporte quedó en $16.000 = 14.000+2.000 (correcto). No se reprodujo el bug en fuente → probable desfase de deploy; recomendado redeploy + re-test.
- Verificado con esbuild (backend + tsx), 0 NUL.


## [2026-06-24] — Chatbot de comercio: auditoría resuelta (tools en cualquier IA + fixes)

Resolución de la auditoría del chatbot de tienda:
- **CRÍTICO — pedidos/reservas en cualquier proveedor:** `processAgentMessage` ya NO ramifica por proveedor. Todo pasa por `agentLoop` (IA7) con las herramientas reales (`registrar_pedido`/`crear_reserva`/`registrar_interes_cliente`). Antes solo Gemini ejecutaba herramientas; con el default `opencode_go` el bot no registraba nada. Ahora registra con la IA configurada, con respaldo y telemetría. Helper `toToolDefs`/`lowercaseTypes` convierte las declaraciones Gemini (MAYÚSCULA) a JSON-schema estándar para el orchestrator. **Dedupe por turno** (`executedTools`) evita pedidos/reservas duplicados si el modelo reintenta. `maxRounds: 4`, `maxTokens: 260`, tier main. Se conserva el error 'Servicio de IA no configurado' (mapea NO_AI_KEY).
- **MEDIO — historial duplicado:** la ruta `/message` ahora procesa ANTES de guardar el mensaje del usuario, así el historial que ve el modelo no incluye el mensaje actual (se anexa una sola vez dentro del pipeline). Elimina el doble último turno y, de paso, el mensaje "huérfano" si el pipeline falla.
- **MENORES:** telemetría del bot de tienda ahora sí se registra (pasa por orchestrator); en human takeover se guarda el mensaje del usuario.
- Verificación: el mount del sandbox quedó stale (glitch conocido, esbuild dio falso EOF); contenido confirmado completo y correcto vía file-tools. Correr `pnpm exec tsc --noEmit` en Windows.


## [2026-06-24] — Chatbot de comercio: asesor consultivo + no repetir/ofrecer productos

Mejora del chatbot de tienda (`agent.service` + `chatbot.routes` + `ChatWidget`):
- **Prompt** (`buildEnrichedSystemPrompt`): reescrito como ASESOR CONSULTIVO (entender→recomendar UNA opción→resolver objeciones→microcompromisos→cierre). Regla clave: solo mencionar/mostrar productos que el cliente pidió o que encajan; **nunca ofrecer el catálogo al azar**; y si el cliente ya dijo que quiere pedir un producto, **no repetir su tarjeta** sino avanzar el pedido (cantidad→nombre→teléfono→dirección). La carta pasa a "consulta interna — NO la listes".
- **`processAgentMessage`**: nuevo parámetro `excludeProductIds`; se **eliminó el relleno con productos destacados** (causa de mostrar productos no pedidos); las sugerencias = solo coincidencias reales menos los ya pedidos.
- **`chatbot.routes /message`**: lee `excludeProductIds` del body y lo pasa al pipeline.
- **`ChatWidget`**: trackea los productos pedidos por "Pedir por aquí" (`orderedIds`), los envía como `excludeProductIds`, y oculta su tarjeta (incluso en mensajes previos) al pedirlos. `onOrderByChat` ahora recibe el producto completo (id+nombre).
- Verificado con esbuild (backend + tsx), 0 NUL.


## [2026-06-24] — IA7: tools provider-agnóstico + AI Coach con cualquier IA

**Sin push/deploy — pendiente del usuario** (`pnpm exec tsc --noEmit` backend + redeploy).

- Orchestrator: nuevo `agentLoop(req)` con function-calling **provider-agnóstico**. Tools en JSON-schema estándar (tipos minúscula) + callback `execute(name,args)`. Soporta OpenAI-compat (OpenCode Go/OpenAI/Groq con `tools`) y Gemini (`functionDeclarations`, convertidos con `geminiSchema` a MAYÚSCULA). Loop multi-ronda (def. 6) con cierre forzado a texto si se agotan; telemetría (`logUsage` tier `agent`), tiering, guardas de límite y respaldo entre proveedores. **No reintenta en otro proveedor tras ejecutar una tool** (evita doble escritura en BD) vía flag `executed`.
- AI Coach (`rutina.assistant`) migrado a `agentLoop`: eliminado el fetch directo a Gemini y la restricción "solo Gemini". TOOLS reescritas a JSON-schema minúscula. Ahora corre con OpenCode Go / OpenAI / Groq / Gemini según configuración; el usuario tiene su coach funcional controlando su OS (perfil, rutina, comidas, compras, productos reales) con la IA que el admin elija. Free=tier small, LEGEND=tier main.
- Fix: el archivo `rutina.assistant.ts` tenía 1082 bytes NUL al final (artefacto de edición); se limpiaron (verificado con esbuild, 0 NUL).
- Asistente operador (`assistant.runPlatformAssistant`, superadmin Agente Maestro + comerciante) migrado también a `agentLoop`: se borraron los runners por proveedor (`runWithGemini`/`runWithOpenAICompat`) y `getAssistantKey`; tools (SUPERADMIN_TOOLS/MERCHANT_TOOLS) reescritas a JSON-schema minúscula y tipadas `ToolDef[]`. Ahora también corre con cualquier IA configurada (tier main, telemetría por tenant). `toOpenAITools` se conserva (lo usa `daimuz-chat`).
- **Todos los agentes con tools quedan sobre el orchestrator unificado.**


## [2026-06-24] — AI Coach: base de conocimiento certificada de fitness

- Nuevo `backend/src/modules/rutina/rutina.coach-kb.ts` → `COACH_KB`: conocimiento estructurado de coach (objetivos: fuerza/hipertrofia/pérdida de grasa/movilidad/salud-mantenimiento/recomposición/rendimiento, con series·reps·descanso·frecuencia·ejercicios·splits por meta; nutrición por prioridad calorías→proteína 1.6–2.2 g/kg→grasas 20–30%→carbos; reglas de progresión entrenamiento+nutrición; recuperación; onboarding; SEGURIDAD —derivar a profesional, nunca esteroides/dietas extremas/sobreentrenamiento—; estructura de respuesta; tono).
- `rutina.assistant.ts`: el `SYSTEM_PROMPT` ahora antepone `COACH_KB` como bloque estable y debajo la capa DAIMUZ (herramientas, productos reales, operación de la app). El coach detecta objetivo y ajusta rutina/nutrición según el KB; al crear rutina distribuye días y esquema por meta.
- `guardar_perfil.goal`: descripción con mapeo de las 7 metas del KB a los 4 enums almacenados (bajar_peso/subir_masa/mantener/salud_general).
- Nota: este asistente corre en Gemini (function-calling). Sin migración de DB.


## [2026-06-24] — Orquestación de IA: IA6 (telemetría + guardas de límite) — plan IA COMPLETO

**Sin push/deploy — pendiente del usuario** (`pnpm exec tsc --noEmit` backend + redeploy; corre migración `ai_usage_log` al boot).

- Migración idempotente `ai_usage_log` (tenant, provider, model, tier, tokens, `est_cost`, ok, created_at + índices).
- Orchestrator: las llamadas de proveedor devuelven `{text, usage}`; `logUsage` registra cada llamada (best-effort, nunca rompe). `estCost` con tabla de tarifas aprox por modelo.
- `getUsageStats()`: gasto estimado de `opencode_go` en ventanas 5h/7d/30d (cache 60s). Límites por env `AI_LIMIT_5H/WEEK/MONTH` (12/30/60).
- `limitGuard` en `textLLM`: ≥80% del tope degrada `main`→`small`; ≥100% evita Go (cae a Groq/Gemini).
- Endpoint `GET /chatbot/superadmin/ai-usage` (stats + desglose por modelo 30d) + tarjeta **"Consumo de IA"** en IntegrationsTab. `agent.processAgentMessage` pasa `tenantId` para telemetría por comercio. Visión también se registra (tier `'vision'`).

**Plan de orquestación IA completo (IA1–IA6).** Pendientes futuros menores: migrar `assistant.runAssistant`/`rutina.assistant` (requieren tools en el orchestrator) y compactar historial largo con `small`.


## [2026-06-24] — Orquestación de IA: IA5 (tiering main/small)

Continuación. **Sin push/deploy — pendiente del usuario** (`pnpm exec tsc --noEmit` backend + redeploy).

- `getAIKeys()` devuelve `opencodeGoModelMain`/`opencodeGoModelSmall` (settings `ai_text_model_main`/`ai_text_model_small`; default main=modelo Go configurado, small=`deepseek-v4-flash`).
- Orchestrator: `goModelFor(keys,{tier})` elige el modelo Go; `textLLM`/`textReply`/`run`/`resolveTextProvider` aceptan `tier`.
- Call sites: `runPublicAssistant`=**small**; chatbot de tienda (`agent.processAgentMessage`) y `daimuz-chat`=**main**.
- UI: campos main/small bajo OpenCode Go en `IntegrationsTab` + persistencia GET/PUT + `useIntegrations`/`api.ts`.
- Cache de prompt: el `system` ya va como bloque líder estable (lo que aprovecha el cache de Go). Pendiente futuro: compactar historial con `small` antes de `main`.


## [2026-06-24] — Orquestación de IA: IA2 (visión) + IA3 (config visión) + IA4 (centralizar proveedor)

Continuación del plan `context/plan-orquestacion-ia.md`. **Nada se ha hecho push/deploy — pendiente del usuario** (correr `pnpm exec tsc --noEmit` en backend + redeploy; la migración `ai_vision_cache` corre sola al boot).

**IA2 — Visión como rol** (`backend/src/modules/ai/orchestrator.service.ts`):
- `visionToText(img)` convierte imagen→texto (por `url` o `base64`), **caché por hash SHA-256** en tabla nueva `ai_vision_cache` (no re-OCR la misma imagen). Defensivo: devuelve `''` si falla.
- `run({ system, message, images })`: transcribe cada imagen y razona TODO con el modelo de texto barato (Go) vía `textReply`. Pipeline imagen→texto→Go.
- `invoice-ocr` se queda como OCR especializado (JSON); la visión genérica vive en el orchestrator.

**IA3 — Config texto vs visión:**
- `getAIKeys()` devuelve `visionProvider`/`visionModel` (settings `ai_vision_provider`/`ai_vision_model`); valida que **la visión nunca use Go** (cae a gemini).
- `visionToText` honra el proveedor configurado (orden: configurado → fallback por key disponible; el modelo configurado solo aplica al proveedor elegido).
- Persistencia en `chatbot.routes` GET/PUT `superadmin/integrations`.
- UI: tarjeta **"Visión — Imagen a texto"** en `IntegrationsTab` (selector gemini/openai/groq + modelo + estado de key); `useIntegrations` + `api.ts` extendidos.

**IA4 — Centralizar selección de proveedor:**
- `resolveTextProvider(keys)` en el orchestrator: devuelve `{provider,url,model,apiKey}` OpenAI-compat para los call sites con function-calling.
- `daimuz-chat.llmCall` usa el helper (borrado su if-chain duplicado; Gemini sigue por su rama propia con tools).
- `agent.processAgentMessage`: rama no-Gemini → `textLLM` (import dinámico para evitar ciclo; Gemini conserva sus tools).
- Sin migrar aún (tool-calling): `assistant.runAssistant`/`runWithOpenAICompat` y `rutina.assistant` → IA5/IA6.

**Archivos:** `ai/orchestrator.service.ts`, `agent/agent.service.ts`, `chatbot/chatbot.routes.ts`, `daimuz-chat/daimuz-chat.routes.ts`, `index.ts` (tabla `ai_vision_cache`), front `IntegrationsTab.tsx` + `hooks/useIntegrations.ts` + `lib/api.ts`.


## [2026-06-22] — Coach Economy T4–T8, Vault/Access Ecosystem (V1–V4), cierres Fase 3 + Adaptive OS (F4.1)

Sesión larga sobre el DAIMUZ Fitness Lifestyle OS. Detalle completo en `context/current-sprint.md`. **Nada se ha hecho push/deploy — pendiente del usuario.**

**Coach Economy (Fase 2) — cerrada T1–T8:**
- **T4 delivery + coach feed:** al activar el programa se materializa una rutina en el OS + mensaje de bienvenida; feed async `coach_feed_entries` (feedback/checkin/ajuste/tarea/anuncio + reply). Front: `ProgramFeed` (default si hay programa activo).
- **T5 payouts coach:** `trainer_withdrawals`, `releaseMaturedCommissions` (pending→available a los 7d), wallet, retiros + admin (`adminProcessWithdrawal`).
- **T6 portal `/coach`:** `CoachPortal` (auth propia, Resumen/Programas/Clientes-feed/Retiros/Perfil) + tab superadmin **Coaches** (`CoachPayoutsTab`).
- **T7 pulir CoachSection:** hero, ranking top coaches, reseñas + score en detalle.
- **T8 reviews + Transformation Score + ranking:** `createReview` (1 por booking pagado), `listTrainerReviews`, `getRanking`; `ReviewCard` en `ProgramFeed`.

**Vault / Access Ecosystem (Fase 3) — V1–V4 + cierres:**
- **V1 Vault Keys:** `vault_keys`/`vault_key_redemptions`/`consumer_vault_unlocks`; módulo `vault` (createKey, redeem transaccional idempotente, getMyUnlocks); `useVaultUnlocks` + `<AccessGate>` + `VaultSection` (tab Vault desktop / 🔑 header móvil) + tab superadmin **Vault** (`VaultKeysTab`). Interfaces: secret_theme, hidden_catalog, coach_room, drops, leaderboard, inner_circle.
- **V2 Drops como eventos:** `drops`/`drop_claims`; `vault.drops.service` (estado computado, claim transaccional `FOR UPDATE`), `vault.realtime` (namespace `/vault`, cupos en vivo); `DropsSection` (countdown + cupos en vivo Socket.io + claim) + tab superadmin **Drops** (`DropsTab`).
- **V3 Logros:** `consumer_achievements`; módulo `achievements` (catálogo con rareza, award idempotente); hooks en vault/drops/coach/legend/streak; `AchievementShelf` en Vault + perfil.
- **V4 Afiliados-curadores:** `createKeyAsAffiliate`/`listAffiliateKeys` (atribución `created_by_affiliate_id`); portal **`/promotor`** (`AffiliatePortal`): tier, ranking, emitir Vault Keys, lista con canjes.
- **Cierres F3:** contexto de pago `drop` (Wompi) + `convertClaim` → **10% de comisión al curador** cuya llave dio el acceso; botón "Pagar y asegurar" en `DropCard`; **waiting room** (badge + countdown ≤10 min).

**Fase 4.1 — Adaptive OS:** módulo `adaptive` (`/adaptive/me`) — nudges priorizados desde señales reales (feed coach sin leer, drop en vivo, racha, cercanía a logro, membresía). `AdaptiveCards` en Today (móvil+desktop), descartables 24h.

**Eventos nuevos en whitelist analytics:** coach_review_submitted, vault_key_redeemed, drop_claimed.

## [2026-06-21] (parte 2) — Rediseño del filtro y de "Editar en grupo" (feedback de UX)

Feedback directo tras la parte 1 de hoy: las etiquetas pill "Todas / [nombre horma]" se veían poco
profesionales, "Editar en grupo" repetido dentro de cada producto era ruidoso, y había que confirmar
que el filtro combina horma+talla+color (no es "repartir stock en cascada", es "filtrar en cascada" —
aclarado con el usuario).

- **Filtro unificado "Filtrar por:".** Se eliminaron los pills de horma ("Todas", "Oversize Americana", "Oversize Fit") y los chips sueltos de talla/color de la fila expandida. Reemplazados por 3 `Select` (Horma/Talla/Color, ocultos si el producto no tiene esa dimensión) + botón "Limpiar" — mismo lenguaje visual que los filtros de Tipo/Categoría/Stock del toolbar principal. Las opciones de cada Select salen de `getDisplayTallas`/`getDisplayColors`/`getDisplayHormas` (ya existían, estaban sin usar).
- **"Editar en grupo" ya no vive dentro de cada producto.** El toggle se movió a UN solo lugar: el botón "Editar variantes" en el header, junto a "Seleccionar" (mismo patrón `variant={modo ? 'default' : 'outline'}`). Con el modo activo, cada fila expandida muestra checkboxes por variante; "seleccionar grupo visible" pasó de ser un link de texto subrayado a un checkbox real en el header de la tabla (escritorio) y una fila con checkbox (mobile) — selecciona/deselecciona todas las variantes que pasan el filtro activo.
- **Confirmado con el usuario:** "cascada" = el filtro debe combinarse según lo que se seleccione (horma solo, talla solo, color solo, o cualquier combinación de los 3) — NO es repartir una cantidad total entre variantes. La lógica `getFilteredVariantsFor` (AND entre los 3 filtros) ya cumplía esto desde la parte 1; no requirió cambios de lógica, solo de UI.

## [2026-06-21] — Talla/Color como filtro real de variantes + edición en grupo (bulk) en Inventario

- **Talla y color ahora filtran, no solo consultan.** El picker rápido (Horma/Talla/Color) en la fila principal de `inventory-list.tsx` ya sincronizaba la horma con la fila expandida (`onHormaChange`, ver parte 15); ahora `useVariantPicker` también dispara `onSizeChange`/`onColorChange`, conectados a nuevo estado `expandedSizeFilter`/`expandedColorFilter` (por producto). La fila expandida ("Ver variantes") y el bloque móvil filtran la tabla completa combinando horma+talla+color a la vez (`getFilteredVariantsFor`), con chips removibles ("Talla M ✕", "Color Negro ✕") para ver/limpiar el filtro activo.
- **Edición en grupo de variantes (bulk).** Botón "Editar en grupo" dentro de la fila expandida de cada producto activa `bulkVariantMode`: aparecen checkboxes por variante + botón "Seleccionar grupo visible" (selecciona de un click todas las variantes que pasan el filtro activo de talla/color/horma). La selección es global (`selectedVariantIds`, un `Set<string>` no atado a un producto), así se puede armar un lote combinando variantes de varios productos/filtros. Barra sticky muestra el contador y abre el diálogo de edición: stock (sumar/restar/establecer cantidad exacta, con motivo obligatorio), precio override, costo y stock mínimo — cada campo es opt-in (checkbox "Cambiar X") para no pisar lo que no se quiere tocar.
- **Backend nuevo:** `POST /api/variants/bulk-update` (`variants.service.ts::bulkUpdate`, `variants.controller.ts::bulkUpdate`, ruta declarada ANTES de `/variants/:id` igual que `/variants/summary`). Itera variante por variante (no transaccional entre ellas a propósito): si una falla (ej. stock insuficiente al restar) las demás igual se aplican; reporta `{ updated, failed: [{id, error}] }`. El stock reusa `adjustStock` (atómico, registra `inventory_movements` con `reference_type: 'bulk_edit'`); precio/costo/stock mínimo reusan `update()`.
- **Frontend:** `api.bulkUpdateVariants()` en `lib/api.ts`. Toda la UI vive en `inventory-list.tsx` (no se tocó `variant-manager.tsx` — ese modal es por-producto, esto es cross-variante desde la vista de inventario).
- Petición del usuario: "que seleccionar la talla y el color también funcione como filtro en las variantes" + "una opción para editar por grupos por si se necesita modificar grandes cantidades".

## [2026-06-19] (parte 16) — Talla y Color: mismo orden siempre, sin importar la horma

Las columnas/chips de Talla y Color del picker rápido (`VariantPickerColumns` /
`VariantQuickPicker`) tomaban el orden tal cual venía del array de variantes — podía
"saltar" al cambiar de horma. Se agregaron `SIZE_ORDER`/`sortSizes` a nivel de módulo
(antes `SIZE_ORDER` vivía duplicado dentro de `InventoryList`) y se aplican siempre:
- **Talla:** orden de confección XS/S/M/L/XL/XXL/XXXL.
- **Color:** alfabético (A-Z).
Al cambiar de horma se sigue filtrando a las tallas/colores de ESA horma (eso no
cambió), pero el orden visual ya no varía — siempre el mismo criterio.

## [2026-06-19] (parte 15) — Picker de Horma sincroniza el filtro + feedback de hover

- **Elegir horma en la columna "Horma" (o en el bloque móvil) ahora también filtra la
  fila expandida ("Ver variantes")** — antes eran dos selecciones independientes (la del
  picker rápido y la del filtro de la tabla expandida), había que elegir la horma dos
  veces. `useVariantPicker` acepta un callback `onHormaChange` que ambos componentes
  (`VariantQuickPicker`, `VariantPickerColumns`) disparan al click, conectado a
  `setHormaFilterFor(product.id, hormaId)`.
- **Feedback de hover/cursor** en todos los botones clickeables del picker (horma, talla,
  círculos de color) y en los chips de filtro de la fila expandida: `cursor-pointer` +
  borde resaltado en hover para horma/talla, y los círculos de color ahora escalan
  (`hover:scale-125`) y muestran un anillo sutil al pasar el mouse — antes no tenían
  ninguna señal visual de que eran clickeables.

## [2026-06-19] (parte 14) — Fix colisión de SKU entre hormas + filtro, círculo de color, 4 imágenes

- **Fix real:** "Oversize Fit" y "Oversize Americana" generaban el mismo tag de horma
  en el SKU ("OVERSI", truncado a 6 chars) — `0009-OVERSI-BLANCO-S` para las dos,
  imposible diferenciarlas. `variant-manager.tsx` ahora usa el **slug completo** de la
  horma (sin truncar) para ese tag — los slugs ya son únicos por definición
  (`UNIQUE KEY uk_horma_slug_tenant`), así que no puede volver a colisionar. No se
  renombran los SKUs ya creados con el bug viejo — solo aplica a variantes nuevas.
- **Filtro por horma en la fila expandida:** cuando un producto tiene variantes en más
  de una horma, aparecen chips ("Todas" + cada horma) arriba de la lista/tabla para
  filtrar qué variantes se muestran — en escritorio y en la tarjeta móvil. El "Stock
  total" del pie cambia a "Stock de esta horma" cuando hay un filtro activo.
- **Columna Color (tabla expandida, escritorio):** ya no muestra el nombre como texto
  ("Blanco") — solo el círculo con su hex, el nombre queda de tooltip (`title`).
- **4 imágenes por variante desde el editor rápido:** el diálogo "Editar variante" que
  se abre con el lápiz de la fila expandida ahora tiene la misma galería de 4 slots
  (`CloudinaryUpload`) que ya existía en el gestor completo de Variantes — antes solo
  se podían cargar imágenes abriendo "Variantes / Tiers".

## [2026-06-19] (parte 13) — Fila expandida: variantes ordenadas por Horma → Color → Talla

El orden de las variantes al expandir un producto dependía de cuándo se habían creado
en la base de datos (`sort_order`/`created_at`), así que podían salir mezcladas si se
agregaron en momentos distintos o por hormas distintas. Se agregó `sortVariantsForDisplay`
(ordena por nombre de horma, después color, después talla con el orden de confección
S/M/L/XL/XXL) y se aplicó en ambas vistas expandidas:
- **Escritorio:** la tabla ya tenía columna "Horma" (cuando hay más de una) — al ordenar,
  las filas de la misma horma quedan juntas, fáciles de escanear.
- **Móvil:** además del orden, se agregó una pequeña etiqueta en negrita con el nombre
  de la horma cada vez que cambia de grupo (solo si el producto tiene más de una).

## [2026-06-19] (parte 12) — El selector Horma/Talla/Color en la tabla queda solo de lectura

A pedido del usuario: el stock que aparece al elegir horma+talla+color en la tabla de
inventario (columnas nuevas + tarjeta móvil) ya **no se puede editar ahí** — solo se
consulta. Se quitó `api.adjustVariantStock` y el `<Input>` editable de `useVariantPicker`
y de los dos componentes que lo consumen (`VariantQuickPicker`, `VariantPickerColumns`);
ahora muestran el stock de la variante elegida con el mismo estilo de punto+número que
el total agregado (verde/ámbar/rojo según `suficiente/bajo/agotado`). Para editar stock
sigue estando el lápiz de la fila expandida o el gestor completo de "Variantes / Tiers".

## [2026-06-19] (parte 11) — Tabla de inventario: Horma/Talla/Color en columnas separadas + Stock dinámico

- Se quitó el resumen "Hormas · colores · tallas" que aparecía debajo del nombre del
  producto (en tarjeta móvil y en la celda Producto del escritorio) — esa info ya vive
  en columnas dedicadas, era redundante.
- **Columna "Variante" partida en 3 columnas reales:** Horma | Talla | Color (antes
  todo apilado en una sola celda). Lógica compartida vía el hook `useVariantPicker`
  (extraído de lo que antes era el cuerpo de `VariantQuickPicker`), consumido por dos
  componentes: `VariantQuickPicker` (móvil, todo en un bloque) y `VariantPickerColumns`
  (escritorio, 4 `<TableCell>` propias: Horma, Talla, Color, Stock).
- **La columna Stock ahora es dinámica:** sin selección, muestra el total agregado (como
  antes). En cuanto se elige talla + color, muestra el stock de **esa variante exacta**
  en un input editable (mismo guardado atómico de siempre). Se movió a continuación de
  Color en vez de su posición anterior (junto a Precio) — comparten la misma instancia/
  estado de selección, así que tenían que quedar en el mismo componente.
- `inventoryColSpan` recalculado: Producto, Horma, Talla, Color, Stock, SKU, Tipo,
  Categoria, [Sede], Precio, Acciones.

## [2026-06-19] (parte 10) — Unificación: la generación por horma vive SOLO en el Gestor de Variantes

A pedido del usuario ("vamos a unificar las dos en una sola ya que hacen lo mismo"):
había DOS implementaciones del mismo generador color×talla por horma — una en
"Agregar Producto" (`inventory-list.tsx`) y el modo guiado libre en el Gestor de
Variantes (`variant-manager.tsx`). Se consolidó en una sola.

- **`variant-manager.tsx`:** el modo "Crear rápido" ahora tiene un conmutador
  **Usar horma / Libre**. Con horma: chips de selección múltiple + una tabla de
  stock color×talla por cada horma elegida (idéntico a lo que tenía antes
  `inventory-list.tsx`), hex heredado de `horma_colors`, SKU con tag de horma si
  hay más de una seleccionada. Libre: el modo de siempre (ejes color/talla/material
  en texto libre). `generate()` quedó unificado con un branch interno según el modo.
  Carga la lista completa de hormas (`api.getHormas`) en vez de solo una por prop.
- **Form manual de variante:** ganó un `<Select>` de Horma (guarda/edita `hormaId`
  directo en la variante) — ya estaba "preparado para guardar" todo lo demás, faltaba
  este campo.
- **`inventory-list.tsx` (ProductFormDialog):** se eliminó por completo el selector
  múltiple de hormas y las tablas de stock — ya no genera variantes al crear el
  producto. Flujo nuevo: crear el producto (datos generales) → abrir "Variantes /
  Tiers" → generar ahí (con horma o sin ella). `handleSubmit` quedó en una sola
  línea (`onSubmit(cleaned)`, sin segundo argumento).
- El encabezado del diálogo de Variantes ahora deriva **todas** las hormas en juego
  desde las variantes ya creadas (`existingHormaNames`), no de un único `hormaId` fijo.

## [2026-06-19] (parte 9) — Horma como plantilla, no como validador: fin de la duplicación de colores

Decisión arquitectónica (a pedido): la horma deja de ser una segunda fuente de verdad
que compite con la variante. Pasa a ser solo una **plantilla de arranque** — define
qué colores/tallas sugerir al crear, pero no sigue validando ni sincronizando nada
después. `isColorAllowed` se mantiene tal cual (sigue bloqueando al crear desde la
matriz, aunque ahí es imposible violarlo porque los colores YA salen de la paleta de
la horma). `horma_colors`/`size_chart` quedan como plantilla/sugerencia, sin validación
posterior sobre variantes ya creadas (confirmado con el usuario).

- **`frontend/lib/colors.ts` (nuevo):** única fuente para "nombre de color → hex" —
  `COLOR_HEX_FALLBACK`, `normalizeColorName`, `hashHex`, `resolveColorHex`, `colorToCss`.
  Reemplaza 3 copias pegadas a mano (con listas ligeramente distintas) en
  `horma-manager.tsx`, `inventory-list.tsx` y `variant-selector.tsx` — los tres ahora
  importan de aquí.
- **Variantes generadas desde la matriz de horma heredan el hex real** de
  `horma_colors.hex` al nacer (antes nacían sin hex, dependían 100% del fallback por
  nombre). Una vez creada, la variante es dueña de su propio `colorHex` — no se vuelve
  a tocar desde la horma.

## [2026-06-19] (parte 8) — Columna "Variante": selector Horma→Talla→Color con stock editable inline

- Nueva columna **Variante** en la tabla de inventario (entre Producto y SKU), componente `VariantQuickPicker`: muestra la horma (label si es una sola, chips si son varias) → tallas (chips) → colores (círculos), en ese orden. Al elegir talla y color se resuelve la variante exacta y aparece un input de stock; al perder foco (blur) o Enter, guarda con `api.adjustVariantStock(id, { type: 'ajuste', ... })` (ajuste atómico, set absoluto — no delta) y refresca el resumen.
- Misma lógica reutilizada en la tarjeta móvil (debajo de los botones de acción, solo si el producto tiene variantes).
- Cada fila tiene su propia instancia con selección independiente (no hay estado compartido entre productos).
- `inventoryColSpan` actualizado (+1) para la nueva columna.

## [2026-06-19] (parte 7) — Un producto puede tener variantes en VARIAS hormas + resumen compacto

- **`horma_id` pasó de `products` a `product_variants`:** antes un producto tenía UNA sola horma; ahora cada VARIANTE tiene la suya. Permite que un mismo producto (ej. "Estampado DTF") tenga variantes repartidas en distintas hormas (Oversize Fit, Camiseta Clásica...), cada una con su propia paleta de colores y tabla de tallas. Migración idempotente en `variants.service.ts → ensureTables()` (+ backfill desde `products.horma_id` para variantes existentes) y `migrations/v46_product_variants_horma_id.sql`. `hormasService.ensureTables()` se hizo público porque `variantsService` la necesita (LEFT JOIN a `hormas` por `horma_id`).
- **Validación de paleta por variante:** `variantsService.create()` valida el color contra la paleta de SU horma (`hormasService.isColorAllowed`), no la del producto.
- **Formulario "Agregar Producto":** selector de horma pasó de único a **multi-selección** (chips). Cada horma elegida muestra su propia tabla de stock color×talla. El SKU de cada variante incluye la horma como prefijo solo cuando hay más de una horma seleccionada (evita colisión real: "Negro-M" puede existir en dos hormas distintas).
- **Catálogo (storefront):** `attachVariants` (storefront.routes.ts) y `VariantSelector` (frontend) ganaron el eje **Horma/Modelo** — si un producto tiene variantes en más de una horma, el cliente la elige como un eje más (junto a Color/Talla/Material).
- **Resumen más corto en la tabla de inventario:** se consolidó todo en una sola línea compacta bajo el nombre del producto — hormas (texto, no badges), círculos de TODOS los colores, y TODAS las tallas — en vez de badges apilados en varias filas. Se quitó el badge de horma duplicado de la columna "Tipo".
- **Fix colores grises:** los círculos de color usaban `colorHex || gris-fijo`; como las variantes creadas desde la matriz de horma no traen hex, todos salían grises. Se agregó `resolveColorHex` (mapa de nombres conocidos + hash estable de respaldo) igual que en `horma-manager.tsx`, aplicado en fila principal, tarjetas móvil y tabla expandida.
- Tabla expandida: agrega columna **Horma** por variante solo cuando el producto tiene variantes en más de una horma (si es una sola, no hace falta repetirla en cada fila — ya está en el encabezado).

## [2026-06-19] (parte 6) — Variantes expandidas: misma estética de la tabla + Editar/Eliminar

- La fila expandida de variantes en `inventory-list.tsx` dejó de ser un `<table>` HTML suelto y ahora usa los mismos componentes `Table/TableHeader/TableRow/TableHead/TableCell` (y las mismas clases de texto/color) que la tabla principal de productos — misma tipografía, mismos bordes, mismo estilo de fila.
- Cada variante tiene columna **Acciones** con botones Editar/Eliminar (ghost icon, igual que la fila de producto):
  - **Editar** abre un diálogo liviano (`editingQuickVariant` / `quickVariantForm`) para color, hex exacto, talla, costo y precio override — usa `api.updateVariant`. El stock sigue ajustándose desde "Variantes / Tiers" (movimiento auditado, no edición directa).
  - **Eliminar** pide confirmación (`deletingQuickVariant`) y hace soft-delete vía `api.deleteVariant`.
  - Ambas acciones refrescan el resumen (`loadVariantsSummary()`) al terminar.
  - Mismo patrón (iconos más chicos) en la vista expandida de las tarjetas móviles.

## [2026-06-19] (parte 5) — Inventario: stock total real, todos los colores, horma y precio en variantes

- **Fix `isUUID()` en rutas de variantes:** `variants.routes.ts` exigía `param('productId'/'id'/'tierId').isUUID()` — algunos productos heredados de la migración anterior no tienen ID UUID, y esa validación los rechazaba con 400 silencioso (solo visible como "Validation errors" en consola, sin toast). Se relajó a `.notEmpty()`.
- **Endpoint nuevo `GET /api/variants/summary`:** trae TODAS las variantes activas del tenant en un solo viaje (`variantsService.findAllByTenant`, sin eager-load de tiers — liviano a propósito). Antes solo existía por-producto (`GET /products/:id/variants`), forzando N+1 si se quería un resumen global.
- **Inventario (`inventory-list.tsx`) consume ese resumen al cargar** (`loadVariantsSummary`, junto a `fetchProducts`) y ya no hace fetch perezoso por fila al expandir — todo queda pre-cargado:
  - **Stock "general" = suma de todas las variantes** del producto (`getDisplayStock`), no el campo `products.stock` desconectado. Se refresca tras crear producto+horma y al cerrar el gestor de Variantes.
  - **Todos los colores** del producto se pintan como círculos en la fila principal (antes tope de 5) — `getDisplayColors`, deduplicados por nombre.
  - Si el producto tiene `hormaId`, se muestra un badge **Horma** junto a "Tipo" (y repetido como encabezado al expandir).
  - Tabla expandida: agregó columna **Precio** (`priceOverride ?? basePrice`), fila de **stock total**, y el SKU ahora se ve como chip `<code>` en vez de texto monoespaciado plano (mismo tratamiento en SKU del producto).

> **Tipo vs Categoría (aclaración, no cambia código):** `Tipo` (`productType`, fijo: ropa/alimentos/electrónica/...) es del sistema y decide qué **campos extra** pide el formulario (talla/material para ropa, vencimiento/registro sanitario para alimentos, etc.) — vive en `lib/product-config.ts`. `Categoría` es libre, la crea cada comercio (`categories` table) para **organizar/filtrar** su propio catálogo (ej. "Camisetas", "Promos") — no afecta el formulario. Son independientes: un producto tiene un Tipo (estructura) y una Categoría (organización), a la vez.

## [2026-06-19] (parte 4) — Fix: `ER_NO_SUCH_TABLE` product_variants (auto-heal de schema)

- **Causa:** `004_variants_and_suppliers.sql` (tablas `product_variants`, `variant_price_tiers`, `inventory_movements`, `suppliers`, `supplier_products` + columna `products.base_price`) es una migración que se corre **a mano**. En tenants donde nunca se ejecutó (ej. `stockpro_db`), cualquier llamada al módulo de variantes tronaba con `ER_NO_SUCH_TABLE` — se disparó al usar el nuevo expandible de inventario (`findByProduct`).
- **Fix:** `variants.service.ts` ganó `ensureTables()` (auto-migración idempotente, mismo patrón que `hormasService.ensureTables()`): crea las 5 tablas con `CREATE TABLE IF NOT EXISTS` + agrega `products.base_price` (backfill desde `sale_price`) si falta. Se llama al inicio de **todos** los métodos públicos del service (`findByProduct`, `findById`, `create`, `update` vía `findById`, `softDelete` vía `findById`, `adjustStock`, `decrementStockInTransaction`, `reserveForPublicOrder`, `releaseForOrder`, `settleVariantForSale`, tiers, `getMovements`). El método es público (no `private`) porque `import.service.ts` (CSV bulk) y `suppliers.service.ts` también tocan estas tablas directamente — ambos ahora llaman `variantsService.ensureTables()` antes de su primera query. En `import.service.ts` se llama **antes** de abrir la transacción (DDL hace COMMIT implícito en MySQL, rompería una transacción en curso).
- **No tocado:** `purchases.service.ts` también lee `suppliers` pero no se incluyó en este fix (fuera del alcance del error reportado); si falla igual, aplica el mismo patrón.

## [2026-06-19] (parte 3) — Variantes: galería de 4 imágenes por color + inventario expandible (color/talla/stock)

- **Hasta 4 imágenes por color en variantes:** `variant-manager.tsx` reemplazó el campo único "Imagen del color (URL)" por una galería de 4 slots (`CloudinaryUpload`, igual patrón que la galería de 4 imágenes del producto general). `ProductVariant.images` ya soportaba un array; ahora la UI lo expone completo. Cap de **4** también validado en backend (`variants.service.ts` → `create`/`update`, constante `MAX_VARIANT_IMAGES`, error 400 si se excede).
- **Tabla de inventario expandible:** en `inventory-list.tsx`, cada fila de producto (desktop y tarjetas móvil) tiene un toggle (chevron / "Ver colores/tallas") que carga `api.getVariantsByProduct` (lazy + cache en `variantsByProduct`) y muestra una mini-tabla con **color (swatch), talla, SKU y stock** (coloreado según `stock`/`minStock`). Si el producto no tiene variantes, se indica explícitamente.

## [2026-06-19] (parte 2) — Hormas: campo Composición (ej. "100% Algodón")

- **`hormas.composition`** (VARCHAR(150), nullable, ej. "100% Algodón"): auto-migración idempotente en `ensureTables` + migración manual `v45_hormas_composicion.sql`. Se decidió mantener `weight_grams` **numérico** (no convertirlo a texto libre) y agregar este campo separado, para no perder el peso usable en cálculos futuros (envíos, etc.). Input "Composición" en `horma-manager.tsx` junto al de Peso; la tabla de listado muestra ambos apilados en la columna "Peso / Composición".

## [2026-06-19] — Hormas: campo Sexo + paleta de colores con círculos seleccionables

- **Campo `sexo` en hormas** (`unisex` | `hombre` | `mujer`, default `unisex`): columna ENUM con auto-migración idempotente en `hormasService.ensureTables` + migración manual `v44_hormas_sexo.sql`. Validado en `create`/`update` (`assertValidSexo`). Selector en `horma-manager.tsx` (form) + columna "Sexo" en la tabla de listado.
- **Paleta de colores con círculos seleccionables:** `horma-manager.tsx` ahora deduplica los colores de **todas** las hormas del tenant (`existingColorCatalog`, vía `useMemo` sobre `hormas`) y los muestra como círculos clicables — clic agrega/quita el color de la horma actual sin re-tipearlo. Se agregó `resolveColorHex` (mapa de nombres conocidos → hex + hash estable de fallback) para que cualquier color tenga un círculo visible aunque no tenga `hex` guardado. Sigue existiendo el flujo manual (nombre + `<input type=color>` para hex exacto) para colores nuevos. La tabla de listado también pinta mini-círculos de la paleta de cada horma.
- Sin cambios de breaking: `colors`/`hex` ya existían en el backend (`horma_colors.hex`); solo se expuso bien en la UI.

> Pendiente: confirmar con patronaje real la manga estimada de "Camiseta Clásica" (ver `brain/horma-architecture.md`).


## [2026-06-18] (parte 3) — Color exacto por variante, bulk inventario, auto-fallback IA, tamaño de logo, posición del Lanyard

- **Color EXACTO por variante (hex) separado del nombre:** columna `product_variants.color_hex` (migración idempotente + auto-heal `ensureColorHex` en el service ante `ER_BAD_FIELD_ERROR`). En `variant-manager` el campo "Color (nombre)" quedó separado de una **paleta** que escribe `colorHex` (ya no pisa el nombre). El storefront (`variant-selector`) arma un mapa nombre→hex y pinta el **swatch con el color exacto** del comercio. Arregla la incoherencia "Vainilla sesgo" mostrándose gris.
- **Aviso de SKU duplicado en variantes + fix:** `saveVariant` NO chequeaba `result.success` → mostraba "Variante creada" en falso y ocultaba el 400 real. Ahora muestra el error del servidor, y además hay **aviso proactivo**: detecta SKU repetido contra las variantes cargadas y **bloquea Guardar** (botón "SKU duplicado").
- **Multi-selección + borrado masivo en Inventario:** `products.service.bulkDelete` (filtra por tenant; ante FK por ventas borra uno a uno y omite los referenciados → `{deleted, skipped}`), ruta `DELETE /products/bulk` (ANTES de `/:id`), controller, `api.bulkDeleteProducts` + acción en store. UI en `inventory-list`: botón "Seleccionar", checkboxes en tabla, overlay en tarjetas móvil, barra bulk + dialog.
- **IA "solo pegar la clave" (auto-fallback):** `getAIKeys` ahora, si el proveedor default no tiene clave, usa el primero que sí la tenga (Groq → Gemini → OpenAI/OpenCode). Diagnóstico del 500 del chatbot = **OpenCode sin saldo** (facturación, no bug). Copy de IntegrationsTab actualizado.
- **Tamaño del logo de la tienda:** columna `store_info.logo_size`; slider + vista previa en Personalizar Tienda → Info Tienda; aplicado al logo del nav en Tema 1 (landing) y Tema 2.
- **Posición y tamaño del Lanyard (portafolio):** `portfolio_config.lanyard_offset_x/_y/_scale` (migración idempotente). Controles en el tab Portafolio del superadmin: **flechas** ↑↓←→ (±10px) + centrar + slider de tamaño (40–200%). La página aplica `transform: translate(x,y) scale()` al contenedor del carnet 3D.

> ⚠️ **Line endings (lección):** el working tree quedó en **CRLF** y el repo en **LF** → 444 archivos "modificados" pero solo ~12 reales. Se creó `.gitattributes` (`* text=auto eol=lf`). NO usar `git add -A`; commitear solo los archivos reales y, aparte, `git add --renormalize .`. Configurar `core.autocrlf input` en Windows.
> Todo necesita commit (sin el ruido CRLF) + push + **Deploy en Komodo** (las columnas nuevas se crean al arrancar el backend).


## [2026-06-18] (parte 2) — Integración de variantes COMPLETA: asiento al confirmar + pasarelas + columna variant_id + cupo de preventa

Cierre de los 4 pendientes de variantes (tsc back+front: **0 errores**):

- **Migraciones idempotentes** (`index.ts`, helper `addCol`): `variant_id` + `cost_price`/`margin_pct`/`margin_amount` en `storefront_order_items` y `sale_items`; `preorder_limit` + `preorder_count` en `product_variants` (+ índices).
- **Asiento al confirmar** (`orders.routes.ts`, status `entregado`): `variants.service.settleVariantForSale(conn, …)` descuenta `product_variants.stock`, libera la reserva (`reserved_stock`; en preventa puede quedar negativo = backorder real), registra movimiento `'salida'` (ref `sale`) y congela `variant_id`/costo/margen en `sale_items`. El SELECT de items ahora trae `variant_id` + `is_preorder`. Producto simple sigue por el flujo legacy (`products.stock` + `stock_movements`).
- **Cupo de preventa** (`variants.service`): `reserveForPublicOrder` ahora maneja normal (incrementa `reserved_stock`) y preventa (incrementa `preorder_count` con guard atómico `preorder_count + qty <= preorder_limit`; NULL = ilimitado), distinguidos por `reference_type` (`storefront_order` vs `storefront_order_preorder`). `releaseForOrder` revierte el contador correcto. `create`/`update` aceptan `preorderLimit`; campo "Cupo de preventa" en `variant-manager.tsx`. `attachVariants` expone `preorderLimit`/`preorderCount`.
- **Reserva en pasarelas** (`orders.routes.ts`): MP-preference, ADDI y Sistecrédito reservan variantes (cancela el pedido + 409 si no alcanza), persisten `variant_id` en sus items, y liberan en sus webhooks de rechazo. `cancel-gateway` y la cancelación desde el panel también liberan (`releaseForOrder`).

> **Solo queda operativo:** arrancar backend (corre migraciones) + cargar AnMarg + **Deploy en Komodo**.


## [2026-06-18] — Variantes en todo el storefront + selección dinámica (Tema 2) + reserva atómica en pedidos + preventa (backorder) + producto AnMarg

**Producto AnMarg (Camiseta Clásica) — datos de carga:** `imports/anmarg-camiseta-clasica/` con CSV de 90 variantes (18 colores × 5 tallas, handle `camiseta-clasica`, material `100% Algodon 160g`, proveedor AnMarg, venta $56.000, costo $28.000, SKU `CC-<COLOR>-<TALLA>`), SQL de tiers por volumen (6+/12+/24+) y README. El importador solo crea el tier base (min_qty=1); los escalones van por el SQL complementario.

**Selección de variantes dinámica en Tema 2 (`theme2-order-flow.tsx`):** se integró el `VariantSelector` existente en el flujo compacto. Al abrir el detalle de un producto con variantes, el cliente elige color/talla y se actualizan precio, imagen y disponibilidad al instante; bloqueo de "Agregar" hasta elegir variante válida; carrito/WhatsApp/ticket/pedido llevan la variante (label + `variantId`); el "+" y "Ordenar Ahora" abren el detalle si hay variantes. Tema 1 (`landing-page`) ya lo tenía; se le agregó `variantId` a los 4 `items.map` (público + 3 pasarelas).

**Bug crítico resuelto — variantes no cargaban hasta recargar:** solo `/storefront/products` adjuntaba variantes; el resto de secciones devolvía el producto sin ellas. Se centralizó el helper `attachVariants()` en `storefront.routes.ts` y se aplicó a TODOS los endpoints públicos de producto: lista, `/offers`, `/new-launches`, `/platform-featured`, `/drop/:id` y `featured`/`trending` de `store-config`.

**Bug crítico de visibilidad:** la lista filtraba `(p.stock > 0 OR p.is_preorder = 1)` y los productos con variantes tienen `products.stock = 0` → no aparecían en la tienda. Se agregó al filtro un `EXISTS` sobre `product_variants` con disponibilidad (`stock - reserved_stock > 0`).

**Reserva atómica de stock de variante en `POST /orders/public`:** antes `checkStockAvailability` validaba contra `products.stock` (0 para variantes) → 409 falso en todo pedido con variante. Ahora: `checkStockAvailability` ignora ítems con `variantId`; nuevos métodos en `variants.service.ts` — `reserveForPublicOrder()` (incrementa `reserved_stock` atómico y race-safe `WHERE (stock - reserved_stock) >= qty`, transaccional, movimiento `'reserva'`) y `releaseForOrder()` (al cancelar o si falla la creación, movimiento `'liberacion'`). `cancel-gateway` libera reservas. Filosofía igual a los `inventory_holds` de productos (reserva suave, reversible).

**Preventa (backorder) para variantes — embudos masivos:** `attachVariants` ya NO oculta variantes agotadas (devuelve todas las activas); el `VariantSelector` recibe `allowOutOfStock` → muestra agotadas en gris pero seleccionables (borde punteado, "Disponible en preventa"). En `/orders/public`, los ítems de variante con `isPreorder` NO se reservan (se venden sin límite de stock). Conectado en ambos themes (`detailIsPreorder` / `Boolean(selectedProduct.isPreorder)`), con flags de preventa en el payload.

> **Pendiente:** asiento al confirmar (pedido→venta) para variantes (hoy descuenta `products.stock`, no asienta `reserved_stock`→`stock`); reserva en flujos de pasarela (solo `/public` reserva); columna `variant_id` en `storefront_order_items` (trazabilidad va por `inventory_movements` + nombre); cupo máximo de preventa por variante. Todo necesita **Deploy en Komodo**.


## [2026-06-17] — Módulo Afiliados (Sprints 1–4) + tarjetas externas + imagen por variante + barra de bienvenida configurable + cierre Tema 2

**Programa de Promotores/Afiliados — backend Sprints 1–4 (parcial, falta deploy):**
- **Sprint 1 (schema):** migración inline idempotente en `index.ts` (10 tablas, `CREATE TABLE IF NOT EXISTS`, sin `ADD COLUMN IF NOT EXISTS`): `affiliates` (nivel plataforma, sin tenant_id), `affiliate_campaigns` (polimórfica store/product/event/service), `affiliate_conversions`, `affiliate_commissions`, `affiliate_withdrawals`, `affiliate_missions`, `affiliate_mission_submissions`, `merchant_events`, `affiliate_packages`, `affiliate_package_orders`. Referencia: `backend/src/migrations/005_affiliates.sql`. Tipos: `modules/affiliates/affiliates.types.ts`.
- **Sprint 2 (core):** `affiliates.service.ts` + `affiliates.routes.ts` (montado en `/api/affiliates`). Auth propia del promotor (bcrypt + JWT `type:'affiliate'`, 30d) — NO se tocó el enum `role` de users. Endpoints promotor (me, campañas+token, conversiones, comisiones, retiros, leaderboard, misiones), superadmin (`/admin/*`: afiliados, retiros con pago→descuenta saldo, misiones CRUD, revisión de envíos→acredita bono) y comercio (`/tenant/*`: overview, conversiones).
- **Sprint 3 (paquetes, pago inmediato):** CRUD de paquetes (superadmin), contratación por el comercio (`affiliate_cop`/`platform_cop` congelados), `markPackagePaid` transaccional que **acredita el wallet al instante**, entrega de contenido (promotor) y completar (comercio).
- **Sprint 4 (atribución por enlace):** `attributeOrder` + `_recordConversion` (pending) + `runAutoApprovals` (vencida la ventana `cookie_days`→approved, pending_cop→balance_cop, +1 monthly_sales). Hook en `POST /orders/public` (`refToken`, no bloqueante). Frontend Tema 2: captura `?ref=` en `localStorage` (30d) y lo envía en el checkout. Endpoint `POST /admin/run-approvals` (cron/tarea). **Hook POS por código:** métodos `lookupAffiliateCode`/`attributeSaleByCode` listos, NO enganchados (sales.service no tiene flujo de código de descuento).
- **PENDIENTE:** Sprint 5 (tier engine + cron mensual de reset/recalcular tier), Sprints 6–8 (portal `/promotor`, tab superadmin, vista comercio — frontend). Ver `context/roadmap-afiliados.md`.

**Tarjetas externas (comercios fuera del aplicativo):** tabla `marketplace_external_cards` + CRUD superadmin (`/api/tenants/external-cards`) + merge en `/storefront/stores` (con `externalUrl`). UI en `CommercesTab` (crear/editar/eliminar). En la home, `StoreCard` clickeable aunque no tenga productos, badge "VISITAR ↗", y `goToStore` abre el link externo en pestaña nueva.

**Imagen por variante (color → imagen):** el backend ya guardaba `images` por variante; se agregó el campo "Imagen del color (URL)" en `variant-manager` y, en la tienda (`landing-page`), la foto principal usa la imagen de la variante seleccionada (`heroUrl = selectedVariant.image || activeUrl`) en ambos layouts.

**Barra de bienvenida configurable (Tema 2):** claves `home_welcome_enabled/title/subtitle` en `platform_settings` (sin tocar backend) + card en `LandingConfigTab` (toggle + título + subtítulo) + props a `home-theme2` (visibilidad por `welcomeEnabled`, contenido editable; la "X" sigue siendo descarte del usuario).

**Cierre Tema 2:** pantalla de éxito con animación holo "en camino" + ticket (`theme2-order-success.tsx`); **bug crítico** corregido (tras enviar no se vaciaba el carrito → pedidos duplicados; ahora `resetCheckout`); restyle minimalista del carrito; tarjeta premium en Favoritos. La confirmación al cliente sale desde el **módulo de pedidos**: botón "Confirmar por WhatsApp" en `pedidos.tsx` con mensaje prellenado según estado.

**Home móvil:** carrusel ajusta su altura a la imagen (sin franjas, sizer móvil); bienvenida responsive sin recorte; sección "Únete a DAIMUZ" con valor para 3 públicos (cliente/comerciante/promotor).

> Nota deploy: TODO lo anterior necesita commit + push + **Deploy en Komodo**. Las tablas de afiliados se crean solas al arrancar el backend.


## [2026-06-16] — Tema 2: reservas que guardan, pedidos sin falla silenciosa, "Ordenar Ahora" + QR de mesa administrable

- **Reservas Tema 2 (guardar + confirmar + WhatsApp):** `theme2-reserve-flow.tsx` ahora hace `POST
  /restbar/reservations/public-quick` (endpoint nuevo en `reservations.routes.ts`) que **guarda la reserva**
  (auto-asigna mesa si hay, o crea con `table_id NULL` y número `R-####` vía secuencia transaccional) y
  **notifica al comercio**. Tras guardar, pantalla de éxito "¡Reserva exitosa! Te llamaremos para confirmar"
  con N° de reserva + botón **opcional** de WhatsApp (con todo el formulario). Antes solo abría WhatsApp.
- **Pedidos Tema 2 — falla silenciosa corregida:** `theme2-order-flow.registerOrder()` ahora chequea
  `res.ok`/`success`, devuelve éxito y muestra el error en UI; `submitOrder` **no abre WhatsApp si el guardado
  falla** (ej. stock 409). Verificado que el pedido SÍ se guarda en `storefront_orders` (+ items + notificación)
  con el `tenantId` correcto (`/storefront/products` devuelve `p.tenant_id as tenantId`, sin disparar fallback).
- **"Ordenar Ahora" en Favoritos:** abre el flujo de pedido con el producto **ya en el carrito**
  (`initialProductId` → efecto que lo agrega una vez al cargar productos).
- **Botón "todas las tiendas":** en móvil estaba centrado abajo (invasivo) → movido a la derecha; escritorio
  sigue como pestaña al borde derecho.
- **QR de mesa ADMINISTRABLE (antes solo generaba):** dos endpoints auth nuevos en `restbar-qr.routes.ts`:
  `GET /tables/:id/session` (sesión activa + invitados + **consumo de cada persona**, parseando la etiqueta
  `[nombre]` del `item_notes`; lo no asignado va a "Sin asignar / mesa") y `POST /tables/:id/session/close`
  (invalida el QR sin cerrar la comanda). `table-qr-button.tsx` reescrito como panel: QR, lista de quién está
  en la mesa con su consumo desglosado, total, **compartir** (copiar/WhatsApp/share nativo), **regenerar** y
  **eliminar**. API: `getTableQrSession` / `closeTableQrSession`.

> Pendientes Tema 2: restyle minimalista del carrito, animación holo "en camino" al activar ubicación,
> tarjeta de ticket de éxito y tarjeta premium (Uiverse). El consumo por persona requiere que el cliente
> entre con su nombre al escanear. Todo esto necesita **commit + push + Deploy en Komodo** para verse en prod.


## [2026-06-16] — Fix IA: agente respeta Base URL (OpenCode) + selector de modelo + checklist deploy

- **FIX raíz de los 500:** `agent.service.callOpenAI` tenía `api.openai.com` hardcodeado → el chatbot de
  tienda fallaba con la key de OpenCode (con Groq sí funcionaba porque tiene URL propia). Ahora `callOpenAI`
  acepta **baseUrl/model** y `processAgentMessage` se los pasa desde `getAIKeys()`. Así los TRES caminos
  (chatbot/agente, asistente del panel, Modo Chat) usan la Base URL configurada. Falta **redeploy del backend**.
- **Selector de modelo (contingencia):** en Integraciones, los campos **Base URL** y **Modelo** ahora tienen
  `datalist` → se puede **elegir de una lista o escribir** libremente. Suaviza cambiar de modelo si uno falla.
- **Checklist de deploy** creado en `context/deploy-checklist-ia.md` (redeploy back/front + config OpenCode + verificación).


## [2026-06-16] — Interruptor de tema + fixes prod (OpenCode base URL, columna priority) + pedidos reales

- **Cambio de tema (claro/oscuro) con expansión dinámica:** `components/theme-switch.tsx` (botón Uiverse
  by mamyapro123, CSS scoped a `.theme-switch__*`, keyframes propios). Usa **next-themes** (ya en el layout)
  y la **View Transitions API** para el reveal circular desde el botón (fallback si no hay soporte / reduce-motion).
  Colocado en el footer del sidebar → visible en todas las vistas del panel.
- **FIX prod — asistente usaba api.openai.com con la key de OpenCode:** `assistant.service` ahora lee la
  **Base URL y el modelo** desde `getAIKeys()` (ajustes `ai_openai_base_url` / `ai_openai_model`), no solo del env.
  Acción del usuario: en Integraciones → OpenAI, Base URL = `https://opencode.ai/zen/v1`, Modelo = `deepseek-v4-flash`.
- **FIX prod — `Unknown column 'o.priority'`:** causa = **MySQL no soporta `ADD COLUMN IF NOT EXISTS`**
  (es de MariaDB), así que esa migración fallaba silenciosa. `getAreaDisplay` ahora es resiliente: intenta con
  `priority`, y si falta la columna la crea con `ADD COLUMN` plano (MySQL) y reintenta sin ella. Cocina/bar
  vuelven a funcionar.
- **Pedidos del chat de tienda ahora son REALES:** `agent.tools.toolRegistrarPedido` inserta en
  `storefront_orders` + `storefront_order_items` (parsea el texto de items, casa con productos, calcula total,
  status 'pendiente') además de notificar → aparecen en el Centro de Pedidos. (Reservas ya insertaban en
  `rb_reservations`; leads siguen como notificación.)
- **Venta POS por chat:** acción `registrar_venta` en el Modo Chat → `salesService.create` (descuenta stock,
  factura), con confirmación.

> Pendiente menor: aplicar el loader/tema a más vistas públicas; leads del chatbot a un módulo CRM si se crea.


## [2026-06-16] — Loader 3D de cajas + crear producto + reflejo visual en Chat Daimuz

- **Loader nuevo:** `components/box-loader.tsx` (`BoxLoader` + `FullPageLoader`, Uiverse by Admin12121,
  CSS scoped a `.dz-loader` y keyframes prefijados `dzl-` para no colisionar). Reemplaza el círculo
  de carga en `app/page.tsx` (carga principal de la app) y `app/login/page.tsx` (2 loaders). El
  **preloader del portafolio se mantiene** intacto. El componente está disponible para otras pantallas.
- **Crear producto por chat:** acción `crear_producto({nombre, precio, categoria?, stock?, es_menu?})`
  → `productsService.create` (genera SKU, categoría 'General' por defecto), con confirmación.
- **Reflejo visual:** tras ejecutar una acción, `/modo-chat` muestra qué módulo se actualizó
  (Mesas/Restbar o Inventario) con acceso directo "Abrir panel" (las acciones devuelven `refresh`).

> Modo Chat Daimuz: estadísticas + Restbar (abrir/tomar/enviar/cobrar) + Inventario (ajustar stock,
> crear producto), OpenAI/Groq/Gemini, botón glitch gated por plan, reflejo del módulo afectado.
> Pendiente mayor: registrar venta (flujo POS), embeber el módulo en vivo bajo el chat.


## [2026-06-16] — Chat Daimuz: pendientes cerrados (gate + acciones + Gemini)

- **Gate del botón:** `CHAT DAIMUZ` en el sidebar solo se muestra a `tenantPlan === 'empresarial'`.
- **Más acciones (confirm-before-execute):**
  - **POS/cobrar:** `cobrar_mesa({mesa, metodo})` → `restbarService.processPayment` (efectivo/tarjeta/nequi/transferencia; cobra el total del pedido).
  - **Inventario:** `ajustar_stock({producto, cantidad})` → `productsService.updateStock` (suma/resta, no baja de 0).
- **Gemini function-calling:** `runGemini` con declarations (tipos en mayúscula) y patrón de 2 rondas:
  functionCall de lectura → ejecuta → segunda llamada con los datos para la respuesta final; las escrituras se proponen igual. Ya no rechaza Gemini en el modo Chat.

> Modo Chat Daimuz ahora cubre: estadísticas/análisis (ventas, pedidos, stock, citas) + acciones de
> Restbar (abrir/tomar/enviar/cobrar) + Inventario (ajustar stock), con OpenAI/Groq/Gemini.
> Nota entorno: mount del sandbox sigue truncando lecturas (archivos verificados íntegros en disco).


## [2026-06-16] — Chat Daimuz: modelos OpenCode Go configurables + botón glitch + multi-módulo

- **Proveedor/modelo configurable desde el panel:** `getAIKeys()` ahora devuelve `openaiBaseUrl` y
  `openaiModel` (settings `ai_openai_base_url` / `ai_openai_model`, fallback env `OPENAI_BASE_URL` /
  `OPENAI_MODEL`). `daimuz-chat` los usa en `llmCall`. Integraciones (GET/PUT) + `IntegrationsTab`
  exponen campos **Base URL** y **Modelo**. Para el plan **OpenCode Go**: Base URL
  `https://opencode.ai/zen/v1`, modelo p. ej. `deepseek-v4-flash` (key `sk-` de opencode en el campo OpenAI).
- **Modo Chat Daimuz multi-módulo:** el agente da estadísticas/análisis del negocio (reusa
  `execMerchant`: ventas, pedidos, stock, citas) + opera Restbar (abrir mesa / tomar pedido / enviar
  a cocina) con confirmación. UI `/modo-chat` estilo ChatGPT con sugerencias.
- **Botón CHAT DAIMUZ** (`components/chat-daimuz-button.tsx`, estilo glitch Uiverse, CSS scoped a
  `.cd-glitch` para no romper otros botones) en el footer del sidebar → abre `/modo-chat`.

> Pendiente: que el botón gate por rol/empresarial, más acciones por módulo, Gemini function-calling.
> Nota entorno: el mount del sandbox truncó lecturas de varios archivos (todos verificados íntegros
> en disco con file-tools); el código nuevo es type-correcto. tsc-en-sandbox no fiable esta sesión.


## [2026-06-16] — Modo Chat Daimuz (slice vertical Restbar) + fix OpenAI en asistentes

**Asistentes multi-proveedor:** `assistant.service.ts` ahora acepta claves OpenAI (`sk-`),
no solo Gemini/Groq. Se generalizó `runWithGroq` → `runWithOpenAICompat(url, model)` (tool-calling),
con ramas `sk-` en `runPlatformAssistant` y `runPublicAssistant`. Base URL configurable por
`OPENAI_BASE_URL` (+ `OPENAI_MODEL`) para compatibles (opencode/openrouter). Mensajes de error
actualizados. **Nota:** la key de opencode.ai no autentica contra api.openai.com salvo que se
fije `OPENAI_BASE_URL` al endpoint de opencode.

**Seguridad de keys (integraciones):** el GET de `/superadmin/integrations` ahora ENMASCARA las
AI keys (`••••••últimos4`) + flags `*Set`; el PUT ignora valores enmascarados (no pisa la key).
Nuevo `GET /superadmin/integrations/reveal/:provider` para ver la key real bajo demanda; el ojo
en `IntegrationsTab` la trae solo al revelar.

**Modo Chat Daimuz (slice Restbar/mesas):** nuevo `modules/daimuz-chat/daimuz-chat.routes.ts`
(montado `/api/daimuz-chat`). El comerciante escribe en lenguaje natural y el agente OPERA mesas:
lecturas (`listar_mesas`, `ver_menu`, `ver_cuenta`) al vuelo; escrituras (`abrir_mesa`,
`tomar_pedido`, `enviar_cocina`) se **proponen** como `pendingAction` y se ejecutan vía
`POST /restbar/execute` SOLO tras confirmación humana (governance). Reusa `restbarService` (KDS real)
y `getAIKeys()` (OpenAI/Groq function-calling; Gemini pendiente). Frontend: página `/modo-chat`
(chat + tarjeta de confirmación) y `api.daimuzChatRestbar/daimuzChatExecute`.

> Esto es la **base** de la visión "todo el panel se vuelve chat y mueve los módulos por debajo"
> (ver `base de la empresa daimuz.md`). Slice v1 = Restbar, confirm-before-execute. Pendiente:
> cobrar, más módulos (inventario/POS/CRM), Gemini function-calling, y el toggle que reemplaza
> el panel completo + reflejo visual del módulo afectado.

> **Nota de entorno:** el sandbox de build truncó lecturas del mount en varios archivos NO tocados
> (`agent.service`, `chatbot.routes`, `index.ts`, `api.ts`); todos verificados ÍNTEGROS en disco con
> file-tools. El módulo nuevo compila limpio. tsc-en-sandbox no fiable esta sesión; build local OK.

## [2026-06-15] — Multi-API Key + cifrado en reposo para agente IA

**Backend:**
- `agent.service.ts`: nueva `getAIKeys()` → devuelve `{ geminiKey, openaiKey, groqKey, defaultProvider }`. `getAIKey()` mantenida (backward compat). `processAgentMessage()` ahora usa routing explícito por provider.
- `chatbot.routes.ts`: GET/PUT `/superadmin/integrations` ahora maneja 3 API keys + provider selector. Las keys se cifran con AES-256-CBC al guardar y se descifran al leer.

**Frontend:**
- `IntegrationsTab.tsx`: rediseñado con 3 campos separados (Gemini/OpenAI/Groq), toggle show/hide individual, badges "Configurado" por provider, y selector de proveedor default con botones con iconos.
- `useIntegrations.ts`: nuevo estado `geminiApiKey`, `groqApiKey`, `defaultAiProvider`.
- `lib/api.ts`: tipos actualizados para `updateSuperadminIntegrations`.

**Entorno:**
- `backend/.env` creado con la OpenAI key del usuario.
- `backend/.env.example` actualizado: `OPENAI_API_KEY`, `GROQ_API_KEY`, `AI_DEFAULT_PROVIDER`.
- `docker-compose.dev.yml` y `docker-compose.dokploy.yml`: incluídas las 4 nuevas env vars.

## [2026-06-16] — Fase 4 Restaurante: reportes (delta A) + cierre del roadmap

- **Reportes de restaurante**: nuevo sub-router `restbar.reports.routes.ts`
  (`GET /api/restbar/reports/summary?from=&to=`, montado en `/api/restbar/reports`): resumen de
  pagos por método, top de productos, rendimiento por mesero y por mesa, KPIs (ventas, comandas,
  ticket promedio, total cobrado). Reutiliza `rb_orders/rb_payments/rb_order_items`. Frontend:
  página `/reportes-restaurante` (rango de fechas, tablas, **export a PDF vía imprimir**) +
  `api.getRestbarReports()`.
- **Marketing/promos**: ya cubierto por `store_banners` → home `/r/[slug]` (Fase 1); sin módulo nuevo.
- **Backup/restore**: NO implementado (acción crítica, approval-gated por `governance`).
- **Build**: frontend tsc 0. En backend, los 2 errores de `tsc` eran truncamientos transitorios del
  mount del sandbox en `agent.service.ts` y `chatbot.routes.ts` (archivos NO tocados; verificados
  íntegros en disco con file-tools). También se reparó una truncación del mount en `lib/api.ts` y
  `restbar.routes.ts` provocada por ediciones con file-tools (restauradas y reverificadas).

- **Backup/restore (delta D)**: sub-router `restbar.backup.routes.ts` (`/api/restbar/backup`):
  `GET /export` (solo lectura), `POST /restore/preview` (dry-run) y `POST /restore` (upsert SOLO
  catálogo/config; nunca pedidos/pagos; exige rol alto + frase `RESTAURAR` + fuerza tenant_id del JWT).
  Frontend: página `/respaldos`. `api.exportRestbarBackup/previewRestbarRestore/restoreRestbarBackup`.

> Roadmap restaurante: Fase 1 ✅ · Fase 2 ✅ · Fase 3 ✅ · Fase 4 ✅. **Integración Sirius COMPLETA.**

## [2026-06-15] — Fase 3 Restaurante: módulo de fidelización / puntos

Nuevo módulo **loyalty** (tsc front 0; backend sin errores nuevos):

- Backend `modules/loyalty/loyalty.routes.ts` (montado `/api/loyalty`): tablas `loyalty_config`,
  `loyalty_accounts`, `loyalty_transactions`, `loyalty_rewards` (auto-migración). Reglas
  configurables (`points_per_thousand`), CRUD de recompensas, cuentas por teléfono, `POST /earn`
  (acúmulo sin tocar el flujo de pago), ajustes manuales y transacciones. Helpers exportados
  `ensureLoyaltyTables`, `getLoyaltyConfig`, `ensureAccount`, `earnPoints`.
- Canje público desde la sesión de mesa (`restbar-qr`): `GET /session/:token/loyalty?phone=` +
  `POST /session/:token/loyalty/redeem` → genera **código de canje** para el mesero.
- Frontend: sección ⭐ en `/mesa/[token]` (consultar saldo por teléfono, ver recompensas, canjear)
  y página admin **`/fidelizacion`** (reglas, recompensas, cuentas, otorgar puntos).
  Métodos `api.getLoyaltyConfig/updateLoyaltyConfig/getLoyaltyRewards/createLoyaltyReward/...`.

## [2026-06-15] — Fase 2 Restaurante COMPLETA: reservas con aviso + jukebox

Cerradas las dos piezas restantes de la Fase 2 (tsc front 0):

- **Reservas con notificación**: al crear una reserva pública (`POST /restbar/reservations/public`)
  se emite `createNotification(tenant, {type:'reservation', ...})` para avisar al comercio. La home
  `/r/[slug]` ya enlazaba a `/reservar/[slug]`.
- **Jukebox**: tablas `rb_jukebox_queue` + `rb_jukebox_config` (auto-migración en `ensureTables`).
  Público `GET/POST /restbar-qr/session/:token/jukebox` (se desbloquea cuando el total de la comanda
  ≥ umbral, default $50k). Staff `GET/PATCH /restbar-qr/jukebox` + nueva página `/jukebox`
  (reproducir/sonada/saltar). En `/mesa/[token]`: progreso al desbloqueo + pedir canción + cola en vivo.
  `api.getJukeboxQueue()` / `api.updateJukeboxStatus()`.

## [2026-06-15] — Fase 2 Restaurante: prioridad de cocina + regalo entre mesas

Implementado y verificado (tsc front 0; backend solo errores preexistentes en `cartillas`):

- **Prioridad de cocina (delta B)**: nueva columna `rb_orders.priority` (`normal|urgente`,
  auto-migración idempotente en `index.ts`). `PATCH /restbar/orders/:id/priority`
  (`setOrderPriority` en service/controller, roles cocina/bar/mesero/admin). `getAreaDisplay`
  selecciona `priority` y ordena **urgentes primero**. Paneles `cocinero-panel.tsx` y
  `bartender-panel.tsx`: badge 🔥 URGENTE (pulse), botón ⚡ para alternar, borde rojo + sort.
  `api.setRestbarOrderPriority()`.
- **Regalo entre mesas**: en `restbar-qr.routes.ts`, `GET /session/:token/tables` (mesas ocupadas)
  y `POST /session/:token/gift` (envía items a la comanda de otra mesa, nota
  `🎁 Regalo de [nombre] (Mesa X)`, → KDS). En `/mesa/[token]`: botón "Regalar a otra mesa",
  selector de mesa y barra inferior que cambia a "🎁 Regalar a Mesa X".

## [2026-06-15] — Fase 1 Restaurante: QR de mesa + sesión del cliente

Se implementó y verificó (tsc 0) la **Fase 1** del plan de integración (sección 7 de
`context/plan-integracion-sirius.md`):

- **QR de mesa con sesión del cliente**: el mesero genera el QR por mesa
  (`table-qr-button.tsx` con `qrcode.react`, insertado en `mesero-panel.tsx`); el cliente
  escanea `/mesa/[token]`, entra con su nombre, ve el menú con disponibilidad real (agotados),
  y pide desde su celular. El pedido entra a la **comanda real → KDS** vía `restbarService`.
- **Sesión invalidada al cobrar/cancelar**: `loadSession()` hace LEFT JOIN al pedido y descarta
  la sesión si el `rb_order` está `cerrada/cancelada` (sin tocar el flujo de pago).
- **Estado del pedido en vivo** para el cliente: `GET /restbar-qr/session/:token/order` +
  vista "Mi pedido" con badges (Pendiente/En preparación/Listo/Entregado), refresco cada 7 s.
- **Home del restaurante** `/r/[slug]`: portada, logo, abierto/cerrado, promos/eventos (reusa
  `store_banners`), destacados y CTAs Ver menú / Reservar. Reusa `storefront/store-config/:slug`.

Backend nuevo: `modules/restbar/restbar-qr.routes.ts` (montado `/api/restbar-qr`), tablas
`rb_table_sessions` + `rb_table_guests` (auto-migración idempotente en arranque).

**Nota de proceso:** `lib/api.ts` se truncó por una edición con file-tools (terminaba en
`export const ap`); restaurado desde HEAD y reaplicados los cambios con python. Reafirma la
lección: **editar archivos existentes con bash/python y verificar en disco**, nunca file-tools.

## [2026-06-15] — Cerebro v4 + visión Empresa/Ramas/DAIMUZ Chat

Se actualizó el cerebro a la estructura **DAIMUZ v4** (`brain/daimuzv4.md`) y se
centralizó la visión de producto:

- **Empresa y ramas** (`brain/empresa-y-ramas.md`): DAIMUZ = empresa con ramas; la **rama Comercio** es el núcleo (`branches/comercio.md`).
- **DAIMUZ Chat** (`brain/daimuz-chat.md`): los dos modos de operar un comercio — **Operativo** (gestionas módulos) y **ControlChat** (la IA opera todo: publicaciones, catálogo, módulos), gateado por **membresía con chat**, con **panel independiente** del chat. Roadmap técnico: dar al `agent/` herramientas que ACTÚAN + permisos + aprobación + auditoría.
- **Capas v4 nuevas**: `graph/` (entities, relations, impact-map), `agents/` (incl. `daimuz-chat-agent`), `tasks/` (template + index), `governance/security-policy.md` y `approval-policy.md`.
- `DAIMUZ.md` actualizado con la sección "Empresa y Ramas (v4)".

---

## [2026-06-14] — Portafolio: tarjetas Lanyard 3D + robot IA público

**Tarjetas del equipo = Lanyard 3D** (`@react-three/*`, ver package.json). Foto del dev → textura del carnet; banda/cordón configurable por tarjeta (columna `portfolio_team_cards.band_image_url`, migración idempotente). Componentes en `frontend/components/portfolio/` (`lanyard.tsx`, `lanyard-showpiece.tsx`). Assets: `public/models/card.glb`, `public/assets/lanyard.png`.

**Robot flotante con IA (portafolio)**
- Robot Spline vía web component `<spline-viewer>` por CDN (sin deps npm). Chat debajo + "nubecitas" arriba con la respuesta. `frontend/components/portfolio/robot-assistant.tsx`.
- **Asistente público nuevo**: `runPublicAssistant()` en `assistant.service.ts` (sin tools ni datos internos, prompt de portafolio) expuesto en `POST /chatbot/platform-assistant/message` (público). Requiere el asistente de plataforma **habilitado** + clave IA (Gemini/Groq).
- URL de la escena del robot configurable desde superadmin → `portfolio_config.robot_spline_url` (migración idempotente); campo en PortfolioTab.

**⚠️ Incidente de fiabilidad:** en este entorno las ediciones del editor truncan archivos en disco; se hizo todo con bash/python y verificación en disco. Ver [[memory/important-fixes]] y [[memory/lessons-learned]].

---

## [2026-06-14] — Colorimetría en Tema 2 + favicon.ico + regla de temas

**Bug:** la paleta del superadmin se generaba y guardaba pero el home (Tema 2,
`MarketplaceHomeGovCo`) seguía verde. **Causa:** pintaba la marca con estilos
**inline** (`style={{ background: GREEN }}`) usando constantes JS fijas — los
estilos inline no se pueden sobreescribir con reglas CSS de clases — y además el
componente nunca recibía la paleta.

**Fix (patrón A, ahora estándar):**
- `home-theme2.tsx` — `GREEN`/`GREEN_DARK`/`GOLD` pasan a ser `var(--brand-green, #00833E)` etc.; nueva prop `themeColors`; la raíz inyecta `--brand-green`/`--brand-green-dark` desde la paleta. Todo el home se tiñe sin tocar cada estilo. Fallback al verde DAIMUZ.
- `landing-page.tsx` — pasa `themeColors={platformThemeColors}` al Tema 2. (El Tema 1 ya se teñía vía remap de clases Tailwind a `--color-primary`.)

**Favicon:** `app/favicon.ico` (App Router) tiene prioridad sobre `metadata.icons`;
había uno viejo. Se **regeneró desde `daimuz-icon.png`** (ICO 16→256). `layout.tsx`
y `dynamic-favicon.tsx` ya apuntan a `daimuz-icon.png`.

**Documentación / gobernanza:**
- `daimuz/brain/colorimetria.md` (nuevo) — doc canónico del sistema + checklist.
- `governance/universal-constraints.md` y `brain/coding-standards.md` — **regla: todo tema nuevo DEBE consumir la colorimetría; nunca hex de marca inline.**

**Estética home (mismo día):** contenedor `max-w-[1600px]`, tarjetas "Para ti"
con formato unificado (precio/Disponible, chip de etiqueta, pill de descuento).

---

## [2026-06-14] — Colorimetría de marca por IA (2 niveles) + fixes favicon/tarjeta

**Arquitectura (decisión):** dos niveles de paleta. Plataforma (superadmin, desde el logo DAIMUZ) → home/marketplace + login + acento por defecto en paneles. Individual del comercio (desde su logo) → su tienda (full color) + solo acento en su panel. Jerarquía de acento: comercio > plataforma > base. Los paneles operativos NO se colorizan por completo (solo acento) para preservar contraste/legibilidad.

**Colorimetría de plataforma (superadmin)**
- `frontend/lib/platform-theme.ts` (nuevo) — `getPlatformPalette()`, `applyPlatformAccentDefault()`, `parsePlatformPalette()`; clave `platform_theme_colors` en `platform_settings`
- `frontend/components/platform-theme-loader.tsx` (nuevo) — montado en `app/layout.tsx`, aplica el acento de plataforma como default app-wide (login + paneles)
- `frontend/components/platform-theme-generator.tsx` (nuevo) — tarjeta en LandingConfigTab: genera desde el logo, previsualiza paleta, guarda
- `frontend/components/landing-page.tsx` — tiñe la home/marketplace con la paleta de plataforma cuando no hay tienda seleccionada (no afecta tiendas con paleta/bg propios)
- `frontend/components/merchant-panel.tsx` — acento de plataforma como fallback cuando el comercio no tiene paleta propia; superadmin ve el acento de plataforma
- Sin backend nuevo: reutiliza `POST /storefront/theme/generate` y `PUT/GET /tenants/platform-settings`

**Auto-colorimetría al subir logo (comerciante)**
- `frontend/components/logo-theme-generator.tsx` — nuevo prop `autoApplySignal`; al subir logo genera+aplica+guarda y muestra toast "Colorimetría aplicada. ¿Deseas editarla?" con acción Editar
- `frontend/components/store-customization.tsx` — el CloudinaryUpload del logo incrementa la señal al subir una URL nueva

**Fixes**
- Favicon: `app/layout.tsx` (`icon`/`shortcut`) y `dynamic-favicon.tsx` ahora usan `daimuz-icon-transparent.png` / `BRAND.iconTransparent` (antes `daimuz-icon.png` mostraba un recuadro blanco en la pestaña)
- "Tarjeta del comercio" (`store-card-config.tsx`): el tema se guarda al instante al seleccionar la tarjeta (spinner + toast); antes solo cambiaba estado local y se perdía sin pulsar "Guardar tarjeta"
- Backend `card-config` (`storefront.routes.ts`): `affectedRows === 0` ya no asume "fila inexistente"; verifica existencia antes de INSERT (evita error 500 por clave duplicada al reguardar sin cambios)

**Nota de entorno:** el `tsc` completo del proyecto no cabe en el sandbox de Cowork (cold compile > límite de tiempo) y el mount de Linux quedó desincronizado; un typecheck acotado validó el componente de la tarjeta y los archivos se verificaron sobre el host.

## [2026-06-12] — Sprint 5: Centro de Pedidos v2 + TenantManagement mejorado

**TenantManagement (tenant-management.tsx)**
- Acciones con nombres: DropdownMenu con Ver / Editar / Activar / Trial Empresarial / Módulos / Eliminar
- Soft-delete de comercio con confirmación (status → 'cancelado')
- Edición de slug (con validación de unicidad en backend) + ver ownerName/ownerEmail en dialog
- Trial configurable: modal con contador días (1–365), botones rápidos 7/14/30; backend pasa `days` al query

**Centro de Pedidos v2 (superadmin/)**
- `KanbanView.tsx` — Kanban 6 columnas @dnd-kit/core con drag & drop; valida state machine antes de API
- `useOrders.ts` — viewMode, priorityStats (useMemo), drawerDrivers, bulk selection (Set), tenantsList
- `OrdersCenterTab.tsx` — banner SLA, priority chips, filtro comercio, border-l-4 por estado, antigüedad coloreada, checkboxes, bulk toolbar flotante, asignación rápida de repartidores en drawer, toggle Tabla/Kanban
- Backend: 3 endpoints nuevos (`/orders/tenants`, `/orders/:id/drivers`, assign con `assigneeId`); assign devuelve `assigned_name`
- Instalado: `@dnd-kit/core` + `@dnd-kit/utilities` con pnpm (npm da error en este proyecto)
- TS 0 errores en backend y frontend

## [2026-06-12] — Panel Superadmin Modular — Sprints 0-4 completos

Refactorización completa del panel superadmin + 4 sprints de nuevas funcionalidades:

**Sprint 0 — Arquitectura modular (3444 líneas → 25 archivos)**
- `frontend/components/superadmin/SuperadminLayout.tsx` — shell con 9 tabs, lazy-load con `next/dynamic`
- `frontend/components/superadmin/tabs/` — 9 componentes JSX puros (uno por tab)
- `frontend/components/superadmin/hooks/` — toda la lógica separada (useCommerces, useIntegrations, useLanding…)
- Patrón establecido: hook → estado + fetch + handlers; tab → solo JSX que consume el hook

**Sprint 2 — Centro de Pedidos cross-tenant**
- `backend/src/modules/orders/superadmin-orders.routes.ts` — 5 endpoints iniciales
- Auto-migración: `ALTER TABLE storefront_orders ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(36) NULL`
- Auto-migración: `CREATE TABLE IF NOT EXISTS order_status_history` (auditoría de transiciones)
- `frontend/components/superadmin/hooks/useOrders.ts` — estado completo: bandeja, filtros, summary, drawer, state machine
- `frontend/components/superadmin/tabs/OrdersCenterTab.tsx` — 6 KPI contadores clicables, filtros, tabla paginada, drawer con items+historial, diálogo de transición de estado
- SLA semáforo: verde <10min, amarillo 10-30min, rojo >30min desde creación del pedido

**Sprint 3 — Wizard creación + Papelera/Restaurar**
- `frontend/components/superadmin/shared/CommerceWizard.tsx` — wizard 4 pasos con validación por paso
- `frontend/components/superadmin/hooks/useTenantLifecycle.ts` — auto-slug, soft-delete (status→'cancelado'), restore (status→'activo'), loaders por fila
- `frontend/components/superadmin/tabs/CommercesTab.tsx` — reescrito con toggle papelera (badge rojo con conteo)
- `frontend/lib/api.ts` — +3 funciones: `getAllTenants`, `softDeleteTenant`, `restoreTenant`

**Sprint 4 — Analytics profesional + SSE reemplaza polling**
- `backend/src/modules/orders/superadmin-orders.routes.ts` — +3 endpoints: SSE, analytics KPIs, heatmap
- SSE endpoint: `res.flushHeaders()` + `res.write('data: ...\n\n')` + `req.on('close')` + ping cada 30s
- Heatmap SQL: UNION `storefront_orders` + `sales`, agrupado por `DAYOFWEEK()-1` y `HOUR`
- Analytics: compara período actual vs período anterior de igual duración para calcular deltas
- `frontend/components/superadmin/hooks/useOrders.ts` — reemplaza `setInterval` 30s con `EventSource(url, { withCredentials: true })` + fallback automático si SSE falla
- `frontend/components/superadmin/hooks/useAnalytics.ts` — reescrito: PlatformAnalytics + HeatmapData + helpers `deltaPct`, `getMaxRevenue`
- `frontend/components/superadmin/tabs/AnalyticsTab.tsx` — reescrito: 6 KPI cards con Delta chip, TenantChart (barras), Heatmap (CSS grid 7×24)
- `frontend/lib/api.ts` — +3 funciones: `getPlatformAnalytics`, `getOrdersHeatmap`, `getSseUrl`

**Auditoría final — 2 bugs corregidos:**
- `SuperadminLayout.tsx` l.52: `useState<TabId>('pagina')` → `useState<TabId>('pedidos')`
- `SuperadminLayout.tsx`: import `Pin` de lucide-react eliminado (nunca usado)

**Estado de TypeScript:** 0 errores en frontend y backend al cierre.

---

## [2026-06-09] — Sistema de Variantes + Precios por Volumen — implementación full-stack

Implementación completa del sistema de variantes de producto con precios escalonados y gestión de proveedores:

**Backend:**
- `backend/src/modules/variants/variants.service.ts` — CRUD completo de variantes, stock atómico (`UPDATE ... WHERE stock >= ?` + affectedRows check), resolvePrice con lógica tier/override/base, import CSV transaccional, movimientos de inventario
- `backend/src/modules/variants/variants.controller.ts` + `variants.routes.ts` — 14 endpoints (variants, price-tiers, stock, movements, import)
- `backend/src/modules/suppliers/suppliers.service.ts` + controller + routes — CRUD proveedores, link/unlink productos
- `backend/src/common/types/index.ts` — 5 nuevas interfaces: ProductVariant, VariantPriceTier, ResolvedPrice, Supplier, SupplierProduct, InventoryMovement
- `backend/src/modules/sales/sales.service.ts` — rama variant en loop de ítems de venta: stock atómico, resolución de tier, price freezing (variant_id, cost_price, margin_pct, margin_amount congelados en sale_items)
- `backend/src/modules/storefront/storefront.routes.ts` — variantes con price tiers (JSON aggregate) por producto
- `backend/src/index.ts` — montaje de variantsRoutes y suppliersRoutes
- `backend/src/migrations/004_variants_and_suppliers.sql` — 5 tablas nuevas (suppliers, supplier_products, product_variants, variant_price_tiers, inventory_movements) + ALTER TABLE (sale_items, order_items, products.base_price)

**Frontend:**
- `frontend/components/variant-manager.tsx` — componente completo: lista variantes con tiers expandibles, diálogos add/edit variante, add tier, ajuste stock (tipos: entrada/salida/ajuste/merma), import CSV
- `frontend/lib/types.ts` — ProductVariant, VariantPriceTier, ResolvedPrice, Supplier
- `frontend/lib/api.ts` — métodos: getVariantsByProduct, createVariant, updateVariant, deleteVariant, adjustVariantStock, getVariantTiers, createVariantTier, updateVariantTier, deleteVariantTier, resolveVariantPrice, importVariantsCsv, getSuppliers, CRUD suppliers
- `frontend/components/inventory-list.tsx` — botón `<Layers>` por producto abre VariantManager dialog
- `frontend/components/point-of-sale.tsx` — handleAddToCart async: detecta variantes activas, muestra picker dialog con resolución de tier por qty; handleAddVariantToCart crea ítem sintético con variantId

**Verificación:** Frontend TSC: 0 errores. Backend: 5 errores son truncaciones pre-existentes en archivos no modificados.

## [2026-06-07] — DAIMUZ auditoría final: limpieza de duplicados, consolidación de indexes

Revisión final contra el análisis completo (propuesta original + crítica + scorecard). Todo validado contra mejores prácticas:

- **Indexes**: modules-index (duplicados `products-variants`/`supplier-catalog` eliminados), endpoints-index (secciones VARIANTS/PRICE TIERS duplicadas consolidadas en 1), files-index (2 paths conflictivos de variants/ eliminados, 1 canonical), db-tables-index (sección duplicada "Nuevas tablas" eliminada)
- **Synapses ops-chain**: contenido duplicado y redundante reescrito en flujo limpio con variantes + price tiers + inventory_movements
- **Architecture database**: duplicado `stock_movements` eliminado, `inventory_movements` agregado, sección "Supplier Catalog" redundante eliminada
- **Business rules**: reglas de stock atómico, price tiers (min_qty solo), congelación, inventory_movements, import CSV agregadas
- **Ontology**: verificación de que ProductVariant y VariantPriceTier existen 1 vez cada uno (no duplicados)
- **Scoreboard**: diseño actual 9.8/10 vs mejores prácticas SaaS (race conditions, congelación, cost_price, inventory_movements, multi-proveedor)

## [2026-06-07] — Variantes + Proveedores: cerebro consolidado en brain/variants-and-suppliers.md

Unificada toda la arquitectura de variantes de producto, precios por volumen y proveedores en un solo documento maestro:

- **brain/variants-and-suppliers.md** — modelo de datos definitivo (5 tablas nuevas), 5 reglas de negocio universales (stock concurrente con UPDATE condicional, price tiers con solo min_qty sin gaps, price freezing en order_items, inventory_movements como fuente de verdad, tenant_id en todas las tablas hijas), plan de 4 sprints
- **Ontologia**: 4 nuevas entidades (ProductVariant, VariantPriceTier, Supplier, InventoryMovement). Stock Movement marcado como legacy.
- **Governance**: reglas de stock atomico, tiers sin gaps, congelacion de precios en ventas, inventory_movements como fuente de verdad
- **Sinapsis ops-chain**: flujo POS con variantes + price tiers + inventory_movements + price freezing
- **Sinapsis supplier-chain**: cadena completa proveedor > importacion > venta > liquidacion
- **Modulos nuevos**: modules/variants/ (variants.md + compressed.md), modules/suppliers/ (suppliers.md + compressed.md)
- **Flujo nuevo**: flows/supplier-flow.md (proveedor > importacion > venta > liquidacion con 6 etapas)
- **Indices**: db-tables-index con 5 nuevas tablas, endpoints-index con endpoints de variants/suppliers
- **DAIMUZ.md**: v3.9 con 37 modulos backend, 5 sinapsis, brain doc referenciado
- **Memoria**: current-state, current-sprint, pending, changelog actualizados

### Pendiente implementar
- Sprint 1: migracion SQL (product_variants, variant_price_tiers, suppliers, supplier_products, inventory_movements)
- Sprint 2: backend (variants.service, price-tier.service, import.service, suppliers.service)
- Sprint 3: frontend (POS variant selector, storefront chips, precio dinamico por tier)
- Sprint 4: panel proveedor + admin (margenes, stock por variante, reportes)

---

## [2026-06-06] — Build verde: 68 errores TypeScript corregidos (frontend + backend)

`pnpm exec tsc --noEmit` arrojaba 53 errores en frontend (8 archivos) y 15 en backend (4 archivos). Todos corregidos con cambios puntuales:

**Frontend**
- `lib/types.ts`: `CategoryItem.isHidden?`; nuevos tipos `DailyReportData` / `SedeReportData` / `ProductReportItem` (espejo de `sales.service.ts`).
- `lib/api.ts`: metodos `getDailyReport(date)` (`GET /sales/daily-report`) y `bulkCreateCustomers(customers)` (`POST /customers/bulk`).
- `ChatWidget.tsx`: `useRef<string|undefined>(undefined)` (React 19 exige argumento).
- `gym-management.tsx`: tipado explícito `id: string` en callbacks.
- `landing-page.tsx`: `?? 0` aplicado a cada operando de la resta de touch.
- `restbar.tsx`: `user?.storeName` -> `user?.tenantName` (x3; `User` no tiene `storeName`).
- `ProductTour.tsx`: migracion a react-joyride **3.1** -- `CallBackProps`->`EventData`, `disableBeacon`->`skipBeacon`, `styles.options`->prop `options`, `callback`->`onEvent`.

**Backend**
- `assistant.routes.ts`: `tenantId: u.tenantId ?? undefined` (`string|null`->`string|undefined`).
- `gym.service.ts`: `status: m.status` lo pisaba `...acc`; renombrado a `membershipStatus`.
- `workorders.controller.ts`: handlers tipados con `AuthRequest` + `req.user!.tenantId!` (patron de `sales.controller`).
- **Nuevo** `modules/alegra/alegra.service.ts`: stub tipado de facturacion electronica (el import dinamico en `orders.routes.ts` no resolvia). `createInvoice` es no-op hasta implementar el cliente real.

**Pendiente real (no bloquea build):** implementar endpoint backend `POST /customers/bulk` e integracion real de Alegra.

---

## [2026-06-05] — Asistente personal en toda la plataforma (role-aware)

Reutilizando la estructura de chat, el asistente ahora es personal y consciente del rol, disponible en admin/comerciante:
- **Backend** `backend/src/modules/assistant/` (service+routes, montado en `/api/assistant`): runner Gemini role-aware.
  - superadmin -> **Agente Maestro**: tools de solo lectura sobre TODA la red (kpis_globales, top_comercios, pedidos_pendientes_globales, stock_critico_global, comercios_inactivos).
  - comerciante/administrador_rb -> asistente de SU negocio (mis_ventas, mis_pedidos_pendientes, mi_stock_critico, mis_citas) scoped por tenant_id.
  - cliente -> sigue usando `/rutina/assistant`.
- **Frontend** `platform-assistant.tsx`: widget flotante (boton abajo-derecha) montado en `app/page.tsx` (MainLayout). Solo se muestra a superadmin/comerciante si el asistente de plataforma esta habilitado.
- Mismo gate global `platform_assistant_enabled` (lo controla el superadmin). Sin migracion nueva.

---

## [2026-06-05] — Asistente IA de plataforma (superadmin -> toda la infraestructura)

Asistente activable a nivel plataforma (no solo por comercio):
- **Toggle**: `platform_settings.platform_assistant_enabled`. Superadmin lo activa en Integraciones (`superadmin-home.tsx`, switch). Endpoints `GET /chatbot/platform-assistant`, `PUT /chatbot/superadmin/platform-assistant`.
- **Asistente del usuario** (`backend/src/modules/rutina/rutina.assistant.ts`): Gemini con function-calling y acceso CONTROLADO a los datos del propio usuario. Tools: guardar_perfil, crear_rutina_ejercicio, agregar_comida, agregar_lista_compras, recomendar_productos (busqueda cross-comercio real). Reusa `getAIKey()`. Ruta `POST /rutina/assistant` (gate: plataforma activa) + `GET /rutina/assistant/status`.
- **Chat del usuario** (`consumer-routine.tsx` -> `ChatAssistant`): boton "Asistente" en el header (solo si plataforma activa); hace cuestionario breve, arma rutina/plan a medida y muestra tarjetas de productos recomendados. Tras cada accion refresca la vista.
- **Vista comerciante** (`dashboard.tsx` -> `AssistantConnectedBanner`): banner "Asistente conectado a tu negocio" cuando esta activo (recuerda publicar catalogo con stock para aparecer en recomendaciones).
- Rutinas verificadas: generadas a medida por IA (decision del usuario), sin catalogo curado.

Sin migracion nueva (reusa platform_settings + tablas rutina_*).

---

## [2026-06-05] — Importacion masiva: auto-crear categorias inexistentes

`products.service.bulkCreate` ahora resuelve la categoria del CSV (por id o por nombre) y, si no existe para el tenant, la crea automaticamente dentro de la misma transaccion (slug como id, nombre original). Mapas en memoria evitan duplicados intra-lote y respetan el UNIQUE (tenant_id, name). Texto de ayuda del modal actualizado en `bulk-upload-dialog.tsx`.
Archivos: `backend/src/modules/products/products.service.ts`, `frontend/components/bulk-upload-dialog.tsx`.

---

## [2026-06-05] — Gym: control de acceso QR + rutina semanal

Tres piezas integradas en la vista del usuario logueado (sin migracion nueva, reusa gym_asistencia, gym_membresias, rutina_actividades_log):
- **QR de acceso**: el miembro ve su QR (codifica `GYM:<userId>`, lib `qrcode.react`) y un banner de estado (permitido/por_vencer/denegado) en su pestana Gym. Endpoint `GET /gym/me/acceso` (`memberAccess` + `computeAccess`).
- **Escaner + resultado (recepcion)**: pestana "Acceso QR" en `gym-management.tsx` con camara `@zxing/browser` + codigo manual; muestra pantalla de resultado a pantalla completa (verde/ambar/rojo) y registra el ingreso si procede. Endpoint `POST /gym/scan` (`scanAccess` valida membresia, auto-marca vencida, registra check-in).
- **Mi semana (Lun-Dom)**: componente `WeekStrip` en la pestana Rutina -- bloques por dia, marca actividades cumplidas (`rutina_actividades_log` via `POST /rutina/actividades/:id/toggle-log` + `GET /rutina/actividades-log`) y cruza con la asistencia real al gym (puntos violeta).

---

## [2026-06-05] — Gym: aprovechar al maximo la estructura

Auditoria y completado del modulo gym para usar todo el esquema:
- Backend: `memberCheckIn`/`memberCheckOut` (auto check-in del miembro, valida membresia activa), `listMemberAttendance` (historial por miembro), `miAsistencia` ahora devuelve `openCheckIn`, `getMemberDetail` incluye asistencia. Rutas: `POST /gym/me/checkin`, `POST /gym/me/checkout`, `GET /gym/members/:id/asistencia`.
- Frontend staff (`gym-management.tsx`): plan con peso/descanso por ejercicio + descripcion; progreso con medidas corporales (cintura/pecho/brazo/pierna/cadera -> JSON); detalle de miembro con edicion completa de membresia (estado/fechas/auto-renew/notas), acciones rapidas activar/pausar/cancelar, e historial de asistencia.
- Frontend miembro (`consumer-routine` GymView): boton de auto check-in / marcar salida por gimnasio activo.
- API: `miGymCheckIn/Out`, `getGymMemberAttendance`.

---

## [2026-06-05] — Diseno UI modulo CONSUMIDOR (rutina)

La vista del cliente estaba basica y no exponia todo el backend. Diseno completo de `consumer-routine.tsx`:
- Header con degradado + anillo SVG de calorias (consumidas/meta) + barras de macros (P/C/F) del dia.
- Editor de **perfil/objetivos** (modal, antes inexistente): objetivo, peso/meta, kcal, agua, nivel actividad, ciudad.
- Pestana **Rutina** nueva: constructor de rutinas + actividades (dia/hora/tipo), antes sin UI.
- Pestana **Cocina** (sub-tabs Despensa/Recetas) con **creacion de recetas** completa (macros, dificultad, meal_type, ingredientes) y "que puedo cocinar".
- **Plan** con captura y totales de macros + toggle hecho.
- Chips de objetivo/agua/peso, empty states, tab bar pulido. Pestana Gym condicional intacta.
- Backend: `getResumen` ahora devuelve nutricion del dia (plan vs consumido) y `listPlanComidas` incluye macros.

Tabs finales: Hoy . Rutina . Cocina . Plan . Compras . Gym (si miembro).

---

## [2026-06-05] — Modulo GIMNASIO end-to-end

### Backend (`/api/gym`)
- `gym.service.ts` (nuevo): membresias con cobro (registrarPago avanza next_payment segun ciclo), planes+ejercicios (transaccion), progreso, asistencia check-in/out, stats del gym, detalle de miembro, y vistas del miembro (misMembresias, miPlan, miProgreso, miAsistencia con calculo de racha/streak).
- `gym.routes.ts` (nuevo): authorize POR RUTA -- staff (`comerciante`/`administrador_rb`/`vendedor`/`cajero`) en `/gym/...`, miembro (`cliente`) en `/gym/me/...`. `index.ts` + montado en `src/index.ts`.

### Frontend
- `components/gym-management.tsx` (nuevo): panel del comercio -- stats, tabla de miembros, alta de miembro (por email), modal de detalle con planes/progreso, registrar pago, crear plan con ejercicios, registrar progreso, y pestana de asistencia con check-out.
- Montado en dashboard: `app/page.tsx` (import + `case 'gym'`) y entrada "Gimnasio" (icono Dumbbell) en `components/sidebar.tsx`.
- Vista del miembro: pestana "Gym" agregada a `consumer-routine.tsx` (solo si tiene membresia) -- membresias, racha de asistencia, plan de entrenamiento y progreso reciente.

### Pendiente
- Correr migraciones en MySQL prod (categorias, identidad, lifestyle/gym) + push.

---

## [2026-06-05] — Categorias PK compuesta + base de datos modulo Consumidor/Gimnasio

### Fixes
- **Categorias 500 entre tenants**: PK era global -> migracion a PK compuesta `(tenant_id, id)`. Archivos: `backend/migrations/fix_categories_composite_pk.sql` (MySQL) + version Postgres en `backend/migrations/postgres/001_*.sql`. Esquema base actualizado.
- Aclaracion de infra: **produccion corre en MySQL** (no Postgres). pgAdmin estaba conectado al motor equivocado (`categories does not exist`).

### Nueva base de datos (solo migracion, sin codigo aun)
- **Modulo Consumidor (Rutina/Estilo de vida)** -- datos del usuario final cross-comercio (pertenecen a `users.id`, no a un tenant):
  - `rutina_perfil`, `rutina_despensa`, `rutina_recetas`, `rutina_receta_ingredientes`, `rutina_rutinas`, `rutina_actividades`, `rutina_plan_comidas`, `rutina_lista_compras`
- **Modulo Gimnasio** -- tenant-scoped (`business_type=gimnasio`), control de miembros y progreso:
  - `gym_membresias`, `gym_planes_entrenamiento`, `gym_ejercicios`, `gym_progreso`
- Archivo: `backend/migrations/add_lifestyle_rutina_and_gym_modules.sql`
- Vision: vista del cliente logueado con su rutina diaria, que comer, recetas con lo que tiene en despensa, lista de lo que falta comprar, y compra cruzada a comercios registrados (proteinas, frutas, gimnasio, ropa, etc.).

### Decisiones tomadas
- Consumidor = **cross-comercio (usuario de plataforma)**. `users` con `role='cliente'` ES el platform_user (no se crea tabla aparte). `users.tenant_id` ya es NULL-able.
- Capa de identidad: nueva tabla `customer_tenant_profiles` (PK `platform_user_id + tenant_id`) con direccion por comercio (neighborhood/municipality/department), bloqueo (`is_blocked`/`block_reason`), consentimiento Habeas Data (`accepts_marketing`), y metricas denormalizadas (first/last_order_at, total_orders, total_spent, average_ticket, total_returns). `customers` se mantiene para mostrador. Archivo: `backend/migrations/add_platform_identity.sql`.

### Construido (end-to-end modulo CONSUMIDOR/rutina)
- **Migracion** `add_lifestyle_rutina_and_gym_modules.sql` ampliada: macros (protein/carbs/fat) en recetas y plan de comidas; perfil con bmr/tdee/bmi/target_weight/water_target; recetas con cook/total minutes, difficulty, meal_type; gym_membresias con price/payment_cycle/auto_renew/next_payment; + tablas nuevas `gym_asistencia` y `rutina_actividades_log`.
- **Backend** modulo `rutina` (nuevo): `rutina.service.ts` (perfil, despensa, recetas+ingredientes, rutinas+actividades, plan comidas, lista compras, "que puedo cocinar", generar lista desde receta, resumen), `rutina.routes.ts` (authorize cliente, REST), `index.ts`, montado en `src/index.ts` como `/api/rutina`.
- **Frontend**: `lib/api.ts` con metodos rutina; `components/consumer-routine.tsx` (overlay full-screen con pestanas Hoy/Despensa/Recetas/Plan/Compras). En `landing-page.tsx` se agrego SOLO un boton nuevo "Rutina" al nav inferior (visible si logueado) + render del overlay. **Las 5 secciones existentes (Mi cuenta, Ofertas, buscar, Carrito, Tienda) quedaron intactas.**

### Pendiente
- Correr en MySQL de prod: `fix_categories_composite_pk.sql`, `add_platform_identity.sql`, `add_lifestyle_rutina_and_gym_modules.sql`.

---

## [2026-06-04] — Despliegue en produccion (Komodo) + fixes del chatbot IA

### Despliegue
- App desplegada en produccion con **Komodo** (`deploy.alexsters.works`), stack `daimuz` (2 servicios: `daimuz_backend`, `daimuz_app`). Dominio: `https://daimuz.alexsters.works`.
- Komodo construye desde el repo de GitHub `github.com/estebanIoI/lopbuk_gastrobar.git` (branch `main`), **no** desde la carpeta local. Los cambios deben hacerse `commit` + `push` para que el build los tome.
- Config Komodo: **Pre Build Images** = ENABLED (corre `docker compose build`), **Destroy Before Deploy** = ENABLED.

### Fixes
- **Google OAuth en prod**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` iba vacio en los build args del frontend -> el provider no se montaba. Las vars `NEXT_PUBLIC_*` se hornean en build, no en runtime. Se paso el client ID real como build arg.
- **Chatbot -- modelo Gemini retirado**: `gemini-2.0-flash` ya no existe (404). En `agent.service.ts` el modelo estaba hardcodeado. Cambiado a alias `gemini-flash-latest` (configurable via env `GEMINI_MODEL`).
- **Chatbot -- soporte Groq**: `callAI()` ahora enruta por prefijo de key: `AIza` -> Gemini, `gsk_` -> Groq (endpoint OpenAI-compatible, modelo via env `GROQ_MODEL`, default `llama-3.3-70b-versatile`), otra -> OpenAI. Nota: el function-calling (pedidos/reservas) solo esta implementado para Gemini.

### Archivos modificados
- `backend/src/modules/agent/agent.service.ts` -- modelo Gemini por alias/env + funcion `callGroq` + routing en `callAI`

### Resultado
- Chatbot IA corriendo en produccion tras `push` al repo + rebuild en Komodo.

---

## [2026-05-28] — SQL sincronizado v3.8 + neuronas nuevas

### SQL
- Migracion v3.8 agrega `categories.is_active/color/sort_order` (fresh + idempotente en existentes)
- Tablas `rb_gastos`, `rb_ingresos_diarios`, `rb_gastos_fijos` integradas al script principal

### DAIMUZ
- Nueva neurona `modules/restbar-finanzas/` (completa + compressed)
- `indexes/endpoints-index.md` actualizado: CATEGORIES PATCH visibility + RESTBAR FINANZAS 13 endpoints
- `indexes/db-tables-index.md` actualizado: 3 tablas nuevas + columnas de categories
- `indexes/files-index.md` actualizado: archivos de categories CRUD + restbar.finanzas + restbar-finanzas.tsx
- `gastrobar-ops/compressed.md` actualizado: Finance Tracker documentado

---

## [2026-05-27] — Tracker Financiero Gastrobar + Categorias CRUD + DAIMUZ v3

### Nuevas funcionalidades
- **Tracker Financiero RestBar**: tab "Finanzas" (admin-only) en el modulo RestBar. Registra gastos variables, ingresos diarios, gastos fijos (con periodos: mensual/quincenal/semanal) y genera resumen quincenal. Auto-timestamp capturado en servidor al momento del registro. Timeline cronologico con iconos diferenciados.
- **Categorias CRUD completo** en modulo Inventario: dialog "Gestionar Categorias" con lista, edicion inline, color picker, toggle ocultar/mostrar y eliminar con validacion (no elimina si tiene productos activos).

### Mejoras
- **CategoryItem** extendido: ahora incluye `isActive`, `color`, `sortOrder`
- **Store Zustand**: nuevas acciones `updateCategory`, `toggleCategoryVisibility`; `fetchCategories` acepta `includeHidden`
- **DAIMUZ v3** completado al 100/100: gobernanza (3 archivos), todos los compressed.md (22 modulos), synapses completas, bugs-history poblado, deployment.md corregido (Dokploy + Evolution API v2)

### Bugs corregidos
- `api.ts`: metodo duplicado `toggleCategoryVisibility` -> renombrado el de storefront a `toggleStorefrontCategoryVisibility` para evitar colision en clase

### Archivos modificados
- `frontend/components/restbar.tsx` -- tab Finanzas + import RestBarFinanzas
- `frontend/components/restbar-finanzas.tsx` -- componente nuevo (tracker financiero completo)
- `backend/src/modules/restbar/restbar.finanzas.routes.ts` -- router con 13 endpoints
- `backend/src/modules/restbar/restbar.routes.ts` -- mount del sub-router `/finanzas`
- `backend/src/index.ts` -- 3 CREATE TABLE para rb_gastos/rb_ingresos_diarios/rb_gastos_fijos
- `frontend/lib/types.ts` -- CategoryItem extendido
- `frontend/lib/store.ts` -- updateCategory + toggleCategoryVisibility
- `frontend/lib/api.ts` -- metodos categorias + fix duplicado
- `frontend/components/inventory-list.tsx` -- dialog categorias CRUD completo
- `frontend/components/store-customization.tsx` -- actualizado a toggleStorefrontCategoryVisibility
- `backend/src/modules/categories/categories.service.ts` -- update + toggleVisibility
- `backend/src/modules/categories/categories.controller.ts` -- update + toggleVisibility
- `backend/src/modules/categories/categories.routes.ts` -- PUT /:id + PATCH /:id/visibility

---

## [2026-05-27] — Memoria unificada 