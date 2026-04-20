# StockPro - Sistema de Gestion de Inventario

Sistema completo de gestion de inventario y punto de venta (POS) para tienda de ropa masculina, localizado para Colombia (COP, IVA 19%).

---

## Tabla de Contenidos

1. [Stack Tecnologico](#stack-tecnologico)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Instalacion y Configuracion](#instalacion-y-configuracion)
4. [Base de Datos (MySQL)](#base-de-datos-mysql)
5. [API REST - Endpoints](#api-rest---endpoints)
6. [Servicios Backend - Logica de Negocio](#servicios-backend---logica-de-negocio)
7. [Frontend - Componentes y Estado](#frontend---componentes-y-estado)
8. [Tipos TypeScript Compartidos](#tipos-typescript-compartidos)
9. [Autenticacion y Roles](#autenticacion-y-roles)
10. [Flujos de Negocio Clave](#flujos-de-negocio-clave)
11. [Guia para Implementar Mejoras](#guia-para-implementar-mejoras)

---

## Stack Tecnologico

### Backend

| Tecnologia | Version | Proposito |
|---|---|---|
| Node.js + Express | 4.21.0 | Servidor HTTP y API REST |
| TypeScript | 5.5.4 | Tipado estatico |
| MySQL2 | 3.11.0 | Driver de base de datos (pool de conexiones) |
| JSON Web Token | 9.0.2 | Autenticacion JWT |
| bcryptjs | 2.4.3 | Hash de contrasenas |
| express-validator | 7.2.0 | Validacion de requests |
| cors | 2.8.5 | Manejo de CORS |
| dotenv | 16.4.5 | Variables de entorno |
| uuid | 10.0.0 | Generacion de IDs unicos |
| ts-node-dev | 2.0.0 | Hot reload en desarrollo |

### Frontend

| Tecnologia | Version | Proposito |
|---|---|---|
| Next.js | 16.0.10 | Framework React (App Router) |
| React | 19.2.0 | UI Library |
| TypeScript | 5.x | Tipado estatico |
| Zustand | 5.0.10 | State management |
| Tailwind CSS | 4.1.9 | Estilos utility-first |
| shadcn/ui (New York) | - | Componentes UI (Radix UI) |
| Recharts | 2.15.4 | Graficos y visualizaciones |
| React Hook Form + Zod | 7.60.0 / 3.25.76 | Formularios y validacion |
| Lucide React | 0.454.0 | Iconos |
| Sonner | 1.7.4 | Notificaciones toast |
| date-fns | 4.1.0 | Manejo de fechas |
| next-themes | 0.4.6 | Soporte dark mode |

---

## Estructura del Proyecto

```
inventariodaniel/
├── backend/
│   ├── src/
│   │   ├── index.ts                          # Entry point del servidor
│   │   ├── config/
│   │   │   ├── env.ts                        # Variables de entorno
│   │   │   ├── database.ts                   # Pool MySQL (connectionLimit: 10)
│   │   │   └── index.ts
│   │   ├── common/
│   │   │   ├── types/index.ts                # Interfaces TypeScript (backend)
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.ts         # JWT verify + role authorization
│   │   │       ├── error.middleware.ts        # Error handler global
│   │   │       └── index.ts
│   │   ├── utils/
│   │   │   ├── validators.ts                 # Validadores express-validator
│   │   │   ├── formatters.ts                 # formatCOP, generateId, TAX_RATE
│   │   │   └── index.ts
│   │   └── modules/
│   │       ├── index.ts                      # Router principal (monta todos los modulos)
│   │       ├── auth/
│   │       │   ├── auth.routes.ts
│   │       │   ├── auth.service.ts
│   │       │   ├── auth.controller.ts
│   │       │   └── index.ts
│   │       ├── users/                        # (misma estructura)
│   │       ├── products/
│   │       ├── sales/
│   │       ├── inventory/
│   │       ├── customers/
│   │       ├── credits/
│   │       ├── dashboard/
│   │       └── categories/
│   ├── inventariodaniel.sql                  # Schema completo + datos iniciales
│   ├── tsconfig.json                         # Target: ES2020, strict, path aliases
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                        # Root layout (dark mode, Toaster, Analytics)
│   │   ├── page.tsx                          # Pagina principal (auth check + routing)
│   │   ├── globals.css                       # Variables CSS OKLch, tema oscuro
│   │   └── favicon.ico
│   ├── components/
│   │   ├── main-layout.tsx                   # Layout con Sidebar + Header
│   │   ├── header.tsx                        # Barra superior
│   │   ├── sidebar.tsx                       # Navegacion lateral (role-based)
│   │   ├── auth-form.tsx                     # Login / Registro
│   │   ├── dashboard.tsx                     # Metricas y graficos
│   │   ├── analytics.tsx                     # Analytics avanzados
│   │   ├── inventory-list.tsx                # CRUD de productos
│   │   ├── point-of-sale.tsx                 # Punto de venta
│   │   ├── sales-history.tsx                 # Historial de ventas
│   │   ├── customers.tsx                     # Gestion de clientes
│   │   ├── credits.tsx                       # Gestion de creditos/fiados
│   │   ├── fiado-checkout.tsx                # Checkout para ventas fiado
│   │   ├── fiados.tsx                        # Re-export de Credits
│   │   ├── invoicing.tsx                     # Facturacion
│   │   ├── settings.tsx                      # Configuracion
│   │   └── ui/                               # Componentes shadcn/ui
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── dialog.tsx
│   │       ├── tabs.tsx
│   │       ├── badge.tsx
│   │       ├── textarea.tsx
│   │       ├── dropdown-menu.tsx
│   │       └── alert-dialog.tsx
│   ├── lib/
│   │   ├── api.ts                            # ApiService (singleton, ~500 lineas)
│   │   ├── store.ts                          # Zustand store principal (~350 lineas)
│   │   ├── auth-store.ts                     # Zustand auth store
│   │   ├── types.ts                          # Interfaces TypeScript (frontend)
│   │   └── utils.ts                          # formatCOP, formatNumber, cn()
│   ├── components.json                       # Config shadcn/ui
│   ├── postcss.config.mjs
│   ├── tsconfig.json                         # Target: ES2017, path alias @/*
│   └── package.json
│
├── README.md                                 # Info general del producto
└── README copy.md                            # (este archivo) Documentacion tecnica
```

---

## Instalacion y Configuracion

### Requisitos Previos

- Node.js >= 18
- MySQL 8.0+
- pnpm (gestor de paquetes usado en el proyecto)

### Variables de Entorno (backend/.env)

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=stockpro_db
JWT_SECRET=cambiar_en_produccion
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
API_PREFIX=/api
```

### Variables de Entorno (frontend/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Pasos de Instalacion

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd inventariodaniel

# 2. Crear la base de datos
mysql -u root -p < backend/inventariodaniel.sql

# 3. Instalar dependencias del backend
cd backend
pnpm install

# 4. Crear archivo .env en backend/ con las variables de arriba

# 5. Iniciar el backend en modo desarrollo
pnpm dev          # Inicia en http://localhost:3001

# 6. En otra terminal, instalar dependencias del frontend
cd frontend
pnpm install

# 7. Iniciar el frontend
pnpm dev          # Inicia en http://localhost:3000
```

### Usuarios por Defecto

| Email | Password | Rol |
|---|---|---|
| admin@stockpro.com | admin123 | admin |
| vendedor@stockpro.com | admin123 | vendedor |

### Scripts Disponibles

**Backend:**
- `pnpm dev` - Desarrollo con hot reload (ts-node-dev)
- `pnpm build` - Compilar TypeScript
- `pnpm start` - Ejecutar build compilado
- `pnpm lint` - ESLint

**Frontend:**
- `pnpm dev` - Desarrollo Next.js
- `pnpm build` - Build produccion
- `pnpm start` - Servidor produccion
- `pnpm lint` - ESLint

---

## Base de Datos (MySQL)

### Nombre: `stockpro_db`

### Diagrama de Tablas

```
users (id PK)
  └──> sales.seller_id (FK)
  └──> credit_payments.received_by (FK)

categories (id PK)
  └──> products.category (FK)

products (id PK)
  └──> sale_items.product_id (FK)
  └──> stock_movements.product_id (FK)

customers (id PK)
  └──> sales.customer_id (FK)
  └──> credit_payments.customer_id (FK)

sales (id PK)
  └──> sale_items.sale_id (FK, CASCADE DELETE)
  └──> credit_payments.sale_id (FK)

invoice_sequence (id PK) - Generador consecutivo facturas
payment_receipt_sequence (id PK) - Generador consecutivo recibos
```

### Tablas Detalladas

#### `users` - Usuarios del sistema
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(36) | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password | VARCHAR(255) | NOT NULL (bcrypt hash) |
| name | VARCHAR(255) | NOT NULL |
| role | ENUM('admin','vendedor') | NOT NULL, DEFAULT 'vendedor' |
| avatar | VARCHAR(500) | NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | AUTO UPDATE |

#### `categories` - Categorias de productos
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(50) | PK |
| name | VARCHAR(100) | NOT NULL |
| description | VARCHAR(255) | NULL |

**Categorias iniciales:** camisas, pantalones, zapatos, accesorios, ropa-interior, abrigos, trajes, deportivo

#### `products` - Productos del inventario
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(36) | PK |
| name | VARCHAR(255) | NOT NULL |
| category | VARCHAR(50) | FK -> categories.id |
| brand | VARCHAR(100) | NULL |
| size | ENUM('XS','S','M','L','XL','XXL','XXXL') | NULL |
| color | VARCHAR(50) | NULL |
| purchase_price | DECIMAL(12,2) | NOT NULL, DEFAULT 0 |
| sale_price | DECIMAL(12,2) | NOT NULL, DEFAULT 0 |
| sku | VARCHAR(50) | UNIQUE, NOT NULL |
| stock | INT | NOT NULL, DEFAULT 0 |
| reorder_point | INT | DEFAULT 5 |
| supplier | VARCHAR(255) | NULL |
| entry_date | DATE | NULL |
| image_url | VARCHAR(500) | NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | AUTO UPDATE |

**Indices:** idx_category, idx_sku, idx_stock

#### `customers` - Clientes
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(36) | PK |
| cedula | VARCHAR(20) | UNIQUE, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| phone | VARCHAR(20) | NULL |
| email | VARCHAR(255) | NULL |
| address | VARCHAR(500) | NULL |
| credit_limit | DECIMAL(12,2) | DEFAULT 0 |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | AUTO UPDATE |

**Indices:** idx_customers_cedula, idx_customers_name

#### `sales` - Ventas / Facturas
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(36) | PK |
| invoice_number | VARCHAR(20) | UNIQUE |
| customer_id | VARCHAR(36) | FK -> customers.id, NULL |
| customer_name | VARCHAR(255) | NULL |
| customer_phone | VARCHAR(20) | NULL |
| customer_email | VARCHAR(255) | NULL |
| subtotal | DECIMAL(12,2) | NOT NULL |
| tax | DECIMAL(12,2) | NOT NULL |
| discount | DECIMAL(12,2) | DEFAULT 0 |
| total | DECIMAL(12,2) | NOT NULL |
| payment_method | ENUM('efectivo','tarjeta','transferencia','fiado') | NOT NULL |
| amount_paid | DECIMAL(12,2) | DEFAULT 0 |
| change_amount | DECIMAL(12,2) | DEFAULT 0 |
| seller_id | VARCHAR(36) | FK -> users.id |
| seller_name | VARCHAR(255) | NULL |
| status | ENUM('completada','anulada') | DEFAULT 'completada' |
| credit_status | ENUM('pendiente','parcial','pagado') | NULL |
| due_date | DATE | NULL |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | AUTO UPDATE |

**Indices:** invoice_number, status, created_at, credit_status, payment_method, due_date

#### `sale_items` - Items de cada venta
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(36) | PK |
| sale_id | VARCHAR(36) | FK -> sales.id (CASCADE DELETE) |
| product_id | VARCHAR(36) | FK -> products.id (RESTRICT) |
| product_name | VARCHAR(255) | NOT NULL |
| product_sku | VARCHAR(50) | NOT NULL |
| quantity | INT | NOT NULL |
| unit_price | DECIMAL(12,2) | NOT NULL |
| discount | DECIMAL(12,2) | DEFAULT 0 |
| subtotal | DECIMAL(12,2) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

#### `stock_movements` - Movimientos de inventario (auditoria)
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(36) | PK |
| product_id | VARCHAR(36) | FK -> products.id |
| type | ENUM('entrada','salida','ajuste','venta','devolucion') | NOT NULL |
| quantity | INT | NOT NULL |
| previous_stock | INT | NOT NULL |
| new_stock | INT | NOT NULL |
| reason | VARCHAR(255) | NULL |
| reference_id | VARCHAR(36) | NULL (ID de venta, etc.) |
| user_id | VARCHAR(36) | NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Indices:** idx_product, idx_type, idx_created

#### `credit_payments` - Abonos a creditos
| Columna | Tipo | Restriccion |
|---|---|---|
| id | VARCHAR(36) | PK |
| sale_id | VARCHAR(36) | FK -> sales.id |
| customer_id | VARCHAR(36) | FK -> customers.id |
| amount | DECIMAL(12,2) | NOT NULL |
| payment_method | ENUM('efectivo','tarjeta','transferencia') | NOT NULL |
| receipt_number | VARCHAR(20) | NULL |
| notes | TEXT | NULL |
| received_by | VARCHAR(36) | FK -> users.id |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Indices:** sale_id, customer_id, created_at

#### `invoice_sequence` - Consecutivo de facturas
| Columna | Tipo | Restriccion |
|---|---|---|
| id | INT | PK, AUTO_INCREMENT |
| prefix | VARCHAR(10) | DEFAULT 'FAC' |
| current_number | INT | DEFAULT 0 |

#### `payment_receipt_sequence` - Consecutivo de recibos
| Columna | Tipo | Restriccion |
|---|---|---|
| id | INT | PK, AUTO_INCREMENT |
| prefix | VARCHAR(10) | DEFAULT 'REC' |
| current_number | INT | DEFAULT 0 |

### Vistas

| Vista | Descripcion |
|---|---|
| `v_products_stock_status` | Productos con estado de stock (agotado/bajo/suficiente) |
| `v_sales_detail` | Ventas con conteo de items y cantidades totales |
| `v_dashboard_metrics` | Metricas agregadas para dashboard |
| `v_customer_balances` | Saldos de credito por cliente (total credito, pagado, pendiente) |

### Stored Procedures

| Procedimiento | Parametros | Descripcion |
|---|---|---|
| `sp_generate_invoice_number` | OUT new_invoice VARCHAR(20) | Auto-incrementa y retorna numero de factura (FAC-000001) |
| `sp_register_stock_movement` | - | Registra movimiento de stock con validacion |
| `sp_get_top_selling_products` | IN limit_count INT | Top productos por cantidad vendida |
| `sp_get_sales_by_category` | - | Ventas agrupadas por categoria |
| `sp_update_credit_status` | IN p_sale_id VARCHAR(36) | Actualiza estado de credito (pendiente/parcial/pagado) |
| `sp_generate_receipt_number` | OUT new_receipt VARCHAR(20) | Auto-incrementa y retorna numero de recibo (REC-000001) |

### Triggers

| Trigger | Tabla | Descripcion |
|---|---|---|
| `tr_products_updated_at` | products | Auto-actualiza updated_at en UPDATE |
| `tr_users_updated_at` | users | Auto-actualiza updated_at en UPDATE |

---

## API REST - Endpoints

**Base URL:** `http://localhost:3001/api`
**Autenticacion:** Bearer token JWT en header `Authorization`

### Auth (`/api/auth`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/auth/login` | No | Login (email, password) -> token + user |
| POST | `/auth/register` | No | Registro (email, password, name, role) |
| GET | `/auth/profile` | Si | Perfil del usuario autenticado |
| PUT | `/auth/profile` | Si | Actualizar perfil (name, avatar) |
| PUT | `/auth/change-password` | Si | Cambiar contrasena (currentPassword, newPassword) |

### Users (`/api/users`) - Solo Admin

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/users` | Admin | Listar usuarios (page, limit) |
| GET | `/users/:id` | Admin | Obtener usuario por ID |
| POST | `/users` | Admin | Crear usuario |
| PUT | `/users/:id` | Admin | Actualizar usuario (name, role, avatar) |
| DELETE | `/users/:id` | Admin | Eliminar usuario |
| PUT | `/users/:id/reset-password` | Admin | Reset de contrasena |

### Products (`/api/products`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/products` | Si | Listar productos (page, limit, category, stockStatus, search) |
| GET | `/products/low-stock` | Si | Productos bajo punto de reorden |
| GET | `/products/out-of-stock` | Si | Productos agotados |
| GET | `/products/sku/:sku` | Si | Buscar producto por SKU |
| GET | `/products/:id` | Si | Obtener producto por ID |
| POST | `/products` | Si | Crear producto |
| PUT | `/products/:id` | Si | Actualizar producto |
| DELETE | `/products/:id` | Si | Eliminar producto |

**Campos de producto:** name, category, brand, size (XS-XXXL), color, purchasePrice, salePrice, sku, stock, reorderPoint, supplier, entryDate, imageUrl

### Sales (`/api/sales`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/sales` | Si | Listar ventas (page, limit, status, paymentMethod) |
| GET | `/sales/recent` | Si | Ultimas 5 ventas completadas |
| GET | `/sales/invoice/:invoiceNumber` | Si | Buscar por numero de factura |
| GET | `/sales/:id` | Si | Detalle de venta con items |
| POST | `/sales` | Si | Crear venta (ver payload abajo) |
| PUT | `/sales/:id/cancel` | Admin | Anular venta (restaura stock) |

**Payload de creacion de venta:**
```json
{
  "items": [
    { "productId": "uuid", "quantity": 2, "discount": 10 }
  ],
  "paymentMethod": "efectivo|tarjeta|transferencia|fiado",
  "amountPaid": 150000,
  "sellerName": "Nombre",
  "customerName": "Opcional",
  "customerId": "uuid (requerido si fiado)",
  "customerPhone": "Opcional",
  "customerEmail": "Opcional",
  "creditDays": 30
}
```

### Inventory (`/api/inventory`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/inventory/movements` | Si | Listar movimientos (page, limit, type) |
| GET | `/inventory/movements/product/:productId` | Si | Movimientos de un producto |
| POST | `/inventory/adjust` | Admin | Ajuste manual de stock |
| POST | `/inventory/bulk-adjust` | Admin | Ajuste masivo de stock |

**Payload de ajuste:**
```json
{
  "productId": "uuid",
  "quantity": 10,
  "type": "entrada|salida|ajuste",
  "reason": "Motivo del ajuste"
}
```

### Customers (`/api/customers`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/customers` | Si | Listar clientes con saldos (page, limit, search) |
| GET | `/customers/search?q=query` | Si | Buscar clientes (nombre, telefono, cedula) |
| GET | `/customers/:id` | Si | Detalle de cliente con saldo |
| GET | `/customers/:id/balance` | Si | Saldo de credito del cliente |
| POST | `/customers` | Si | Crear cliente |
| PUT | `/customers/:id` | Si | Actualizar cliente |
| DELETE | `/customers/:id` | Si | Eliminar (solo si saldo = 0) |

**Campos de cliente:** cedula, name, phone, email, address, creditLimit, notes

### Credits (`/api/credits`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/credits` | Si | Listar creditos pendientes/parciales (page, limit, customerId, status) |
| GET | `/credits/summary` | Si | Resumen: totalPending, totalCredits, customersWithDebt |
| GET | `/credits/:saleId` | Si | Detalle de credito (venta + pagos + saldo) |
| GET | `/credits/:saleId/payments` | Si | Historial de pagos de un credito |
| POST | `/credits/:saleId/payments` | Si | Registrar abono |

**Payload de abono:**
```json
{
  "amount": 50000,
  "paymentMethod": "efectivo|tarjeta|transferencia",
  "notes": "Abono parcial"
}
```

### Dashboard (`/api/dashboard`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/dashboard/metrics` | Si | Metricas completas del dashboard |
| GET | `/dashboard/sales-trend?days=7` | Si | Tendencia de ventas (datos para grafico) |
| GET | `/dashboard/store-info` | Si | Informacion de la tienda |
| PUT | `/dashboard/store-info` | Admin | Actualizar info de tienda |

### Categories (`/api/categories`)

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | `/categories` | Si | Listar categorias |
| POST | `/categories` | Si | Crear categoria (id, name, description?) |
| DELETE | `/categories/:id` | Si | Eliminar (solo si no tiene productos) |

---

## Servicios Backend - Logica de Negocio

### AuthService
- `login(email, password)` - Verifica credenciales con bcrypt, genera JWT (24h)
- `register(email, password, name, role)` - Hash de password, crea usuario, retorna JWT
- `getProfile(userId)` - Retorna usuario sin password
- `updateProfile(userId, data)` - Actualiza nombre y/o avatar
- `changePassword(userId, currentPassword, newPassword)` - Verifica password actual, hashea nuevo

### ProductsService
- `findAll(page, limit, filters)` - Paginado con filtros: category, stockStatus, search, rango de precio
- `findById(id)` / `findBySku(sku)` - Busqueda individual
- `create(data)` - Valida SKU unico, inserta producto
- `update(id, data)` - Actualizacion parcial, verifica SKU unico
- `delete(id)` - Falla si tiene sale_items asociados
- `updateStock(id, quantity)` - Suma/resta al stock actual
- `getLowStock()` / `getOutOfStock()` - Consultas por estado

### SalesService
- `create(data)` - **Transaccion MySQL:**
  1. Valida que productos existan y tengan stock suficiente
  2. Genera numero de factura con `sp_generate_invoice_number`
  3. Calcula subtotales con descuentos por item (porcentaje)
  4. Aplica IVA 19% sobre subtotal
  5. Si es `fiado`: amount_paid=0, credit_status='pendiente', calcula due_date
  6. Si es efectivo: calcula cambio (falla si pago insuficiente)
  7. Inserta venta, items y movimientos de stock
  8. Commit o rollback atomico
- `cancel(id, userId)` - Revierte movimientos de stock, marca como `anulada`
- `findAll/findById/findByInvoiceNumber` - Con items cargados

### CustomersService
- `findAll(page, limit, search?)` - Con calculo de saldo en la query
- `search(query)` - Busqueda rapida nombre/telefono/cedula (max 10)
- `create(data)` - Valida cedula unica
- `delete(id)` - Falla si tiene saldo pendiente > 0

### CreditsService
- `registerPayment(saleId, amount, paymentMethod, userId)` - **Transaccion:**
  1. Bloquea registro de venta (SELECT FOR UPDATE)
  2. Valida monto <= saldo restante
  3. Genera numero de recibo con `sp_generate_receipt_number`
  4. Inserta pago
  5. Actualiza credit_status: pendiente -> parcial -> pagado
  6. Actualiza amount_paid en la venta
- `getSummary()` - totalPending, totalCredits, customersWithDebt

### DashboardService
- `getMetrics()` - Queries complejas:
  - Total productos, valor del inventario (stock * sale_price)
  - Productos con stock bajo/agotado
  - Ventas diarias/semanales/mensuales (incluye credit_payments)
  - Top 5 productos por cantidad vendida
  - Ventas por categoria
  - Ultimas 5 ventas
- `getSalesTrend(days)` - Datos para grafico lineal (ventas + abonos por dia)

### InventoryService
- `adjustStock(productId, quantity, type, reason, userId)` - **Transaccion:**
  - `entrada`: stock += quantity
  - `salida`: stock -= quantity (falla si resultaria negativo)
  - `ajuste`: stock = quantity (valor absoluto)
  - Registra movimiento con stock anterior y nuevo
- `bulkAdjustStock(adjustments, userId)` - Itera y llama adjustStock

---

## Frontend - Componentes y Estado

### Zustand Stores

#### `useStore()` - Store Principal
```typescript
// Productos
products: Product[]
isLoadingProducts: boolean
fetchProducts(): Promise<void>
addProduct(data): Promise<Product>
updateProduct(id, data): Promise<Product>
deleteProduct(id): Promise<void>

// Carrito (local, no API)
cart: CartItem[]
addToCart(product): void
removeFromCart(productId): void
updateCartQuantity(productId, quantity): void
applyItemDiscount(productId, discount): void
clearCart(): void

// Ventas
sales: Sale[]
isLoadingSales: boolean
fetchSales(): Promise<void>
addSale(data): Promise<Sale>
cancelSale(id, reason): Promise<void>

// Movimientos de stock
stockMovements: StockMovement[]
fetchStockMovements(): Promise<void>
addStockMovement(data): Promise<void>

// Categorias
categories: Category[]
fetchCategories(): Promise<void>
addCategory(data): Promise<void>
deleteCategory(id): Promise<void>

// UI State
activeSection: string
setActiveSection(section): void
sidebarOpen: boolean
setSidebarOpen(open): void
toggleSidebar(): void

// Cliente seleccionado (para fiado)
selectedCustomer: Customer | null
setSelectedCustomer(customer): void

// Info de tienda (persistido en localStorage)
storeInfo: { name, address, phone, email, taxId, invoiceGreeting, invoicePolicy }
```

**Persistencia:** cart, storeInfo, activeSection -> `stockpro-storage` (localStorage)

#### `useAuthStore()` - Store de Autenticacion
```typescript
user: User | null
isAuthenticated: boolean
isLoading: boolean
login(email, password): Promise<void>
register(email, password, name, role): Promise<void>
logout(): void
updateProfile(data): Promise<void>
checkAuth(): Promise<void>
```

**Persistencia:** user, isAuthenticated -> `stockpro-auth` (localStorage)

### Funciones Helper
- `getStockStatus(product)` -> 'suficiente' | 'bajo' | 'agotado'
- `calculateCartTotals(cart)` -> { subtotal, tax, total } (TAX_RATE = 0.19)

### ApiService (Singleton)
- Almacena token en `localStorage('authToken')`
- Envia `Authorization: Bearer <token>` en cada request
- URL base: `NEXT_PUBLIC_API_URL` (default: `http://localhost:3001/api`)
- Metodos espejo de todos los endpoints del backend

### Componentes Principales

| Componente | Archivo | Rol | Descripcion |
|---|---|---|---|
| AuthForm | auth-form.tsx | Admin/Vendedor | Login y registro con validacion |
| MainLayout | main-layout.tsx | Wrapper | Sidebar + Header + contenido |
| Sidebar | sidebar.tsx | Navegacion | Menu lateral con filtro por rol |
| Header | header.tsx | UI | Titulo, busqueda, menu usuario |
| Dashboard | dashboard.tsx | Admin | Cards de metricas, graficos Recharts, alertas |
| Analytics | analytics.tsx | Admin | Rentabilidad, ROI, margenes, rotacion |
| InventoryList | inventory-list.tsx | Admin | Tabla CRUD productos, filtros, categorias |
| PointOfSale | point-of-sale.tsx | Todos | Browser de productos, carrito, checkout |
| FiadoCheckout | fiado-checkout.tsx | Todos | Seleccion/creacion cliente para fiado |
| SalesHistory | sales-history.tsx | Todos | Tabla ventas, filtros, detalle, impresion |
| Customers | customers.tsx | Admin | CRUD clientes, busqueda, saldos |
| Credits | credits.tsx | Admin | Creditos pendientes, abonos, historial |
| Invoicing | invoicing.tsx | Admin | Lista facturas, detalle, impresion |
| Settings | settings.tsx | Admin | Info tienda, perfil, usuarios, exportar datos |

### Navegacion por Secciones (Client-Side)

```
activeSection (useStore) determina que componente se renderiza:

Admin puede acceder a:
  - dashboard    -> <Dashboard />
  - inventory    -> <InventoryList />
  - pos          -> <PointOfSale />
  - history      -> <SalesHistory />
  - invoices     -> <Invoicing />
  - customers    -> <Customers />
  - fiados       -> <Credits />
  - analytics    -> <Analytics />
  - settings     -> <Settings />

Vendedor solo puede acceder a:
  - pos          -> <PointOfSale />
  - history      -> <SalesHistory />
  (se fuerza redireccion a 'pos' si intenta otra seccion)
```

### Tema y Estilos

- **Modo:** Dark mode forzado (`html class="dark"`)
- **Colores:** Variables CSS con OKLch color space
  - Primary: Verde (oklch 0.65 0.18 145)
  - Background: Azul muy oscuro
  - Destructive: Rojo
- **Responsivo:** Mobile-first con breakpoints sm/md/lg/xl
- **Componentes UI:** shadcn/ui estilo "New York"

### localStorage Keys

| Key | Contenido |
|---|---|
| `authToken` | JWT token |
| `stockpro-storage` | Store Zustand (cart, storeInfo, activeSection) |
| `stockpro-auth` | Auth store (user, isAuthenticated) |
| `fiado.maxLimit` | Limite de credito configurado |
| `fiado.dueDays` | Dias de plazo para fiados |

---

## Tipos TypeScript Compartidos

### Backend (`backend/src/common/types/index.ts`)

```typescript
interface User { id, email, password?, name, role, avatar?, createdAt, updatedAt }
interface Product { id, name, category, brand?, size?, color?, purchasePrice, salePrice, sku, stock, reorderPoint, supplier?, entryDate?, imageUrl?, createdAt, updatedAt }
interface Sale { id, invoiceNumber, customerId?, customerName?, customerPhone?, customerEmail?, subtotal, tax, discount, total, paymentMethod, amountPaid, changeAmount, sellerId, sellerName?, status, creditStatus?, dueDate?, notes?, items?, createdAt, updatedAt }
interface SaleItem { id, saleId, productId, productName, productSku, quantity, unitPrice, discount, subtotal }
interface StockMovement { id, productId, type, quantity, previousStock, newStock, reason?, referenceId?, userId?, createdAt }
interface Customer { id, cedula, name, phone?, email?, address?, creditLimit, notes?, createdAt, updatedAt }
interface CreditPayment { id, saleId, customerId, amount, paymentMethod, receiptNumber?, notes?, receivedBy, createdAt }
interface Category { id, name, description? }
interface StoreInfo { id, name, address, phone, taxId, email, logoUrl? }
```

### Frontend (`frontend/lib/types.ts`)

```typescript
// Mismas interfaces con algunas adiciones:
interface CartItem { product: Product, quantity: number, discount: number }
interface CustomerFull extends Customer { totalCredit?, totalPaid?, balance? }
interface CreditDetail { sale: Sale, payments: CreditPayment[], totalPaid, balance, creditStatus }
interface DashboardMetrics { totalProducts, totalInventoryValue, dailySales, weeklySales, monthlySales, lowStockProducts, outOfStockProducts, topSellingProducts, salesByCategory, recentSales }

type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'
type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado'
type CreditStatus = 'pendiente' | 'parcial' | 'pagado'
type StockStatus = 'suficiente' | 'bajo' | 'agotado'
```

---

## Autenticacion y Roles

### Flujo JWT

1. Usuario envia `POST /api/auth/login` con email y password
2. Backend verifica con bcrypt, genera JWT con `{ userId, email, role }`
3. Token se almacena en `localStorage('authToken')` en el frontend
4. Cada request envia `Authorization: Bearer <token>`
5. Middleware `authenticate` verifica y decodifica el token
6. Middleware `authorize(...roles)` verifica el rol del usuario

### Configuracion JWT
- **Secret:** Variable `JWT_SECRET` (cambiar en produccion)
- **Expiracion:** `JWT_EXPIRES_IN` (default: 24 horas)

### Permisos por Rol

| Funcionalidad | Admin | Vendedor |
|---|---|---|
| Dashboard y metricas | Si | No |
| Analytics | Si | No |
| CRUD Productos | Si | No |
| Punto de Venta | Si | Si |
| Historial de Ventas | Si | Si |
| Anular Ventas | Si | No |
| Gestion de Clientes | Si | No |
| Gestion de Creditos | Si | No |
| Ajustar Inventario | Si | No |
| Configuracion | Si | No |
| Gestion de Usuarios | Si | No |
| Facturacion | Si | No |

---

## Flujos de Negocio Clave

### 1. Flujo de Venta Normal (efectivo/tarjeta/transferencia)

```
1. Vendedor busca productos en POS (por nombre/SKU/categoria)
2. Agrega productos al carrito con cantidades
3. Opcionalmente aplica descuento por item (%)
4. Selecciona metodo de pago
5. Si efectivo: ingresa monto recibido, se calcula cambio
6. Se crea la venta (POST /api/sales)
   Backend en transaccion:
   a. Valida stock de cada producto
   b. Genera numero factura (FAC-XXXXXX)
   c. Calcula subtotales, descuentos, IVA 19%
   d. Inserta sale + sale_items
   e. Descuenta stock de cada producto
   f. Registra stock_movements tipo 'venta'
   g. Commit
7. Frontend muestra factura para impresion
8. Se limpia el carrito
```

### 2. Flujo de Venta Fiado (credito)

```
1. Vendedor arma el carrito normalmente
2. Selecciona metodo de pago "fiado"
3. Se abre FiadoCheckout:
   a. Busca cliente existente (cedula/nombre/telefono)
   b. O crea nuevo cliente con limite de credito
   c. Valida que el total no exceda limite de credito disponible
4. Se crea la venta con:
   - payment_method = 'fiado'
   - amount_paid = 0
   - credit_status = 'pendiente'
   - due_date = hoy + creditDays
5. El saldo queda pendiente en el sistema de creditos
```

### 3. Flujo de Abono a Credito

```
1. Admin va a seccion Fiados/Creditos
2. Ve lista de creditos pendientes/parciales
3. Selecciona un credito para ver detalle
4. Registra un abono (POST /api/credits/:saleId/payments)
   Backend en transaccion:
   a. Bloquea la venta (SELECT FOR UPDATE)
   b. Valida monto <= saldo restante
   c. Genera numero de recibo (REC-XXXXXX)
   d. Inserta credit_payment
   e. Actualiza credit_status y amount_paid en sales
   f. Commit
5. Si se paga el total: credit_status = 'pagado'
   Si se paga parcial: credit_status = 'parcial'
```

### 4. Flujo de Anulacion de Venta

```
1. Admin va a historial de ventas
2. Selecciona una venta completada
3. Confirma anulacion
4. Backend (PUT /api/sales/:id/cancel):
   a. Verifica que la venta este 'completada'
   b. Restaura stock de cada producto
   c. Registra stock_movements tipo 'devolucion'
   d. Marca la venta como 'anulada'
```

### 5. Flujo de Ajuste de Inventario

```
1. Admin va a inventario
2. Selecciona un producto
3. Realiza ajuste manual:
   - entrada: aumenta stock (nueva mercancia)
   - salida: reduce stock (perdida, dano)
   - ajuste: establece stock absoluto (conteo fisico)
4. Backend registra el movimiento con stock anterior y nuevo
```

---

## Guia para Implementar Mejoras

### Agregar un Nuevo Modulo Backend

1. Crear carpeta en `backend/src/modules/nuevo-modulo/`
2. Crear archivos:
   - `nuevo-modulo.routes.ts` - Definir rutas Express
   - `nuevo-modulo.service.ts` - Logica de negocio (queries MySQL)
   - `nuevo-modulo.controller.ts` - Handlers de request/response
   - `index.ts` - Exportar router
3. Registrar en `backend/src/modules/index.ts`:
   ```typescript
   import { nuevoModuloRouter } from './nuevo-modulo';
   router.use('/nuevo-modulo', authenticate, nuevoModuloRouter);
   ```
4. Agregar tipos en `backend/src/common/types/index.ts`
5. Agregar validadores en `backend/src/utils/validators.ts` si es necesario
6. Agregar tabla(s) en `inventariodaniel.sql`

### Agregar un Nuevo Componente Frontend

1. Crear `frontend/components/nuevo-componente.tsx`
2. Agregar tipos en `frontend/lib/types.ts`
3. Agregar metodos API en `frontend/lib/api.ts` (en la clase ApiService)
4. Agregar estado en `frontend/lib/store.ts` si es necesario
5. Registrar la seccion en la navegacion:
   - En `frontend/components/sidebar.tsx`: agregar item al array de navegacion
   - En `frontend/app/page.tsx`: agregar case en el switch de secciones
6. Importar y renderizar en el switch de `page.tsx`

### Agregar un Nuevo Campo a Producto

1. **SQL:** `ALTER TABLE products ADD COLUMN nuevo_campo TIPO;`
2. **Backend types:** Agregar a interface `Product` en `common/types/index.ts`
3. **Backend service:** Actualizar queries de INSERT/UPDATE/SELECT en `products.service.ts`
4. **Backend validators:** Agregar validacion en `utils/validators.ts`
5. **Frontend types:** Agregar a interface `Product` en `lib/types.ts`
6. **Frontend form:** Agregar campo en el formulario de `inventory-list.tsx`
7. **Frontend table:** Agregar columna en la tabla de productos

### Agregar un Nuevo Metodo de Pago

1. **SQL:** Modificar ENUM en columna `payment_method` de tabla `sales`
2. **Backend:** Actualizar logica en `sales.service.ts` (seccion de calculo de pago)
3. **Backend validators:** Agregar al array de metodos validos
4. **Frontend types:** Agregar al tipo `PaymentMethod`
5. **Frontend POS:** Agregar opcion en el selector de `point-of-sale.tsx`
6. **Frontend historial:** Agregar badge/filtro en `sales-history.tsx`

### Agregar Reportes/Exportaciones

1. Crear ruta en dashboard o nuevo modulo de reportes
2. En el servicio, escribir queries de agregacion MySQL
3. Para exportar CSV/Excel: generar en backend y enviar como descarga
4. Para PDF: usar libreria como `pdfkit` o `puppeteer` en backend

### Agregar Imagenes de Productos

1. Instalar `multer` en backend para upload de archivos
2. Crear ruta `POST /api/upload` con middleware de multer
3. Guardar en carpeta `uploads/` o servicio cloud (S3, Cloudinary)
4. Almacenar URL en campo `image_url` del producto
5. Mostrar imagen en frontend con `<Image>` de Next.js

### Agregar Notificaciones en Tiempo Real

1. Instalar `socket.io` en backend
2. Emitir eventos en momentos clave (nueva venta, stock bajo, nuevo abono)
3. En frontend, conectar con `socket.io-client`
4. Mostrar notificaciones con Sonner (ya instalado)

### Patron de Respuestas API

Todas las respuestas siguen este formato:

```json
// Exito
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}

// Error
{
  "success": false,
  "error": "Mensaje de error",
  "details": [{ "field": "email", "message": "Email ya registrado" }]
}
```

### Patron de Manejo de Errores

```typescript
// Usar AppError para errores controlados
import { AppError } from '@common/middleware';

throw new AppError('Producto no encontrado', 404);
throw new AppError('Stock insuficiente', 400);
throw new AppError('Email ya registrado', 409);
```

### Patron de Transacciones MySQL

```typescript
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  // ... operaciones ...
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

### Consideraciones para Produccion

- Cambiar `JWT_SECRET` a un valor seguro
- Configurar `CORS_ORIGIN` con el dominio real
- Usar HTTPS
- Configurar variables de entorno en el servidor
- Habilitar rate limiting (instalar `express-rate-limit`)
- Agregar logging (instalar `winston` o `pino`)
- Configurar backups automaticos de MySQL
- Considerar migraciones de DB (instalar `knex` o `typeorm`)
- Agregar tests unitarios y de integracion
- Configurar CI/CD pipeline

### Constantes Importantes

| Constante | Valor | Ubicacion |
|---|---|---|
| TAX_RATE | 0.19 (19%) | backend/src/utils/formatters.ts, frontend/lib/types.ts |
| Connection Limit | 10 | backend/src/config/database.ts |
| JWT Default Expiry | 24h | backend/src/config/env.ts |
| Pagination Default | 20 items | Varios servicios |
| Pagination Max | 100 items | Validadores |
| Password Min Length | 6 chars | Validadores |
| Sizes | XS,S,M,L,XL,XXL,XXXL | Types |
| Categories Default | 8 categorias | SQL seed data |
| Invoice Prefix | FAC | invoice_sequence |
| Receipt Prefix | REC | payment_receipt_sequence |ddd
