# 📊 KPIs de Seguridad

> Lo que no se mide no se mejora. Estos indicadores muestran, en cualquier momento,
> qué tan "duro" es DAIMUZ en seguridad. Se revisan en cada ola del
> [[context/plan-auditoria-seguridad-2026]] y alimentan el reporte al negocio.

---

## Indicadores núcleo

| KPI | Qué mide | Meta objetivo | Fuente |
|---|---|---|---|
| **MTTD** — Tiempo medio de detección | Del ataque a la alerta | ↓ minutos, no días | SIEM (Fase 15) |
| **MTTR** — Tiempo medio de respuesta | De la alerta a la contención | ↓ horas | Blue team (Fase 17) |
| **Vulnerabilidades críticas abiertas** | Backlog de riesgo activo | 0 críticas > SLA | SAST/DAST/pentest |
| **Vulnerabilidades corregidas** | Ritmo de remediación | ↑ tendencia | Pipeline |
| **Cobertura MFA** | % de cuentas sensibles con 2FA | 100% dueño/superadmin | Auth (Fase 3) |
| **Cobertura de cifrado** | % de datos sensibles cifrados en tránsito/reposo | 100% tránsito | Fase 12 |
| **Cobertura de backups** | % de datos críticos respaldados + probados | 100% con restore probado | Fase 13 |
| **RTO** — Objetivo de tiempo de recuperación | Cuánto tarda volver a operar | Definido y cumplido | Fase 13 |
| **RPO** — Punto objetivo de recuperación | Cuántos datos se pueden perder | Definido y cumplido | Fase 13 |
| **APIs protegidas** | % de endpoints con authz + rate limit + validación | 100% | Fase 6 |
| **Secretos rotados** | % de secretos con rotación al día | 100% | Fase 10/12 |
| **Dependencias vulnerables** | Nº de deps con CVE conocido | 0 críticas/altas | Dependabot/Trivy |
| **Cobertura de logs/monitoreo** | % de componentes enviando a SIEM | ↑ hacia 100% | Fase 15 |
| **Riesgo residual por módulo** | Riesgo tras controles, por módulo | Bajo/aceptable | Matriz de riesgo |

---

## Riesgo residual por módulo (matriz viva)

> Se completa durante la ejecución. Escala: 🟢 bajo · 🟡 medio · 🟠 alto · 🔴 crítico.

| Módulo | Superficie principal | Riesgo inicial | Residual | Notas |
|---|---|---|---|---|
| `auth` | Identidad, JWT | 🔴 | 🟡 | F1/F2/F4/F5 **aplicados** (pend. review+deploy). Abiertos: F3 (lockout→Redis), 2FA, rediseño register. Ver [[security/findings/ola-1-2026-07-22]] |
| `tenants` | Aislamiento multi-tenant | 🔴 | — | Regla `tenant_id` del JWT |
| `agent` (IA) | Prompt injection, tools | 🔴 | — | Guard RAG existente; auditar function calling |
| `stripe`/pagos | Webhooks, fraude | 🟠 | — | Verificar firma + idempotencia |
| `privacy` | PII, Ley 1581 | 🟠 | — | Implementado; auditar cobertura |
| `storefront` | Público, XSS | 🟠 | — | Sanear contenido de tenant |
| `pos`/`sales` | Integridad financiera | 🟡 | — | Inmutabilidad ya fuerte |
| `whatsapp` | Canal externo | 🟠 | — | Evolution API self-hosted |

---

## Cómo se reporta

- **Semáforo ejecutivo** para el negocio: 4-5 KPIs clave (críticas abiertas, MFA, backups probados, MTTD).
- **Detalle técnico** para el equipo: matriz de riesgo residual + hallazgos por fase.
- Cada hallazgo se convierte en tarea ([[tasks/task-template]]) y se rastrea hasta cierre.

---

← [[security/audit-plan]] | [[security/README]] | → [[security/tools]]
