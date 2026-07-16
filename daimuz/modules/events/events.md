# 🎫 Events — Bounded Context

> Experience Platform para Lopbuk. Gestiona eventos, venta de entradas, check-in y trazabilidad completa.
> **Estado:** RC1 — Aprobado para Beta Operativa Controlada.

## Arquitectura

```
modules/events/
├── events.bus.ts              ← DomainEventBus (32 eventos) + InMemory impl
├── events.bus-interface.ts    ← Interfaz desacoplada (Ready for Redis/RabbitMQ/Kafka)
├── events.state-machine.ts    ← 3 StateMachines: Event (10 estados), Booking (8), Ticket (4)
├── events.policy.ts           ← Policy Engine central (ventanas, edad, max tickets, refund)
├── events.capacity.ts         ← Capacity Engine unificado (disponibilidad, soldOut, waitlist)
├── events.scheduler.ts        ← 4 jobs: hold-cleaner, stale-bookings, waitlist-promote, close-events
├── events.notifications.ts    ← Orchestrator (WhatsApp, Email, Push, In-App) — suscriptor de EventBus
├── events.analytics-engine.ts ← Métricas reactivas + product funnel
├── events.logger.ts           ← TraceID + 23 acciones tipadas
├── events.timeline.ts         ← Logs → entries descriptivas con iconos
├── events.features.ts         ← Feature flags por tenant (dynamicPricing, wallet, transfer...)
├── events.booking.service.ts  ← Flujo: Hold→Checkout→PaymentIntent→Webhook→QR→Check-in
├── events.service.ts          ← CRUD: eventos, venues, seat maps, ticket types, analytics
├── events.controller.ts       ← 36 handlers
├── events.routes.ts           ← 39 endpoints (8 públicos, 31 autenticados)
├── events.types.ts            ← DTOs
└── index.ts                   ← Barrel export
```

## Flujo de compra

```
Cliente → POST /public/:slug/hold (10 min TTL)
        → POST /public/:slug/checkout
        → paymentsService.createCheckout({ context: 'event_booking' })
        → redirect Wompi
        → Webhook → onApproved → confirmBooking
        → Booking confirmed + QR HMAC + EventBus.emit('BookingConfirmed')
        → NotificationOrchestrator → WhatsApp + Email + In-App
        → AnalyticsEngine → métricas actualizadas
```

## Endpoints clave

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/api/events/public?slug=` | Público |
| GET | `/api/events/public/:slug` | Público |
| POST | `/api/events/public/:slug/hold` | Público |
| POST | `/api/events/public/:slug/checkout` | Público |
| GET | `/api/events/health` | Público |
| GET | `/api/events/superadmin/stats` | Superadmin |
| GET | `/api/events/:id/timeline` | Comercio |
| GET | `/api/events/:id/analytics` | Comercio |
| POST | `/api/events/checkin/:id/ticket/:code` | Staff |

## Blindajes activos

| Riesgo | Blindaje |
|--------|---------|
| Webhook duplicado | Dedup `external_reference` + booking status check |
| Último ticket (race) | `UPDATE ... WHERE capacity=0 OR tickets_sold+? <= capacity` + `affectedRows` |
| QR alterado | HMAC-SHA256 verification |
| QR repetido | `ticket_ya_usado` con timestamp + operador |
| Transferencia | `ticket_version++` en BD y QR payload |
| Hold expirado | Cleaner 60s + validación en checkout |
| Check-in doble | `FOR UPDATE` + status check atómico |

## Tablas (13 nuevas)

`event_venues`, `event_seat_maps`, `merchant_events` (extendida +14 cols), `event_ticket_types`, `event_seat_holds`, `event_bookings`, `event_booking_items`, `event_payment_transactions`, `event_coupons`, `event_transfers`, `event_waitlists`, `event_logs`

## Migraciones

| # | Contenido |
|---|-----------|
| 0044 | 10 tablas + 14 ALTER merchant_events + 14 FK + 10 índices |
| 0045 | `ticket_version` en booking_items |
| 0046 | `event_logs` + `trace_id` en holds/bookings + 3 índices |
| 0047 | `event_waitlists` (10 cols) |

## Integración con ecosistema

| Sistema | Integración |
|---------|------------|
| Payments | Nuevo context `'event_booking'` en `createCheckout` + `onApproved` |
| WhatsApp | NotificationOrchestrator → `sendTextMessage()` |
| In-App | `merchant_notifications` table |
| Scheduler | `startScheduler()` registrado en `index.ts` boot |

## Frontend

| Ruta | Componente |
|------|-----------|
| `/panel/eventos` | `event-backoffice.tsx` (stats, lista, calendario, timeline, editor) |
| `/evento/[slug]` | Landing pública (hero, countdown, ticket selector, checkout) |
| `/evento/ticket/[code]` | Ticket digital (QR, info, descargar) |

## Definition of Done (Beta)

- No lógica de negocio en Controllers
- No reglas fuera del Policy Engine
- No validaciones de estado fuera de StateMachines
- Todo side effect por EventBus
- Ningún servicio llama directamente a WhatsApp/Email/Push
- Disponibilidad solo por Capacity Engine
- Ningún módulo nuevo depende internamente de Events

## Criterios para Experience Core

Extraer cuando ≥2 de:
- 2+ módulos consumen PolicyEngine
- 2+ módulos consumen CapacityEngine
- 2+ módulos consumen StateMachine
- 2+ módulos publican en DomainEventBus
