# Plan — Integración de pasarelas de pago (Wompi) + config por tienda

> Estado: PROPUESTA (pendiente de aprobar decisiones). Alto riesgo: dinero real, llaves y webhooks.

## 1. Objetivo (dos capas)

**Capa A — Wompi de plataforma (superadmin / DAIMUZ).**
Las llaves Wompi del superadmin cobran a los **comercios** sus **suscripciones, paquetes de video, clases y demás** de DAIMUZ. El dinero va a la cuenta del administrador (DAIMUZ).

**Capa B — Pasarela por tienda (comercio).**
Cada comercio puede configurar **su propia** pasarela (Wompi u otras) para cobrar las ventas de **sus** productos/servicios en su tienda — pero **solo si el superadmin le activa el módulo**. El dinero va a la cuenta del comercio.

Regla clave: una transacción usa SIEMPRE las llaves del dueño del dinero (plataforma para suscripciones; comercio para ventas de su tienda).

## 2. Cómo funciona Wompi (confirmado en docs oficiales)

- Métodos: **Widget** (JS embebido), **Web Checkout** (form HTML → redirección), **API** (a la medida; tokenización para **pagos recurrentes**).
- Para Widget/Checkout se necesita:
  1. **Llave pública** (`pub_test_…` sandbox / `pub_prod_…` producción) — única que toca el frontend.
  2. **Referencia única** por transacción (como un nº de factura).
  3. **Firma de integridad** = `SHA256(referencia + montoEnCentavos + moneda [+ expiración] + secretoIntegridad)`. **Se genera en el servidor** (nunca exponer el secreto de integridad).
  4. Monto **en centavos**, moneda `COP`.
- **Confirmación = webhook** (evento `transaction.updated`), verificado con el **secreto de eventos**. La URL de redirección es solo informativa; la verdad la da el webhook (o consultar `GET https://production.wompi.co/v1/transactions/<id>`).
- 4 secretos por comercio Wompi: **llave pública**, **llave privada**, **secreto de integridad**, **secreto de eventos**.

## 3. Recomendación de arquitectura

- **v1: Web Checkout (redirección)** para suscripciones/paquetes y ventas. Es lo más simple y seguro: el backend arma la referencia + firma, el front redirige a Wompi, y un **webhook** marca el pago. Sin manejar datos de tarjeta (menos PCI).
- **Recurrencia real (cobro automático mensual)** = fase posterior con **API + tokenización** (guardar token de tarjeta y cobrar con la llave privada). Para v1, las suscripciones se renuevan con **pago manual/enlace** (el comercio paga cada ciclo), que es lo que Web Checkout permite.

## 4. Modelo de datos

**Plataforma (Capa A)** — tabla `platform_payment_gateways` (o reutilizar `platform_settings`):
- `provider` ('wompi'), `environment` ('sandbox'|'production'),
- `public_key`, `private_key`, `integrity_secret`, `events_secret` — **todos cifrados con `crypto.ts`** (AES-256-CBC). Solo la pública se envía al front.
- `is_active`.

**Por tienda (Capa B)** — tabla `tenant_payment_gateways`:
- `tenant_id`, `provider`, `environment`, las 4 llaves **cifradas**, `is_active`.
- En `tenants` (o `store_info`): flag `gateways_module_enabled` (lo activa el **superadmin** por comercio).

**Transacciones** — tabla `wompi_transactions` (auditoría y conciliación):
- `id` (referencia única), `context` ('subscription'|'package'|'order'), `context_id`,
- `tenant_id` (a qué comercio aplica), `owner` ('platform'|'tenant'),
- `amount_in_cents`, `currency`, `wompi_id`, `status` ('PENDING'|'APPROVED'|'DECLINED'|'VOIDED'|'ERROR'),
- timestamps. Idempotencia por `id` (referencia) para no duplicar.

## 5. Backend (endpoints)

- `POST /api/payments/checkout` → crea la referencia, calcula la **firma de integridad** (server-side), persiste `wompi_transactions` en PENDING y devuelve `{ publicKey, reference, amountInCents, signature, redirectUrl }` para que el front lance el Web Checkout. Elige llaves según `context`/`owner` (plataforma vs comercio).
- `POST /api/payments/wompi/webhook` → recibe el evento, **verifica la firma de eventos**, consulta la transacción en Wompi por seguridad, actualiza `wompi_transactions` y **dispara la acción** (activar suscripción / habilitar paquete / marcar pedido pagado). Idempotente.
- `GET /api/payments/transaction/:reference` → estado para la pantalla de “resultado”.
- Superadmin: `GET/PUT /api/superadmin/payment-gateway` (llaves de plataforma).
- Comercio: `GET/PUT /api/merchant/payment-gateway` (llaves propias) — **bloqueado** salvo que `gateways_module_enabled`.

Seguridad: llaves cifradas en reposo; integridad/eventos/privada **nunca** salen al front; webhook valida firma; montos siempre recalculados en backend (no confiar en el front para el precio de suscripciones/paquetes).

## 6. Frontend

- **Superadmin → Configuración de pagos:** formulario con entorno (sandbox/prod) + las 4 llaves Wompi (input password, se guardan cifradas). Toggle activo. Y, por comercio, un switch “Permitir pasarela propia” (`gateways_module_enabled`).
- **Comercio → Pagos (si el módulo está activo):** formulario equivalente para sus llaves.
- **Pago de suscripción/paquete (comercio):** botón “Pagar con Wompi” → llama `/payments/checkout` → redirige al Checkout → vuelve a una página de resultado que consulta el estado.
- **Storefront (cliente):** si la tienda tiene Wompi activo, “Pagar con Wompi” como método en el checkout (junto a MP/ADDI/contraentrega ya existentes).

## 7. Fases

1. **Fase 1 (Capa A):** tabla + `crypto` de llaves de plataforma, `POST /payments/checkout` + firma, webhook, y UI superadmin + pago de **suscripción/paquete** por Web Checkout. (Cobro a comercios.)
2. **Fase 2 (Capa B):** `tenant_payment_gateways` + flag `gateways_module_enabled` (toggle superadmin) + UI del comercio + “Pagar con Wompi” en el storefront.
3. **Fase 3 (recurrencia):** API + tokenización para cobro automático de suscripciones.

## 8. Decisiones a confirmar antes de codear

1. **Método v1:** Web Checkout (redirección) ✅ recomendado, vs Widget embebido, vs API a la medida.
2. **Suscripciones v1:** pago por ciclo vía enlace/Checkout ✅ recomendado, vs recurrencia automática (tokenización) desde el inicio.
3. **Por dónde empezar:** Fase 1 (cobro a comercios) ✅ recomendado, vs Fase 2 (pasarela por tienda) primero.

## 9. Requiere del usuario
- Llaves Wompi (sandbox primero): pública, privada, secreto de integridad, secreto de eventos.
- Confirmar que `ENCRYPTION_KEY` está seteada en el backend (la usa `crypto.ts`).
- En Wompi dashboard: registrar la **URL de eventos** (webhook) y la **URL de redirección**.
- Deploy en Komodo para crear tablas (migraciones inline idempotentes).
