# 🏢 DAIMUZ — La empresa y sus ramas

> Documento central (v4). Si quieres entender QUÉ es DAIMUZ como empresa,
> cuáles son sus ramas y cómo encaja el "DAIMUZ Chat", empieza aquí.

---

## 1. Qué es DAIMUZ (empresa)

DAIMUZ es una **empresa de tecnología** que construye software para negocios.
Su producto NO es un solo sistema: se organiza en **ramas** (verticales),
cada una atiende un tipo de cliente/uso. Todas comparten el mismo cerebro
(`daimuz/`), la misma identidad de marca y la misma IA.

```
                ┌───────────────────────────────┐
                │           DAIMUZ              │
                │   (marca · IA · cerebro)      │
                └───────────────┬───────────────┘
        ┌───────────────┬───────┴───────┬────────────────┐
        ▼               ▼               ▼                ▼
   RAMA COMERCIO   RAMA PORTAFOLIO   (futuras)      DAIMUZ CHAT
   (SaaS negocios)  (marca/servicios)              (IA transversal)
```

---

## 2. Las ramas (branches)

| Rama | Qué es | Estado | Base de código |
|---|---|---|---|
| **Comercio** | SaaS multi-tenant para que cualquier negocio opere (POS, inventario, tienda online, delivery, restaurante, finanzas, etc.) | ✅ Activa (núcleo) | `lopbuk_gastrobar/` |
| **Portafolio** | Landing pública de la marca + captación (servicios, planes, robot IA) | ✅ Activa | `/portfolio` |
| **DAIMUZ Chat** | IA transversal que **opera** el negocio (no solo responde) | 🟡 En evolución | `chatbot/` + `agent/` + `assistant/` |

> Cada rama nueva se documenta en `daimuz/branches/[rama].md`.
> La rama Comercio es la base y la más madura → ver `daimuz/branches/comercio.md`.

---

## 3. La rama Comercio — base actual

Es el corazón de DAIMUZ. Un **SaaS multi-tenant** donde cada negocio
(`tenant`) activa solo los módulos que necesita. Hoy ya existe y funciona:

- **Multi-tenant**: `tenant_id` en todo; aislamiento por negocio.
- **Módulos activables** (`frontend/lib/modules.ts`): POS, inventario, ventas,
  caja, clientes, créditos, finanzas, gastrobar, compras, delivery, flota,
  tienda online (storefront), WhatsApp, etc.
- **Planes / membresías** (`subscriptions`, `profile-modal`): Básico,
  Profesional, Empresarial — gatean qué puede usar el comerciante.
- **IA** (`chatbot`, `agent`, `assistant`): hoy ATIENDE clientes y da info.

Análisis completo: `daimuz/branches/comercio.md`.

---

## 4. Los dos MODOS de operar un comercio

El gran salto de producto: un comercio puede operarse de **dos formas**.

### 🛠️ Modo Operativo (incluido en todos los planes)
El comerciante **gestiona sus módulos a mano**: activa POS, inventario,
publica productos, configura su tienda, etc. Control total, trabajo manual.
Es lo que la rama Comercio ya hace hoy.

### 🤖 Modo ControlChat (premium — requiere membresía con chat)
El comerciante **no gestiona módulos a mano**: le **escribe al DAIMUZ Chat**
y este se encarga de **todo el negocio y sus publicaciones** (crear/editar
productos, publicar ofertas, configurar la tienda, activar módulos…).

> «Tú solo le escribes; él ya sabe qué hacer con tu negocio.»

Quien no quiere administrar nada, **paga el plan con chat asistencial** y
delega la operación al DAIMUZ Chat.

### Relación entre modos
- Ambos modos conviven. Con membresía-chat, el comerciante **activa/desactiva**
  el modo ControlChat con un toggle y puede volver al operativo cuando quiera.
- Sin membresía-chat → solo modo Operativo.

```
Plan SIN chat   → solo Modo Operativo
Plan CON chat   → Modo Operativo + (toggle) Modo ControlChat
```

---

## 5. El DAIMUZ Chat tiene su PROPIO panel

El DAIMUZ Chat **no vive dentro del panel de módulos**: tiene un
**panel de administración independiente**, donde el comerciante:

- activa/desactiva el modo ControlChat,
- define qué puede hacer el chat sobre su negocio (alcance/permisos),
- ve el historial de acciones que el chat ejecutó,
- ajusta tono, datos del negocio y reglas.

Separarlo deja claro que el chat es un **operador autónomo supervisado**,
no un módulo más.

---

## 6. Cómo se mapea al código (qué falta para ControlChat)

| Capa | Hoy existe | Para ControlChat falta |
|---|---|---|
| Chat atención cliente | `chatbot/` (`/chatbot/message`) | — |
| Asistente plataforma | `assistant/` (`/assistant`, `runPublicAssistant`) | — |
| Agente con contexto | `agent/` (`processAgentMessage`) | **Herramientas que ACTÚAN** (crear producto, publicar oferta, activar módulo) con permisos + aprobación |
| Gating por plan | `subscriptions`, `profile-modal` | Flag "membresía con chat" + toggle `controlchat_enabled` por tenant |
| Panel del chat | Config básica en superadmin | **Panel independiente** del DAIMUZ Chat por comerciante |

**Regla de seguridad:** el ControlChat ejecuta acciones reales sobre el
negocio → toda acción destructiva o de pagos requiere confirmación
(ver `governance/approval-policy.md`).

---

← [[DAIMUZ]] | → [[brain/daimuz-chat]] | [[branches/comercio]]
