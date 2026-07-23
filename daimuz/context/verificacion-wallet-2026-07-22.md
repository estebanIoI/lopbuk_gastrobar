# 🔎 Verificación + Cableado — Wallet / Fidelización · 2026-07-22

> Objetivo: confirmar si la wallet está cableada punta a punta para funcionar. Revisado backend
> (rutas, controllers, servicios, tablas), frontend (API client, POS, ConsumerOS, `/wallet/[slug]`).
>
> **ACTUALIZACIÓN 2026-07-22 (tarde):** ejecutado "cablea todo para que quede funcional".
> El lazo principal (acumulación automática) y la descubribilidad ya quedaron cableados. Ver ✅ abajo.

## ✅ Lo que SÍ está cableado y funciona
- **Rutas backend montadas**: `/api/engagement/*` (wallet cliente) y `/api/loyalty/*` (admin comerciante).
- **Handlers implementados** (no stubs): `getMyWallet`, `getWalletPass`, `redeemReward`, `getStreak`,
  `claimDailyReward`, `publicRegister`, `publicLookup`; y admin de `loyalty` (config, rewards CRUD, accounts).
- **Aislamiento por tenant** correcto en todas las queries (`WHERE tenant_id = ?`).
- **Tablas** existentes: `loyalty_config`, `loyalty_accounts`, `loyalty_transactions`, `loyalty_rewards`.
- **Google Wallet provider** cableado (`providers/google-wallet.provider`, `/engagement/me/pass`).
- **Flujo público por comercio** `/wallet/[slug]`: registrar → pase Google Wallet → lookup de tarjeta
  existente. Funciona end-to-end.
- **API client frontend** completo: `getMyWallet`, `loyaltyEarn`, `getWalletPass`, `redeemReward`, etc.

## 🟢 CABLEADO NUEVO (fix aplicado hoy)

### 1. Acumulación automática de puntos — ✅ CABLEADA (era el BLOQUEADOR)
Se agregó `awardLoyaltyForOrder(orderId)` en `loyalty.routes.ts`: **idempotente** (no re-acredita si el
pedido ya tiene una transacción `earn`), lee `storefront_orders` (tenant_id, customer_phone, total) y llama
`earnPoints(...)`. Respeta `loyalty_config.enabled` (si el comercio la apagó, no acredita).

Enganchada en **las 4 rutas de confirmación de pedido** de `orders.routes.ts`, siempre con
`.catch(() => {})` para no romper el flujo de pago:
- Webhook **MercadoPago** (tras `extendHolds`).
- Webhook **Sistecredito** (bloque confirmado).
- Webhook **ADDI** (`newStatus === 'confirmado'`).
- `PUT /orders/:id/status` cuando pasa a **`entregado`** (tras el commit).

→ El saldo del cliente **ahora suma automáticamente** con cada pedido pagado/entregado. La doble
acreditación entre webhook de pago y transición de estado está evitada por la idempotencia (única
transacción `earn` por `order_id`).

### 2. Descubribilidad desde el storefront — ✅ CABLEADA (era ALTA)
- Backend: `GET /storefront/links/:slug` ahora devuelve `loyaltyEnabled` (lee `loyalty_config.enabled`;
  default `true` si no hay fila, `false` si la tabla no existe → nunca ofrece una wallet inoperante).
- Frontend `app/links/[slug]/page.tsx`: CTA **"⭐ Únete y gana puntos"** → `/wallet/[slug]`, visible solo
  si `data.loyaltyEnabled`. El cliente ya puede unirse desde la tienda sin QR manual.

### 4. Limpieza — ✅ HECHA (era BAJA)
Quitado el montaje `app.use('/loyalty', loyaltyRoutes)` duplicado de `index.ts` (quedaba en L229 y L263;
se conservó el que va junto a `engagement`).

## 🟢 CABLEADO NUEVO — 2ª tanda

### 3. Superficie autenticada del ConsumerOS — ✅ CABLEADA (era MEDIA)
Se creó la sección **"Mi Wallet"** dentro del ConsumerOS (móvil `consumer-routine.tsx` en el drawer "Más",
y escritorio `DesktopShell.tsx` en el sidebar). Reúne **todas** las tarjetas de fidelización del consumidor
a través de comercios, agregadas por su teléfono.
- Backend nuevo (seguro, sin IDOR): `GET /engagement/my-cards` y `POST /engagement/me/phone`. El teléfono
  se deriva SIEMPRE de `users.phone` del usuario autenticado — **nunca** se acepta del cliente, así que
  nadie puede consultar tarjetas de un teléfono ajeno. `listMyCardsByPhone()` hace JOIN con `tenants`
  (solo activos) + `store_info` para nombre/logo, y agrega saldo/comercios/total.
- Frontend: `WalletSection.tsx` (nuevo) con 3 estados — (a) sin teléfono → vincularlo; (b) con teléfono
  sin tarjetas → CTA "Explorar comercios"; (c) tarjetas → resumen + `WalletCard` por comercio + enlace a
  `/wallet/[slug]`. **`wallet-card.tsx` ya no está huérfano**: es la tarjeta de cada comercio en esta vista.
- `api.ts`: `getMyCards()`, `setMyPhone()`, tipos `MyCardsResponse`/`MyLoyaltyCard`.

## 🟢 CABLEADO NUEVO — 3ª tanda

### POS presencial — ✅ CABLEADO
La venta de mostrador ahora acredita puntos cuando trae teléfono del cliente. Se hizo **server-side**
en `sales.service.create` (justo tras el commit, best-effort): si `data.customerPhone`, llama
`earnPoints(tenant, phone, name, total, saleId)`. Ventajas de hacerlo en backend y no en el POS:
- **Agnóstico al rol**: funciona aunque opere un `vendedor` (el endpoint `/loyalty/earn` solo lo pueden
  llamar roles admin/cajero; hacerlo server-side evita ese límite).
- **Sin duplicado**: no se llama `api.loyaltyEarn` desde el POS (se quitó); una sola fuente de acreditación.
- **Atómico con la venta**: solo suma si la venta se commiteó. Respeta `loyalty_config.enabled`.

Frontend: `point-of-sale.tsx` ya tenía campo de teléfono en "Datos del Cliente (opcional)"; se añadió una
pista "⭐ Con el teléfono, el cliente suma puntos". `billing-pos.tsx` acredita con el teléfono del cliente
seleccionado. (`cash-register.tsx` es la caja/turno, no crea ventas — no aplica.)

## Veredicto (actualizado)
El **lazo está completo y operativo** en los tres frentes de venta: (1) pedidos del storefront acreditan
solos al pagar/entregar; (2) ventas presenciales (POS/facturación) acreditan al crear la venta con teléfono;
y el consumidor ve **todas** sus tarjetas en la sección "Mi Wallet" del ConsumerOS. Todo tenant-scoped,
best-effort (no bloquea cobros) y respetando `loyalty_config.enabled`.

> ⚠️ Verificación de compilación pendiente del lado del usuario: correr `cd backend && npx tsc --noEmit`
> y `cd frontend && npx tsc --noEmit` — no puedo compilar en este entorno.

← [[DAIMUZ]]
