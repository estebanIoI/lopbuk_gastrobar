# 🎯 Impact Map

| Si cambia… | Revisar |
|---|---|
| **Auth / Tenant isolation** | TODO acceso a datos; `governance/security-policy.md` |
| **Membership / Plan** | gating de módulos, `has_chat`, panel del DAIMUZ Chat |
| **Module activable** | `lib/modules.ts` + `sidebar.tsx` + `app/page.tsx` |
| **DAIMUZ Chat (ControlChat) gana una acción** | permisos, aprobación, auditoría (`ChatAction`), tenant isolation |
| **Order** | inventory, payments, delivery, reports |
| **Colorimetría / tema** | `brain/colorimetria.md` (regla: todo tema la consume) |

> Riesgo alto: cualquier acción del ControlChat que escriba en el negocio.
> Una IA que actúa NO puede saltarse auth, tenant ni aprobaciones.

← [[graph/entities]] | [[graph/relations]] | [[governance/approval-policy]]
