# Plan — Marketplace de Entrenadores (Coach Marketplace)

> Estado: propuesta (2026-06-22). El usuario fitness contrata y PAGA a entrenadores
> registrados DENTRO del Consumer OS; DAIMUZ captura el dinero y retiene comisión.
> Construye sobre: **Afiliados** (motor de comisiones/payouts), **Wompi** (captura),
> **Consumer Plans/LEGEND** (gating + entitlement `coach_priority`), **rutina** (entrega
> del plan), patrón de **gym_membresias** (precios/ciclos). Lectura previa:
> `roadmap-afiliados.md`, `plan-consumer-os.md`.

---

## 0. Idea en una frase
El entrenador publica **combos/sesiones** (rutina + nutrición a medida, asesorías),
el usuario los paga por la app, DAIMUZ **captura y retiene comisión**, y el plan se
entrega dentro del OS del usuario. La app deja de ser solo storefront y se vuelve la
**capa de monetización y entrega** del coaching.

---

## 1. Modelo de negocio (números)
El entrenador cobra **desde 500.000 COP**; DAIMUZ retiene ~**100.000**.

| Modelo | A 500k | A 1M | Para |
|---|---|---|---|
| Comisión **20%** | 100k | 200k | Upside para la app |
| Tarifa fija 100k | 100k (20%) | 100k (10%) | Predecible para el coach |
| **Híbrido 20% con mínimo 100k** *(recomendado)* | 100k | 200k | Garantiza piso y escala |

Ojo: la pasarela (Wompi ≈ 2,65%+IVA por transacción) se descuenta aparte. Para netar
100k en el piso, subir comisión a ~23% o pasarle el costo de pasarela al coach.

---

## 2. Modelo de datos (nuevo, sobre lo existente)

```
trainers                          trainer_offers (combos/sesiones)
──────────────────────            ──────────────────────
id (uuid)                         id
user_id  ── FK users (opcional)   trainer_id ── FK trainers
name, handle, bio                 title, description
photo_url, specialties json       kind enum(plan|sesion|mensual|combo)
status enum(pending|active|susp.)  price_cop        (≥ 500000)
commission_pct  (def. 20)          duration_days    (vigencia del servicio)
rating_avg, sessions_count         deliverables json (rutina, nutrición, asesorías…)
password_hash (auth propia)        is_active
created_at                         created_at

trainer_bookings (contratación)   trainer_commissions (reparto)
──────────────────────            ──────────────────────
id                                id
offer_id ── FK trainer_offers     booking_id ── FK trainer_bookings
trainer_id, user_id               trainer_id
amount_cop                        gross_cop, platform_cop, trainer_cop
platform_cop, trainer_cop         gateway_fee_cop
status enum(pending|paid|         status enum(pending|available|paid)
  delivered|completed|refunded)   created_at
wompi_reference                   
started_at, expires_at            trainer_reviews
gateway_payment_id                ──────────────────────
created_at                        id, booking_id, user_id, rating, comment, created_at
```

`trainer_offers.deliverables` (JSON) define QUÉ entrega el combo (p.ej. rutina + plan de
comidas + N asesorías) → al pagar, se materializa en el módulo **rutina** del usuario.

---

## 3. Flujo de pago (captura + comisión + payout)
1. Usuario elige un combo → `POST /trainers/bookings` crea booking `pending`.
2. **Wompi**: reusa el checkout público que ya existe (`createCheckout` context nuevo
   `coach_booking`; el monto se resuelve del `offer.price_cop` en el servidor).
3. Webhook `onApproved` → booking `paid`; se calcula la comisión:
   `platform_cop = max(min_cop, round(amount * commission_pct/100))`, `trainer_cop =
   amount - platform_cop - gateway_fee`, y se acredita a `trainer_commissions`.
4. **Entrega**: se ejecutan los `deliverables` (crea rutina/plan en `rutina` del usuario,
   habilita chat/asesoría). Booking → `delivered`.
5. **Payout al entrenador**: manual por superadmin (Nequi/Daviplata) — reusa el patrón de
   `affiliate_withdrawals`. El saldo del coach sale de `trainer_commissions` disponibles.

> Seguridad: monto y tenant/owner resueltos en el SERVIDOR desde la oferta (nunca del
> front). Llaves Wompi de plataforma (mismas que suscripciones). Filtrado por ids.

---

## 4. Roles y auth
- **Auth del entrenador**: propia (`password_hash` + JWT `type:'trainer'`), igual que el
  promotor de afiliados — sin tocar el enum `role` de users. (Enlazable a `user_id`.)
- Superadmin aprueba entrenadores (`status pending→active`) y paga payouts.
- El usuario fitness contrata desde su Consumer OS (autenticado).

---

## 5. Entrega dentro del Consumer OS
- Nueva sección/tab **"Coach"** en el OS: catálogo de entrenadores + combos, "Mis
  asesorías", chat con el coach, y el plan entregado aparece en **Rutina/Plan**.
- **Entitlement `coach_priority`** (LEGEND): prioridad de respuesta / cupos / descuento en
  combos → gatea con `LegendGate` (ya existe).

---

## 6. Reúsa lo existente
Afiliados (motor de comisiones, payouts, auth propia, leaderboard) · Wompi
(`payments.service` captura + webhook) · Consumer Plans (gating + `coach_priority`) ·
`rutina` (entrega de rutina/nutrición) · patrón `gym_membresias` (precio/ciclo) ·
`requireEntitlement` / `LegendGate` (gates) · analytics `consumer_events`.

---

## 7. Roadmap por sprints
- **T1 — Schema + auth** (`trainers`, `trainer_offers`, `trainer_bookings`,
  `trainer_commissions`, `trainer_reviews`; migración idempotente; JWT `type:'trainer'`).
- **T2 — Catálogo + ofertas** (CRUD de ofertas del coach; listado público en el OS).
- **T3 — Contratación + Wompi** (booking + checkout público `coach_booking` + webhook +
  cálculo de comisión transaccional).
- **T4 — Entrega** (materializar `deliverables` en `rutina`; estado del booking; chat).
- **T5 — Payouts superadmin** (saldo del coach + retiros, patrón afiliados).
- **T6 — Portal del entrenador** (`/coach`: dashboard, ofertas, ventas, reviews, retiros).
- **T7 — Sección Coach en el OS** (catálogo + mis asesorías + `coach_priority`).
- **T8 — Reviews + ranking + analytics**.

---

## 8. Decisiones a confirmar
1. **Comisión**: ¿20% fijo, tarifa fija 100k, o híbrido 20% con mínimo 100k? (recomiendo híbrido).
2. **¿La pasarela la absorbe la plataforma o el entrenador?** (recomiendo entrenador, para netar 100k).
3. **Payout**: ¿manual (Nequi) al inicio, o automatizado más adelante?
4. **Auth del coach**: propia (recomendado) o ligada a `users.role`.

## 9. Riesgos / guardas
- Monto siempre del servidor (anti-manipulación). · Comisión calculada en transacción
  (anti-doble). · Reembolsos: revertir comisión + marcar booking `refunded`. · Multi-tenant
  N/A (los entrenadores son de plataforma, como afiliados) — excepción consciente.
