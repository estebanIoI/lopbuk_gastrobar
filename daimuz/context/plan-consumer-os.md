# Plan — Consumer OS (Sistema operativo lifestyle premium)

> Estado: arquitectura definitiva (2026-06-21). Evolución del "panel Mi Rutina" a un
> **sistema operativo** donde el usuario vive: fitness + social + compras + IA + membresía.
> Tesis: **el panel es el producto; el marketplace es una función del panel.**
> Construye sobre lo existente: `consumer-routine.tsx` (vistas), módulo LEGEND (G1–G8),
> `rutina`/`gym`, marketplace (`landing-page.tsx`).

---

## 0. Principio rector

| Panel (lo viejo) | Consumer OS (lo nuevo) |
|---|---|
| Se usa "cuando hay algo que hacer" | El usuario **vive** ahí |
| Marketplace = destino | Marketplace = sección ("Explore") |
| Pantalla = features | Pantalla = **ambiente** (FREE minimal vs LEGEND oro/glow) |
| Abre en Tienda | Abre en **Today** (hábito diario) |

Referentes: Apple Fitness, Strava, Discord, Steam, Notion, Duolingo.

---

## 1. Smart Home Routing (mantener `/`, NO crear `/mi-rutina`)

`app/page.tsx` ya ramifica por rol — se formaliza como router:

```
/  →  smart router
   if (!user)               → <MarketplacePublic />   (landing pública actual)
   if (user.role==='cliente')→ <ConsumerOS />          (NUEVO)
   else                     → <MerchantPanel />        (sin cambios)
```

Mantener `/` preserva deep-links (`?store=slug`), SEO interno y evita dos "homes".
Login para `cliente` → `dest = '/'` (con `?next=` respetado).

---

## 2. Un core, dos shells (arquitectura real)

Estructura nueva en `frontend/components/consumer/`:

```
consumer/
  hooks/
    useConsumerData          (carga datos — extrae el load(tab) actual)
    useConsumerPlan          (/me LEGEND: tier, powerDays, milestones)
    useConsumerTheme         (FREE vs LEGEND → CSS vars de ambiente)
    useConsumerEntitlements  (hasEntitlement → gate de features)
  layouts/
    MobileShell              (md:hidden — el actual, tabs inferiores)
    DesktopShell             (hidden md:flex — dashboard OS, NUEVO)
  sections/
    TodaySection  RoutineSection  KitchenSection
    PlansSection  StoreSection(Explore)  GymSection
  widgets/
    MacroRing  WeekStrip  LegendCard  PowerDays
    StreakCard  AIButton  MilestonesGrid  CommandCenter
```

Las **sections** y **widgets** son agnósticas del shell; cada shell las compone distinto.
Primer paso (C1): extraer `useConsumerData` + sections del `consumer-routine.tsx` actual **sin cambiar la UI móvil**.

---

## 3. DesktopShell — premium, NO "el móvil estirado"

Layout de 3 zonas:

```
┌───────────┬──────────────────────┬───────────────┐
│ Sidebar   │ Main Grid (widgets)  │ Command Center│
│ 240–260px │  dashboard, no pages │ AI Insights   │
│ sticky    │                      │ (desktop only)│
│ glass     │                      │               │
└───────────┴──────────────────────┴───────────────┘
```

- **Sidebar** (sticky, glassmorphism): avatar, **LEGEND badge + streak + power days**, botón Asistente IA, navegación vertical (Today · Routine · Kitchen · Plans · Explore · Gym).
- **Main Grid** = widgets, no páginas tradicionales. Ej.:
  `[ Rutina hoy ] [ Macros ]` · `[ Calendario ] [ Compras ]` · `[ IA Coach ] [ Milestones ]`.
- **Command Center** (panel derecho, solo desktop): **AI Insights** vivos — "Hoy estás bajo en proteína", "Racha de 12 días", "Oferta recomendada para tu objetivo", "Tu coach dejó feedback". Hace que el OS se sienta inteligente y vivo.

---

## 4. Today como pantalla inicial (hábito diario)

Al entrar (no en Tienda):

```
🔥 Buenos días, Jhon
87 días LEGEND · Rutina de hoy lista
2300 kcal objetivo · 3 tareas pendientes
```

Genera retorno diario y sensación de progreso. La tienda es secundaria.

---

## 5. Marketplace integrado = "Explore"

- NO sacar al usuario del panel: el storefront (`landing-page`/grid) se monta como **sección "Explore"** dentro del OS. Carrito y checkout intactos.
- Nombre aspiracional **"Explore"** (no "Tienda"). Se siente parte del ecosistema, no otra app.

---

## 6. LEGEND cambia el AMBIENTE (no solo desbloquea)

`useConsumerTheme` aplica CSS variables a todo el OS:

| FREE | LEGEND |
|---|---|
| minimal, gris, limpio | oro, glow, partículas suaves, microanimaciones, depth |

La membresía **transforma el entorno**, no solo habilita features. (El reveal G5 ya existe; esto extiende el tema a todo el shell.)

---

## 7. Microinteracciones (no animaciones pesadas)

Hover glow · progress fill · smooth counters · reactive cards · magnetic buttons.
Reveal LEGEND corto y skippable (ya hecho). Nada de modales pesados ni transiciones lentas.

---

## 8. Roadmap por fases

- **C1** Extraer core: `useConsumerData` + sections + widgets desde `consumer-routine.tsx` (sin cambiar UI móvil). MobileShell = wrapper del actual.
- **C2** Smart router en `app/page.tsx`: `cliente → <ConsumerOS>`; ConsumerOS elige shell por breakpoint. Today como inicial.
- **C3** DesktopShell: Sidebar + Main Grid (widgets). Reusa sections/widgets.
- **C4** "Explore" (marketplace integrado como sección).
- **C5** `useConsumerTheme` (ambiente FREE/LEGEND en todo el OS) + microinteracciones.
- **C6** Command Center (AI Insights) — desktop. Reusa el asistente IA + entitlement `routine_ai`.
- **C7** Conectar `useConsumerEntitlements` a features reales (gate IA/descuentos/combos).

### Evolución del producto
FASE 1 Consumer Panel → **FASE 2 Consumer OS** → FASE 3 AI Companion → FASE 4 Social + Leaderboards + Coach Layer → FASE 5 DAIMUZ Ecosystem.

---

## 9. Decisiones cerradas
1. Ruta: **`/`** (smart router), NO `/mi-rutina`.
2. Marketplace: **integrado como "Explore"**.
3. Pantalla inicial: **Today**.
4. Nombre: **ConsumerOS** (no "ConsumerHome").

## 10. Reúsa lo existente
`consumer-routine.tsx` (vistas) · módulo LEGEND G1–G8 (plan/tema/gamificación) · `rutina`/`gym` (datos) · `landing-page` (Explore) · asistente IA (`rutina.assistant`) para el Command Center · `platform_settings` (config ambiente).

## 11. No romper
Multi-tenant/identidad: datos del consumidor sobre `users.id` (cross-comercio, como `rutina`). Roles: solo `cliente` entra al OS; comerciante/staff → MerchantPanel. Deep-links `?store=` siguen funcionando vía smart router.
