# 🔐 Módulo Privacy — Protección de Datos Personales

> Ley 1581 de 2012 (Habeas Data, Colombia) con prácticas RGPD como estándar técnico.
> Creado 2026-07-02. Reglas transversales en [[governance/universal-constraints]] § Protección de Datos.

---

## Qué hace

1. **Registro de consentimientos** (`consent_records`): tabla inmutable (solo INSERT; revocar = nuevo registro `granted=0`). El estado vigente es el registro más reciente por `(identifier, consent_type)`.
2. **Solicitudes de titulares** (`data_subject_requests`): acceso / rectificación / borrado / revocación, con SLA de 10 días hábiles (`due_at`) y verificación anti-suplantación (nombre vs. pedidos previos del teléfono).
3. **Derecho de acceso**: exportación JSON consolidada (cliente + pedidos storefront + ventas POS + sesiones de chat + historial de consentimientos).
4. **Derecho al olvido**: anonimización irreversible — borra identidad (nombre/cédula/teléfono/email/dirección/GPS/chat) y conserva montos transaccionales (obligación fiscal). Bloqueado si hay crédito fiado pendiente.
5. **Retención automática** (`retention.job.ts`, diario): chatbot 12 meses, delivery chat 6 meses, GPS de pedidos entregados 90 días.
6. **Auditoría persistente**: primer módulo que escribe en la tabla `audit_log` (`pii_export`, `pii_erasure`, `consent_recorded`, `dsr_created/completed`, `retention_purge`).

## Archivos

| Archivo | Rol |
|---|---|
| `backend/src/modules/privacy/privacy.service.ts` | Toda la lógica (consents, DSR, export, erasure, audit) |
| `backend/src/modules/privacy/privacy.routes.ts` | Rutas públicas (rate-limited) + admin (`authorize('superadmin','comerciante')`) |
| `backend/src/modules/privacy/retention.job.ts` | Purga diaria (arranca en `index.ts` al boot) |
| `backend/src/utils/redact.ts` | `redactPII()` para logs + `minimizeGatewayPayload()` para webhooks |
| `frontend/lib/consent.ts` | Estado de consentimiento del navegador (`localStorage['dz_consent']`) + evento `dz-consent-changed` |
| `frontend/lib/legal-templates.ts` | Plantillas Ley 1581 por defecto (política de datos, términos, cookies) |
| `frontend/components/consent/CookieConsentBanner.tsx` | Banner granular (esenciales/analítica/marketing) |
| `frontend/components/consent/DataRightsModal.tsx` | Formulario público de habeas data (footer de la tienda) |

## Endpoints

```
POST  /api/privacy/public/consents        — registrar consentimiento (banner/checkout) · público, 10/min
POST  /api/privacy/public/requests        — crear solicitud de derechos · público, 5/min
GET   /api/privacy/requests               — listar solicitudes del tenant · auth
PATCH /api/privacy/requests/:id           — atender/completar/denegar · comerciante
GET   /api/privacy/customers/:id/export   — derecho de acceso (JSON) · comerciante
POST  /api/privacy/customers/:id/erase    — derecho al olvido (anonimización) · comerciante
```

## Integraciones con otros módulos

- **[[modules/orders/orders]]**: las 4 rutas de checkout público (`/public`, `/mp-preference`, `/addi-application`, `/sistecredito-application`) exigen `acceptsDataPolicy=true` (400 si falta), registran consentimientos vía `recordCheckoutConsents()` y guardan `consent_id` en la orden.
- **[[modules/customers/customers]]**: el DELETE del CRM ahora es soft delete (`is_active=0, deleted_at`); el borrado real de PII es `eraseCustomer()`. UI en `customers.tsx`: exportar, desactivar, borrado definitivo, panel de solicitudes con SLA.
- **[[modules/whatsapp/whatsapp]]**: "BAJA"/"STOP" entrante = revocación `marketing_whatsapp`; campañas futuras DEBEN usar `sendMarketingMessage()` (verifica consentimiento).
- **[[modules/storefront/storefront]]** (frontend): Meta Pixel solo se inyecta con consentimiento de marketing; checkbox obligatorio en ambos checkouts (CheckoutView y CheckoutWizardML); footer legal siempre visible con fallback a plantillas.
- **[[modules/agent/agent]]**: guard documentado en `agent.rag.ts` — prohibido PII de clientes en el contexto del LLM.
- **payments**: webhook Wompi persiste payload minimizado (sin email/nombre del evento completo).

## Pendientes

- [x] ~~Consentimiento en pedidos creados por el chatbot~~ ✅ 2026-07-02 (`registrar_pedido` registra consentimiento + `consent_id`)
- [ ] DPAs con procesadores externos (ver [[governance/security-policy]])
- [ ] Validación jurídica de las plantillas legales
- [ ] Exportación CSV masiva de clientes con registro en audit_log

← [[DAIMUZ]] · [[governance/universal-constraints]] · [[modules/privacy/compressed]]
