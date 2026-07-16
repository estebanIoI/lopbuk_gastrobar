# Customer Engagement Platform (P1)

> Subproducto completo dentro de DAIMUZ. La wallet es un canal; el producto es
> la retención automática de clientes impulsada por datos, eventos e IA.

## 🎯 Propósito

Plataforma de engagement para comercios locales: capturar clientes vía QR/link,
conocerlos vía CRM 360°, fidelizarlos con puntos+niveles+streaks, y retenerlos
con automatizaciones multi-canal. Google Wallet es el canal inicial.

## 🧩 Arquitectura

```
customer-engagement/
├── customer-engagement.service.ts   -- CRM, puntos, niveles, wallet, geo, campañas, segmentos, analytics, streaks, timeline, 360°
├── customer-engagement.controller.ts -- 21 handlers HTTP
├── customer-engagement.routes.ts    -- 22 endpoints (2 público, 7 cliente, 13 admin)
├── engagement-events.ts             -- Customer Event Bus (6 tipos de evento)
├── automation-engine.ts             -- Motor desacoplado: 5 trigger evaluators + 4 action executors
├── providers/
│   ├── wallet-provider.interface.ts -- Contrato WalletProvider
│   └── google-wallet.provider.ts    -- Google Wallet API (JWT auth)
└── index.ts

frontend/components/wallet/
├── wallet-card.tsx           -- Tarjeta digital premium (compact + full)
├── customer-360.tsx          -- Panel lateral 360° con 8 secciones
├── customer-timeline.tsx     -- Timeline cronológico
├── live-activity-feed.tsx    -- Feed en vivo
└── ai-insights.tsx           -- Recomendaciones IA
```

## 🗄️ Tablas DB

| Tabla | Propósito | Nueva? |
|---|---|---|
| `loyalty_accounts` | Cuenta CRM extendida | Extendida |
| `loyalty_config` | Config wallet + geo + puntos | Extendida |
| `loyalty_rewards` | Catálogo con tipos condicionales | Extendida |
| `loyalty_transactions` | Historial de puntos | Sin cambios |
| `engagement_campaigns` | Campañas multi-canal | Nueva |
| `engagement_automations` | Reglas de automatización | Nueva |
| `engagement_events` | Event log del Event Bus | Nueva |
| `engagement_segments` | Segmentos dinámicos | Nueva |
| `engagement_notes` | Notas internas por cliente | Nueva |

## 🔄 Customer Event Bus

Eventos emitidos por la plataforma:

| Evento | Origen | Handlers |
|---|---|---|
| `points_earned` | loyalty.routes.ts::earnPoints() | Recalcula nivel, ejecuta automations |
| `level_up` | service::recalculateLevel() | Notifica, ejecuta automations |
| `sale_completed` | POS, orders, restbar | Recalcula nivel |
| `geo_enter` | reportLocation() | Dispara push si configurado |
| `redemption` | Canje de recompensa | Registra analytics |
| `pass_installed` | Wallet generado | Métricas adopción |

## 🤖 Automation Engine (desacoplado)

```
index.ts → automationEngine.tick() (cada 15 min)
              ↓
         Trigger Evaluators (5):
         - time_of_day, inactive_7d, inactive_30d, birthday, near_reward
              ↓
         Action Executors (4):
         - push, notification, whatsapp, wallet_update
```

Para agregar nuevo trigger: `triggerEvaluators.set('nuevo', evaluatorFn)`.

## 👤 Customer 360°

Panel lateral con 8 secciones:

| Sección | Contenido |
|---|---|
| Resumen | KPIs + tarjeta wallet + productos favoritos |
| Timeline | Cronología de todos los eventos |
| Compras | Ventas POS + pedidos online |
| Wallet | Estado del pass + provider |
| Recompensas | Historial de canjes |
| Segmentos | Segmentos a los que pertenece |
| Predicción IA | Churn prob, return prob, LTV, frecuencia, ticket promedio |
| Notas | Notas internas del equipo |

## 🌐 Endpoints (22)

### Públicos (2)
| Método | Ruta |
|---|---|
| POST | `/api/engagement/register` |
| GET | `/api/engagement/lookup` |

### Cliente (7)
| Método | Ruta |
|---|---|
| GET | `/api/engagement/me/wallet` |
| POST | `/api/engagement/me/pass` |
| POST | `/api/engagement/me/redeem` |
| POST | `/api/engagement/me/location` |
| GET | `/api/engagement/me/streak` |
| POST | `/api/engagement/me/daily-reward` |

### Admin (13)
| Método | Ruta |
|---|---|
| GET/PUT | `/api/engagement/config` |
| GET | `/api/engagement/customers` |
| GET | `/api/engagement/customers/:id` |
| GET | `/api/engagement/customers/:id/360` |
| GET | `/api/engagement/customers/:id/timeline` |
| POST | `/api/engagement/customers/:id/notes` |
| GET | `/api/engagement/rewards` |
| GET/POST | `/api/engagement/campaigns` |
| GET/POST | `/api/engagement/segments` |
| POST | `/api/engagement/segments/recompute` |
| GET/POST/PATCH/DELETE | `/api/engagement/automations` |
| GET | `/api/engagement/analytics` |
| GET | `/api/engagement/live-activity` |
| GET | `/api/engagement/ai-insights` |

## 🎮 Gamificación

- **Niveles:** Bronze → Silver → Gold → Platinum (por visitas + gasto)
- **Streaks:** Rachas de días consecutivos con milestones (3/5/7/10/15/30 días → bonus puntos)
- **Daily Reward:** Check-in diario que otorga puntos al alcanzar milestones

## 📱 Frontend

- Landing `/wallet/[slug]` — registro <20s + "Agregar a Google Wallet"
- Panel admin `/fidelizacion` — 8 tabs
- Customer 360° — panel lateral completo con 8 secciones
- Live Activity Feed — eventos en tiempo real
- AI Insights — recomendaciones accionables

## ⏳ Roadmap

| Fase | Qué |
|---|---|
| ✅ Fase 1 | Captura + Wallet + Puntos + CRM + Event Bus |
| ✅ Fase 2 | Automatizaciones + Campañas + Segmentación + Analytics |
| ✅ Fase 3 | Customer 360° + Timeline + AI Insights + Live Activity + Streaks |
| 🔜 Fase 4 | Journey Builder visual + AI Copilot + Wallet Designer |
| 🔜 Fase 5 | Revenue Attribution + Benchmark + Marketplace recompensas |
