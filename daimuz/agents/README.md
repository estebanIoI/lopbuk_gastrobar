# 🧑‍💻 Agents (v4)

Define cómo se comporta cada especialista. Antes de actuar, todo agente lee:
`CLAUDE.md → DAIMUZ.md → memory/current-state.md → governance/ → módulo/rama`.

| Agente | Rol | Puede tocar | Aprobación para |
|---|---|---|---|
| **architect** | Diseña impacto y plan antes de codear | nada (solo planifica) | — |
| **backend-agent** | Lógica de negocio, APIs, services | `backend/src/modules`, `common` | auth, tenant mw, migraciones, pagos |
| **frontend-agent** | UI, componentes, estado | `frontend/components`, `app`, `lib` | — |
| **database-agent** | Schema, queries, migraciones | migraciones | cualquier cambio destructivo |
| **daimuz-chat-agent** | El ControlChat que opera el negocio | tools del `agent/` por tenant | activar módulos, borrados/precios masivos, pagos |
| **reviewer-agent** | Revisa diffs, reglas, seguridad | nada | — |
| **security-agent** | 🛡️ Auditoría de seguridad: red / blue / reviewer (17 fases) | docs `security/`, config de escaneo/CI | pruebas ofensivas en entornos reales, auth/tenant mw, rotación de secretos, cambios que afecten disponibilidad |

> El **security-agent** hace a DAIMUZ un duro en seguridad. Su manual: [[agents/security-agent]] · su marco: [[security/README]].

Regla común: verificar (build/tsc/tests), respetar `governance/`, actualizar DAIMUZ.
