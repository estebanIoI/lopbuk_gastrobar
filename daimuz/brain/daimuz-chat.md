# 🤖 DAIMUZ Chat — IA que opera el negocio

> Spec central del DAIMUZ Chat. Es la IA transversal de la empresa: el mismo
> "cerebro conversacional" que, según el plan, **atiende** o **opera** el negocio.

---

## 1. Idea

El DAIMUZ Chat es la pieza que diferencia a DAIMUZ del resto de SaaS:
en vez de obligar al comerciante a aprender módulos, le permite **delegar la
operación a una IA**. Escribes en lenguaje natural y el chat ejecuta.

Tres niveles de capacidad (de menor a mayor):

| Nivel | Qué hace | Endpoint / código |
|---|---|---|
| **Informativo** | Responde dudas (público / asistente) | `runPublicAssistant`, `/assistant` |
| **Atención** | Atiende clientes de una tienda (RAG catálogo) | `/chatbot/message`, `agent/` |
| **Operativo (ControlChat)** | **Actúa** sobre el negocio: crea productos, publica ofertas, configura, activa módulos | *(por construir)* `agent/` + tools |

---

## 2. Modos del comercio (resumen)

- **Operativo**: el comerciante usa los módulos a mano. (Incluido.)
- **ControlChat**: el DAIMUZ Chat controla el negocio y sus publicaciones.
  (Premium, requiere membresía con chat; se activa con un toggle.)

Detalle de negocio en `brain/empresa-y-ramas.md`.

---

## 3. Qué controla el ControlChat

Sobre el negocio del comerciante (su `tenant`), el chat puede:

- **Publicaciones**: crear/editar/despublicar productos, ofertas, banners,
  novedades, secciones de la tienda online.
- **Catálogo e inventario**: alta de productos, precios, stock, categorías.
- **Configuración**: datos de la tienda, horarios, métodos de pago, colorimetría.
- **Módulos**: activar/desactivar módulos según lo que el negocio necesite.
- **Consulta**: ventas del día, pedidos, alertas de stock (ya existe en `agent`).

Todo **siempre dentro de su `tenant`** (aislamiento multi-tenant, sin excepción).

---

## 4. Panel independiente del DAIMUZ Chat

El chat tiene su **propio panel** (no es un módulo más):

- **Activación**: toggle `controlchat_enabled` (solo visible si el plan incluye chat).
- **Alcance / permisos**: qué acciones puede ejecutar el chat por sí solo y
  cuáles requieren confirmación del comerciante.
- **Historial de acciones**: log de lo que el chat hizo (auditoría).
- **Comportamiento**: tono, datos del negocio, reglas y límites.

---

## 5. Gating por membresía

```
membership.has_chat == false  → Modo Operativo únicamente
membership.has_chat == true   → toggle controlchat_enabled (on/off)
```

- Se resuelve con el plan del tenant (`subscriptions` / `tenantPlan`).
- "Plan asistencial" = plan con chat + ControlChat activable: el comerciante
  delega todo y solo conversa.

---

## 6. Arquitectura para llegar a ControlChat (roadmap técnico)

1. **Herramientas (function-calling) que ACTÚAN** en `agent/`:
   `crear_producto`, `publicar_oferta`, `editar_tienda`, `activar_modulo`, …
   Cada tool → llama al `*.service.ts` real del módulo (lógica reutilizada).
2. **Permisos por acción** + **aprobación** para acciones sensibles
   (pagos, borrados, cambios masivos) → `governance/approval-policy.md`.
3. **Flag de plan** `has_chat` + columna `controlchat_enabled` por tenant.
4. **Panel independiente** del chat (frontend) + endpoints de config/historial.
5. **Auditoría**: cada acción del chat queda registrada (quién, qué, cuándo).

**Constante de seguridad:** una IA que ejecuta acciones reales NUNCA debe
saltarse autenticación, tenant isolation ni aprobaciones. Ver
`governance/universal-constraints.md` y `governance/approval-policy.md`.

---

← [[DAIMUZ]] | [[brain/empresa-y-ramas]] | [[branches/comercio]] | [[governance/approval-policy]]
