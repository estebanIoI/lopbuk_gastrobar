# ⬡ DAIMUZ — Núcleo Cognitivo de Lopbuk

> El cerebro del proyecto. Abre **solo la carpeta `daimuz/`** como bóveda en Obsidian.  
> Toda consulta empieza aquí. Toda neurona conecta aquí.

---

## 🏢 Empresa y Ramas (v4)

> DAIMUZ es una **empresa con ramas**. La rama Comercio es el núcleo; el DAIMUZ Chat es la IA transversal que puede **operar** el negocio.

| Nodo | Para qué |
|---|---|
| [[brain/empresa-y-ramas]] | 🏢 Visión central: empresa → ramas → modos Operativo/ControlChat |
| [[brain/daimuz-chat]] | 🤖 DAIMUZ Chat: IA que opera el negocio (panel propio, gating por plan) |
| [[brain/modelo-negocio]] | 💼 Modelo de negocio: Curso Chat Daimuz + suscripción (base oficial) |
| [[branches/comercio]] | 🛒 Base de la rama Comercio (SaaS multi-tenant) |
| [[graph/entities]] · [[graph/impact-map]] | 🕸️ Knowledge graph (entidades + impacto) |
| [[agents/README]] · [[agents/daimuz-chat-agent]] | 🧑‍💻 Arnés de agentes (incl. ControlChat) |
| [[governance/approval-policy]] · [[governance/security-policy]] | ✅🔒 Qué exige aprobación / reglas de seguridad |
| [[tasks/task-template]] · [[indexes/tasks-index]] | 🗂️ Capa de tareas v4 |

---para los de mas

## ⚡ Acceso Rápido (Indexes)

> Empieza aquí si no sabes en qué módulo está lo que buscas.

| Índice | Para encontrar |
|---|---|
| [[indexes/modules-index]] | Qué hace cada módulo (1 línea por módulo) |
| [[indexes/endpoints-index]] | Todos los endpoints REST ultra-compactos |
| [[indexes/db-tables-index]] | Todas las tablas y su propósito |
| [[indexes/files-index]] | Archivos críticos y su ubicación exacta |

---

## 🕸️ Sinapsis — Impacto entre Módulos

> Si cambias un módulo, ¿qué otros se ven afectados?

| Sinapsis | Cadena |
|---|---|---|
| [[synapses/ops-chain]] | POS → Ventas → Inventario → Caja |
| [[synapses/gastrobar-chain]] | Recetas → Inventario → Merma → Food Cost |
| [[synapses/supplier-chain]] | Proveedor → Variantes → Precios → Ventas → Liquidación |
| [[synapses/delivery-chain]] | Storefront → Pedidos → Delivery → WhatsApp |
| [[synapses/supplier-chain]] | Proveedor → Variantes → Tiers → Venta → Liquidación |
| [[synapses/saas-chain]] | Tenant → Auth → Módulos → Suscripciones |

---

## 🧠 Cerebro

| Región | Función |
|---|---|
| [[brain/identity]] | Qué es Lopbuk y para quién |
| [[brain/philosophy]] | Por qué está construido así |
| [[brain/coding-standards]] | Cómo se escribe el código |
| [[brain/empresa-y-ramas]] | 🏢 Empresa, ramas y modos Operativo/ControlChat |
| [[brain/daimuz-chat]] | 🤖 DAIMUZ Chat: IA que opera el negocio |
| [[brain/colorimetria]] | 🎨 Sistema de colorimetría + regla: todo tema la consume |
| [[brain/ai-behavior]] | Cómo hablarle a Claude |
| [[brain/naming-conventions]] | Nombres de todo en el sistema |
| [[brain/variants-and-suppliers]] | ⭐ Variantes + price tiers + proveedores — arquitectura definitiva (4 sprints) |
| [[brain/variants-implementation-plan]] | ⭐ Plan de implementación de variantes (legacy — ver variants-and-suppliers) |
| [[brain/patterns/module-pattern]] | Patrón estándar de módulo backend |
| [[brain/daimuz-replication]] | ⭐ Cómo replicar DAIMUZ en otro proyecto |

---

## 🔒 Governance — Reglas que Nunca se Rompen

| Documento | Contenido |
|---|---|
| [[governance/universal-constraints]] | Multi-tenant, soft-delete, stock, auth pattern, código |
| [[governance/why-decisions]] | Por qué existen esas reglas (razonamiento) |
| [[governance/update-protocol]] | Cuándo y dónde actualizar cada parte de DAIMUZ |
| [[governance/security-policy]] | 🔒 Tenant isolation, auth, chat que actúa |
| [[governance/approval-policy]] | ✅ Qué exige aprobación humana (incl. ControlChat) |

---

## 🧬 Ontología — Qué ES cada Entidad

| Documento | Entidades |
|---|---|
| [[ontology/entities]] | Tenant, User, Sale, Order, CashSession, Product, Recipe, PAR Level |

---

## 💾 Memoria Viva

| Archivo | Contenido |
|---|---|
| [[memory/current-state]] | Estado actual del proyecto |
| [[memory/changelog]] | Historial de cambios por fecha |
| [[memory/completed-features]] | Qué está 100% terminado |
| [[memory/lessons-learned]] | Qué aprendimos construyendo |
| [[memory/important-fixes]] | Bugs críticos resueltos |
| [[memory/bugs-history]] | Historial de problemas abiertos |

---

## 🗺️ Arquitectura

| Documento | Descripción |
|---|---|
| [[architecture/overview]] | Diagrama general del sistema |
| [[architecture/frontend]] | Mapa del frontend Next.js |
| [[architecture/backend]] | Mapa del backend Express |
| [[architecture/database]] | Schema MySQL multitenant |
| [[architecture/deployment]] | Entornos, variables, deploy |

---

## 🌊 Flujos del Sistema

| Flujo | Descripción |
|---|---|
| [[flows/auth-flow]] | Login local + Google OAuth |
| [[flows/sale-flow]] | Venta completa en el POS |
| [[flows/order-flow]] | Pedido → cocina → entrega |
| [[flows/inventory-flow]] | Movimientos de stock y kardex |
| [[flows/delivery-flow]] | Asignación → tracking → entrega |
| [[flows/supplier-flow]] | Proveedor → importación → venta → liquidación |

---

## 🧩 Módulos Core

> Cada módulo tiene `[modulo].md` completo + `compressed.md` para triage rápido.

| Módulo | Función | Compressed |
|---|---|---|---|
| [[modules/auth/auth]] | Autenticación, JWT, roles | [[modules/auth/compressed]] |
| [[modules/tenants/tenants]] | Multi-tenant, módulos activables | [[modules/tenants/compressed]] |
| [[modules/dashboard/dashboard]] | KPIs y métricas en tiempo real | [[modules/dashboard/compressed]] |
| [[modules/products/products]] | Productos base + categorías | [[modules/products/compressed]] |
| [[modules/variants/variants]] | Variantes color/talla + price tiers + stock atómico | [[modules/variants/compressed]] |
| [[modules/pos/pos]] | Punto de venta | [[modules/pos/compressed]] |
| [[modules/cash-sessions/cash-sessions]] | Apertura/cierre de caja | [[modules/cash-sessions/compressed]] |
| [[modules/sales/sales]] | Registro de ventas | [[modules/sales/compressed]] |
| [[modules/inventory/inventory]] | Stock y kardex | [[modules/inventory/compressed]] |
| [[modules/suppliers/suppliers]] | Catálogo proveedores + supplier_products | [[modules/suppliers/compressed]] |
| [[modules/purchases/purchases]] | Compras a proveedores | [[modules/purchases/compressed]] |
| [[modules/orders/orders]] | Pedidos y estados | [[modules/orders/compressed]] |
| [[modules/customers/customers]] | CRM de clientes | [[modules/customers/compressed]] |
| [[modules/privacy/privacy]] | 🔐 Ley 1581/RGPD: consentimientos, habeas data, retención | [[modules/privacy/compressed]] |
| [[modules/finances/finances]] | Flujo de caja y Stripe | [[modules/finances/compressed]] |
| [[modules/subscriptions/subscriptions]] | Planes SaaS | [[modules/subscriptions/compressed]] |

---

## 🍽️ Módulos Gastrobar

| Módulo | Función | Compressed |
|---|---|---|
| [[modules/gastrobar-ops/gastrobar-ops]] | Centro de mando gastrobar | [[modules/gastrobar-ops/compressed]] |
| [[modules/restbar-finanzas/restbar-finanzas]] | Tracker financiero del gastrobar | [[modules/restbar-finanzas/compressed]] |
| [[modules/recipes/recipes]] | Recetas BOM y food cost | [[modules/recipes/compressed]] |
| [[modules/merma/merma]] | Control de desperdicios | [[modules/merma/compressed]] |
| [[modules/scanner/scanner]] | Escáner de códigos de barras | [[modules/scanner/compressed]] |

---

## 🚀 Módulos Digitales y Delivery

| Módulo | Función | Compressed |
|---|---|---|
| [[modules/storefront/storefront]] | Tienda online pública | [[modules/storefront/compressed]] |
| [[modules/product-templates/product-templates]] | 🧩 Plantillas dinámicas de producto (tipo Shopify) | [[modules/product-templates/compressed]] |
| [[modules/delivery/delivery]] | Delivery y flota | [[modules/delivery/compressed]] |
| [[modules/whatsapp/whatsapp]] | Mensajería WhatsApp | [[modules/whatsapp/compressed]] |
| [[modules/agent/agent]] | Agente IA con RAG | [[modules/agent/compressed]] |

---

## 🏗️ Módulos Verticales

| Módulo | Industria | Estado |
|---|---|---|
| [[modules/realestate/realestate]] | Inmobiliaria | [[modules/realestate/compressed]] · 🔄 En ajuste |
| [[modules/workorders/workorders]] | Tapicería / Servicios técnicos | [[modules/workorders/compressed]] · 🔄 En ajuste |
| [[modules/ferreteria/ferreteria]] | Ferretería + flota por peso | [[modules/ferreteria/compressed]] · ⏳ Pendiente |

---

## 🧭 Decisiones de Arquitectura

| Decisión | Resumen |
|---|---|
| [[decisions/multitenant-strategy]] | `tenant_id` por columna — simple y escalable |
| [[decisions/auth-approach]] | JWT + httpOnly cookie — sin XSS |
| [[decisions/state-management]] | Zustand — sin boilerplate |
| [[decisions/db-design]] | MySQL directo, UUID, soft delete |
| [[brain/variants-and-suppliers]] | Variantes + price tiers + proveedores — arquitectura definitiva |

---

## 🤖 Prompts para Claude

| Prompt | Usar cuando... |
|---|---|
| [[prompts/new-feature]] | Agrego un feature a un módulo existente |
| [[prompts/new-module]] | Creo un módulo desde cero |
| [[prompts/bug-fix]] | Hay un bug que diagnosticar |
| [[prompts/code-review]] | Quiero revisar calidad del código |

---

## 🔧 Scripts de Mantenimiento

| Script | Uso |
|---|---|
| `bash daimuz/scripts/new-module.sh` | Scaffolding inteligente — crea solo los archivos necesarios según tier (micro/standard/full) |

**Prompt de cierre de sesión** (pegar al final de cada sesión):
```
Actualiza los archivos DAIMUZ relevantes basándote en lo que hicimos hoy:
memory/current-state.md, memory/changelog.md, context/current-sprint.md,
memory/lessons-learned.md (si aplica), memory/completed-features.md (si aplica).
```

---

## 📍 Contexto Vivo

| Archivo | Propósito |
|---|---|
| [[context/current-sprint]] | En qué trabajo esta semana |
| [[context/pending]] | Backlog priorizado |
| [[context/environment]] | Variables, servicios, puertos |
| [[context/roles/roles-map]] | Qué puede hacer cada rol |

---

## 🏛️ Bóveda de Conocimiento

| Archivo | Contenido |
|---|---|
| [[vault/api-routes]] | Todos los endpoints REST de la API |
| [[vault/business-rules]] | Reglas de negocio críticas por módulo |
| [[vault/glossary]] | Términos del dominio |
| [[vault/integrations]] | Stripe · WhatsApp · Google · Cloudinary |
| [[vault/external-resources]] | Links y docs externos |
| [[vault/stack/tech-stack]] | Stack completo con decisiones |

---

## 👤 Navegar por Rol

### 🏪 Dueño / Admin
[[modules/dashboard/dashboard]] · [[modules/finances/finances]] · [[modules/sales/sales]] · [[modules/inventory/inventory]] · [[modules/purchases/purchases]] · [[modules/customers/customers]] · [[modules/subscriptions/subscriptions]]

### 💰 Cajero
[[modules/pos/pos]] · [[modules/cash-sessions/cash-sessions]] · [[modules/sales/sales]] · [[modules/scanner/scanner]] · [[flows/sale-flow]]

### 🍳 Cocinero
[[modules/orders/orders]] · [[modules/gastrobar-ops/gastrobar-ops]] · [[modules/recipes/recipes]]

### 🍹 Bartender
[[modules/orders/orders]] · [[modules/gastrobar-ops/gastrobar-ops]] · [[modules/recipes/recipes]] · [[modules/merma/merma]]

### 🍽️ Mesero
[[modules/orders/orders]] · [[modules/gastrobar-ops/gastrobar-ops]] · [[modules/pos/pos]]

### 🚗 Driver / Conductor
[[modules/delivery/delivery]] · [[modules/orders/orders]] · [[flows/delivery-flow]]

### 📦 Encargado de Inventario
[[modules/inventory/inventory]] · [[modules/purchases/purchases]] · [[modules/merma/merma]] · [[modules/scanner/scanner]] · [[flows/inventory-flow]]

### 🌐 Administrador SaaS (superadmin)
[[modules/tenants/tenants]] · [[modules/subscriptions/subscriptions]] · [[modules/auth/auth]]

---

## ⚡ Navegar por Tarea

### "Quiero agregar un feature"
→ [[prompts/new-feature]] → [[brain/coding-standards]] → [[brain/patterns/module-pattern]]

### "Quiero crear un módulo nuevo"
→ [[prompts/new-module]] → [[brain/patterns/module-pattern]] → [[architecture/backend]]

### "Hay un bug"
→ [[prompts/bug-fix]] → [[memory/bugs-history]] → [[memory/important-fixes]]

### "Quiero entender la arquitectura"
→ [[architecture/overview]] → [[architecture/frontend]] → [[architecture/backend]] → [[architecture/database]]

### "Quiero entender el flujo de ventas"
→ [[flows/sale-flow]] → [[synapses/ops-chain]] → [[modules/pos/pos]] → [[modules/sales/sales]] → [[modules/variants/variants]]

### "Quiero entender variantes y proveedores"
→ [[brain/variants-and-suppliers]] → [[modules/variants/variants]] → [[modules/suppliers/suppliers]] → [[flows/supplier-flow]]

### "Quiero entender la autenticación"
→ [[flows/auth-flow]] → [[modules/auth/compressed]] → [[modules/auth/auth]] → [[decisions/auth-approach]]

### "Quiero entender el delivery"
→ [[flows/delivery-flow]] → [[synapses/delivery-chain]] → [[modules/delivery/delivery]]

### "Quiero ver el estado actual"
→ [[memory/current-state]] → [[context/current-sprint]] → [[context/pending]]

### "¿Qué pasa si cambio X módulo?"
→ [[synapses/ops-chain]] o [[synapses/gastrobar-chain]] o [[synapses/delivery-chain]] o [[synapses/saas-chain]]

### "¿Qué ES una venta / pedido / sesión de caja?"
→ [[ontology/entities]]

### "¿Cuáles son las reglas que nunca se rompen?"
→ [[governance/universal-constraints]]

---

## 🕸️ Red Neuronal — Dependencias Clave

> Cómo se conectan los módulos entre sí. Detalle completo en [[synapses/]].

**Núcleo operativo:**
[[modules/pos/pos]] → [[modules/sales/sales]] → [[modules/inventory/inventory]] → [[modules/purchases/purchases]]

**Cadena del cliente:**
[[modules/customers/customers]] → [[modules/sales/sales]] → [[modules/finances/finances]]

**Cadena gastrobar:**
[[modules/recipes/recipes]] → [[modules/inventory/inventory]] → [[modules/merma/merma]] → [[modules/gastrobar-ops/gastrobar-ops]]

**Cadena delivery:**
[[modules/storefront/storefront]] → [[modules/orders/orders]] → [[modules/delivery/delivery]] → [[modules/whatsapp/whatsapp]]

**Cadena SaaS:**
[[modules/subscriptions/subscriptions]] → [[modules/tenants/tenants]] → [[modules/auth/auth]]

**Cadena finanzas:**
[[modules/cash-sessions/cash-sessions]] → [[modules/sales/sales]] → [[modules/finances/finances]]

---

*⬡ DAIMUZ v3.9 — 37 módulos backend · 88 componentes frontend · 11 rutas app/ · 4 indexes completos · 43 compressed.md · 5 sin