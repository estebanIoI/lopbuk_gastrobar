# 🕸️ Knowledge Graph — Entidades (rama Comercio + DAIMUZ Chat)

## Entidades núcleo
- **Tenant** — un negocio. Dueño del aislamiento (`tenant_id`).
- **User** — usuario (comerciante, vendedor, repartidor, cliente…). Pertenece a un Tenant.
- **Membership / Plan** — plan del tenant (Básico/Profesional/Empresarial). Gatea módulos y `has_chat`.
- **Module** — capacidad activable (POS, inventario, storefront, delivery…).
- **Product / Variant** — catálogo del tenant.
- **Order / Sale / Payment** — venta y cobro.
- **Delivery** — entrega de un pedido.
- **StorefrontPublication** — lo que se publica en la tienda online (producto publicado, oferta, banner, novedad, sección).
- **ChatSession / Message** — conversación con el DAIMUZ Chat.
- **ChatAction** — acción que el ControlChat ejecutó sobre el negocio (auditoría).

## Atributos clave de control
- `Membership.has_chat` → si el plan da acceso al DAIMUZ Chat.
- `Tenant.controlchat_enabled` → si el comerciante activó el Modo ControlChat.
- `ChatAction.requires_approval` → si la acción necesitó confirmación humana.

← [[graph/relations]] | [[graph/impact-map]] | [[brain/empresa-y-ramas]]
