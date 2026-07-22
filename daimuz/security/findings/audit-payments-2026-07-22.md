# 💳 Auditoría de Seguridad — Payments / Finances · 2026-07-22

> Módulo de mayor riesgo económico. Además de BOLA/BFLA, se buscó: firma de webhooks,
> confianza en datos del cliente, idempotencia, replay, cambios de estado no autorizados,
> validación de montos y descuadres pago↔venta. **Lote 1: webhooks de pasarela** (viven en
> `orders.routes.ts`). Pendiente: `payments.service.ts`, `stripe`, `finances`, conciliaciones, wallet.
> ⚠️ No compilado aquí → ver **caveat de despliegue** al final antes de subir.

---

## 🔴 PAY-01 — Confirmación de pago falsa por webhook fail-open (CRÍTICA) — ✅ CORREGIDA

- **Vulnerabilidad:** los webhooks de **Sistecredito** y **ADDI** confían en el `status` enviado en el
  body y **no autentican el origen de forma estricta**:
  - **Sistecredito:** con solo `apiKey` configurada, la validación era `if (receivedKey && receivedKey
    !== apiKey)` → **una `x-api-key` ausente/vacía pasaba** (bypass). Sin `apiSecret` ni `apiKey`: sin
    validación. Además busca la orden por `id OR order_number` (el `order_number` puede ser **enumerable**).
  - **ADDI:** si no hay `addi_webhook_user/password` configurados, **aceptaba el webhook sin auth**
    (solo logueaba un warning). Requiere el UUID de la orden (menos enumerable, pero los UUIDs se filtran).
  - Ninguno **re-verifica el pago contra la API de la pasarela** (a diferencia de MercadoPago, que sí
    consulta `api.mercadopago.com/v1/payments/{id}` y no confía en el body).
- **Severidad:** 🔴 **Crítica** — fraude directo: `POST {reference:"<orderNumber>", status:"approved"}`
  (Sistecredito) o `{orderId, status:"APPROVED"}` (ADDI) **confirma órdenes como pagadas sin pagar** →
  el comercio despacha mercancía gratis. Cadena: fail-open + confianza en body + lookup enumerable.
- **Riesgo:** pérdida económica directa y masiva, automatizable.
- **Evidencia:** `orders.routes.ts` Sistecredito L1471-1479 (`if (receivedKey && ...)`) y ADDI L993
  (`else { warn('aceptando sin auth') }`).
- **Corrección aplicada (fail-closed):**
  - Sistecredito: la `apiKey` ahora es obligatoria (`if (receivedKey !== apiKey) → 401`); y si **no hay
    secreto ni apiKey configurados**, se **rechaza** (401) en vez de procesar.
  - ADDI: si no hay credenciales configuradas, se **rechaza** (401) en vez de aceptar sin auth.
  - Ambos auditan el intento (`audit.webhookInvalidSignature`).
- **Archivos modificados:** `backend/src/modules/orders/orders.routes.ts`.
- **Efectos secundarios:** ⚠️ **importante** — ver caveat de despliegue.

## 🟡 PAY-02 — MercadoPago: firma opcional (BAJA, mitigada) — 📝 documentada
`if (mpWebhookSecret)` omite la verificación de firma si el secreto no está configurado. **Mitigado**
porque el webhook re-consulta el pago real contra la API de MP (no confía en el body). Recomendado:
configurar `mp_webhook_secret` y, opcionalmente, exigir firma (fail-closed) como en Sistecredito/ADDI.

## 🟡 PAY-03 — Sin validación de monto recibido vs esperado (MEDIA) — 📝 recomendada (no auto-aplicada)
Ningún webhook compara el **monto pagado** contra el `total` de la orden antes de confirmar. Un pago
parcial/manipulado por menor monto confirmaría la orden igual. Recomendado: en MercadoPago comparar
`payment.transaction_amount` (y `currency_id`) contra `order.total` (COP = enteros, comparación exacta con
tolerancia mínima); en Sistecredito/ADDI, exigir monto en el payload autenticado o re-verificar por API.
**No aplicado aún:** tocar la confirmación de pago a ciegas puede bloquear pagos legítimos si los montos
divergen por comisiones/redondeo. Requiere validar el dato real de cada pasarela. Lo aplico con tu OK.

## 🟢 Idempotencia / cambios de estado — correcto (en lo revisado)
Los tres webhooks usan `UPDATE ... WHERE status='pendiente'` (o guard equivalente) + chequeo de
`affectedRows` antes de disparar efectos → **idempotentes** ante reintentos/replay de la pasarela. ✅

---

## ⚠️ Caveat de despliegue (leer antes de subir PAY-01)
El fix es **fail-closed**: si en producción Sistecredito/ADDI **no** envían firma/apiKey/Basic-Auth y esas
credenciales **no** están configuradas, las confirmaciones **se rechazarán** (órdenes quedarían
`pendiente` pese al pago). Antes de desplegar, **confirma** que:
1. `mp_webhook_secret`, `apiSecret`/`apiKey` de Sistecredito y `addi_webhook_user/password` estén
   configurados en `platform_settings`/env de producción, y
2. que cada pasarela realmente envía ese header/credencial en sus webhooks.
Si alguna pasarela no soporta autenticación de webhook, la alternativa segura es **re-verificar el pago
contra su API** (como MercadoPago) en vez de confiar en el body — dímelo y lo implemento para esa pasarela.

## 📊 Cobertura (Payments — parcial)
| Componente | N1 Auth | N2 Tenant | N3 Authz | N4 Integridad pago |
|---|---|---|---|---|
| webhook MercadoPago | ✅ (firma opc.+ re-fetch API) | N/A (order UUID) | N/A (webhook) | ⚠️ falta monto (PAY-03) |
| webhook Sistecredito | ⚠️→✅ (fail-closed) | N/A | N/A | ⚠️ confía en body status; falta monto |
| webhook ADDI | ⚠️→✅ (fail-closed) | N/A | N/A | ⚠️ confía en body status; falta monto |
| payments.service.ts | ⏳ | ⏳ | ⏳ | ⏳ |
| stripe | ⏳ | ⏳ | ⏳ | ⏳ |
| finances | ⏳ | ⏳ | ⏳ | ⏳ |

← [[security/README]] | [[security/findings/audit-bola-idor-2026-07-22]]
