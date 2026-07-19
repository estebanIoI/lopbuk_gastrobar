# Plan Quirúrgico — Motor de Crecimiento (Growth Engine)

> Estado: propuesta (2026-07-19). Objetivo: convertir toda la información que ya generan
> los módulos de DAIMUZ (POS, CRM, inventario, fidelización, IA, analítica, finanzas,
> marketing) en **recomendaciones automáticas** que digan al comerciante *cuánto invertir,
> qué promocionar, qué pausar y a quién volver a venderle*. DAIMUZ deja de ser "otro
> software de gestión" y pasa a ser un **copiloto de crecimiento**: se vende **resultado,
> no módulo**.
>
> Planes hermanos: `plan-maestro-daimuz-os.md` (loops), `plan-orquestacion-ia.md` (LLM barato).

---

## 0. Tesis (lo que este plan cambia)

La publicidad **amplifica** negocios, no los arregla. DAIMUZ ya mejora el negocio por debajo
(inventario, ventas, procesos, fidelización). El Motor de Crecimiento es la **capa que lee
todo eso y da dirección comercial**. No es un módulo más: es una capa de *lectura + decisión*
por encima de los módulos existentes.

**Regla de oro:** el Growth Engine **no genera datos nuevos**, los **interpreta**. Todo dato
que necesita ya existe en una tabla. Prohibido duplicar lógica de negocio: consume services.

De vender features → a vender resultados:

| Antes (feature) | Ahora (resultado) |
|---|---|
| "Tengo CRM" | "Sube la recompra: 12 clientes están listos para volver esta semana" |
| "Tengo campañas" | "Puedes invertir $800.000 más en Meta sin tocar tu utilidad" |
| "Tengo inventario" | "No lances esa campaña: solo quedan 14 unidades" |
| "Tengo IA" | "Promociona el producto B, no el A: deja 3× más margen" |

---

## 1. Lo que YA existe y se REUTILIZA (no reconstruir)

| Pieza existente | Ubicación | Rol en el Growth Engine |
|---|---|---|
| **AI Orchestrator** (`textLLM`, `run`, tiering small/main, cache) | `backend/src/modules/ai/orchestrator.service.ts` | Redacta y prioriza recomendaciones con LLM **barato**. NO se crea IA nueva. |
| **AI Insights** (churn risk, near level, best day) | `customer-engagement.service.ts` | Semilla de señales de cliente; el motor las consume y las convierte en acción. |
| **Automation Engine** (5 triggers + 4 actions, desacoplado) | `customer-engagement/automation-engine.ts` | Ejecuta la acción cuando el usuario acepta una recomendación (campaña, WhatsApp, cupón). |
| **Dashboard/analítica** (KPIs en vivo) | `modules/dashboard/dashboard.service.ts` | Fuente de ventas/embudo; el motor lee, no recalcula. |
| **Finances** (flujo de caja, márgenes) | `modules/finances/finances.service.ts` | Fuente de margen y utilidad para los guardrails de gasto. |
| **Inventory + sede_stock** | `modules/inventory/*` | Cobertura de stock y tiempo de reposición → freno de campañas. |
| **Event Bus** (engagement-events, EventBus de events) | varios | El motor se suscribe; recalcula señales sin polling pesado. |

El Growth Engine es **pegamento inteligente**, no un silo.

---

## 2. Arquitectura objetivo — módulo `growth`

Nuevo bounded context `backend/src/modules/growth/` siguiendo el patrón estándar
(`*.service.ts` = lógica, controller, routes, index). Tres capas internas:

```
        ┌──────────────────── módulo growth ────────────────────┐
  datos │  1. Fact Layer      → snapshot diario por tenant       │
  (read)│     (lee dashboard/finances/inventory/CRM services)    │
        │                                                        │
  reglas│  2. Rule Engine     → guardrails determinísticos       │
        │     (margen, ROAS, CPA, stock) → señales tipadas       │
        │                                                        │
   IA   │  3. Advisor (LLM)   → narra + prioriza + explica       │
        │     usa ai/orchestrator.textLLM (tier small)           │
        └────────────────────────────────────────────────────────┘
                         ↓ produce
              growth_recommendations (accionables)
                         ↓ al aceptar
              automation-engine ejecuta la acción
```

**Por qué reglas ANTES que IA:** los números que mueven dinero (no exceder CPA, no gastar sin
stock, no pausar algo rentable) deben ser **determinísticos y auditables**. La IA solo redacta,
prioriza y explica en lenguaje del comerciante. Nunca la IA decide sola un monto de gasto:
propone dentro de los límites que calcularon las reglas.

---

## 3. Modelo de datos (mínimo, migración `0053+`)

> Editar `backend/src/db/schema/schema.ts` → `npm run db:generate` → `npm run migrate`.
> Todas con `tenant_id`, soft delete (`is_active`), timestamps. **Prohibido DDL en runtime.**

| Tabla | Para qué | Columnas clave |
|---|---|---|
| `growth_settings` | Guardrails del comerciante (una fila por tenant) | `target_margin_pct`, `min_roas`, `max_cpa`, `restock_lead_days`, `monthly_sales_goal`, `currency` |
| `growth_metrics_daily` | Snapshot consolidado diario (materializa lo caro) | `date`, `revenue`, `orders`, `gross_margin_pct`, `ad_spend`, `roas`, `cpa`, `repeat_rate`, `inventory_cover_days` |
| `growth_recommendations` | Recomendaciones accionables generadas | `type`, `title`, `body`, `severity`, `impact_estimate`, `payload_json`, `status(new/accepted/dismissed/expired)`, `expires_at` |
| `growth_reco_feedback` | Aprendizaje del loop | `recommendation_id`, `action`, `outcome_json` |

`growth_metrics_daily` es la clave de rendimiento: el job nocturno consolida una vez lo que si
no sería un recálculo caro en cada apertura del panel.

---

## 4. Los números que mandan (fórmulas fijas)

El motor razona sobre estos KPIs; se definen una sola vez y se reutilizan:

- **Margen bruto %** = (ingresos − COGS) / ingresos. COGS ya sale de recipes/food-cost o
  costo de producto en inventory.
- **CPA** (costo por adquisición) = gasto en ads / clientes nuevos atribuidos.
- **ROAS** = ingresos atribuidos a ads / gasto en ads.
- **ROAS de equilibrio** = 1 / margen bruto. *Si el ROAS real ≤ ROAS de equilibrio → se pierde
  plata en cada venta publicitaria.* Este es el guardrail central del gasto.
- **CPA máximo rentable** = margen bruto por cliente × (1 − colchón). Nunca gastar por encima.
- **Techo de inversión** = margen disponible del mes − utilidad objetivo → "cuánto más puedes
  meter en Meta sin tocar tu utilidad".
- **Cobertura de inventario (días)** = stock actual / venta diaria promedio. Si
  `cobertura < lead_time de reposición` → **frenar campaña de ese producto**.
- **Recompra / repeat rate** y **días-a-recompra** = del CRM (customer-engagement AI Insights).

---

## 5. Catálogo de recomendaciones (las preguntas del usuario → outputs)

Cada `type` = una regla determinística + una narración IA. MVP de 6:

| type | Dispara cuando… | Output al comerciante | Acción 1-clic |
|---|---|---|---|
| `budget_headroom` | ROAS real > ROAS equilibrio y hay margen | "Puedes invertir $X más sin afectar utilidad" | Ajustar presupuesto |
| `pause_campaign` | ROAS < equilibrio o CPA > máximo | "Pausa esta campaña: pierdes $Y por venta" | Marcar para pausar |
| `stock_guard` | Cobertura < lead time con campaña activa/planeada | "No promociones X: solo Z unidades / N días" | Bloquear/avisar compra |
| `promote_margin` | Producto con alto margen + buena conversión + stock sano | "Promociona B, deja 3× más margen que A" | Crear campaña/combo |
| `winback` | Clientes con alta prob. de recompra (CRM) | "12 clientes listos para volver esta semana" | Disparar WhatsApp/cupón vía automation-engine |
| `restock_alert` | Venta proyectada supera stock antes del lead time | "Repón X ahora para no quedarte sin vender" | Crear orden de compra |

Todas terminan en una **acción existente** (campaña, WhatsApp, cupón, compra) — el motor no
inventa ejecutores nuevos, engancha `automation-engine` / módulos de compras.

---

## 6. Fases / Slices (ejecución vertical, un loop completo a la vez)

Principio DAIMUZ: completar 1 slice útil antes del siguiente. No hacer "un poco de todo".

**G0 · Fact Layer** *(base, sin UI)*
- Schema `growth_settings` + `growth_metrics_daily` (migración 0053).
- Job nocturno `growth.snapshot.job` por tenant que lee dashboard/finances/inventory/CRM
  services y materializa el snapshot. Idempotente por `(tenant_id, date)`.
- Endpoint `GET /growth/metrics` (lee snapshot). *Entregable: los números existen y se ven.*

**G1 · Guardrails config**
- CRUD `growth_settings` (margen objetivo, ROAS mín, CPA máx, lead de reposición, meta mensual).
- UI: pantalla "Configura tu crecimiento" (wizard con las 6 preguntas del usuario).
- *Entregable: el comerciante define sus límites una vez.*

**G2 · Rule Engine determinístico**
- `growth-rules.service.ts`: las 6 reglas de la §5 → escribe `growth_recommendations`.
- Corre tras el snapshot y en eventos clave (venta grande, stock bajo) vía Event Bus.
- *Entregable: recomendaciones reales, sin IA todavía (texto plantilla).*

**G3 · Advisor IA (capa narrativa)**
- `growth-advisor.service.ts` usa `ai/orchestrator.textLLM({tier:'small'})` para:
  reescribir cada reco en tono claro, priorizar el feed y explicar el "por qué".
- Prefijo de system prompt estable (persona + reglas) para pegarle al cache de Go (barato).
- *Entregable: el copiloto "habla" como asesor, no como reporte.*

**G4 · Panel Copiloto (UI)**
- Feed de recomendaciones (severidad, impacto estimado, acción 1-clic).
- Cada acción engancha ejecutor existente (campaña/WhatsApp/cupón/compra).
- Widget "Semáforo de gasto": puedes invertir / mantén / frena.
- *Entregable: la propuesta de valor visible y vendible.*

**G5 · Loop de feedback**
- Registrar aceptar/descartar + outcome (`growth_reco_feedback`).
- Ajustar prioridad y colchones con lo aprendido; medir uplift real (recompra, ROAS).
- *Entregable: el sistema mejora y demuestra el resultado prometido.*

---

## 7. Integración / Sinapsis (impacto)

```
Ventas (dashboard) ─┐
Finanzas (margen) ──┤
Inventario/sede ────┼─► Fact Layer ─► Rule Engine ─► Advisor IA ─► Feed de recos
CRM/AI Insights ────┤                                                   │
Marketing/ads ──────┘                                    (aceptar) ──► automation-engine ─► campaña/WhatsApp/cupón/compra
```

Crear `daimuz/synapses/growth-chain.md`:
`Snapshot → Reglas → IA → Recomendación → Acción → (nuevo dato) → Snapshot` (loop cerrado).

---

## 8. Governance (reglas que NO se rompen)

- Toda query filtra `WHERE tenant_id = ?`; `tenant_id` viene de `req.user.tenantId`, nunca del body.
- Lógica **solo** en `growth-*.service.ts`. Controllers/routes finos.
- Soft delete (`is_active`), nunca DELETE físico.
- Respuestas `{ success, data }` / `{ success, error }`; errores con `throw new AppError(...)`.
- Esquema por **migración versionada** (Drizzle Kit). Prohibido `CREATE/ALTER TABLE` en runtime.
- Gating por plan de suscripción: el Growth Engine es un **tier premium** (palanca de monetización).
- La IA **nunca** decide un monto de gasto sola: solo propone dentro de límites de las reglas;
  acciones que mueven dinero (subir presupuesto, comprar) exigen confirmación humana
  (`governance/approval-policy`).

---

## 9. No-hacer (evitar sobre-ingeniería)

- No construir un motor de atribución de ads propio en G0–G4: empezar con el gasto/resultado
  que ya se pueda leer o cargar manual; atribución fina es fase posterior.
- No entrenar modelos propios: usar reglas + LLM barato (orchestrator) primero.
- No duplicar KPIs: si dashboard/finances ya calculan algo, se consume, no se recalcula.
- No abrir todos los `type` de reco a la vez: los 6 del MVP, medir, luego ampliar.

---

## 10. Métrica de éxito

El Growth Engine funciona si, para un comercio piloto: (1) sube el **repeat rate** por las
recos de winback, (2) el **ROAS** se mantiene ≥ equilibrio por los guardrails de gasto, y
(3) baja el **dinero desperdiciado en campañas sin stock**. Eso es lo que se vende: no "tengo
IA", sino "tu negocio creció y gastaste mejor".

---

*Motor de Crecimiento v1 — capa estratégica sobre DAIMUZ. Reutiliza ai-orchestrator +
customer-engagement + dashboard + finances + inventory. Migración inicial 0053.*
