# Sprint / Foco Actual

> Actualiza este archivo al inicio de cada sesion de trabajo.

## Sprint activo: Junio 2026

### ✅ [2026-06-22]: Vault / Access Ecosystem (Fase 3) — slice V1

Plan: `context/plan-gamificacion-ecosistema.md`. Canon: "Vault Key/Access Pass", NO "código"; las llaves desbloquean **interfaces ocultas** del OS, no solo productos.

| Paso | Estado | Qué |
|---|---|---|
| V1 Vault Keys (núcleo) | ✅ | **Backend:** migración `vault_keys` + `vault_key_redemptions` (UNIQUE por user) + `consumer_vault_unlocks` (lookup rápido). Módulo `modules/vault` (service: `createKey` con código `VAULT-XXXXX`/custom, `redeem` transaccional `FOR UPDATE` idempotente por (key,user) + upsert de desbloqueos, `getMyUnlocks`, admin list/update; routes: consumidor `POST /vault/redeem`, `GET /vault/me/unlocks`; superadmin `/admin/keys` GET/POST/PATCH; `GET /unlock-types`). Registrado en `index.ts`. Interfaces conocidas: secret_theme, hidden_catalog, coach_room, drops, leaderboard, inner_circle. **Frontend:** `api` (redeem/unlocks/admin), hook `useVaultUnlocks` (cache 60s + `has`), `<AccessGate requires>` (gate de interfaz oculta), `VaultSection` (canje + reveal + grid de interfaces + demo Inner Circle gateada) montada como tab **Vault** en desktop y como "puerta secreta" 🔑 en el header móvil. Superadmin: tab **Vault** (`VaultKeysTab`) emite/lista/deshabilita llaves. Evento `vault_key_redeemed` en whitelist. |
| V2 Drops como eventos (G4) | ✅ | **Backend:** migración `drops` (ventana, `total_slots`/`slots_taken`, `requires_unlock`, status) + `drop_claims` (único por user). `vault.drops.service`: `adminCreate/List/Update`, `listForUser`/`getForUser` (estado computado upcoming/live/sold_out/ended + `hasAccess` por unlock + `claimed`), **`claim` transaccional `FOR UPDATE`** (cupo real, idempotente, valida ventana+acceso). `vault.realtime` (namespace `/vault`, salas `drop:<id>`, `emitDropUpdate`); `initVaultSocket` en index. Rutas: consumidor `/vault/drops` GET, `/drops/:id` GET, `/drops/:id/claim` POST; superadmin `/admin/drops` GET/POST/PATCH. **Frontend:** `api` (drops/claim/admin), `getVaultSocket` en `lib/socket`, `DropsSection` (countdown en vivo, barra de cupos, "Quedan N", claim, sold-out/cerrado, suscripción Socket.io para contador en vivo) embebida en `VaultSection` tras `<AccessGate requires="drops">`. Superadmin: tab **Drops** (`DropsTab`) programa/cancela y ve avance. Evento `drop_claimed`. |
| V3 Logros de cliente (G6) | ✅ | **Backend:** migración `consumer_achievements` (único user+code). Módulo `achievements` (catálogo: founder, legend_member, vault_initiate, drop_hunter, drop_legend, coach_disciple, streak_warrior con rareza; `award` idempotente INSERT IGNORE, `getMine` devuelve catálogo con owned, `countDropClaims`). Rutas `/achievements/catalog` + `/me`. **Award hooks** (dynamic import defensivo): vault redeem→vault_initiate, drop claim→drop_hunter (+drop_legend a 5), coach activado→coach_disciple, legend redeem→legend_member, streak≥7→streak_warrior. **Frontend:** `getMyAchievements` + `AchievementShelf` (owned/bloqueado por rareza) en `VaultSection` y compacto en `PerfilModal`. |
| F3c drop→Wompi + comisión curador | ✅ | Contexto de pago `drop` (`payments.createCheckout`/`onApproved`); ruta `POST /vault/drops/:id/checkout` (sobre el cupo reservado); `dropsService.convertClaim` marca `converted` + **acredita 10% al curador** cuya Vault Key dio el acceso (`affiliatesService.creditVaultKeyConversion`, comisión `pending`). Front: `api.checkoutDrop` + botón "Pagar y asegurar" en `DropCard`. |
| F3b waiting room | ✅ | Badge "SALA DE ESPERA" + countdown destacado en drops a ≤10 min de abrir; auto-flip a EN VIVO al cruzar `starts_at`. |
| V4 Afiliados-curadores (G5/G7) | ✅ | **Backend:** `vaultService.createKey` refactor a `opts {createdBy, createdByAffiliateId}` (insert ahora guarda `created_by_affiliate_id`); `createKeyAsAffiliate` (cap 100 canjes por defecto) + `listAffiliateKeys`. Rutas en `affiliates.routes` (reusa `authenticateAffiliate`): `GET/POST /me/vault-keys`. **Frontend:** `api` afiliado (`affiliateToken` + `requestAsAffiliate`; login/register/logout/me, leaderboard, commissions, withdrawals, vault-keys). Portal **`/promotor`** (`AffiliatePortal`): login/registro + dashboard (tier, ranking del leaderboard, saldo, ventas/mes) + **emitir Vault Keys** (elige interfaces a desbloquear: drops/catálogo oculto/tema secreto/inner circle) + lista de llaves con canjes. El curador reparte acceso; las llaves quedan atribuidas a él (cimiento para comisión por conversión). |
| F4.1 Adaptive OS | ✅ | Módulo `adaptive` (`/adaptive/me`): nudges priorizados desde señales reales (feed coach sin leer, drop en vivo con acceso, racha, cercanía a logro, membresía por vencer/upgrade). Front: `AdaptiveCards` en Today (móvil+desktop), descartables 24h (localStorage). |
| F4.2 Predictive commerce | ✅ | `predictiveNudge` en `adaptive.service`: estima recompra de consumible por **cadencia real** del usuario (intervalo medio entre compras del mismo producto, historial `storefront_order_items`↔`users.phone`). Nudge `predictive` "Reabastece tu X" → tab explore. Estilo añadido en `AdaptiveCards`. |
| F4.3 Transformation tracking | ✅ | Migración `consumer_body_logs` (único user+día). Módulo `progress` (`/progress/me`, `/me/logs`, `POST /log`): `addLog` upsert por día, `getSummary` con **Progress Score** (avance hacia peso meta 65% + consistencia 30d 35%), tendencia 14d, delta/toGoal. Front: `ProgressCard` (anillo de score + peso + delta + sparkline + modal "registrar peso") en Today (móvil+desktop). |
| **FASE 5 — Community Layer** | | |
| F5.1 Leaderboard + retos | ✅ | Migración `seasonal_challenges` + `challenge_participants`. Módulo `arena` (`/arena/*`): **Community Score** leaderboard (días activos 30d×10 + logros×15 + drops×8, nombre de pila + posición propia), retos de temporada (`listActive` con progreso por métrica streak/drops/achievements, `join`, `challengeLeaderboard`), admin CRUD. Front: `CommunitySection` (retos + join + barra de progreso; **leaderboard gateado** por `<AccessGate requires="leaderboard">`) en el Vault; tab superadmin **Retos** (`ChallengesTab`). |
| F5.2 Guilds | ✅ | Migración `guilds` + `guild_members` (1 guild por usuario). `arena.service`: `createGuild`/`joinGuild`/`leaveGuild`/`listGuilds` (score = suma de Community Scores de miembros) / `getMyGuild`. Rutas `/arena/guilds*`. Front: pestaña **Guilds** en `CommunitySection` (crear/unirse/salir + ranking de guilds + mi guild con miembros). |
| F5.3 Social feed | ✅ | Migración `arena_feed` + `arena_feed_likes`. `arena.service`: `postFeed`, `autoFeed` (auto-post), `listFeed` (con liked), `toggleLike`. **Auto-post** en `achievements.award` (logro nuevo → feed) y al liquidar reto. Rutas `/arena/feed*`. Front: pestaña **Feed** (publicar + like + auto-posts de logros/retos). |
| **FASE ACTIVACIÓN (reframe del usuario)** | | El cuello de botella no es UI ni más módulos: es **activación**. Usuario nuevo entra sin objetivo/plan → no vuelve. Prioridad: onboarding guiado que genera el programa. |
| O1 Onboarding + generar programa | ✅ | **Backend:** cols onboarding en `rutina_perfil` (experience/location/time/days/motivation/protein_g/carbs_g/fat_g/onboarded_at). `completeOnboarding`: Mifflin-St Jeor → BMR/TDEE/calorías por objetivo + macros + agua + meta de peso; upsert perfil; **genera rutina inicial** (split por experiencia/lugar/días: Full Body / PPL / Upper-Lower + hábitos agua/proteína, defensivo) + roadmap. `getOnboardingStatus` (grandfathered: usuarios con perfil+objetivo no se fuerzan). Rutas `/rutina/onboarding` + `/status`. **Frontend:** `OnboardingWizard` full-screen (7 pasos: objetivo, datos, experiencia, lugar, dieta, tiempo, motivación) → reveal "Analizando…" → "Tu plan está listo" (kcal/macros/split/roadmap + CTA). **Gate en `ConsumerOS`**: si no onboarded → wizard antes del OS. |
| P0 Nav móvil 5 + Comunidad tab | ✅ | Barra móvil = **Hoy · Rutina · Plan · Comunidad · Más** (Coach/Cocina/Compras/Vault/Planes/Explore al sheet "Más"). **Comunidad sacada del Vault** → tab propio (móvil y desktop) renderizando `CommunitySection`. Desktop: ítem Comunidad en sidebar. |
| P0 Mission Control home | ✅ | **Backend:** `consumer_daily_checks` + `getTodayMission` (día N desde onboarded_at, **sesión de hoy** desde la rutina por día de semana, macros del perfil, checklist) + `toggleDailyCheck` (entrenar→racha). Rutas `/rutina/today-mission`,`/check`. **Frontend:** `MissionControl` (hero "Día N · Hoy toca: [sesión] · [Iniciar rutina]" + macros + **checklist diario** accionable con barra de progreso) arriba del Today (móvil+desktop), reemplazando el dashboard genérico. |
| P1 Vista de progreso completa | ✅ | `ProgressView` (full-screen): resumen (score/peso/cambio), **predicción** por tasa semanal ×12, **before/after** de fotos, timeline de registros. Botón "Ver progreso" en `ProgressCard`. |
| P1 Upsell contextual LEGEND | ✅ | `LegendUpsell` reutilizable (solo FREE vía `useEntitlements`) en Mission Control al avanzar el día. `PlanesView` ya tenía canje + comparativo de beneficios con candados. |
| 🐛 Fix prod: onboarding `sex` truncado | ✅ | `rutina_perfil.sex` era ENUM y truncaba `'m'/'f'` del wizard → onboarding fallaba (`WARN_DATA_TRUNCATED`). Fix: (1) `completeOnboarding` normaliza a `masculino`/`femenino`; (2) `ALTER MODIFY sex VARCHAR(20)` idempotente. (Las advertencias `Duplicate key name idx_*` son benignas: índices idempotentes ya existentes.) |
| P2 Gamificación: XP/niveles/ligas | ✅ | Migración `consumer_xp_log`. Módulo `gamification`: `awardXp(reason)` (tabla XP_REWARDS: check 10, workout 25, logro 50, drop 30, vault 40, coach 100, reseña 20, join 15, ganar reto 120, onboarding 40), `getXpProfile` (**nivel** por curva triangular + progreso + **liga semanal** por XP de 7 días: Bronce→Diamante), `getLeagueBoard`. Rutas `/gamification/me`,`/league`. **XP cableado** (dynamic import defensivo) en: daily check/workout, logro, drop claim, vault redeem, coach activado, reseña, join/ganar reto, onboarding. **Frontend:** `XpWidget` (nivel+barra+liga; compact en hero de Mission Control), pestaña **Liga** en Comunidad (XpWidget + tabla semanal). **Motivación:** nudge `motivation` en adaptive ("cerca de subir de liga"). |
| P1 Compra self-serve LEGEND | ✅ | **Monetización directa.** Migración `legend_purchases`. Service: `LEGEND_PLANS` (Mensual 29.9k / Semestral 149.9k / Anual 249.9k) + `getLegendPricing`, `grantLegendMonths` (grant transaccional extiende/crea, sin tope), `createLegendCheckout` (compra pendiente + Wompi), `getLegendPurchaseAmountCents`, `activateLegendPurchase` (idempotente, otorga LEGEND + badge). Pagos: contexto **`legend_subscription`** (monto del server, `onApproved`→activate). Rutas `/consumer-plans/legend/pricing` + `/legend/checkout`. Frontend: cards de pricing en `PlanesView` (solo no-LEGEND) → checkout Wompi → activación automática. **P1 completo.** |
| O2 Fix crítico: logout móvil | ✅ | "Cerrar sesión" en `PerfilModal` (usado en móvil y desktop) vía `useAuthStore.logout` con confirm. Resuelve el atrapamiento del usuario. |
| Mejoras finas + LEGEND admin | ✅ | **LEGEND códigos:** `deleteCode` (bloquea si ya canjeado; `force` borra también ledger) + `DELETE /admin/codes/:id?force=1`; botón 🗑 en `LegendCodesTab`. **Fotos:** campo foto (URL) en el registro de `ProgressCard` + thumbnail de última foto; toggle de foto en el composer del feed. **Comentarios:** tabla `arena_feed_comments` + `comments_count`; `addComment`/`listComments`; rutas `/arena/feed/:id/comments`; UI expandible de comentarios por post en el Feed. |
| F5.4 Retos con premio automático | ✅ | `addCol reward_unlock` + `settled_at` en retos. `settleChallenge` (admin, idempotente): a quienes alcanzaron la meta otorga el **unlock** (`consumer_vault_unlocks`) + badge `challenge_champion` + post al feed. Ruta `POST /arena/admin/challenges/:id/settle`. Front: select de recompensa-unlock + botón **Premiar** en `ChallengesTab`. Nuevo logro `challenge_champion` en catálogo. |

**Acción requerida:** `pnpm exec tsc --noEmit` front+back + **redeploy** backend (migraciones al boot: trainer_withdrawals, vault_keys/vault_key_redemptions/consumer_vault_unlocks, drops/drop_claims, consumer_achievements). NO push (lo hace el usuario).

### ⏳ PENDIENTE (próxima sesión) — sesión cerrada [2026-06-22]
1. **Deploy y prueba en vivo:** tsc front+back → push → Komodo Deploy → probar loop completo (Vault Key → canje → drop en vivo → claim → pago → comisión curador → badges → adaptive cards).
2. **Fase 4 (resto):** predictive commerce (necesita historial de compras de consumibles), AI transformation tracking (peso/fotos/medidas → progress score), drops sugeridos por el adaptive engine.
3. **Fase 5 — Community Layer:** leaderboards sociales, guilds/teams, retos de temporada, social feed.
4. **Pendientes finos:** marcar `coach_feed_entries.is_read` al abrir el feed (de eso depende el nudge "coach te escribió"); comisión de curador configurable por tier (hoy fija 10%); `founder` sin trigger automático (otorgar manual); waiting room más inmersiva.

---

### ✅ [2026-06-22]: Coach Economy (Fase 2) — vertical slice (T1–T8 completa)

Plan maestro: `context/plan-maestro-daimuz-os.md`. Detalle: `context/plan-marketplace-entrenadores.md`.

| Paso | Estado | Qué |
|---|---|---|
| **T1 schema + auth** | ✅ | Migración idempotente (`trainers`, `trainer_offers`, `trainer_bookings`, `trainer_commissions`, `trainer_reviews`) en `index.ts`; `modules/trainers/{trainers.types,trainers.service,trainers.routes}.ts`; auth propia del coach (bcrypt + JWT `type:'trainer'`, cookie `trainerToken`); rutas `/api/trainers` register/login/logout/me/patch. Comisión por defecto **híbrido 20% + mín 100k** (`DEFAULT_COMMISSION_PCT`/`DEFAULT_MIN_COMMISSION_COP`), `MIN_OFFER_PRICE_COP=500k`. |
| T2 catálogo + ofertas | ✅ | Service: CRUD de ofertas del coach (`createOffer`/`listMyOffers`/`updateOffer`/`deactivateOffer`, **programas** ≥500k) + catálogo público (`listActiveTrainers`/`getTrainerPublic`). Rutas `/me/offers` (coach) + `/public/trainers(/:id)`. Frontend: `api.getPublicTrainers/getPublicTrainer` + `CoachSection` (grid de coaches → detalle con programas, estilo elite) + tab **Coach** en desktop y móvil. Contratación = placeholder (T3). |
| T3 contratación + Wompi + Active Program | ✅ | Loop completo: `createBooking` congela `program_snapshot`; `POST /trainers/bookings` crea booking + checkout Wompi (contexto **`coach_booking`** en `payments.createCheckout`, monto del booking en BD); webhook `onApproved` → `activateBookingPaid` (transaccional): comisión **híbrido 20% mín 100k** + gateway 2.65% al coach + `trainer_commissions` con `release_at`=+7d + acredita `pending_cop`. **Active Program Layer:** `getActiveProgram` + `ActiveProgramBanner` en Today (móvil+desktop, "Semana N/total"). CoachSection contrata real (redirige a Wompi). Migración: cols `program_snapshot`/`activation_status`/`current_week` en bookings + `release_at` en commissions (ALTER idempotente). Eventos coach en whitelist analytics. |
| T4 delivery + coach feed | ✅ | **Delivery:** al activar el programa, `deliverProgram` crea una **rutina** del programa en el OS del usuario + mensaje de bienvenida (defensivo). **Async coach feed** (no WhatsApp): tabla `coach_feed_entries` (author coach/user, kinds feedback/checkin/adjustment/task/announcement/reply); service `getBookingFeed`/`coachPostFeed`/`userReplyFeed`/`coachListClients`. Rutas: consumidor `GET/POST /bookings/:id/feed`; coach `GET /me/clients`, `GET/POST /me/clients/:bookingId/feed`. Frontend: `ProgramFeed` (feed + responder) + `CoachSection` lo muestra por defecto si hay programa activo (toggle "ver otros entrenadores"). |
| T5 payouts del coach | ✅ | Tabla `trainer_withdrawals` (idempotente). Service: `releaseMaturedCommissions` (comisión `pending`→`available`, mueve neto de `pending_cop`→`balance_cop` cuando `release_at`≤ahora, transaccional; lazy en wallet y en listado admin), `getWallet`, `listMyCommissions`, `requestWithdrawal` (mín 50k, ≤ saldo), `listMyWithdrawals`, `adminListWithdrawals`, `adminProcessWithdrawal` (descuenta saldo al marcar pagado, transaccional `FOR UPDATE`). Rutas coach `/me/wallet`,`/me/commissions`,`/me/withdrawals` (GET/POST); superadmin `/admin/withdrawals` (GET) + `:id` (PATCH). |
| T6 portal `/coach` | ✅ | Página `app/coach/page.tsx` (dynamic, ssr:false) + `components/coach/CoachPortal.tsx`: auth propia (login/registro), shell con sidebar y vistas **Resumen** (wallet + solicitar retiro + comisiones), **Programas** (CRUD ofertas con modal), **Clientes** (lista → feed de coaching, postea feedback/checkin/ajuste/tarea/anuncio), **Retiros** (historial), **Perfil** (editar + términos comisión + logout). `api.ts`: `trainerToken` en memoria + `requestAsTrainer` + métodos (auth, offers CRUD, clients+feed, wallet/commissions/withdrawals, admin de retiros). Superadmin: tab **Coaches** (`CoachPayoutsTab`) para procesar/pagar/rechazar retiros. |
| T7 pulir Coach en OS | ✅ | `CoachSection` rediseñada: hero aspiracional, **ranking de top coaches** (Transformation Score, carrusel), detalle con estrellas + score + reseñas de clientes, acceso rápido al programa activo mientras explora. |
| T8 reviews + score + ranking | ✅ | **Backend:** `transformationScore` (transformaciones×12 + rating×16 + reseñas×4); `createReview` (1 por booking pagado, recalcula `rating_avg`), `listTrainerReviews` (nombre de pila), `listReviewableBookings`, `getRanking`. Rutas públicas `/public/ranking`, `/public/trainers/:id/reviews`; consumidor `/bookings/reviewable`, `POST /reviews`. **Frontend:** `getCoachRanking/getTrainerReviews/getReviewableBookings/createTrainerReview`; `ReviewCard` en `ProgramFeed` (estrellas + comentario, evento `coach_review_submitted`), reseñas+score en `CoachSection`. |

**Acción requerida:** `pnpm exec tsc --noEmit` backend + **redeploy** (migración corre al boot). NO push.


### 🚧 En progreso [2026-06-22]: Consumer OS (panel del cliente = producto, no marketplace)

Visión: el panel del `cliente` es el producto; el marketplace es una función ("Explore"). Plan en `context/plan-consumer-os.md`.

| Paso | Estado | Qué |
|---|---|---|
| C1 core | ✅ | `consumer/hooks/useConsumerData` (extrae estado+load de `consumer-routine.tsx` sin tocar UI móvil) |
| C2 router+shell | ✅ | smart router en `app/page.tsx` (`cliente → <ConsumerOS/>`); `ConsumerOS` elige shell por breakpoint (`useIsDesktop`); `DesktopShell` (sidebar+main); secciones exportadas de `consumer-routine` |
| C3 desktop premium | ✅ | Command Center (AI Insights heurísticos), saludo Today, glass; `useConsumerData` expone `planState` |
| C3b Today grid | ✅ | `consumer/sections/TodayDashboard` (grid de widgets real, no la vista móvil en columna) |
| C4 Explore modular | ✅ | `consumer/sections/explore/{ExploreSection,ProductCard}` (search+categorías+grid, contextual; NO embebe LandingPage); tab inline en ambos shells; compra delega a `?store=` |
| C5 ambient+micro | ✅ | `useConsumerTheme` (ambiente FREE/LEGEND + CSS vars), `useCountUp` (contador suave), hover-lift |
| C4b carrito inline | ✅ | `lib/consumer-cart-store` (zustand+persist, multi-tienda); `CartDrawer` (checkout inline: contra entrega multi-tienda / Wompi 1 tienda vía `/orders/public` + checkout público); `CartButton` global (sidebar+header) |
| C6 reco engine | ✅ | `lib/explore-recommend` (scoring por objetivo: `bajar_peso`/`subir_masa`/…); "Recomendado para ti" + grid ordenado por relevancia |
| **C7 Entitlements + Premium** | ✅ | Membresía con ACCESO REAL (ver detalle abajo) |

**C7 — Entitlements Engine + Premium Experience (LEGEND deja de ser solo visual):**
- **C7.1/C7.2** Base ya existía (G1/G2: `consumer_entitlements` + `hasEntitlement`). Nuevos: `useEntitlements` (frontend, access profile + cache 60s + `has(key)`), `requireEntitlement(key)` (middleware backend con 403 + log en ledger), `LegendGate` (soft paywall, nunca "acceso denegado").
- **C7.3** IA gated: `runAssistant(advanced)` — Free básica (600/450 tokens) vs LEGEND AI Coach (1100/800 + prompt coach). Ruta detecta `routine_ai`. Branding "AI Coach LEGEND" en botón + header del chat.
- **C7.4** Smart Combos en Explore (gated `smart_combos`): combo del top-recomendado + "Agregar combo"; Free ve teaser.
- **C7.5** Discounts engine: tabla `consumer_discount_rules` + seed (10% + envío gratis) + `getMyDiscounts` + UI superadmin (`LegendCodesTab`: % + envío gratis). ProductCard "−X% LEGEND", CartDrawer "Ahorraste $X" + `discount` por tienda.
- **C7.6** UX premium: `lib/haptics` (Vibration API) en add-to-cart/reveal/checkout; `LegendShine` (brillo) en header LEGEND.
- **C7.7** Streak engine: tabla `consumer_streak_days` + `pingActivity`/`getStreak` + ping al montar; chip "🔥 N" móvil + saludo desktop.
- **C7.8** Explore intelligence: `/recommended` (ahora autenticado) puntúa `goal_match + merchant_priority (destacados) + purchase_history (por teléfono del user) + oferta`. macro_match real pendiente (requiere tags de macros en productos).
- **C7.10** Analytics: tabla `consumer_events` + `trackEvent` (whitelist) + `POST /me/event` + `GET /admin/events` + tarjeta "Eventos (30d)" en superadmin. Eventos: legend_redeemed, smart_combo_clicked, product_added, explore_opened, ai_advanced_opened, discount_used.

**Migraciones nuevas (corren al boot):** `consumer_discount_rules`, `consumer_streak_days`, `consumer_events` (en el bloque consumer-plans de `index.ts`).
**Pendiente C7 (mejora futura):** macro_match real (tags de macros en productos) y UI superadmin para reglas de descuento por categoría (hoy solo % global + envío).

**Pendientes Consumer OS:**
- ✅ **Recos desde backend**: `GET /storefront/recommended?goal=&limit=` (scoring server-side, misma visibilidad), `api.getRecommended`, ExploreSection lo usa con fallback al heurístico front.
- ✅ **GPS en CartDrawer**: captura `navigator.geolocation` + mini-mapa OSM + `deliveryLatitude/Longitude` y link Maps en notas.
- ⏳ **Wompi multi-tienda**: constraint real — un pago Wompi = una referencia/comercio. Multi-tienda en un solo pago necesita *payment splitting* a nivel plataforma (decisión de negocio/backend). Hoy: contra entrega es multi-tienda; Wompi queda 1 tienda a la vez (bloqueo con mensaje claro).
- ⏳ **Ambient theme en TODAS las secciones**: el shell/Today ya cambian con LEGEND; retrofittear los oranges hardcodeados de Rutina/Cocina/Plan/Compras es un repaso grande (comparten UI con el móvil) — pendiente dedicado.
- ⏳ **Tratamiento widget desktop** de Rutina/Cocina/Plan/Compras: requieren rediseño por sección (layout multi-columna), no batchear sin validar en runtime.
- ⏳ **Sedes (pickup)** en CartDrawer: multi-tienda complica (cada comercio sus sedes); pendiente.

**Acción requerida:** `pnpm exec tsc --noEmit` + `pnpm build` en frontend, validar en runtime (móvil <768, desktop ≥768, Command Center ≥1280, flujo Explore→carrito→checkout) y **Deploy en Komodo**. NO se hizo push.

### ✅ Completado [2026-06-21]: Carrito Tema 2 + fixes pagos + "Te encontré"/GPS + Módulo LEGEND (G1–G8)

| Tarea | Estado | Descripción |
|---|---|---|
| Carrito Tema 2 responsivo + fotos | ✅ | `theme2-order-flow.tsx`: modal `h-[100dvh]` + header/footer `shrink-0`; miniatura de producto/variante en cada línea |
| Promo "lleva 2, −X%" en Tema 2 | ✅ | `lib/qty-promo.ts` nuevo `qtyPromoUnit()` (escala a cualquier qty); badge en lista, banner en detalle, precio combinado en carrito/WhatsApp/pedido. `T2Product.qtyPromo` |
| Fix 400 /orders/public con Wompi | ✅ | validadores `optional({ checkFalsy: true })` para email/cédula/depto/municipio/dirección/barrio (vacíos ya no rompen) |
| Fix 401 pago de productos | ✅ | endpoint público `POST /payments/public/checkout` (sin auth) + `createCheckout` resuelve monto/tenant del pedido en BD (context 'order'); `api.createPublicOrderCheckout`; landing-page usa el público |
| Wizard ML captura completa | ✅ | campo Notas (opcional) agregado; flujo revisado (captura los 9 campos) |
| "Te encontré" (Tema 2) | ✅ | `GET /orders/public/lookup` (por teléfono+tenant) **verificado por nombre** (privacidad); autocompleta dirección/GPS de pedido anterior |
| Ubicación GPS + mini-mapa | ✅ | botón captura `navigator.geolocation`, muestra mini-mapa OSM (iframe, sin coords); lat/lng al pedido + link Maps. Botón "Confirmar pedido" (antes "Enviar por WhatsApp") |
| **Módulo LEGEND G1–G8** | ✅ | Consumer Plans completo (ver abajo) |

**Módulo Consumer Plans / LEGEND (nuevo, end-to-end):**
- **G1** Schema idempotente en `index.ts` (`consumer_access_codes`, `consumer_plan_grants`, `consumer_access_ledger`, `consumer_entitlements` + seed) · `migrations/006_consumer_plans.sql` · `consumer-plans.types.ts`. Ids VARCHAR(36) (no BIGINT).
- **G2** `consumer-plans.service.ts`: `redeemCode` (FOR UPDATE, idempotente, hash código, stack_policy extend con tope 180d, ledger), `getUserTier`, `hasEntitlement`, CRUD códigos, get/saveLegendConfig.
- **G3** `consumer-plans.routes.ts` (`/api/consumer-plans`): `/redeem` (rate-limit 5/15min), `/me`, `/legend-config`, admin codes + config.
- **G4** `consumer-plans-view.tsx` (pestaña Planes en `consumer-routine.tsx`): estado + contador en vivo + canje + beneficios.
- **G5** `legend-reveal.tsx` (glitch dorado skippable ≤2.5s) + tema LEGEND en el panel (header/tab dorados).
- **G6** `superadmin/tabs/LegendCodesTab.tsx`: generar/listar/desactivar códigos + config animación.
- **G7** Gamificación: `legend-badge.tsx` reutilizable, `powerDays` (streak), milestones 30/90/180/365 en `getUserTier` + UI.
- **G8** `getAnalytics()` + `GET /admin/analytics` + KPIs en LegendCodesTab (activos, por vencer, canjes 30d, retención, milestones).

**Archivos clave:** backend `index.ts` (migración G1 + registro ruta), `modules/consumer-plans/*`, `modules/orders/orders.routes.ts` (lookup + checkFalsy), `modules/payments/{payments.service,payments.routes}.ts` (checkout público order); frontend `lib/api.ts`, `theme2/theme2-order-flow.tsx`, `lib/qty-promo.ts`, `consumer-routine.tsx`, `consumer-plans-view.tsx`, `legend-reveal.tsx`, `legend-badge.tsx`, `theme-ml/checkout-wizard-ml.tsx`, `superadmin/{SuperadminLayout,tabs/LegendCodesTab}.tsx`.

**PENDIENTE (próxima sesión):** conectar `hasEntitlement(userId, key)` a features reales (gatear asistente IA con `routine_ai`, descuentos con `discounts`, etc.). Además: tsc front+back en Windows y **Deploy en Komodo** (la migración G1 corre al boot). NO se hizo push.

### ✅ Completado [2026-06-18 parte 2]: Integración de variantes COMPLETA (asiento + pasarelas + variant_id + cupo)

| Tarea | Estado | Descripción |
|---|---|---|
| Migraciones idempotentes | ✅ | `index.ts` addCol: `variant_id`+congeladas en `storefront_order_items`/`sale_items`; `preorder_limit`+`preorder_count` en `product_variants` |
| Asiento al confirmar | ✅ | `settleVariantForSale(conn)` descuenta stock variante, libera reserva, movimiento `salida`, congela en `sale_items`; SELECT de items con `variant_id`+`is_preorder` |
| Cupo de preventa | ✅ | `reserveForPublicOrder` enforce atómico `preorder_count + qty <= preorder_limit`; distinción por `reference_type`; `create`/`update`+UI |
| Reserva en pasarelas | ✅ | MP/ADDI/Sistecrédito reservan + persisten `variant_id` + cancelan/409 si no alcanza; liberan en webhooks de rechazo + `cancel-gateway` |
| Trazabilidad | ✅ | `variant_id` en `storefront_order_items` y `sale_items` |
| Auditoría | ✅ | tsc backend + frontend: **0 errores totales** |

**Archivos clave:** `backend/src/index.ts` (migraciones), `modules/variants/variants.service.ts` (`settleVariantForSale` + reserve/release con cupo), `modules/variants/variants.controller.ts` (pasa preorderLimit), `modules/orders/orders.routes.ts` (asiento + reserva en 3 pasarelas + liberación en webhooks), `modules/storefront/storefront.routes.ts` (attachVariants expone cupo), `common/types/index.ts`; frontend `components/variant-manager.tsx` (campo cupo), `lib/types.ts`.

**Solo queda operativo:** arrancar backend (corre migraciones) + cargar AnMarg + **Deploy en Komodo**.

### ✅ Completado [2026-06-18]: Variantes en todo el storefront + selección dinámica (Tema 2) + reserva atómica + preventa

| Tarea | Estado | Descripción |
|---|---|---|
| Producto AnMarg (carga) | ✅ | `imports/anmarg-camiseta-clasica/`: CSV 90 variantes + SQL tiers (6+/12+/24+) + README. No cargado en BD aún. |
| Selector dinámico Tema 2 | ✅ | `VariantSelector` integrado en `theme2-order-flow.tsx`: precio/imagen/stock al instante, bloqueo hasta elegir, variante en carrito/WhatsApp/pedido, `+`/"Ordenar Ahora" abren detalle si hay variantes |
| Tema 1 payload variantId | ✅ | `variantId` agregado a los 4 `items.map` de `landing-page` (público + 3 pasarelas) |
| Attach variantes centralizado | ✅ | helper `attachVariants()` en `storefront.routes.ts` aplicado a lista, /offers, /new-launches, /platform-featured, /drop/:id, store-config featured+trending (fix: no cargaban hasta recargar) |
| Visibilidad por variante | ✅ | lista incluye productos `stock=0` con variante disponible (`EXISTS` sobre `product_variants`) |
| Reserva atómica en /orders/public | ✅ | `reserveForPublicOrder`/`releaseForOrder` en `variants.service.ts`; `checkStockAvailability` ignora `variantId`; libera en `cancel-gateway` |
| Preventa backorder | ✅ | `allowOutOfStock` en `VariantSelector` (agotadas seleccionables); ítems `isPreorder` no reservan stock; conectado en ambos themes |
| Auditoría tsc | ✅ | backend + frontend sin errores nuevos en archivos tocados |

**Archivos clave:**
- Backend: `storefront.routes.ts` (helper `attachVariants` + visibilidad por variante), `orders.routes.ts` (`/public` reserva + `cancel-gateway` libera + `checkStockAvailability` variant-aware), `variants.service.ts` (`reserveForPublicOrder`/`releaseForOrder`)
- Frontend: `theme2/theme2-order-flow.tsx`, `variant-selector.tsx` (prop `allowOutOfStock`), `landing-page.tsx`
- Datos: `imports/anmarg-camiseta-clasica/` (CSV + SQL + README)

**Pendiente variantes:** asiento al confirmar (pedido→venta) para variantes (hoy descuenta `products.stock`, no asienta `reserved_stock`→`stock`); reserva en flujos de pasarela (solo `/public`); columna `variant_id` en `storefront_order_items` (cambio de schema, no hecho por la regla); cupo máximo de preventa por variante. **Falta Deploy en Komodo.**

### ✅ Completado [2026-06-17]: Afiliados (backend S1–4) + tarjetas externas + imagen por variante + barra config + cierre Tema 2

| Tarea | Estado | Descripción |
|---|---|---|
| Afiliados Sprint 1 (schema) | ✅ | 10 tablas, migración inline idempotente + tipos + 005_affiliates.sql |
| Afiliados Sprint 2 (core) | ✅ | service+routes, auth propia promotor, campañas/conversiones/retiros/misiones, superadmin/comercio |
| Afiliados Sprint 3 (paquetes) | ✅ | CRUD + contratación + pago inmediato al wallet |
| Afiliados Sprint 4 (atribución) | ✅ | hook `?ref=` en /orders/public + auto-aprobación; código POS listo (sin enganchar) |
| Tarjetas externas | ✅ | tabla + CRUD superadmin + merge en /storefront/stores + redirect en home |
| Imagen por variante | ✅ | campo en variant-manager + swap de imagen al elegir color (tienda) |
| Barra de bienvenida configurable | ✅ | platform_settings + LandingConfigTab + props home-theme2 |
| Cierre Tema 2 | ✅ | éxito holo+ticket, fix duplicados, carrito minimalista, premium, confirmación desde pedidos |
| Home móvil | ✅ | carrusel sin franjas + bienvenida sin recorte + "Únete a DAIMUZ" (3 públicos) |

**Pendiente afiliados (ver `context/roadmap-afiliados.md`):** Sprint 4b (hook POS por código), 4c (cron auto-aprobación),
Sprint 5 (tier engine + reset mensual), Sprints 6–8 (frontend: portal `/promotor`, panel comercio, tab superadmin).

**Acción requerida:** commit + push + **Deploy en Komodo** (las tablas de afiliados se crean al arrancar el backend).

### ✅ Completado [2026-06-16]: Tema 2 (reservas/pedidos) + QR de mesa administrable

| Tarea | Estado | Descripción |
|---|---|---|
| Reservas Tema 2 que guardan | ✅ Completo | `POST /restbar/reservations/public-quick` + pantalla de éxito + WhatsApp opcional |
| Pedidos sin falla silenciosa | ✅ Completo | `registerOrder` valida `res.ok`; no abre WhatsApp si falla; error en UI |
| "Ordenar Ahora" en Favoritos | ✅ Completo | `initialProductId` → producto ya en el carrito al abrir el flujo |
| Botón "todas las tiendas" a la derecha | ✅ Completo | Móvil: pill a la derecha (antes centrado); escritorio: pestaña borde derecho |
| QR de mesa administrable | ✅ Completo | GET sesión (invitados + consumo c/u) + close; panel con compartir/regenerar/eliminar |

**Archivos clave:**
- Backend: `restbar-qr.routes.ts` (GET/POST `/tables/:id/session(/close)`), `restbar/reservations.routes.ts` (`/public-quick`)
- Frontend: `theme2/theme2-reserve-flow.tsx`, `theme2/theme2-order-flow.tsx`, `theme2/theme2-storefront.tsx`, `restbar/table-qr-button.tsx`, `landing-page.tsx`, `lib/api.ts`

**Pendiente Tema 2:** restyle carrito minimalista, animación holo "en camino" al activar ubicación, tarjeta de ticket de éxito y tarjeta premium (Uiverse). **Falta Deploy en Komodo** para ver todo en prod.

### ✅ Completado [2026-06-14]: Colorimetría de marca por IA + fixes

| Tarea | Estado | Descripción |
|---|---|---|
| Arquitectura 2 niveles | ✅ Completo | Paleta plataforma (home/login/default) + paleta comercio (tienda full / panel acento) |
| Colorimetría superadmin | ✅ Completo | Tarjeta en LandingConfigTab; genera desde logo, guarda `platform_theme_colors` |
| Acento global default | ✅ Completo | `platform-theme-loader` en layout; fallback en `merchant-panel` |
| Auto-colorimetría comerciante | ✅ Completo | Al subir logo: genera+aplica+guarda + toast "¿desea editar?" |
| Fix favicon | ✅ Completo | `daimuz-icon-transparent.png` (sin recuadro blanco) |
| Fix guardado de tema (tarjeta) | ✅ Completo | `store-card-config.tsx` guarda al instante; backend `card-config` ya no falla por INSERT duplicado |

**Archivos clave:**
- Nuevos: `frontend/lib/platform-theme.ts`, `frontend/components/platform-theme-loader.tsx`, `frontend/components/platform-theme-generator.tsx`
- Editados: `frontend/app/layout.tsx`, `frontend/components/dynamic-favicon.tsx`, `frontend/components/superadmin/tabs/LandingConfigTab.tsx`, `frontend/components/logo-theme-generator.tsx`, `frontend/components/store-customization.tsx`, `frontend/components/landing-page.tsx`, `frontend/components/merchant-panel.tsx`, `frontend/components/store-card-config.tsx`
- Backend: `backend/src/modules/storefront/storefront.routes.ts` (fix `card-config`)
- Sin cambios de schema (reutiliza `platform_settings` + `/storefront/theme/*`)

**Pendiente de verificar en runtime:** levantar dev server, generar colorimetría desde superadmin y desde un comercio, confirmar tinte en home/login/panel; confirmar que el tema de la tarjeta del comercio persiste tras recargar. Requiere clave de IA de visión (Gemini/Groq/OpenAI) en Integraciones.

### ✅ Completado [2026-06-12]: Sprint 5 — Centro de Pedidos v2 + TenantManagement

| Sprint | Estado | Descripción |
|---|---|---|
| Sprint 5a — TenantManagement | ✅ Completo | DropdownMenu acciones con labels, eliminar, editar slug, trial configurable con días |
| Sprint 5b — Kanban + Bulk | ✅ Completo | KanbanView con @dnd-kit, acciones masivas, bulk toolbar flotante |
| Sprint 5c — Quick wins SLA | ✅ Completo | Banner alerta, priority chips, filtro comercio, border-l-4, antigüedad coloreada |
| Sprint 5d — Asignación rápida | ✅ Completo | Drawer muestra repartidores del tenant, asigna por driverId directo |

**Archivos clave:**
- `frontend/components/superadmin/shared/KanbanView.tsx` (nuevo — @dnd-kit)
- `frontend/components/superadmin/hooks/useOrders.ts` (expandido — bulk, drivers, kanban, priorityStats)
- `frontend/components/superadmin/tabs/OrdersCenterTab.tsx` (reescrito)
- `frontend/components/tenant-management.tsx` (mejorado — DropdownMenu, delete, slug, trial days)
- `backend/src/modules/orders/superadmin-orders.routes.ts` (3 endpoints nuevos, assign con assigneeId)
- `backend/src/modules/tenants/tenants.service.ts` (update acepta slug; activateTrial acepta days)
- Dep nueva: `@dnd-kit/core` + `@dnd-kit/utilities` (instalado con pnpm, npm da error en este proyecto)

### ✅ Completado [2026-06-12]: Panel Superadmin Modular (Sprints 0-4)

| Sprint | Estado | Descripción |
|---|---|---|
| Sprint 0 — Refactor monolito | ✅ Completo | 3444 líneas → 25 archivos, arquitectura hook+tab |
| Sprint 2 — Centro de Pedidos | ✅ Completo | Bandeja cross-tenant, SSE, state machine, drawer |
| Sprint 3 — Wizard + Papelera | ✅ Completo | Wizard 4 pasos, soft-delete, restore tenants |
| Sprint 4 — Analytics + SSE | ✅ Completo | KPIs plataforma, heatmap 7×24, SSE reemplaza polling |

**Archivos clave del resultado:**
- Backend: `superadmin-orders.routes.ts` (ahora 11 endpoints)
- Frontend: `frontend/components/superadmin/` (26 archivos tras Sprint 5)
- DB: `storefront_orders.assigned_to` (col) + `order_status_history` (tabla)

---

### ✅ Completado [2026-06-09]: Variantes + Precios por Volumen

### Estado Variantes

| Sprint | Estado | Proximo paso |
|---|---|---|
| DAIMUZ - Arquitectura disenada | Completo | En DAIMUZ |
| Sprint 1 - Schema DB | Pendiente | Migracion SQL |
| Sprint 2 - Backend | Pendiente | services + endpoints |
| Sprint 3 - Frontend POS + Storefront | Pendiente | selectores + precio dinamico |
| Sprint 4 - Panel Proveedor + Admin | Pendiente | vista proveedor + margenes |

### Sesion [2026-06-07] - Arquitectura Variantes en DAIMUZ
- **Modulo variants** -> `daimuz/modules/variants/variants.md` (completo + compressed.md)
- **Flujo** -> `daimuz/flows/variant-flow.md` (ciclo import -> storefront -> venta -> auditoria)
- **Sinapsis** -> `daimuz/synapses/variants-chain.md` (cadena impacto + matriz + flujo transaccional)
- **Plan definitivo** -> `daimuz/brain/variants-implementation-plan.md` (analisis critico, scorecard, roadmap 4 sprints)
- **Indexes**: modules-index (duplicados limpiados), db-tables-index (3 tablas nuevas + ALTERs), endpoints-index (endpoints variants + tiers + import + suppliers)
- **Governance**: universal-constraints.md con reglas de stock atomico, price tiers (min_qty solo), congelacion en ventas, inventory_movements como fuente de verdad
- **Ontologia**: entities.md con ProductVariant, VariantPriceTier, Supplier, SupplierProduct, InventoryMovement
- **Pending**: consolidado en 1 entrada con 4 sprints + migracion legacy
- **Scorecard**: diseno actual 9.4/10, plan 9.8/10 vs mejores practicas SaaS
- Pendiente: ejecutar migracion SQL, codificar services, endpoints, frontend

### Sesión [2026-06-09] — Integración análisis crítico externo + corrección de inconsistencias

- **Análisis externo integrado**: propuesta original (8.0/10) → crítica refinada (9.6/10) → DAIMUZ ya estaba en 9.4/10 → confirmado y corregido a 9.8/10
- ✅ **`variants-implementation-plan.md`**: `variant_price_tiers` ahora incluye `tenant_id` en DDL (antes solo en nota); unificado `attribute_1/2` → `color`/`size`/`material`; timestamps explícitos
- ✅ **`db-tables-index.md`**: `product_variants` ahora incluye `reserved_stock`, `min_stock`, `images`, `sort_order`; `platform_margin_pct` → `tenant_margin_pct`; `supplier_products` con timestamps
- ✅ **Estado confirmado**: race conditions, min_qty sin gaps, cost_price, inventory_movements, price freezing — TODO ya estaba en DAIMUZ antes de este análisis
- Pendiente: ejecutar migraciones SQL, codificar services, endpoints, frontend (Sprints 1-4)

### Sesión [2026-06-07] — Plan variants consolidado en DAIMUZ (ronda 2)
- ✅ **Módulo variants**: `daimuz/modules/variants/variants.md` + `compressed.md` creados
- ✅ **Synapse**: `daimuz/synapses/variants-chain.md` con flujo variante → venta → stock atómico
- ✅ **Ontología limpiada**: entidades duplicadas (ProductVariant x3, PriceTier x4) consolidadas en 10 entidades únicas
- ✅ **db-tables-index**: esquemas completos de `product_variants`, `variant_price_tiers`, `suppliers`, `supplier_products`
- ✅ **files-index**: variants + suppliers services + frontend components agregados
- ✅ **endpoints-index**: variantes consolidado en una sola sección (eliminados 3 duplicados)
- ✅ **Arquitectura**: min_qty sin gaps, UPDATE atómico `WHERE stock >= ?`, congelar precios en sale_items, cost_price para margen real

### Sesiones anteriores (IA Agent)

| Fase | Estado |
|---|---|
| Fase 1 - RAG + Function Calling | Completo |
| Fase 2 - WhatsApp (Evolution API) | Completo |
| Fase 3 - Voz IA (Vapi) | Pendiente |
| Fase 4 - Panel Admin del Agente | Pendiente |

---

## Template para nueva sesion

```markdown
## [YYYY-MM-DD]

### Objetivo de hoy
[que quiero lograr]

### Archivos que voy a tocar
- [archivo 1]
- [archivo 2]

### Resultado
[que logre al final]
```

---

[[context/pending]] | [[DAIMUZ]] | -> [[context/environment]]
