# 🕸️ Knowledge Graph — Relaciones

```
Tenant ─tiene→ User (muchos)
Tenant ─tiene→ Membership (1 activa)        Membership ─define→ has_chat, módulos
Tenant ─activa→ Module (muchos)
Tenant ─tiene→ Product (muchos)             Product ─se publica como→ StorefrontPublication
Order  ─pertenece a→ Tenant                 Order ─tiene→ Payment, Delivery
ChatSession ─pertenece a→ Tenant            ChatSession ─genera→ Message (muchos)
ControlChat ─ejecuta→ ChatAction            ChatAction ─afecta→ Product | StorefrontPublication | Module | Config
```

## Reglas de impacto rápidas
- Cambia **Membership** → revisar `has_chat`, módulos disponibles, gating del panel del chat.
- Cambia **Module** → revisar `lib/modules.ts`, `sidebar.tsx`, `app/page.tsx` (3 lugares).
- Cambia **StorefrontPublication** → revisar storefront público + lo que el ControlChat puede publicar.
- Cambia **ChatAction** (ControlChat) → revisar permisos, aprobación y auditoría.

← [[graph/entities]] | [[graph/impact-map]]
