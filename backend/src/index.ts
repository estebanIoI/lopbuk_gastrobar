import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { config, testConnection } from './config';
import { errorHandler, notFoundHandler } from './common/middleware';
import { initScannerSocket } from './modules/scanner';

// Importar rutas de modulos
import { authRoutes } from './modules/auth';
import { usersRoutes } from './modules/users';
import { productsRoutes } from './modules/products';
import { salesRoutes } from './modules/sales';
import { inventoryRoutes } from './modules/inventory';
import { dashboardRoutes } from './modules/dashboard';
import { customersRoutes } from './modules/customers';
import { creditsRoutes } from './modules/credits';
import { categoriesRoutes } from './modules/categories';
import { cashSessionsRoutes } from './modules/cash-sessions';
import { tenantsRoutes } from './modules/tenants';
import { storefrontRoutes } from './modules/storefront';
import { ordersRoutes } from './modules/orders';
import { couponsRoutes } from './modules/coupons';
import { recipesRoutes } from './modules/recipes';
import deliveryRoutes from './modules/delivery/delivery.routes';
import clientRoutes from './modules/client/client.routes';
import { purchasesRoutes } from './modules/purchases';
import { servicesRoutes } from './modules/services';
import sedesRoutes from './modules/sedes/sedes.routes';
import { chatbotRoutes } from './modules/chatbot/chatbot.routes';
import { printersRoutes } from './modules/printers';
import vendedoresRoutes from './modules/vendedores/vendedores.routes';
import cargosRoutes from './modules/cargos/cargos.routes';
import novedadesRoutes from './modules/novedades/novedades.routes';
import reviewsRoutes from './modules/reviews/reviews.routes';
import { syncRoutes, startSyncScheduler } from './modules/sync';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { restbarRoutes } from './modules/restbar';
import { financesRoutes } from './modules/finances';
import { portfolioRoutes } from './modules/portfolio';

const app = express();

// Trust the reverse proxy (nginx) so that express-rate-limit can read the real client IP
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images from Cloudinary etc.
}));

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Cookie parser (needed for httpOnly auth cookies)
app.use(cookieParser());

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization: strip HTML tags from all string fields to prevent stored XSS
function stripHtml(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').trim();
  }
  if (Array.isArray(value)) return value.map(stripHtml);
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      clean[k] = stripHtml(v);
    }
    return clean;
  }
  return value;
}
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = stripHtml(req.body);
  }
  next();
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60_000,       // 1 minuto
  max: 10,                // 10 intentos por minuto en auth
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Intenta de nuevo en un minuto.' },
});

const apiLimiter = rateLimit({
  windowMs: 60_000,       // 1 minuto
  max: 200,               // 200 requests por minuto en el resto de la API
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Lopbuk API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
const apiPrefix = process.env.API_PREFIX !== undefined ? process.env.API_PREFIX : '/api';
app.use(`${apiPrefix}/auth`, authLimiter, authRoutes);
app.use(`${apiPrefix}`, apiLimiter);
app.use(`${apiPrefix}/users`, usersRoutes);
app.use(`${apiPrefix}/products`, productsRoutes);
app.use(`${apiPrefix}/sales`, salesRoutes);
app.use(`${apiPrefix}/inventory`, inventoryRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/customers`, customersRoutes);
app.use(`${apiPrefix}/credits`, creditsRoutes);
app.use(`${apiPrefix}/categories`, categoriesRoutes);
app.use(`${apiPrefix}/cash-sessions`, cashSessionsRoutes);
app.use(`${apiPrefix}/tenants`, tenantsRoutes);
app.use(`${apiPrefix}/storefront`, storefrontRoutes);
app.use(`${apiPrefix}/orders`, ordersRoutes);
app.use(`${apiPrefix}/coupons`, couponsRoutes);
app.use(`${apiPrefix}/recipes`, recipesRoutes);
app.use(`${apiPrefix}/delivery`, deliveryRoutes);
app.use(`${apiPrefix}/client`, clientRoutes);
app.use(`${apiPrefix}/purchases`, purchasesRoutes);
app.use(`${apiPrefix}/services`, servicesRoutes);
app.use(`${apiPrefix}/sedes`, sedesRoutes);
app.use(`${apiPrefix}/chatbot`, chatbotRoutes);
app.use(`${apiPrefix}/printers`, printersRoutes);
app.use(`${apiPrefix}/vendedores`, vendedoresRoutes);
app.use(`${apiPrefix}/cargos`, cargosRoutes);
app.use(`${apiPrefix}/novedades`, novedadesRoutes);
app.use(`${apiPrefix}/reviews`, reviewsRoutes);
app.use(`${apiPrefix}/sync`, syncRoutes);
app.use(`${apiPrefix}/subscriptions`, subscriptionsRoutes);
app.use(`${apiPrefix}/restbar`, restbarRoutes);
app.use(`${apiPrefix}/finances`, financesRoutes);
app.use(`${apiPrefix}/portfolio`, portfolioRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('No se pudo conectar a la base de datos. Verifica la configuracion.');
      process.exit(1);
    }

    // Run lightweight schema migrations (idempotent)
    try {
      const pool = (await import('./config/database')).default;
      await pool.query(
        `ALTER TABLE store_info ADD COLUMN IF NOT EXISTS product_card_style VARCHAR(20) NULL DEFAULT 'style1'
         COMMENT 'Estilo de tarjeta de producto: style1 o style2'`
      );
      // RBAC: permissions column on employee_cargos
      await pool.query(
        `ALTER TABLE employee_cargos ADD COLUMN IF NOT EXISTS permissions JSON NULL
         COMMENT 'Permisos granulares del cargo: ["ventas","inventario",...]'`
      );
      // AES encryption marker columns (added when encryption migration runs)
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS data_encrypted TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '1 = campos sensibles cifrados con AES-256'`
      );
      // Sedes table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sedes (
          id VARCHAR(36) PRIMARY KEY,
          tenant_id VARCHAR(36) NOT NULL,
          name VARCHAR(100) NOT NULL,
          address VARCHAR(500) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
          INDEX idx_sedes_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // sede_id column in products
      await pool.query(
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS sede_id VARCHAR(36) NULL
         COMMENT 'Sede a la que pertenece el producto (NULL = todas las sedes)'`
      );
      // Printers table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS printers (
          id VARCHAR(36) PRIMARY KEY,
          tenant_id VARCHAR(36) NOT NULL,
          name VARCHAR(100) NOT NULL,
          connection_type ENUM('lan','usb','bluetooth') NOT NULL DEFAULT 'lan',
          ip VARCHAR(45) NULL,
          port INT NOT NULL DEFAULT 9100,
          paper_width SMALLINT NOT NULL DEFAULT 80,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          assigned_module ENUM('caja','cocina','bar','factura') NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
          INDEX idx_printers_tenant (tenant_id),
          INDEX idx_printers_module (tenant_id, assigned_module)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch { /* column may already exist or DB doesn't support IF NOT EXISTS */ }

    // ── restBar + Finances migrations ────────────────────────────────────────
    try {
      const pool2 = (await import('./config/database')).default;
      // Extender products con campos de menú
      await pool2.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_menu_item BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'TRUE = ítem de menú visible para meseros'`);
      await pool2.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_ingredient BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'TRUE = insumo que se descuenta por receta'`);
      await pool2.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS preparation_area ENUM('bar','cocina','ambos') NULL COMMENT 'Área de preparación'`);
      await pool2.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS prep_time_minutes INT NULL COMMENT 'Tiempo estimado de preparación en minutos'`);
      await pool2.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS available_in_menu BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Disponibilidad en tiempo real para meseros'`);
      // Extender product_recipes
      await pool2.query(`ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS include_in_cost TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = incluir en costo del plato'`);
      // Mesas
      await pool2.query(`CREATE TABLE IF NOT EXISTS rb_tables (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, number VARCHAR(20) NOT NULL, capacity INT NOT NULL DEFAULT 4, area VARCHAR(100) NULL, status ENUM('libre','ocupada','reservada','inactiva') NOT NULL DEFAULT 'libre', qr_code VARCHAR(500) NULL, notes TEXT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, UNIQUE INDEX idx_rb_table_number (tenant_id, number), INDEX idx_rb_table_status (tenant_id, status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Comandas
      await pool2.query(`CREATE TABLE IF NOT EXISTS rb_orders (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, table_id VARCHAR(36) NOT NULL, order_number VARCHAR(20) NOT NULL, waiter_id VARCHAR(36) NOT NULL, waiter_name VARCHAR(255) NOT NULL, guests_count INT NOT NULL DEFAULT 1, status ENUM('abierta','en_proceso','lista','entregada','cerrada','cancelada') NOT NULL DEFAULT 'abierta', notes TEXT NULL, subtotal DECIMAL(12,2) NOT NULL DEFAULT 0, tax DECIMAL(12,2) NOT NULL DEFAULT 0, discount DECIMAL(12,2) NOT NULL DEFAULT 0, total DECIMAL(12,2) NOT NULL DEFAULT 0, sale_id VARCHAR(36) NULL, opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (table_id) REFERENCES rb_tables(id) ON DELETE RESTRICT, FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE RESTRICT, FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL, UNIQUE INDEX idx_rb_order_number (tenant_id, order_number), INDEX idx_rb_order_table (table_id, status), INDEX idx_rb_order_status (tenant_id, status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Ítems de comanda
      await pool2.query(`CREATE TABLE IF NOT EXISTS rb_order_items (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, order_id VARCHAR(36) NOT NULL, menu_item_id VARCHAR(36) NOT NULL, menu_item_name VARCHAR(255) NOT NULL, preparation_area ENUM('bar','cocina','ambos') NOT NULL, quantity INT NOT NULL DEFAULT 1, unit_price DECIMAL(12,2) NOT NULL, subtotal DECIMAL(12,2) NOT NULL, discount DECIMAL(5,2) NOT NULL DEFAULT 0, status ENUM('pendiente','en_preparacion','listo','entregado','cancelado') NOT NULL DEFAULT 'pendiente', guest_number TINYINT NULL DEFAULT NULL, item_notes TEXT NULL, sent_to_kitchen_at TIMESTAMP NULL, ready_at TIMESTAMP NULL, delivered_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (order_id) REFERENCES rb_orders(id) ON DELETE CASCADE, FOREIGN KEY (menu_item_id) REFERENCES products(id) ON DELETE RESTRICT, INDEX idx_rb_item_order (order_id), INDEX idx_rb_item_status (tenant_id, status), INDEX idx_rb_item_area (tenant_id, preparation_area, status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Secuencia de comandas
      await pool2.query(`CREATE TABLE IF NOT EXISTS rb_order_sequence (id INT PRIMARY KEY AUTO_INCREMENT, tenant_id VARCHAR(36) NOT NULL, prefix VARCHAR(10) NOT NULL DEFAULT 'C', current_number INT NOT NULL DEFAULT 0, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, UNIQUE INDEX idx_rb_order_seq (tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Pagos de comandas
      await pool2.query(`CREATE TABLE IF NOT EXISTS rb_payments (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, order_id VARCHAR(36) NOT NULL, guest_number TINYINT NULL DEFAULT NULL, payment_method ENUM('efectivo','tarjeta','nequi','transferencia','mixto') NOT NULL, amount DECIMAL(12,2) NOT NULL, amount_paid DECIMAL(12,2) NOT NULL, change_amount DECIMAL(12,2) NOT NULL DEFAULT 0, cashier_id VARCHAR(36) NOT NULL, cashier_name VARCHAR(255) NOT NULL, cash_session_id VARCHAR(36) NULL, notes TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (order_id) REFERENCES rb_orders(id) ON DELETE RESTRICT, FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE RESTRICT, FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE SET NULL, INDEX idx_rb_payment_order (order_id), INDEX idx_rb_payment_tenant (tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Categorías financieras
      await pool2.query(`CREATE TABLE IF NOT EXISTS finance_categories (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, type ENUM('ingreso','egreso') NOT NULL, name VARCHAR(100) NOT NULL, icon VARCHAR(50) NULL, color VARCHAR(7) NULL, is_system TINYINT(1) NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, UNIQUE INDEX idx_fin_cat_name (tenant_id, type, name), INDEX idx_fin_cat_tenant (tenant_id, type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Transacciones financieras
      await pool2.query(`CREATE TABLE IF NOT EXISTS finance_transactions (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, type ENUM('ingreso','egreso') NOT NULL, category_id VARCHAR(36) NOT NULL, category_name VARCHAR(100) NOT NULL, description VARCHAR(500) NOT NULL, amount DECIMAL(12,2) NOT NULL, transaction_date DATE NOT NULL, payment_method ENUM('efectivo','tarjeta','transferencia','nequi','daviplata','cheque','otro') NOT NULL DEFAULT 'efectivo', receipt_url VARCHAR(500) NULL, receipt_number VARCHAR(100) NULL, is_recurring TINYINT(1) NOT NULL DEFAULT 0, recurrence_type ENUM('diario','semanal','quincenal','mensual','bimestral','anual') NULL, recurrence_day TINYINT NULL, source_type ENUM('manual','sale','purchase_invoice','payroll','cash_movement') NOT NULL DEFAULT 'manual', source_id VARCHAR(36) NULL, notes TEXT NULL, tags JSON NULL, created_by VARCHAR(36) NULL, created_by_name VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE RESTRICT, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL, INDEX idx_fin_tx_tenant (tenant_id), INDEX idx_fin_tx_type (tenant_id, type), INDEX idx_fin_tx_date (tenant_id, transaction_date), INDEX idx_fin_tx_source (source_type, source_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Presupuestos
      await pool2.query(`CREATE TABLE IF NOT EXISTS finance_budgets (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, category_id VARCHAR(36) NOT NULL, year SMALLINT NOT NULL, month TINYINT NOT NULL, budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0, notes TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE CASCADE, UNIQUE INDEX idx_budget_unique (tenant_id, category_id, year, month), INDEX idx_budget_period (tenant_id, year, month)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch { /* tables may already exist */ }

    // Run AES encryption migration for existing plaintext sensitive data
    try {
      const { runEncryptionMigration } = await import('./utils/migrate-encrypt');
      const pool = (await import('./config/database')).default;
      await runEncryptionMigration(pool);
    } catch { /* migration errors are logged inside the function */ }

    const httpServer = http.createServer(app);

    // Inicializar Socket.io
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
    });

    // Inicializar WebSocket handlers para escáner
    initScannerSocket(io);

    // Iniciar scheduler de sync offline→nube (solo si IS_LOCAL_INSTANCE=true)
    startSyncScheduler();

    httpServer.listen(config.port, () => {
      console.log(`
========================================
  Lopbuk Backend API
========================================
  Servidor: http://localhost:${config.port}
  Ambiente: ${config.nodeEnv}
  Base de datos: ${config.db.database}
  WebSocket: Habilitado
========================================
  Endpoints disponibles:
  - POST   /api/auth/login
  - POST   /api/auth/register
  - GET    /api/auth/profile
  - GET    /api/users
  - GET    /api/products
  - GET    /api/sales
  - GET    /api/inventory/movements
  - GET    /api/dashboard/metrics
========================================
      `);
    });
  } catch (error) {
    console.error('Error iniciando el servidor:', error);
    process.exit(1);
  }
};

startServer();
