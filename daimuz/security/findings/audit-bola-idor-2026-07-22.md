# 🔓 Auditoría de Seguridad — Fase 1: BOLA / IDOR · 2026-07-22

> Barrido de autorización a nivel de objeto (Broken Object Level Authorization / IDOR).
> Método: leer rutas + controller + service de cada módulo y verificar que todo acceso por `id`
> filtre por `tenant_id` (del JWT) o por ownership (`user_id`). Se corrige conforme se encuentra.
> **Lote 1** (alto impacto). El barrido continúa (sales, finances, events, wallet, sedes, products…).
> ⚠️ No compilado en este entorno → correr `tsc`/build antes de desplegar.

---

## 🔴 IDOR-01 — Cross-tenant en `customers` (CRÍTICA) — ✅ CORREGIDA

- **Vulnerabilidad:** `customers.service.ts` exponía `findById`, `update`, `delete` y `getBalance`
  **sin filtrar por `tenant_id`**. Las rutas exigen `authenticate`, pero el controller no propagaba el
  tenant. Un comerciante del tenant A podía, manipulando el `:id`:
  - **Leer** PII y saldo financiero de clientes del tenant B: `GET /api/customers/:id`, `GET /api/customers/:id/balance`.
  - **Modificar** (nombre, cédula, límite de crédito): `PUT /api/customers/:id`.
  - **Borrar** (soft-delete): `DELETE /api/customers/:id`.
- **Severidad:** 🔴 **Crítica** (Broken Access Control — OWASP A01). Fuga de PII (Ley 1581) + datos
  financieros + escritura/borrado cross-tenant.
- **Riesgo:** violación de aislamiento multi-tenant, exposición de datos personales y manipulación de
  cartera de otro comercio. Impacto legal (habeas data) y de integridad.
- **Evidencia:**
  ```sql
  -- findById (antes): sin tenant
  SELECT ... FROM customers c WHERE c.id = ?            -- params: [id]
  -- update (antes): guard y UPDATE sin tenant
  await this.findById(id);  ...  UPDATE customers SET ... WHERE id = ?
  -- delete (antes): UPDATE customers SET is_active=0 WHERE id = ?
  -- getBalance (antes): findById(customerId) sin tenant
  ```
- **Corrección aplicada:** se añadió `tenantId` (del `req.user.tenantId`) como filtro obligatorio en
  todas las consultas y mutaciones:
  ```sql
  WHERE c.id = ? AND c.tenant_id = ?                    -- findById
  UPDATE customers SET ... WHERE id = ? AND tenant_id = ?
  UPDATE customers SET is_active=0, deleted_at=NOW() WHERE id = ? AND tenant_id = ?
  ```
  Firmas actualizadas: `findById(tenantId, id)`, `update(tenantId, id, data)` (ya recibía tenant),
  `delete(tenantId, id)`, `getBalance(tenantId, customerId)`; el controller ahora pasa `tenantId` en
  `findById`, `delete` y `getBalance`.
- **Archivos modificados:** `backend/src/modules/customers/customers.service.ts`,
  `backend/src/modules/customers/customers.controller.ts`.
- **Efectos secundarios:** ninguno esperado. Verifiqué que **ningún módulo externo** llama a
  `customersService.findById/getBalance/delete` (solo el propio controller, en los módulos ya revisados:
  customers, orders, client, credits, sales). El contrato HTTP no cambia (mismas rutas/params). Un `id`
  de otro tenant ahora devuelve **404** en vez de datos. Recomendado un grep repo-wide de
  `customersService.(findById|getBalance|delete)` para confirmar en módulos aún no barridos.

---

## 🟢 client — SIN HALLAZGOS
`client.routes.ts` (auto-servicio del cliente registrado): `authorize('cliente')` + ownership correcto.
`GET /client/orders` → `WHERE o.client_user_id = ?`; `GET /client/orders/:id` → `WHERE o.id = ? AND
o.client_user_id = ?`. Los items se leen de una orden ya verificada como propia. ✅

## 🟡 orders — hallazgos BAJOS (documentados, no corregidos)
Las rutas autenticadas (tras `router.use(authenticate)` en L1604) filtran por `tenant_id`
(`GET /orders/:id`, `/stats`, `PUT /orders/:id/status`). ✅ Las rutas **públicas** de pasarela sí actúan
por `id` sin ownership, pero mitigadas:
- `PUT /orders/cancel-gateway/:orderId` — cancela solo órdenes `pendiente` de pasarela; **id = UUIDv4**
  (no enumerable). Severidad 🟢 Baja. *Mejora sugerida:* token firmado o `client_user_id` cuando exista.
- `GET /orders/{addi,sistecredito}-status/:orderId` — expone solo el enum `status`. 🟢 Baja / informativo.

## 🔴 sales — AUDITADO A FONDO (service + controller + routes) — ✅ CORREGIDO

Niveles verificados: `router.use(authenticate)` (N1 ✅). BFLA correcto en `cancel`, `stats`,
`daily-report`, `vendedores-performance`, `vendedor/:sellerId` (`authorize('comerciante','superadmin')`)
y `findAll` restringe al vendedor a *sus* ventas de *hoy*. Hallazgos:

### 🔴 BOLA-02 — `GET /api/sales/invoice/:invoiceNumber` cross-tenant (CRÍTICA) — ✅ CORREGIDA
- **Evidencia:** `findByInvoiceNumber(invoiceNumber)` → `SELECT * FROM sales WHERE invoice_number = ?`
  (sin tenant). Las **facturas son secuenciales por tenant (FAC-0001, FAC-0002…) → enumerables**: un
  comerciante podía leer ventas completas (montos, cliente, items) de cualquier tenant iterando números.
- **Riesgo:** fuga masiva de datos financieros + PII cross-tenant, fácilmente automatizable.
- **Corrección:** firma `findByInvoiceNumber(tenantId, invoiceNumber)` + `WHERE invoice_number = ? AND tenant_id = ?`; el controller pasa `req.user.tenantId`.
- **Archivos:** `sales.service.ts`, `sales.controller.ts`. **Efectos:** ninguno (mismo contrato HTTP; factura de otro tenant → 404).

### 🔴 BOLA-03 — `GET /api/sales/:id` cross-tenant (ALTA) — ✅ CORREGIDA
- **Evidencia:** `findById(id)` → `SELECT * FROM sales WHERE id = ?` (sin tenant). Lectura de cualquier
  venta por UUID (menos enumerable que la factura, pero igualmente cross-tenant).
- **Corrección:** `findById(tenantId, id)` + `WHERE id = ? AND tenant_id = ?`; callers internos
  (`create`, `cancel`) actualizados; controller pasa tenant.
- **Archivos:** `sales.service.ts`, `sales.controller.ts`. **Efectos:** ninguno.

### 🔴 BOLA-05 — Integridad cross-tenant de stock en `create` (ALTA) — ✅ CORREGIDA
- **Evidencia:** en `create`, `SELECT id, stock, name FROM products WHERE id = ?` (L476) usaba el
  `productId` del body **sin tenant**, y luego decrementaba stock (`UPDATE products SET stock = stock - ?
  WHERE id = ?`). Un vendedor del tenant A podía referenciar un `productId` del tenant B (obtenible de su
  storefront público) y **decrementar el stock del competidor** (sabotaje económico) además de crear una
  venta con producto ajeno.
- **Corrección:** el `SELECT ... FOR UPDATE` de entrada ahora exige `AND tenant_id = ?` → un producto de
  otro tenant devuelve 404 antes de tocar stock. Defensa en profundidad: los `UPDATE products SET stock`
  (venta y anulación) también llevan `AND tenant_id = ?`.
- **Archivos:** `sales.service.ts`. **Efectos:** ninguno (los productos propios funcionan igual).

### 🟢 cancel — endurecido (defensa en profundidad)
`cancel` ya acotaba por tenant en el `SELECT ... FOR UPDATE` (el controller siempre pasa `tenantId`). Se
endureció el `UPDATE sales SET status='anulada'` final para incluir `AND tenant_id = ?` (usando el tenant
de la fila bloqueada), por si algún caller futuro omitiera el parámetro opcional.

### 🟡 BFLA-01 — Vendedor lee ventas ajenas intra-tenant (MEDIA) — ✅ CORREGIDA
- **Evidencia:** `findAll` restringía al `vendedor` a *sus* ventas, pero `GET /sales/:id` y
  `GET /sales/invoice/:num` no → un vendedor podía leer cualquier venta de su propio tenant por id/factura.
- **Corrección (modelo por permisos, no por nombre de rol):** nueva política centralizada
  `canReadAllSales(user)` en `utils/permissions.ts` + permisos `sales.read.all` / `sales.read.own`.
  Regla: `comerciante`/`superadmin` o permiso `sales.read.all` → acceso total; `vendedor` (hasta migrar a
  permisos finos) → acotado a `seller_id = userId`. `findById`/`findByInvoiceNumber` aceptan
  `restrictSellerId` y el controller lo deriva de la política. `findAll` ahora usa **la misma** política
  (elimina el `role === 'vendedor'` disperso) → un solo punto de verdad, listo para crecer.
- **Archivos:** `utils/permissions.ts`, `sales.service.ts`, `sales.controller.ts`.
- **Efectos:** un vendedor pidiendo la venta de otro → 404. Roles no-vendedor y comerciante sin cambios.
  Para dar visión total a un cargo específico en el futuro: otorgarle el permiso `sales.read.all`.

---

## 📊 Matriz de cobertura de seguridad (4 niveles) — por módulo auditado

> ✅ verificado correcto · ⚠️ corregido en esta auditoría · ❌ pendiente/faltante · N/A no aplica

| Módulo | N1 Autenticación | N2 Tenant Isolation | N3 Autorización (rol/permiso) | N4 Ownership |
|---|---|---|---|---|
| customers | ✅ | ⚠️ (era ❌: findById/update/delete/getBalance) | ✅ | N/A |
| client | ✅ | ✅ (`client_user_id`) | ✅ (`authorize('cliente')`) | ✅ |
| orders | ✅ (tras L1604) | ✅ auth-routes; 🟡 públicas por UUID | ✅ | ⚠️ parcial (públicas de pasarela) |
| sales | ✅ | ⚠️ (era ❌: findById/invoice/create-stock) | ✅ (cancel/stats/reportes con `authorize`) | ⚠️ (BFLA-01 → política `sales.read.all`) |
| payments / finances | ⏳ | ⏳ | ⏳ | ⏳ |
| customer-engagement (wallet) | ⏳ | ⏳ | ⏳ | ⏳ |
| events | ⏳ | ⏳ | ⏳ | ⏳ |
| sedes / products / delivery / subscriptions | ⏳ | ⏳ | ⏳ | ⏳ |

---

## Estado del barrido
| Módulo | Estado |
|---|---|
| customers | 🔴→✅ Corregido (IDOR-01) |
| client | 🟢 Limpio |
| orders | 🟡 Bajo (documentado) |
| sales | 🔴→✅ Corregido (BOLA-02/03/05, cancel endurecido); 🟡 BFLA-01 pendiente decisión |
| payments/finances, events, customer-engagement (wallet), sedes, products, delivery, subscriptions | ⏳ Pendientes |

## Resumen de severidades (hasta ahora)
| ID | Módulo | Tipo | Severidad | Estado |
|---|---|---|---|---|
| IDOR-01 | customers | BOLA lectura+escritura+borrado | 🔴 Crítica | ✅ Corregido |
| BOLA-02 | sales | BOLA lectura (factura enumerable) | 🔴 Crítica | ✅ Corregido |
| BOLA-03 | sales | BOLA lectura (por id) | 🟠 Alta | ✅ Corregido |
| BOLA-05 | sales | Integridad cross-tenant (stock) | 🟠 Alta | ✅ Corregido |
| BFLA-01 | sales | Vendedor lee ventas ajenas intra-tenant | 🟡 Media | ⏳ Pendiente (decisión) |
| orders (público) | orders | BOLA por id (UUID, mitigado) | 🟢 Baja | 📝 Documentado |

← [[security/README]] | [[security/audit-plan#fase-4]]
