# 🔒 Política de Seguridad (v4)

> Estas son las **reglas que nunca se rompen**. El programa completo de auditoría (17 fases,
> modelo de amenazas 2026, KPIs, herramientas, respuesta a incidentes) vive en la región
> [[security/README]]. Antes de tocar auth, tenant, pagos o el agente IA → lee también [[synapses/security-chain]].

1. **Tenant isolation**: toda query filtra por `tenant_id`; el `tenant_id` viene del JWT, nunca del body/params/query. Única excepción: superadmin, explícita.
2. **Auth**: JWT en cookie httpOnly como fuente de verdad. No tocar `auth.middleware.ts` ni el middleware de tenant sin aprobación.
3. **DAIMUZ Chat que actúa**: el ControlChat ejecuta acciones reales → corre con el `tenant` del comerciante, respeta permisos y aprobaciones (`approval-policy.md`), y audita cada acción. Nunca expone datos de otro tenant.
4. **Datos sensibles**: no exponer en errores ni logs. PII de clientes en logs → usar `redactPII()` (`backend/src/utils/redact.ts`); los errores de mysql2 incluyen el SQL con valores del cliente, por eso `sql`/`sqlMessage` se enmascaran. Payloads de webhooks de pasarela → `minimizeGatewayPayload()` antes de persistir.
5. **Endpoints públicos** (storefront, portafolio, asistente público): sin auth pero acotados (por slug/tenant o sin datos internos, como `runPublicAssistant`).
6. **Protección de datos (Ley 1581)**: consentimiento antes de capturar PII, anonimización para el derecho al olvido, retención automática, todo acceso/export/borrado de PII auditado en `audit_log`. Detalle: [[governance/universal-constraints]] § Protección de Datos y [[modules/privacy/privacy]].

## 🤝 Encargados del tratamiento (procesadores externos)

| Procesador | Datos que recibe | DPA |
|---|---|---|
| Wompi | email, monto, referencia de pago (tarjeta la procesa Wompi, no nosotros) | ⏳ pendiente firmar |
| MercadoPago / ADDI / Sistecrédito | nombre, email, teléfono, cédula, monto | ⏳ pendiente firmar |
| Evolution API (WhatsApp self-hosted) | teléfono, nombre, conversación completa | ⏳ auditar despliegue |
| Cloudinary | imágenes (productos, logos) — evitar fotos con PII | ⏳ pendiente firmar |
| Proveedor LLM (agente IA) | mensajes del chat — PROHIBIDO inyectar PII de clientes al contexto RAG | guard en `agent.rag.ts` |

> Firmar los DPAs pendientes es una tarea de la Ola 3 en [[context/plan-auditoria-seguridad-2026]].

← [[governance/universal-constraints]] | [[governance/approval-policy]] | → [[security/README]]
