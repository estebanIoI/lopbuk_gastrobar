# Roadmap — Módulo Afiliados / Promotores

> Estado al 2026-06-17. Backend Sprints 1–4 implementados (falta deploy). Frontend pendiente.

## ✅ Hecho (backend)

- **Sprint 1 — Schema:** 10 tablas vía migración inline idempotente en `backend/src/index.ts`
  (`affiliates`, `affiliate_campaigns` polimórfica, `affiliate_conversions`, `affiliate_commissions`,
  `affiliate_withdrawals`, `affiliate_missions`, `affiliate_mission_submissions`, `merchant_events`,
  `affiliate_packages`, `affiliate_package_orders`). Referencia `migrations/005_affiliates.sql`.
  Tipos en `modules/affiliates/affiliates.types.ts`.
- **Sprint 2 — Core:** `affiliates.service.ts` + `affiliates.routes.ts` (`/api/affiliates`).
  Auth propia del promotor (bcrypt + JWT `type:'affiliate'`). Rutas promotor/superadmin/comercio.
- **Sprint 3 — Paquetes (pago inmediato):** CRUD paquetes, contratación, `markPackagePaid`
  (acredita wallet al instante, transaccional), entrega y completado.
- **Sprint 4 — Atribución por enlace:** `attributeOrder` + `runAutoApprovals`; hook en
  `POST /orders/public` (`refToken`); captura `?ref=` en Tema 2; endpoint `/admin/run-approvals`.

## ⏳ Pendiente

### Sprint 4b — Hook POS por código (cuando exista flujo de código en ventas)
- `sales.service` hoy NO procesa códigos de descuento (aplica montos). Métodos listos:
  `affiliatesService.lookupAffiliateCode(code, tenantId)` y `attributeSaleByCode(...)`.
- Enganchar ANTES del flujo de cupones cuando se agregue código de descuento al POS/checkout.

### Sprint 4c — Cron de auto-aprobación
- Llamar `POST /api/affiliates/admin/run-approvals` periódicamente (tarea programada diaria)
  o engancharlo a un `setInterval` en `index.ts` tras `app.listen`.

### Sprint 5 — Tier Engine + reset mensual
- Endpoint `POST /api/affiliates/admin/recalculate-tiers` (cron mensual):
  `UPDATE affiliates SET monthly_sales = 0` + recalcular `tier` según `TIER_RULES`
  (bronze 0–10 / silver 11–50 / gold 50+). El tier ajusta la comisión base de nuevas campañas.
- (`monthly_sales` ya se incrementa al aprobar conversiones en `runAutoApprovals`.)

### Sprint 6 — Portal del promotor (frontend) → `/promotor`
- Rutas: `page.tsx` (landing/registro), `login`, `dashboard` (wallet+métricas), `campaigns`
  (mis campañas + generador de link/código), `missions`, `leaderboard`, `history`.
- Componentes en `components/affiliates/`: `wallet-card`, `campaign-generator`, `metrics-chart`
  (recharts), `tier-badge`, `leaderboard-table`, `mission-card`, `conversion-log`,
  `package-catalog`, `package-order-card`.
- API client: agregar métodos a `lib/api.ts` (afiliado usa cookie `affiliateToken` o Bearer).

### Sprint 7 — Panel del comercio (frontend)
- Sección "Promotores que me representan" (consume `/api/affiliates/tenant/overview` y `/tenant/conversions`).
- Contratar paquete (`/tenant/packages` + `POST /tenant/package-orders`), ver/completar contrataciones.

### Sprint 8 — Tab superadmin (frontend)
- `components/superadmin/tabs/AffiliatesTab.tsx`: KPIs (`/admin/analytics`), tabla de promotores
  (`/admin/affiliates` + status), bandeja de pagos (retiros `/admin/withdrawals` + paquetes
  `/admin/package-orders/:id/pay`), CRUD misiones, revisión de envíos, CRUD paquetes.

## Decisiones de arquitectura (confirmadas)
1. **Auth promotor:** propia (`password_hash` + JWT `type:'affiliate'`), sin tocar el enum `role` de users.
   (Si se quiere unificar con la cuenta DAIMUZ, enlazar por `affiliates.user_id` en Sprint 6.)
2. **Ventana de atribución:** configurable por campaña, default 7 días (`cookie_days`).
3. **Aprobación de conversiones:** automática por tiempo (`runAutoApprovals`), con override manual posible.
4. **Pago de retiros/paquetes:** manual por superadmin (Nequi/Daviplata). Stripe se engancha sobre
   `markPackagePaid` / un flujo de retiro más adelante.

## Endpoints ya disponibles (`/api/affiliates`)
- Promotor: `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `GET /me/campaigns`,
  `POST /campaigns`, `GET /campaigns/:id/metrics`, `GET /me/conversions`, `GET /me/commissions`,
  `GET /me/withdrawals`, `POST /withdrawals`, `GET /leaderboard`, `GET /missions`,
  `POST /missions/:id/submit`, `GET /packages`, `GET /me/package-orders`, `PATCH /me/package-orders/:id/deliver`.
- Comercio: `GET /tenant/overview`, `GET /tenant/conversions`, `GET /tenant/packages`,
  `POST /tenant/package-orders`, `GET /tenant/package-orders`, `PATCH /tenant/package-orders/:id/complete`.
- Superadmin: `GET /admin/analytics`, `POST /admin/run-approvals`, `GET /admin/affiliates`,
  `PATCH /admin/affiliates/:id/status`, `GET /admin/withdrawals`, `PATCH /admin/withdrawals/:id`,
  `GET/POST/PATCH /admin/missions`, `GET /admin/submissions`, `PATCH /admin/submissions/:id`,
  `GET/POST/PATCH/DELETE /admin/packages`, `GET /admin/package-orders`, `PATCH /admin/package-orders/:id/pay`.
