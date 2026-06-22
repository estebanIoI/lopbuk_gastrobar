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

## FASE 3 — Vault / Access Ecosystem  ⏳ (plan listo, 0 código)
Dispara viralidad, FOMO, adquisición, comunidad, afiliados. Detalle: `plan-gamificacion-ecosistema.md`. **Refinamientos canónicos:**
- **Llamarlo "Vault Key" / "Access Pass", NO "código"** (se siente barato).
- **Las llaves desbloquean INTERFACES OCULTAS, no solo productos:** tema secreto, catálogo oculto, combos exclusivos, sala de coach privada, drops, leaderboard. La app tiene "capas" → obsesión.
- **`<AccessGate/>`** desbloquea categorías/productos/drops/themes/coach-rooms/bundles.
- **Drops = EVENTOS, no "ofertas":** "🔥 Protein Drop · ⏳ 200 cupos · 👑 Solo LEGEND + Vault Access" → urgencia, screenshots, viralidad, status. (Waiting room + countdown realtime + Socket.io.)
- **Afiliados como CURADORES:** emiten vault keys, desbloquean drops, crean campañas privadas, curan productos; comisión dinámica por tier/conversión/retención.
- **Logros de cliente:** Founder, Early Access, Drop Hunter, Elite Buyer, Coach Disciple (en perfil/checkout/rankings/drops).

## FASE 4 — AI + Adaptive System  ⏳ (futuro)
- **Adaptive OS:** el OS reacciona a macros/compras/sueño/rutina/coach/streak → cambia recomendaciones, combos, reminders, intensidad, drops sugeridos.
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
