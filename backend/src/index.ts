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
import { initVaultSocket } from './modules/vault/vault.realtime';

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
import { lopbukLandingRoutes } from './modules/lopbuk-landing';
import devRequestsRoutes from './modules/dev-requests/dev-requests.routes';
import { fleetRoutes } from './modules/fleet';
import { realEstateRoutes } from './modules/realestate';
import { workOrderRoutes } from './modules/workorders';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import { mermaRoutes } from './modules/merma';
import { gastrobarRoutes } from './modules/gastrobar-ops';
import { rutinaRoutes } from './modules/rutina';
import { workoutRoutes } from './modules/workout';
import variantsRoutes from './modules/variants/variants.routes';
import affiliatesRoutes from './modules/affiliates/affiliates.routes';
import consumerPlansRoutes from './modules/consumer-plans/consumer-plans.routes';
import trainersRoutes from './modules/trainers/trainers.routes';
import vaultRoutes from './modules/vault/vault.routes';
import achievementsRoutes from './modules/achievements/achievements.routes';
import adaptiveRoutes from './modules/adaptive/adaptive.routes';
import progressRoutes from './modules/progress/progress.routes';
import arenaRoutes from './modules/arena/arena.routes';
import gamificationRoutes from './modules/gamification/gamification.routes';
import pushRoutes from './modules/push/push.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import suppliersRoutes from './modules/suppliers/suppliers.routes';
import hormasRoutes from './modules/hormas/hormas.routes';
import hiddenAccessRoutes from './modules/hidden-access/hidden-access.routes';
import locationsRoutes from './modules/locations/locations.routes';
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
app.use(`${apiPrefix}/consumer-plans`, consumerPlansRoutes);
app.use(`${apiPrefix}/trainers`, trainersRoutes);
app.use(`${apiPrefix}/vault`, vaultRoutes);
app.use(`${apiPrefix}/achievements`, achievementsRoutes);
app.use(`${apiPrefix}/adaptive`, adaptiveRoutes);
app.use(`${apiPrefix}/progress`, progressRoutes);
app.use(`${apiPrefix}/arena`, arenaRoutes);
app.use(`${apiPrefix}/gamification`, gamificationRoutes);
app.use(`${apiPrefix}/push`, pushRoutes);
app.use(`${apiPrefix}/payments`, paymentsRoutes);
app.use(`${apiPrefix}/daimuz-chat`, daimuzChatRoutes);
app.use(`${apiPrefix}/finances`, financesRoutes);
app.use(`${apiPrefix}/portfolio`, portfolioRoutes);
app.use(`${apiPrefix}/lopbuk-landing`, lopbukLandingRoutes);
app.use(`${apiPrefix}/dev-requests`, devRequestsRoutes);
app.use(`${apiPrefix}/fleet`, fleetRoutes);
app.use(`${apiPrefix}/realestate`, realEstateRoutes);
app.use(`${apiPrefix}/workorders`, workOrderRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);
app.use(`${apiPrefix}/merma`, mermaRoutes);
app.use(`${apiPrefix}/gastrobar-ops`, gastrobarRoutes);
app.use(`${apiPrefix}/rutina`, rutinaRoutes);
app.use(`${apiPrefix}/workouts`, workoutRoutes);
app.use(`${apiPrefix}/gym`, gymRoutes);
app.use(`${apiPrefix}/assistant`, assistantRoutes);
app.use(`${apiPrefix}/modifiers`, modifiersRoutes)
app.use(`${apiPrefix}/superadmin`, superadminOrdersRoutes);
app.use(`${apiPrefix}/cartillas`, cartillasRoutes);
app.use(`${apiPrefix}/profile`, profileRoutes);
app.use(`${apiPrefix}/community`, communityRoutes);
app.use(`${apiPrefix}/notifications`, notificationsRoutes);
app.use(`${apiPrefix}/theme4`, theme4Routes);

// Variantes + Proveedores + Hormas + Hidden-access + Locations
// IMPORTANTE: rutas con prefijo específico van ANTES de variantsRoutes (/api)
// porque variantsRoutes tiene router.use(authenticate) global que interceptaría
// rutas sin auth como /api/hidden-access/*
app.use(`${apiPrefix}/suppliers`, suppliersRoutes);
app.use(`${apiPrefix}/hormas`, hormasRoutes);
app.use(`${apiPrefix}/hidden-access`, hiddenAccessRoutes);
app.use(`${apiPrefix}/locations`, locationsRoutes);
app.use(`${apiPrefix}`, variantsRoutes);

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

    // ── Drizzle migrations (schema-as-history) ───────────────────────────────
    // En NO-producción se aplican al arrancar. En producción NO se corren aquí:
    // usar `npm run migrate` (drizzle-kit) antes de `npm run start` para evitar
    // edge cases de locking/metadata con múltiples instancias.
    // Import dinámico tolerante: si Drizzle aún no está instalado, no rompe el boot.
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { runMigrations } = await import('./db/migrate');
        await runMigrations();
        console.log('Drizzle: migraciones aplicadas (dev).');
      } catch (e) {
        console.error('Drizzle migrate (dev) omitido/error:', e);
      }
    }

    // ── DDL congelado (FASE 2 Drizzle) ───────────────────────────
    // El bloque de ~80 CREATE TABLE + ALTERs que vivía aquí fue migrado al
    // baseline versionado: backend/src/db/migrations/0000_*. PROHIBIDO DDL en
    // runtime — cualquier cambio de esquema es una nueva migración Drizzle.
    // Ver CLAUDE.md (sección “Migraciones de esquema”).

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
    initVaultSocket(io);

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
};

startServer();
