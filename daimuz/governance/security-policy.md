# 🔒 Política de Seguridad (v4)

1. **Tenant isolation**: toda query filtra por `tenant_id`; el `tenant_id` viene del JWT, nunca del body/params/query. Única excepción: superadmin, explícita.
2. **Auth**: JWT en cookie httpOnly como fuente de verdad. No tocar `auth.middleware.ts` ni el middleware de tenant sin aprobación.
3. **DAIMUZ Chat que actúa**: el ControlChat ejecuta acciones reales → corre con el `tenant` del comerciante, respeta permisos y aprobaciones (`approval-policy.md`), y audita cada acción. Nunca expone datos de otro tenant.
4. **Datos sensibles**: no exponer en errores ni logs.
5. **Endpoints públicos** (storefront, portafolio, asistente público): sin auth pero acotados (por slug/tenant o sin datos internos, como `runPublicAssistant`).

← [[governance/universal-constraints]] | [[governance/approval-policy]]
