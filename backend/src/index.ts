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
import restbarQrRoutes from './modules/restbar/restbar-qr.routes';
import loyaltyRoutes from './modules/loyalty/loyalty.routes';
import daimuzChatRoutes from './modules/daimuz-chat/daimuz-chat.routes';
import { financesRoutes } from './modules/finances';
import { portfolioRoutes } from './modules/portfolio';
import devRequestsRoutes from './modules/dev-requests/dev-requests.routes';
import { fleetRoutes } from './modules/fleet';
import { realEstateRoutes } from './modules/realestate';
import { workOrderRoutes } from './modules/workorders';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import { mermaRoutes } from './modules/merma';
import { gastrobarRoutes } from './modules/gastrobar-ops';
import { rutinaRoutes } from './modules/rutina';
import variantsRoutes from './modules/variants/variants.routes';
import affiliatesRoutes from './modules/affiliates/affiliates.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import suppliersRoutes from './modules/suppliers/suppliers.routes';
import { gymRoutes } from './modules/gym';
import assistantRoutes from './modules/assistant/assistant.routes';
import modifiersRoutes from './modules/modifiers/modifiers.routes'
import superadminOrdersRoutes from './modules/orders/superadmin-orders.routes';
import { cartillasRoutes } from './modules/cartillas';
import profileRoutes from './modules/profile/profile.routes';
import communityRoutes from './modules/community/community.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import theme4Routes from './modules/theme4/theme4.routes';

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
  // Las secciones HTML personalizadas requieren HTML crudo: no sanitizar ese endpoint.
  const isRawHtmlRoute = req.path.includes('/custom-sections');
  if (!isRawHtmlRoute && req.body && typeof req.body === 'object') {
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
app.use(`${apiPrefix}/restbar-qr`, restbarQrRoutes);
app.use(`${apiPrefix}/loyalty`, loyaltyRoutes);
app.use(`${apiPrefix}/affiliates`, affiliatesRoutes);
app.use(`${apiPrefix}/payments`, paymentsRoutes);
app.use(`${apiPrefix}/daimuz-chat`, daimuzChatRoutes);
app.use(`${apiPrefix}/finances`, financesRoutes);
app.use(`${apiPrefix}/portfolio`, portfolioRoutes);
app.use(`${apiPrefix}/dev-requests`, devRequestsRoutes);
app.use(`${apiPrefix}/fleet`, fleetRoutes);
app.use(`${apiPrefix}/realestate`, realEstateRoutes);
app.use(`${apiPrefix}/workorders`, workOrderRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);
app.use(`${apiPrefix}/merma`, mermaRoutes);
app.use(`${apiPrefix}/gastrobar-ops`, gastrobarRoutes);
app.use(`${apiPrefix}/rutina`, rutinaRoutes);
app.use(`${apiPrefix}/gym`, gymRoutes);
app.use(`${apiPrefix}/assistant`, assistantRoutes);
app.use(`${apiPrefix}/modifiers`, modifiersRoutes)
app.use(`${apiPrefix}/superadmin`, superadminOrdersRoutes);
app.use(`${apiPrefix}/cartillas`, cartillasRoutes);
app.use(`${apiPrefix}/profile`, profileRoutes);
app.use(`${apiPrefix}/community`, communityRoutes);
app.use(`${apiPrefix}/notifications`, notificationsRoutes);
app.use(`${apiPrefix}/theme4`, theme4Routes);

// Variantes + Proveedores
app.use(`${apiPrefix}`, variantsRoutes);
app.use(`${apiPrefix}/suppliers`, suppliersRoutes);

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
      // ── Restbar Finanzas: gastos variables ───────────────────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rb_gastos (
          id            VARCHAR(36)    PRIMARY KEY,
          tenant_id     VARCHAR(36)    NOT NULL,
          concepto      VARCHAR(200)   NOT NULL,
          categoria     VARCHAR(50)    NOT NULL DEFAULT 'egreso',
          cantidad      DECIMAL(10,2)  NOT NULL DEFAULT 1,
          valor_unitario DECIMAL(12,2) NOT NULL,
          total         DECIMAL(12,2)  NOT NULL,
          notas         TEXT           NULL,
          registered_at DATETIME       NOT NULL,
          created_by    VARCHAR(36)    NULL,
          INDEX idx_rb_gastos_tenant_date (tenant_id, registered_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // ── Restbar Finanzas: ingresos diarios ────────────────────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rb_ingresos_diarios (
          id            VARCHAR(36)    PRIMARY KEY,
          tenant_id     VARCHAR(36)    NOT NULL,
          fecha         DATE           NOT NULL,
          num_pedidos   INT            NOT NULL DEFAULT 0,
          valor_ventas  DECIMAL(12,2)  NOT NULL DEFAULT 0,
          ganancia      DECIMAL(12,2)  NOT NULL DEFAULT 0,
          notas         TEXT           NULL,
          created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
          updated_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_tenant_fecha (tenant_id, fecha)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // ── Restbar Finanzas: gastos fijos (nómina, servicios) ────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rb_gastos_fijos (
          id         VARCHAR(36)   PRIMARY KEY,
          tenant_id  VARCHAR(36)   NOT NULL,
          nombre     VARCHAR(200)  NOT NULL,
          valor      DECIMAL(12,2) NOT NULL,
          periodo    ENUM('semanal','quincenal','mensual') NOT NULL DEFAULT 'quincenal',
          is_active  TINYINT(1)    NOT NULL DEFAULT 1,
          created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_rb_gastos_fijos_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // ── Categories: columnas adicionales ──────────────────────────────────────
      await pool.query(
        `ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1
         COMMENT 'Soft delete: 0 = oculta'`
      );
      await pool.query(
        `ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(7) NULL DEFAULT '#6366f1'
         COMMENT 'Color hex para la UI'`
      );
      await pool.query(
        `ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0
         COMMENT 'Orden de visualización'`
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

    // ── inventory_holds + storefront_orders + store_info ────────────────────
    {
      const mPool = (await import('./config/database')).default;
      const addCol = async (sql: string) => {
        try { await mPool.query(sql); } catch (e: any) { if (e?.errno !== 1060) console.warn('[migration]', e?.message); }
      };

      // inventory_holds — reserva de stock durante checkout
      await mPool.query(`
        CREATE TABLE IF NOT EXISTS inventory_holds (
          id         VARCHAR(36) NOT NULL,
          order_id   VARCHAR(36) NOT NULL,
          product_id VARCHAR(36) NOT NULL,
          tenant_id  VARCHAR(36) NOT NULL,
          quantity   INT         NOT NULL,
          expires_at TIMESTAMP   NOT NULL,
          created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_holds_product (product_id),
          INDEX idx_holds_order   (order_id),
          INDEX idx_holds_tenant  (tenant_id),
          INDEX idx_holds_expires (expires_at),
          CONSTRAINT fk_holds_order FOREIGN KEY (order_id)
            REFERENCES storefront_orders(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => {});

      // storefront_orders nuevas columnas
      await addCol(`ALTER TABLE storefront_orders ADD COLUMN gateway_payment_id VARCHAR(255) NULL COMMENT 'ID del pago en pasarela para reembolsos'`);
      await addCol(`ALTER TABLE storefront_orders ADD COLUMN refund_status VARCHAR(20) NULL COMMENT 'none, pending, refunded, manual'`);

      // ── Variantes: trazabilidad + congelación en pedidos/ventas + cupo de preventa ──
      await addCol(`ALTER TABLE storefront_order_items ADD COLUMN variant_id VARCHAR(36) NULL COMMENT 'Variante (color/talla) pedida'`);
      await addCol(`ALTER TABLE storefront_order_items ADD COLUMN cost_price DECIMAL(12,2) NULL COMMENT 'Costo congelado de la variante'`);
      await addCol(`ALTER TABLE storefront_order_items ADD COLUMN margin_pct DECIMAL(5,2) NULL`);
      await addCol(`ALTER TABLE storefront_order_items ADD COLUMN margin_amount DECIMAL(12,2) NULL`);
      await addCol(`ALTER TABLE storefront_order_items ADD INDEX idx_soi_variant (variant_id)`);
      await addCol(`ALTER TABLE sale_items ADD COLUMN variant_id VARCHAR(36) NULL`);
      await addCol(`ALTER TABLE sale_items ADD COLUMN cost_price DECIMAL(12,2) NULL`);
      await addCol(`ALTER TABLE sale_items ADD COLUMN margin_pct DECIMAL(5,2) NULL`);
      await addCol(`ALTER TABLE sale_items ADD COLUMN margin_amount DECIMAL(12,2) NULL`);
      await addCol(`ALTER TABLE sale_items ADD INDEX idx_si_variant (variant_id)`);
      // Cupo de preventa por variante (NULL = ilimitado) + contador de preventa vendida
      await addCol(`ALTER TABLE products ADD COLUMN qty_promo TEXT NULL COMMENT 'Promo de cantidad (JSON): {secondUnitPct, tiers:[{minQty,discountPct}]}'`);
      await addCol(`ALTER TABLE product_variants ADD COLUMN preorder_limit INT NULL COMMENT 'Cupo máximo de preventa (NULL = ilimitado)'`);
      await addCol(`ALTER TABLE product_variants ADD COLUMN preorder_count INT NOT NULL DEFAULT 0 COMMENT 'Unidades vendidas/reservadas en preventa'`);

      // store_info nuevas columnas
      await addCol(`ALTER TABLE store_info ADD COLUMN allow_contraentrega TINYINT(1) NOT NULL DEFAULT 1`);
      await addCol(`ALTER TABLE store_info ADD COLUMN online_discount_enabled TINYINT(1) NOT NULL DEFAULT 0`);
      await addCol(`ALTER TABLE store_info ADD COLUMN show_info_module TINYINT(1) NOT NULL DEFAULT 0`);
      await addCol(`ALTER TABLE store_info ADD COLUMN info_module_description TEXT NULL`);
      await addCol(`ALTER TABLE store_info ADD COLUMN contact_page_enabled TINYINT(1) NOT NULL DEFAULT 0`);
      await addCol(`ALTER TABLE store_info ADD COLUMN contact_page_title VARCHAR(255) NULL`);
      await addCol(`ALTER TABLE store_info ADD COLUMN contact_page_description TEXT NULL`);
      await addCol(`ALTER TABLE store_info ADD COLUMN contact_page_products TEXT NULL`);
      await addCol(`ALTER TABLE store_info ADD COLUMN contact_page_links TEXT NULL`);
      await addCol(`ALTER TABLE store_info ADD COLUMN contact_page_image VARCHAR(500) NULL`);
      await addCol(`ALTER TABLE store_info ADD COLUMN meta_pixel_id VARCHAR(50) NULL DEFAULT NULL COMMENT 'ID del pixel de Meta/Facebook para tracking de conversiones'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN enable_iva TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = aplicar IVA 19% al registrar venta'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN product_detail_style VARCHAR(20) NULL DEFAULT 'default' COMMENT 'Estilo del detalle de producto: default | ml (cargado estilo Mercado Libre)'`);

      // ── Tarjeta de presentación en el marketplace (página principal) ──────────
      await addCol(`ALTER TABLE store_info ADD COLUMN card_cover_url VARCHAR(500) NULL COMMENT 'Imagen de portada de la tarjeta del comercio en el marketplace'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN card_description VARCHAR(300) NULL COMMENT 'Descripción corta mostrada en la tarjeta del marketplace'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = comercio verificado (check azul)'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN open_state ENUM('open','closed') NOT NULL DEFAULT 'open' COMMENT 'Estado manual abierto/cerrado de la tarjeta'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN marketplace_visible TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = visible en la página principal'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN marketplace_order INT NOT NULL DEFAULT 0 COMMENT 'Orden de aparición en el marketplace (menor primero)'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN business_hours JSON NULL COMMENT 'Horario de atención por día con franjas: {"mon":[{"open":"08:00","close":"22:00"}],...}'`);
      await addCol(`ALTER TABLE store_info ADD COLUMN store_theme VARCHAR(20) NOT NULL DEFAULT 'theme1' COMMENT 'Tema visual de la tienda pública: theme1 (clásico) o theme2 (gastronómico)'`);

      // ── Pasarelas de pago: llaves de plataforma (cifradas) + transacciones Wompi ──
      await mPool.query(`
        CREATE TABLE IF NOT EXISTS platform_payment_gateways (
          provider         VARCHAR(20)  NOT NULL PRIMARY KEY,
          environment      VARCHAR(20)  NOT NULL DEFAULT 'sandbox',
          public_key       TEXT         NULL,
          private_key      TEXT         NULL,
          integrity_secret TEXT         NULL,
          events_secret    TEXT         NULL,
          is_active        TINYINT(1)   NOT NULL DEFAULT 0,
          updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => {});
      await mPool.query(`
        CREATE TABLE IF NOT EXISTS wompi_transactions (
          reference        VARCHAR(64)  NOT NULL PRIMARY KEY,
          owner            VARCHAR(20)  NOT NULL DEFAULT 'platform',
          tenant_id        VARCHAR(36)  NULL,
          context          VARCHAR(30)  NOT NULL,
          context_id       VARCHAR(64)  NULL,
          amount_in_cents  BIGINT       NOT NULL,
          currency         VARCHAR(3)   NOT NULL DEFAULT 'COP',
          status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
          wompi_id         VARCHAR(80)  NULL,
          customer_email   VARCHAR(255) NULL,
          payload          JSON         NULL,
          created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
          updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_wtx_status  (status),
          INDEX idx_wtx_tenant  (tenant_id),
          INDEX idx_wtx_context (context, context_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => {});

      // ── Modificadores de producto (adiciones, combos, "sin X") ────────────────
      await mPool.query(`
        CREATE TABLE IF NOT EXISTS product_modifier_groups (
          id             VARCHAR(36)  NOT NULL PRIMARY KEY,
          tenant_id      VARCHAR(36)  NOT NULL,
          product_id     VARCHAR(36)  NOT NULL,
          name           VARCHAR(150) NOT NULL,
          selection_type ENUM('single','multiple') NOT NULL DEFAULT 'multiple',
          is_required    TINYINT(1)   NOT NULL DEFAULT 0,
          min_select     INT          NOT NULL DEFAULT 0,
          max_select     INT          NULL,
          sort_order     INT          NOT NULL DEFAULT 0,
          created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_pmg_product (product_id),
          INDEX idx_pmg_tenant  (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => {});
      // ── Secciones HTML personalizadas de la tienda ────────────────────────────
      await mPool.query(`
        CREATE TABLE IF NOT EXISTS store_custom_sections (
          id            INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id     VARCHAR(36)   NOT NULL,
          name          VARCHAR(255)  NOT NULL,
          slug          VARCHAR(255)  NOT NULL,
          html_content  LONGTEXT      NOT NULL,
          is_active     TINYINT(1)    NOT NULL DEFAULT 0,
          created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY idx_tenant_slug (tenant_id, slug),
          INDEX idx_scs_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => {});
      // Corrige tablas legacy cuyo id quedó sin AUTO_INCREMENT (o sin PK)
      await mPool.query(`ALTER TABLE store_custom_sections MODIFY COLUMN id INT NOT NULL`).catch(() => {});
      await mPool.query(`ALTER TABLE store_custom_sections ADD PRIMARY KEY (id)`).catch(() => {}); // ignora si ya existe
      await mPool.query(`ALTER TABLE store_custom_sections MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(() => {});

      await mPool.query(`
        CREATE TABLE IF NOT EXISTS product_modifier_options (
          id          VARCHAR(36)   NOT NULL PRIMARY KEY,
          tenant_id   VARCHAR(36)   NOT NULL,
          group_id    VARCHAR(36)   NOT NULL,
          name        VARCHAR(150)  NOT NULL,
          image_url   VARCHAR(500)  NULL,
          price_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
          is_active   TINYINT(1)    NOT NULL DEFAULT 1,
          sort_order  INT           NOT NULL DEFAULT 0,
          INDEX idx_pmo_group  (group_id),
          INDEX idx_pmo_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => {});
    }

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
      await pool2.query(`ALTER TABLE rb_orders ADD COLUMN IF NOT EXISTS priority ENUM('normal','urgente') NOT NULL DEFAULT 'normal'`).catch(()=>{});
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
      // ── Comunidad DAIMUZ (auto-migración idempotente; alinea esquema con el código) ──
      await pool2.query(`CREATE TABLE IF NOT EXISTS community_posts (id VARCHAR(36) PRIMARY KEY, author_id VARCHAR(36) NOT NULL, title VARCHAR(200) NOT NULL, body TEXT NULL, category ENUM('noticia','video','tutorial','app','oferta') NOT NULL DEFAULT 'noticia', status ENUM('draft','published') NOT NULL DEFAULT 'draft', cover_url VARCHAR(500) NULL, likes_count INT NOT NULL DEFAULT 0, saves_count INT NOT NULL DEFAULT 0, comments_count INT NOT NULL DEFAULT 0, shares_count INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, published_at TIMESTAMP NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_post_status (status, is_active, published_at), KEY idx_post_author (author_id), KEY idx_post_category (category)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool2.query(`CREATE TABLE IF NOT EXISTS community_post_media (id VARCHAR(36) PRIMARY KEY, post_id VARCHAR(36) NOT NULL, media_type ENUM('image','video','gif') NOT NULL DEFAULT 'image', url VARCHAR(500) NOT NULL, order_index INT NOT NULL DEFAULT 0, FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE, KEY idx_media_post (post_id, order_index)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool2.query(`CREATE TABLE IF NOT EXISTS community_post_ads (id VARCHAR(36) PRIMARY KEY, post_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL, tenant_id VARCHAR(36) NOT NULL, order_index INT NOT NULL DEFAULT 0, FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE, KEY idx_ad_post (post_id, order_index), KEY idx_ad_product (product_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool2.query(`CREATE TABLE IF NOT EXISTS community_reactions (id VARCHAR(36) PRIMARY KEY, post_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NULL, device_id VARCHAR(64) NULL, type ENUM('like','save') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE, KEY idx_reaction_post (post_id, type), KEY idx_reaction_user (user_id), KEY idx_reaction_device (device_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool2.query(`CREATE TABLE IF NOT EXISTS community_comments (id VARCHAR(36) PRIMARY KEY, post_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, body TEXT NOT NULL, parent_id VARCHAR(36) NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE, KEY idx_comment_post (post_id, is_active, created_at), KEY idx_comment_parent (parent_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool2.query(`CREATE TABLE IF NOT EXISTS community_settings (setting_key VARCHAR(100) PRIMARY KEY, setting_value TEXT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Columnas que el código usa pero faltaban en migraciones viejas:
      await pool2.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS shares_count INT NOT NULL DEFAULT 0`);
      await pool2.query(`ALTER TABLE community_reactions ADD COLUMN IF NOT EXISTS device_id VARCHAR(64) NULL`);
      try { await pool2.query(`ALTER TABLE community_reactions MODIFY COLUMN user_id VARCHAR(36) NULL`); } catch { /* ya nullable o sin permiso */ }
    } catch { /* tables may already exist */ }

    // ── Agent / WhatsApp module migrations ───────────────────────────────────
    try {
      const poolAgent = (await import('./config/database')).default;
      // chatbot_sessions: human takeover flag and channel tracking
      await poolAgent.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS human_takeover TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = agente silenciado, responde un humano'`);
      await poolAgent.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS channel ENUM('web','whatsapp','voice','api') NOT NULL DEFAULT 'web' COMMENT 'Canal de origen de la sesión'`);
      await poolAgent.query(`ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50) NULL COMMENT 'Teléfono capturado por el agente'`);
      // chatbot_config: WhatsApp / Evolution API fields
      await poolAgent.query(`ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = agente activo en WhatsApp'`);
      await poolAgent.query(`ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50) NULL COMMENT 'Número de WhatsApp del negocio'`);
      await poolAgent.query(`ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS evolution_instance VARCHAR(100) NULL COMMENT 'Nombre de la instancia en Evolution API'`);
      await poolAgent.query(`ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS agent_tools JSON NULL COMMENT 'Herramientas habilitadas para el agente'`);
      await poolAgent.query(`ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS working_hours JSON NULL COMMENT 'Horario activo del agente'`);
      // agent_actions: audit log of tool calls
      await poolAgent.query(`
        CREATE TABLE IF NOT EXISTS agent_actions (
          id          VARCHAR(36)  PRIMARY KEY,
          tenant_id   VARCHAR(36)  NOT NULL,
          session_id  VARCHAR(36)  NULL,
          channel     ENUM('chat','whatsapp','voice','web') NOT NULL DEFAULT 'chat',
          tool_name   VARCHAR(100) NOT NULL,
          tool_input  JSON         NULL,
          tool_output JSON         NULL,
          success     TINYINT(1)   NOT NULL DEFAULT 1,
          created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
          updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
          INDEX idx_agent_actions_tenant  (tenant_id),
          INDEX idx_agent_actions_session (session_id),
          INDEX idx_agent_actions_tool    (tenant_id, tool_name),
          INDEX idx_agent_actions_created (tenant_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch { /* columns/table may already exist */ }

    // ── Work Orders (Tapicería) migration ────────────────────────────────────
    try {
      const poolWO = (await import('./config/database')).default;
      await poolWO.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS module_workorders TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Módulo Tapicería/Órdenes de Trabajo habilitado'`);
      await poolWO.query(`CREATE TABLE IF NOT EXISTS work_order_sequence (id INT PRIMARY KEY AUTO_INCREMENT, tenant_id VARCHAR(36) NOT NULL, prefix VARCHAR(10) NOT NULL DEFAULT 'OT', current_number INT NOT NULL DEFAULT 0, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, UNIQUE INDEX idx_wo_seq_tenant (tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await poolWO.query(`CREATE TABLE IF NOT EXISTS work_orders (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, order_number VARCHAR(20) NOT NULL, customer_id VARCHAR(36) NULL, customer_name VARCHAR(255) NOT NULL, customer_phone VARCHAR(50) NULL, item_description VARCHAR(500) NOT NULL, item_type VARCHAR(100) NOT NULL DEFAULT 'vehiculo', job_type VARCHAR(100) NOT NULL DEFAULT 'tapizado_completo', fabric_description VARCHAR(300) NULL, quoted_price DECIMAL(12,2) NOT NULL DEFAULT 0, advance_paid DECIMAL(12,2) NOT NULL DEFAULT 0, received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, promised_at DATE NULL, delivered_at TIMESTAMP NULL, status ENUM('recibido','cotizado','aprobado','en_proceso','listo','entregado','cancelado') NOT NULL DEFAULT 'recibido', notes TEXT NULL, assigned_to VARCHAR(36) NULL, sale_id VARCHAR(36) NULL, photos_in JSON NULL, photos_out JSON NULL, created_by VARCHAR(36) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL, UNIQUE INDEX idx_wo_number (tenant_id, order_number), INDEX idx_wo_tenant_status (tenant_id, status), INDEX idx_wo_promised (tenant_id, promised_at), INDEX idx_wo_customer (tenant_id, customer_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await poolWO.query(`CREATE TABLE IF NOT EXISTS work_order_materials (id INT PRIMARY KEY AUTO_INCREMENT, tenant_id VARCHAR(36) NOT NULL, work_order_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NULL, product_name VARCHAR(255) NOT NULL, quantity DECIMAL(10,3) NOT NULL DEFAULT 1, unit VARCHAR(50) NOT NULL DEFAULT 'unidad', unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0, total_cost DECIMAL(12,2) NOT NULL DEFAULT 0, notes TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE, INDEX idx_wo_mat_order (work_order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await poolWO.query(`CREATE TABLE IF NOT EXISTS work_order_payments (id INT PRIMARY KEY AUTO_INCREMENT, tenant_id VARCHAR(36) NOT NULL, work_order_id VARCHAR(36) NOT NULL, amount DECIMAL(12,2) NOT NULL, payment_method ENUM('efectivo','tarjeta','transferencia','nequi','otro') NOT NULL DEFAULT 'efectivo', notes TEXT NULL, received_by VARCHAR(36) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE, FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE, FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL, INDEX idx_wo_pay_order (work_order_id), INDEX idx_wo_pay_tenant (tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch { /* tables may already exist */ }

    // ── Widen users encrypted-field columns (AES ciphertext exceeds old VARCHAR sizes) ──
    try {
      const poolU = (await import('./config/database')).default;
      await poolU.query(`ALTER TABLE users MODIFY COLUMN phone VARCHAR(500) NULL`);
      await poolU.query(`ALTER TABLE users MODIFY COLUMN cedula VARCHAR(500) NULL`);
      await poolU.query(`ALTER TABLE users MODIFY COLUMN department VARCHAR(500) NULL`);
      await poolU.query(`ALTER TABLE users MODIFY COLUMN municipality VARCHAR(500) NULL`);
      await poolU.query(`ALTER TABLE users MODIFY COLUMN address VARCHAR(500) NULL`);
      await poolU.query(`ALTER TABLE users MODIFY COLUMN neighborhood VARCHAR(500) NULL`);
    } catch { /* columns may already be wide enough */ }

    // ── User saved addresses ─────────────────────────────────────────────────
    try {
      const poolA = (await import('./config/database')).default;
      await poolA.query(`CREATE TABLE IF NOT EXISTS user_addresses (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        label VARCHAR(100) NOT NULL DEFAULT 'Mi dirección',
        department VARCHAR(500) NULL,
        municipality VARCHAR(500) NULL,
        address VARCHAR(500) NULL,
        neighborhood VARCHAR(500) NULL,
        delivery_latitude DECIMAL(10,7) NULL,
        delivery_longitude DECIMAL(10,7) NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_ua_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch { /* table may already exist */ }

    // ── Dev Requests migration ────────────────────────────────────────────────
    try {
      const pool3 = (await import('./config/database')).default;
      await pool3.query(`
        CREATE TABLE IF NOT EXISTS dev_requests (
          id VARCHAR(36) PRIMARY KEY,
          tenant_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          tenant_name VARCHAR(255) NULL,
          requester_name VARCHAR(255) NOT NULL,
          title VARCHAR(300) NOT NULL,
          description TEXT NOT NULL,
          type ENUM('objetivo','mejora','actualizacion','bug','otro') NOT NULL DEFAULT 'mejora',
          priority ENUM('baja','media','alta') NOT NULL DEFAULT 'media',
          status ENUM('pendiente','en_revision','cotizado','aprobado','en_progreso','completado','rechazado') NOT NULL DEFAULT 'pendiente',
          estimated_hours DECIMAL(6,2) NULL,
          price_per_hour DECIMAL(10,2) NULL,
          total_price DECIMAL(12,2) NULL,
          admin_notes TEXT NULL,
          rejection_reason VARCHAR(500) NULL,
          paid_at TIMESTAMP NULL,
          completed_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
          INDEX idx_dev_req_tenant (tenant_id),
          INDEX idx_dev_req_status (status),
          INDEX idx_dev_req_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch { /* table may already exist */ }

    // ── Affiliates / Programa de Promotores (Sprint 1) ───────────────────────
    // Nota: affiliates es de nivel plataforma (sin tenant_id, excepción consciente).
    // El resto del módulo sí lleva tenant_id. Todo idempotente (CREATE TABLE IF NOT EXISTS).
    try {
      const poolAff = (await import('./config/database')).default;
      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliates (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        handle VARCHAR(100) NULL,
        tier ENUM('bronze','silver','gold') NOT NULL DEFAULT 'bronze',
        balance_cop DECIMAL(14,2) NOT NULL DEFAULT 0,
        pending_cop DECIMAL(14,2) NOT NULL DEFAULT 0,
        monthly_sales INT NOT NULL DEFAULT 0,
        status ENUM('active','suspended') NOT NULL DEFAULT 'active',
        password_hash VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_aff_email (email),
        UNIQUE INDEX idx_aff_handle (handle),
        INDEX idx_aff_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS merchant_events (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        event_date DATETIME NOT NULL,
        location VARCHAR(255) NULL,
        cover_image VARCHAR(800) NULL,
        ticket_price DECIMAL(14,2) NULL,
        capacity INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        INDEX idx_mevent_tenant (tenant_id, is_active, event_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_packages (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        deliverables JSON NULL,
        price_cop DECIMAL(14,2) NOT NULL,
        affiliate_pct DECIMAL(5,2) NOT NULL,
        platform_pct DECIMAL(5,2) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_affpkg_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_campaigns (
        id VARCHAR(36) PRIMARY KEY,
        affiliate_id VARCHAR(36) NOT NULL,
        tenant_id VARCHAR(36) NOT NULL,
        entity_type ENUM('store','product','event','service') NOT NULL DEFAULT 'store',
        entity_id VARCHAR(36) NULL,
        ref_token VARCHAR(100) NOT NULL,
        discount_code VARCHAR(50) NULL,
        discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
        commission_pct DECIMAL(5,2) NOT NULL,
        cookie_days TINYINT NOT NULL DEFAULT 7,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_campaign_ref (ref_token),
        UNIQUE INDEX idx_campaign_code (discount_code),
        FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        INDEX idx_campaign_affiliate (affiliate_id),
        INDEX idx_campaign_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_conversions (
        id VARCHAR(36) PRIMARY KEY,
        campaign_id VARCHAR(36) NOT NULL,
        tenant_id VARCHAR(36) NOT NULL,
        order_id VARCHAR(36) NULL,
        sale_id VARCHAR(36) NULL,
        method ENUM('link','code') NOT NULL,
        order_total_cop DECIMAL(14,2) NOT NULL,
        commission_cop DECIMAL(14,2) NOT NULL,
        status ENUM('pending','approved','paid','rejected') NOT NULL DEFAULT 'pending',
        approved_at TIMESTAMP NULL,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES affiliate_campaigns(id) ON DELETE CASCADE,
        INDEX idx_conv_campaign (campaign_id),
        INDEX idx_conv_tenant (tenant_id),
        INDEX idx_conv_status (status),
        INDEX idx_conv_order (order_id),
        INDEX idx_conv_sale (sale_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_commissions (
        id VARCHAR(36) PRIMARY KEY,
        affiliate_id VARCHAR(36) NOT NULL,
        conversion_id VARCHAR(36) NULL,
        type ENUM('conversion','mission_bonus','tier_bonus','package') NOT NULL,
        amount_cop DECIMAL(14,2) NOT NULL,
        status ENUM('pending','approved','paid') NOT NULL DEFAULT 'pending',
        note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
        INDEX idx_comm_affiliate (affiliate_id, status),
        INDEX idx_comm_conversion (conversion_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_package_orders (
        id VARCHAR(36) PRIMARY KEY,
        package_id VARCHAR(36) NOT NULL,
        affiliate_id VARCHAR(36) NOT NULL,
        tenant_id VARCHAR(36) NOT NULL,
        entity_type ENUM('store','event','service') NOT NULL DEFAULT 'store',
        entity_id VARCHAR(36) NULL,
        status ENUM('pending_payment','paid','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending_payment',
        total_cop DECIMAL(14,2) NOT NULL,
        affiliate_cop DECIMAL(14,2) NOT NULL,
        platform_cop DECIMAL(14,2) NOT NULL,
        paid_at TIMESTAMP NULL,
        content_deadline TIMESTAMP NULL,
        content_delivered JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (package_id) REFERENCES affiliate_packages(id) ON DELETE RESTRICT,
        FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        INDEX idx_pkgorder_affiliate (affiliate_id, status),
        INDEX idx_pkgorder_tenant (tenant_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
        id VARCHAR(36) PRIMARY KEY,
        affiliate_id VARCHAR(36) NOT NULL,
        amount_cop DECIMAL(14,2) NOT NULL,
        payment_method VARCHAR(100) NOT NULL,
        status ENUM('requested','processing','paid','rejected') NOT NULL DEFAULT 'requested',
        processed_by VARCHAR(36) NULL,
        note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
        INDEX idx_withdraw_affiliate (affiliate_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_missions (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        reward_cop DECIMAL(14,2) NOT NULL,
        required_views INT NULL,
        min_tier ENUM('bronze','silver','gold') NOT NULL DEFAULT 'bronze',
        expires_at TIMESTAMP NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mission_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      await poolAff.query(`CREATE TABLE IF NOT EXISTS affiliate_mission_submissions (
        id VARCHAR(36) PRIMARY KEY,
        mission_id VARCHAR(36) NOT NULL,
        affiliate_id VARCHAR(36) NOT NULL,
        content_url VARCHAR(800) NOT NULL,
        status ENUM('submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
        reviewed_by VARCHAR(36) NULL,
        review_note TEXT NULL,
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_id) REFERENCES affiliate_missions(id) ON DELETE CASCADE,
        FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
        INDEX idx_submission_mission (mission_id, status),
        INDEX idx_submission_affiliate (affiliate_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch (e: any) { console.warn('[migration affiliates]', e?.message); }

    // ── Variantes: color exacto (hex) además del nombre ──────────────────────
    try {
      const poolCh = (await import('./config/database')).default;
      await poolCh.query(`ALTER TABLE product_variants ADD COLUMN color_hex VARCHAR(9) NULL COMMENT 'Color exacto (hex) para el swatch de la tienda'`);
    } catch (e: any) { if (e?.errno !== 1060) console.warn('color_hex migration:', e?.message); }

    // ── Tienda: tamaño del logo en la barra de navegación ────────────────────
    try {
      const poolLs = (await import('./config/database')).default;
      await poolLs.query(`ALTER TABLE store_info ADD COLUMN logo_size SMALLINT NULL COMMENT 'Alto del logo en la nav de la tienda (px)'`);
    } catch (e: any) { if (e?.errno !== 1060) console.warn('logo_size migration:', e?.message); }

    // ── Tenant module control ────────────────────────────────────────────────
    try {
      const mPool = (await import('./config/database')).default;
      await mPool.query(
        `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS enabled_modules JSON NULL
         COMMENT 'Array de IDs de módulos habilitados. NULL = usar defaults por tipo de negocio'`
      );
    } catch { /* column may already exist */ }

    // ── Announcement bar: scroll_speed column ────────────────────────────────
    try {
      const abPool = (await import('./config/database')).default;
      await abPool.query(
        `ALTER TABLE store_announcement_bar ADD COLUMN scroll_speed TINYINT NOT NULL DEFAULT 3
         COMMENT 'Velocidad del marquee: 1=muy lento, 5=muy rapido'`
      );
    } catch (e: any) { if (e?.errno !== 1060) console.warn('scroll_speed migration:', e?.message); }

    // ── Gastrobar Ops migrations (merma + PAR levels) ────────────────────────
    try {
      const gPool = (await import('./config/database')).default;
      await gPool.query(`
        CREATE TABLE IF NOT EXISTS waste_records (
          id             VARCHAR(36)   NOT NULL PRIMARY KEY,
          tenant_id      VARCHAR(36)   NOT NULL,
          product_id     VARCHAR(36)   NULL,
          product_name   VARCHAR(200)  NOT NULL,
          quantity       DECIMAL(10,3) NOT NULL,
          unit           VARCHAR(20)   NOT NULL DEFAULT 'unidad',
          waste_type     ENUM('natural','operativa','administrativa','vencimiento') NOT NULL DEFAULT 'operativa',
          reason         ENUM('quemado','vencido','mal_corte','devolucion','consumo_interno','robo','cortesia','sobreporcion','dano','otro') NOT NULL DEFAULT 'otro',
          cost_value     DECIMAL(12,2) NOT NULL DEFAULT 0,
          area           ENUM('cocina','bar','general') NOT NULL DEFAULT 'cocina',
          responsible_id   VARCHAR(36)  NULL,
          responsible_name VARCHAR(100) NULL,
          notes          TEXT          NULL,
          photo_url      VARCHAR(500)  NULL,
          recorded_by      VARCHAR(36)  NOT NULL,
          recorded_by_name VARCHAR(100) NOT NULL,
          created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_wr_tenant_date (tenant_id, created_at),
          INDEX idx_wr_product     (product_id),
          INDEX idx_wr_area        (area)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await gPool.query(`
        CREATE TABLE IF NOT EXISTS par_levels (
          id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
          tenant_id           VARCHAR(36)   NOT NULL,
          product_id          VARCHAR(36)   NOT NULL,
          daily_usage         DECIMAL(10,3) NOT NULL DEFAULT 0,
          days_between_orders INT           NOT NULL DEFAULT 1,
          safety_stock        DECIMAL(10,3) NOT NULL DEFAULT 0,
          area                ENUM('cocina','bar','general') NOT NULL DEFAULT 'cocina',
          notes               TEXT          NULL,
          created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_pl_tenant_product (tenant_id, product_id),
          INDEX idx_pl_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
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
  - GET    /api/variants
  - GET    /api/suppliers
========================================`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
