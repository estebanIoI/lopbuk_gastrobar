# Events — Quick Ref

> **Estado:** RC1 — Beta aprobada. Arquitectura congelada.

**Endpoints clave:** 39 total (8 públicos). Ver `events.md`.
**Tablas:** 13 (migraciones 0044-0047).
**Frontend:** `/panel/eventos`, `/evento/[slug]`, `/evento/ticket/[code]`.

**Flujo:** Hold(10min) → Checkout → PaymentIntent(context:event_booking) → Webhook → Booking+QR → EventBus → Notifications

**Blindajes:** Webhook idempotencia, venta atómica (affectedRows), QR HMAC, ticket_version, FOR UPDATE check-in, hold cleaner 60s.

**Engines:** EventBus(32 eventos), StateMachine(3), Policy, Capacity, Scheduler(4 jobs), Notifications(4 canales), Analytics, Logger(TraceID), Timeline, Features.

**DoD:** Sin lógica en controllers · reglas en Policy · estados en StateMachine · side effects por EventBus · capacidad por CapacityEngine.
