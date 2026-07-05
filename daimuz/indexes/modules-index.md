# ⚡ Modules Index — Lopbuk

> Referencia rápida. 1 línea por módulo. Para detalles → `[[modules/[modulo]/[modulo]]]`

## Core / Siempre activos

| Módulo | Función resumida | Archivos clave |
|---|---|---|
| `auth` | Login local+Google, JWT httpOnly, roles | `auth.service.ts`, `auth-store.ts` |
| `tenants` | Multi-tenant SaaS, módulos activables por tenant | `tenants.service.ts` |
| `dashboard` | KPIs en tiempo real: ventas, stock, pedidos | `dashboard.service.ts`, `dashboard.tsx` |
| `users` | CRUD usuarios del tenant, cambio de rol | `users.service.ts`, `users.controller.ts` |
| `sedes` | Multi-sede con caja e inventario independientes | `sedes.routes.ts` |
| `cargos` | Cargos/posiciones personalizadas por tenant (FK desde users.cargo_id) | `cargos.service.ts` |
| `printers` | Impresoras POS por tenant (LAN/USB/BT), asignadas a módulo caja/cocina/bar | `printers.service.ts` |
| `sync` | Sincronización offline-first: ventas y compras pendientes de subir a la nube | `sync.service.ts` |

## Operaciones Core

| Módulo | Función resumida | Archivos clave |
|---|---|---|
| `pos` | Punto de venta: carrito, descuentos, cobro | `point-of-sale.tsx`, `billing-pos.tsx` |
| `cash-sessions` | Apertura/cierre de caja con arqueo | `cash-sessions.service.ts`, `cash-register.tsx` |
| `sales` | Registro inmutable de ventas + cancelaciones auditadas | `sales.service.ts` |
| `inventory` | Kardex de stock, movimientos, alertas mínimo | `inventory.service.ts`, `inventory-list.tsx` |
| `products` | CRUD productos base (sin variantes), categorías, bulk import | `products.service.ts` |
| `variants` | Variantes color/talla, price tiers, stock atómico, resolvePrice, import CSV | `variants.service.ts`, `price-tier.service.ts`, `import.service.ts` |
| `categories` | Categorías: CRUD + color + sort_order + toggle visibilidad | `categories.service.ts` |
| `purchases` | Órdenes de compra a proveedores, ingreso de stock. `suppliers` CRUD incluido | `purchases.service.ts` |
| `suppliers` | Catálogo proveedores, productos por proveedor (N:N), stock por variante | `suppliers.service.ts`, `provider-products.tsx` |
| `customers` | CRM básico, historial de compras, créditos (soft delete; borrado real vía privacy) | `customers.service.ts` |
| `privacy` | 🔐 Ley 1581/RGPD: consentimientos, habeas data, derecho al olvido, retención, auditoría PII | `privacy.service.ts`, `retention.job.ts` |
| `product-templates` | 🧩 Plantillas dinámicas de producto (landing JSON-driven tipo Shopify) | `product-templates.service.ts`, `SectionRenderer.tsx`, `product-template-editor.tsx` |
| `credits` | Fiados: cupo, pagos parciales, historial | `credits.service.ts` |
| `finances` | Flujo de caja, ingresos/egresos, P&L | `finances.service.ts` |
| `coupons` | Cupones de descuento por tenant (código, %, fijo, expiración) | `coupons.routes.ts` |
| `reviews` | Reseñas de productos del storefront (pendiente/aprobado/rechazado) | `reviews.service.ts` |

## Gastrobar

| Módulo | Función resumida | Archivos clave |
|---|---|---|
| `gastrobar-ops` | Centro de mando: food cost, PAR, tendencias | `gastrobar.service.ts`, `gastrobar-ops.tsx` |
| `restbar` | Mesas, comandas, reservas, servicio en piso | `restbar.service.ts`, `reservations.service.ts`, `restbar.tsx` |
| `restbar-finanzas` | Tracker financiero (admin-only): gastos, ingresos, P&L quincenal | `restbar.finanzas.routes.ts`, `restbar-finanzas.tsx` |
| `recipes` | Recetas BOM, cálculo food cost en tiempo real | `recipes.service.ts`, `recipes.tsx` |
| `merma` | Control de desperdicio, justificación auditada | `merma.service.ts`, `merma.tsx` |
| `orders` | Pedidos mesa+delivery con estados y Socket.io | `orders.routes.ts`, `pedidos.tsx` |

## RRHH / Nómina

| Módulo | Función resumida | Archivos clave |
|---|---|---|
| `vendedores` | Comisiones, metas mensuales, nómina generada | `vendedores.service.ts`, `vendedores.controller.ts` |
| `novedades` | Ausencias, permisos, incapacidades, vacaciones por empleado | `novedades.service.ts` |

## Digital / Delivery

| Módulo | Función resumida | Archivos clave |
|---|---|---|
| `storefront` | Tienda online pública por slug, checkout | `storefront.routes.ts`, `app/links/[slug]/page.tsx` |
| `client` | Rutas del cliente registrado (perfil, direcciones, pedidos propios) | `client.routes.ts` |
| `delivery` | Asignación conductor, tracking, estados | `delivery.routes.ts`, `driver-panel.tsx` |
| `fleet` | Gestión de vehículos y flota de despacho | `fleet.routes.ts`, `fleet-management.tsx` |
| `whatsapp` | Evolution API v2, envío/recepción mensajes | `whatsapp.service.ts` |
| `agent` | Agente IA RAG + function calling + WhatsApp | `agent.service.ts`, `agent.rag.ts`, `agent.tools.ts` |
| `chatbot` | Config del chatbot por tenant (superadmin activa/desactiva) | `chatbot.routes.ts`, `ChatWidget.tsx` |
| `scanner` | Escáner código de barras → buscar producto en POS | `barcode-scanner.tsx`, `scanner.socket.ts` |
| `scanner-remote` | Escáner remoto: móvil como barcode reader vía QR | `remote-scanner.tsx`, `app/scanner-remote/[sessionId]/page.tsx` |
| `services` | Catálogo citas/asesorías + disponibilidad + bookings storefront | `services.service.ts`, `services-management.tsx` |
| `portfolio` | Portafolio público de la marca (singleton) | `portfolio.routes.ts`, `app/portfolio/page.tsx` |
| `media-library` | Subida imágenes a Cloudinary | `media-library.routes.ts`, `ui/cloudinary-upload.tsx` |
| `dev-requests` | Solicitudes de nuevas funcionalidades enviadas por tenants | `dev-requests.service.ts`, `developer-requests.tsx` |
## Consumidor (cross-comercio, role cliente)

| Módulo | Función resumida | Archivos clave |
|---|---|---|
| `rutina` | Estilo de vida del usuario final: perfil/objetivos, despensa, recetas (qué puedo cocinar), plan de comidas con macros, lista de compras cross-comercio | `rutina.service.ts`, `rutina.routes.ts`, `consumer-routine.tsx` |
| `gym` | Gimnasio tenant-scoped: miembros, membresías con cobro, planes/ejercicios, progreso, asistencia (check-in/out + racha). Staff en `/api/gym`, miembro en `/api/gym/me` | `gym.service.ts`, `gym.routes.ts`, `gym-management.tsx`, vista miembro en `consumer-routine.tsx` |

> Identidad: `users` (role=cliente) = platform_user global. Perfil por comercio en `customer_tenant_profiles`.

## Rutas Públicas — `app/` (sin auth)

| Ruta | Qué muestra | Componente principal |
|---|---|---|
| `/links/[slug]` | Tienda online del tenant | `StoreBuilder.tsx` / `landing-page.tsx` |
| `/menu/[slug]` | Menú digital gastrobar (QR en mesa) | `app/menu/[slug]/page.tsx` |
| `/reservar/[slug]` | Reservas online del restaurante | `app/reservar/[slug]/page.tsx` |
| `/inmobiliaria/[slug]` | Portal inmobiliario público | `realestate.tsx` |
| `/portfolio` | Portafolio de la marca DAIMUZ | `app/portfolio/page.tsx` |
| `/s/[storeSlug]/[sectionSlug]` | Secciones HTML personalizadas storefront | `app/s/.../page.tsx` |
| `/scanner-remote/[sessionId]` | Escáner de barras en móvil (sesión QR) | `app/scanner-remote/.../page.tsx` |

## SaaS / Pagos

| Módulo | Función resumida | Archivos clave |
|---|---|---|
| `subscriptions` | Planes SaaS, checkout Stripe, control acceso | `subscriptions.service.ts` |
| `stripe` | Webhook Stripe, payment intents, eventos | `stripe.service.ts`, `stripe.controller.ts` |

## Verticales

| Módulo | Función resumida | Estado |
|---|---|---|
| `realestate` | Propiedades, leads CRM, contratos, pagos de arriendo | 🔄 En ajuste |
| `workorders` | Órdenes de servicio (tapicería) con fotos y materiales | 🔄 En ajuste |
| `ferreteria` | Flota por peso, despacho en pista | ⏳ Pendiente |

---

## Navegar por síntoma

- **"Error de autorización"** → `[[modules/auth/auth]]`
- **"No descuenta stock"** → `[[modules/inventory/inventory]]` o `[[modules/variants/variants]]` (variantes)
- **"No aparecen colores/tallas"** → `[[modules/variants/variants]]` (variantes no creadas)
- **"Precio no cambia por cantidad"** → `[[modules/variants/variants]]` (price-tiers no configurados)
- **"No puedo vender"** → `[[modules/cash-sessions/cash-sessions]]` (caja no abierta)
- **"Pedido no llega a cocina"** → `[[modules/orders/orders]]` + Socket.io
- **"Food cost incorrecto"** → `[[modules/recipes/recipes]]`
- **"WhatsApp no responde"** → `[[modules/whatsapp/whatsapp]]` + Evolution API config
- **"Nómina incorrecta"** → `[[modules/vendedores/vendedores]]` (comisiones) + `[[modules/novedades/novedades]]` (descuentos)
- **"Impresora no imprime"** → `[[modules/printers/printers]]` (tipo de conexión + módulo asignado)
- **"Venta offline no subió"** → `[[modules/sync/sync]]` (campo `synced=0` en sales/purchases)

---

← [[DAIMUZ]] | → [[indexes/endpoints-index]]
