# Plan Maestro — DAIMUZ Fitness Lifestyle OS

> Documento orquestador (2026-06-22). DAIMUZ ya no es "ecommerce / app fitness /
> marketplace / afiliados": es un **sistema de identidad + commerce + coaching +
> status + acceso**. El valor NO está en cada módulo, sino en **cómo se alimentan
> entre sí** (loops). Este doc fija la visión, el loop central, las fases y el estado.
> Planes de detalle: `plan-consumer-os.md`, `plan-marketplace-entrenadores.md`,
> `plan-gamificacion-ecosistema.md`.

---

## 0. Los 5 motores
1. **Commerce Engine** (storefront + Explore)
2. **Consumer OS** (el panel = producto)
3. **Membership Engine** (LEGEND + entitlements)
4. **Coach Economy** (marketplace de entrenadores)
5. **Access / Gamification** (Vault Keys + drops + logros)

## 1. El loop = el producto
```
Explore → compra → mejora física → coach → progreso → streak → status
→ LEGEND → acceso VIP → exclusividad → comunidad → más compras → …
```
**Regla de oro:** no construir features aisladas; construir **loops de comportamiento**.
DAIMUZ gana cuando el usuario vuelve, siente progreso e identidad, compra, presume y se queda.

## 2. Principio de ejecución: vertical slices
Completar **1 loop completo y adictivo** antes del siguiente. El error fatal es hacer "un
poco de coach + un poco de gamificación + un poco de drops": todo se siente incompleto.
Orden: **OS indispensable → Coaches → Vault/Drops → AI adaptativa → Comunidad.**

---

## FASE 1 — Consumer OS Premium  ✅ (construido C1–C7)
OS indispensable: hábito, identidad, retención, monetización preparada.
- Entitlements engine (`useEntitlements`, `requireEntitlement`, `LegendGate`). ✅
- UX premium (ambient FREE/LEGEND, haptics, shine, streak). ✅
- AI Coach gated (Free básica / LEGEND avanzada). ✅
- Explore inteligente (goal + merchant_priority + purchase_history). ✅
- Streak engine + analytics de eventos. ✅
- **Pendiente fase 1 (mejora):** AI Coach con voz / meal-scan; macro_match real (tags de macros); Adaptive OS (ver Fase 4).

## FASE 2 — Coach Economy  ⏳ (plan listo, 0 código)
Monetiza fuerte, crea economía interna, sube LTV, genera contenido humano.
Detalle y datos: `plan-marketplace-entrenadores.md`. **Refinamientos canónicos:**
- **Vender PROGRAMAS / Transformaciones, NO "sesiones"** ("Transformación 90 días", "Recomposición", "Cutting Elite"). La gente compra **identidad futura**, no asesorías.
- **Coach Layer (no un tab):** el coach **modifica el OS** del cliente — rutina, macros, tareas, reminders, retos. El programa activo cambia el dashboard ("🔥 Programa activo: Hipertrofia Elite · Semana 2/12 · Coach Juan").
- **Async coaching feed, NO chat tipo WhatsApp:** el coach deja feedback/audio/video/ajuste/check-in; el usuario responde. Escala mejor, menos presión real-time, más premium.
- **Transformation Score** (no solo reviews): adherencia + retención + reviews + progreso + engagement → badges "Top Transformación / Más Consistente / Elite Coach".
- **Adaptive Coaching:** si el usuario falla macros / baja asistencia / pierde streak → DAIMUZ **avisa al coach** y sugiere ajuste. Difícil de copiar.
- El marketplace debe sentirse **elite fitness ecosystem**, no Fiverr: resultados, transformación, filosofía, energía visual — no tablas/cards aburridas.

## FASE 3 — Vault / Access Ecosystem  ✅ (construido V1–V4; ver current-sprint.md)
> V1 Vault Keys (interfaces ocultas + AccessGate) · V2 Drops como eventos (ventana + cupos en vivo Socket.io) · V3 Logros de cliente (badges) · V4 Afiliados-curadores (emiten Vault Keys, portal `/promotor`). Pendiente futuro: drops→checkout real, waiting room visual, comisión por conversión de llave.
Dispara viralidad, FOMO, adquisición, comunidad, afiliados. Detalle: `plan-gamificacion-ecosistema.md`. **Refinamientos canónicos:**
- **Llamarlo "Vault Key" / "Access Pass", NO "código"** (se siente barato).
- **Las llaves desbloquean INTERFACES OCULTAS, no solo productos:** tema secreto, catálogo oculto, combos exclusivos, sala de coach privada, drops, leaderboard. La app tiene "capas" → obsesión.
- **`<AccessGate/>`** desbloquea categorías/productos/drops/themes/coach-rooms/bundles.
- **Drops = EVENTOS, no "ofertas":** "🔥 Protein Drop · ⏳ 200 cupos · 👑 Solo LEGEND + Vault Access" → urgencia, screenshots, viralidad, status. (Waiting room + countdown realtime + Socket.io.)
- **Afiliados como CURADORES:** emiten vault keys, desbloquean drops, crean campañas privadas, curan productos; comisión dinámica por tier/conversión/retención.
- **Logros de cliente:** Founder, Early Access, Drop Hunter, Elite Buyer, Coach Disciple (en perfil/checkout/rankings/drops).

## FASE 4 — AI + Adaptive System  ✅ (F4.1–F4.3 construido)
- **Adaptive OS:** ✅ F4.1 — `adaptive` (`/adaptive/me`): nudges priorizados (coach, drop en vivo, racha, logro, membresía). `AdaptiveCards` en Today.
- **Predictive commerce:** ✅ F4.2 — recompra por cadencia real del historial. Pendiente: predicción por macros/sueño.
- **Transformation tracking:** ✅ F4.3 — `consumer_body_logs` + Progress Score (avance a meta + consistencia) + `ProgressCard`. Pendiente: fotos antes/después, body trend AI.

## FASE 5 — Community Layer  ✅ (F5.1–F5.4 construido)
- **Leaderboards + retos:** ✅ F5.1 — `arena` (Community Score leaderboard + retos de temporada). `CommunitySection` (gateado) + tab superadmin Retos.
- **Guilds/Teams:** ✅ F5.2 — `guilds`/`guild_members`, ranking de guilds por suma de scores, pestaña Guilds.
- **Social feed:** ✅ F5.3 — `arena_feed` + likes; auto-posts de logros/retos + posts manuales; pestaña Feed.
- **Retos con premio automático:** ✅ F5.4 — `settleChallenge` otorga unlock + badge `challenge_champion` + feed a los ganadores.
- Pendiente futuro: feed con fotos antes/después, comentarios en feed, retos por guild, notificaciones push.

> **TODAS las fases 1–5 del plan maestro construidas.** Pendiente transversal: deploy (tsc + push + Komodo), prueba en vivo, y mejoras finas listadas por fase.

## REFRAME (usuario, 2026-06): ACTIVACIÓN ＞ más módulos
El problema real ya no es features, es **activación/retención**: el usuario nuevo entra sin objetivo ni plan → explora 20s → se va. Orden correcto: **Activación → Retención → Monetización → Expansión**.

**P0 — Activación (en curso)**
- ✅ **O1 Onboarding guiado** que genera el programa (rutina + calorías/macros + roadmap) + reveal "Tu plan está listo" + gate en ConsumerOS.
- ✅ **O2 Logout móvil** (estaba atrapado).
- ✅ **Mission Control home**: `MissionControl` (día N + sesión de hoy + macros + checklist diario accionable) arriba del Today, móvil+desktop.
- ✅ **Nav móvil 5 ítems** (Hoy, Rutina, Plan, Comunidad, Más) + **Comunidad como tab directo** (fuera del Vault).

**P1 — Conversión/Progreso ✅**
- ✅ Planes: canje + comparativo de beneficios + upsell contextual `LegendUpsell` + **pricing self-serve** (Mensual/Semestral/Anual → checkout Wompi `legend_subscription` → activación automática).
- ✅ **Vista de progreso completa** (`ProgressView`): timeline, before/after fotos, predicción AI.

**P2 — Retención**
- ✅ **Gamificación profunda**: XP por acción + niveles (curva triangular) + **ligas semanales** (Bronce→Diamante) + `XpWidget` + pestaña Liga + nudge motivacional. Módulo `gamification`.
- ⏳ Command Center móvil (resumen AI colapsable). Temporadas/seasons de ligas (reset semanal ya implícito por ventana 7d; falta histórico/premios de temporada).

**Pendientes de infraestructura (no críticos)**
- ⏳ Notificaciones push reales (requiere service worker + VAPID + tabla de subscripciones). Hoy hay nudges in-app (adaptive) en su lugar.
- ⏳ Retos por guild (guild vs guild): extender `seasonal_challenges` con dimensión de guild + scoring agregado.
- **Predictive commerce:** "Probablemente necesitarás proteína en 4 días".
- **AI transformation tracking:** peso/fotos/medidas/adherencia → progress score + body trend.

## FASE 5 — Community Layer  ⏳ (futuro)
Leaderboards (streaks/adherencia/transformaciones/compras/coaches) · Guilds/Teams · Seasonal Events ("Summer Cut Challenge") · Social Feed (progreso/compras/streaks/logros).

---

## 3. Prioridad real AHORA
1. ✅ Consumer OS indispensable · 2. ✅ Entitlements reales · 3. ✅ AI Coach (gate) ·
4. ✅ Explore inteligente → **siguiente: Fase 2 (Coach Economy), como vertical slice
completa**, antes de tocar Vault/Drops. El riesgo #1 es hacer coaches + gamificación a la vez.

## 4. Lo ya construido que cimienta todo
LEGEND dejó listos los cimientos que reusan las fases 2–3: motor de **comisiones/payouts**
(Afiliados), **Wompi público** (captura), **entitlements + LegendGate + ledger**, **eventos**
(analytics) y el patrón de **membresías**. Ningún módulo nuevo arranca de cero.

## 5. El cambio mental
No "premium features" → **premium lifestyle environment**. No vender productos → vender
**identidad fitness con estatus, progreso y exclusividad**. Ese es el verdadero foso.
