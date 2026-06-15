# 🛒 Rama Comercio — base actual

> Análisis de la base de la rama Comercio (el SaaS multi-tenant). Es el núcleo
> de DAIMUZ y el sustrato sobre el que correrá el DAIMUZ Chat (ControlChat).

---

## Qué es

Plataforma **SaaS multi-tenant**: cada negocio (`tenant`) tiene su espacio
aislado y activa solo los módulos que necesita. Código: `lopbuk_gastrobar/`.

## Stack
Next.js 16 · React 19 · TypeScript · Tailwind · Zustand · Express · MySQL2 ·
Socket.io · JWT + Google OAuth. Multi-tenant por `tenant_id`.

## Pilares (ya construidos)

| Pilar | Dónde |
|---|---|
| Multi-tenant + roles + auth | `auth/`, `tenants/`, middleware |
| Módulos activables por negocio | `frontend/lib/modules.ts`, `sidebar.tsx`, `app/page.tsx` |
| Operación | POS, inventario, ventas, caja, clientes, créditos, finanzas |
| Vertical gastrobar | mesas, comandas, reservas, recetas/BOM, food cost, merma |
| Tienda online pública | `storefront/`, `/links/[slug]`, checkout |
| Delivery + flota | `delivery/`, `fleet/` |
| Planes / membresías | `subscriptions/`, `profile-modal` (Básico/Profesional/Empresarial) |
| IA conversacional | `chatbot/` (atención), `agent/` (RAG+tools de consulta), `assistant/` |
| Portafolio público | `/portfolio` (capta clientes para la rama) |

## Cómo encaja el DAIMUZ Chat (los dos modos)

- **Hoy** la rama opera en **Modo Operativo**: el comerciante gestiona módulos.
- **Siguiente** = **Modo ControlChat**: el `agent/` gana herramientas que
  ACTÚAN (crear producto, publicar, activar módulo) y el comerciante delega.
  Gateado por membresía-chat. Ver `brain/daimuz-chat.md`.

## Reglas que no se rompen (resumen)
- Filtrar SIEMPRE por `tenant_id`; `tenant_id` del JWT, nunca del body.
- Lógica en `*.service.ts`. Soft delete. Respuestas `{ success, data/error }`.
- No tocar schema/auth/pagos sin aprobación. Ver `governance/`.

## Entidades núcleo
Tenant · User · Membership/Plan · Module · Product · Order · Sale · Payment ·
Delivery · StorefrontPublication · ChatSession. Grafo: `graph/entities.md`.

---

← [[DAIMUZ]] | [[brain/empresa-y-ramas]] | [[brain/daimuz-chat]] | [[indexes/modules-index]]
