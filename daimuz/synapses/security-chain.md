# 🛡️ Sinapsis: Cadena de Seguridad

> La seguridad no es un módulo: es una capa que **atraviesa todos los módulos**. Esta sinapsis
> documenta qué controles de seguridad toca cada cambio. Región completa: [[security/README]].

## Flujo: Todo request pasa por los mismos guardianes

```
REQUEST
   │
   ▼
Traefik/TLS ──► CORS/headers ──► verifyToken (JWT httpOnly)
                                      │
                                      ├─► req.user.tenantId  ← ÚNICA fuente del tenant
                                      ├─► authorize('rol')   ← RBAC
                                      └─► service: WHERE tenant_id = ?  ← aislamiento
                                                │
                                                ├─► query parametrizada (anti-SQLi)
                                                ├─► redactPII() en logs
                                                └─► audit_log / ChatAction (auditoría)
```

Romper cualquier eslabón = incidente. El orden importa: authz **antes** de la lógica, tenant **antes** de la query.

## Impacto por Cambio (qué revisar en seguridad)

### Si tocas `auth.middleware.ts` (⚠️ AVISAR antes)
- Afecta: **TODOS** los módulos. Revisar Fase 3 y 4. Verificar firma JWT, `req.user.tenantId`, `authorize()` con params sueltos.

### Si tocas cualquier `*.service.ts` con acceso a DB
- Revisar Fase 4 y 5: query parametrizada, filtro `tenant_id` del JWT, no leer `tenant_id` del body, mass assignment (whitelist de campos).

### Si tocas un endpoint (`*.routes.ts`)
- Revisar Fase 6: `verifyToken` + `authorize()` presentes, rate limit, validación de entrada/salida, no filtrar campos internos. Actualizar [[indexes/endpoints-index]] (evitar Shadow APIs).

### Si tocas el agente IA (`agent.rag.ts`, `agent.tools.ts`)
- Revisar Fase 7 (obligatorio): NUNCA PII al contexto RAG, cada tool valida tenant+permisos+aprobación, `ChatAction`, defensas anti prompt-injection.

### Si tocas pagos/webhooks (`stripe`, Wompi, MercadoPago)
- Revisar Fase 6 y 12: verificar firma del webhook, idempotencia, anti-replay, `minimizeGatewayPayload()`, jamás almacenar datos de tarjeta.

### Si tocas el frontend/storefront
- Revisar Fase 8: sanear contenido de tenant (anti stored-XSS), CSP/headers, cookies `HttpOnly/Secure/SameSite`, no PII en LocalStorage.

### Si tocas infra/deploy (`docker-compose.*`, Traefik, `.env`)
- Revisar Fase 9, 10, 11: sin puertos de DB/Redis expuestos, secretos fuera del repo (GitLeaks), imágenes escaneadas (Trivy), TLS moderno.

### Si tocas datos de clientes (PII)
- Revisar Fase 12 y [[modules/privacy/privacy]]: consentimiento, anonimización (no DELETE), retención, auditoría en `audit_log`.

## Regla de Seguridad transversal

```typescript
// ✅ SIEMPRE — el tenant manda desde el JWT
const tenantId = req.user.tenantId

// ❌ NUNCA — superficie de fuga cross-tenant
const tenantId = req.body.tenantId ?? req.params.tenantId ?? req.query.tenantId
```

---

**Región de seguridad:** [[security/README]] · [[security/audit-plan]] · [[security/threat-model-2026]] · [[agents/security-agent]]
**Módulos más sensibles:** [[modules/auth/auth]] · [[modules/tenants/tenants]] · [[modules/agent/agent]] · [[modules/privacy/privacy]] · [[modules/stripe/compressed]]

← [[synapses/saas-chain]] | [[DAIMUZ]]
