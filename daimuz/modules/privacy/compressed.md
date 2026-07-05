# 🔐 privacy — compressed

**Qué es:** Protección de datos Ley 1581/RGPD: consentimientos, habeas data, derecho al olvido, retención.

- **Tablas:** `consent_records` (inmutable, solo INSERT), `data_subject_requests` (SLA 10 días hábiles). Columnas: `customers.is_active/deleted_at/anonymized_at`, `storefront_orders.consent_id`, `store_info.privacy_policy_version/cookies_content`.
- **Backend:** `modules/privacy/` (service+routes+retention.job) · `utils/redact.ts` (PII en logs, payload Wompi).
- **Frontend:** `lib/consent.ts` + `lib/legal-templates.ts` + `components/consent/` (banner cookies + modal derechos). Pixel Meta gated por consentimiento. Checkbox obligatorio en ambos checkouts.
- **Checkout:** las 4 rutas públicas de orders exigen `acceptsDataPolicy=true` → 400 si falta; consentimiento queda en `consent_records` + `consent_id` en la orden.
- **Olvido:** `eraseCustomer()` anonimiza (identidad fuera, montos quedan) + audit_log `pii_erasure`. CRM delete = soft delete.
- **WhatsApp:** "BAJA"/"STOP" = opt-out; marketing futuro → `sendMarketingMessage()` (verifica consent).
- **Retención diaria:** chatbot 12m · delivery chat 6m · GPS entregados 90d.
- **Regla de oro:** nada de PII en logs (redactPII) ni en el RAG del agente IA.

Detalle: [[modules/privacy/privacy]] · Reglas: [[governance/universal-constraints]]
