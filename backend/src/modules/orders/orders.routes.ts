import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';
import { config } from '../../config/env';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import crypto from 'crypto';
import { audit } from '../../utils/audit-logger';
import { autoAssignVehicle, calcOrderWeight } from '../fleet';
import { affiliatesService } from '../affiliates/affiliates.service';

const router: ReturnType<typeof Router> = Router();

// =============================================
// INVENTORY HOLDS — reserva de stock durante checkout
// =============================================
async function checkStockAvailability(
  items: { productId: string; productName?: string; quantity: number }[],
  tenantId: string
): Promise<{ ok: boolean; conflict?: string }> {
  for (const item of items) {
    if (!item.productId) continue;
    const [rows] = await pool.query(
      `SELECT p.name,
              p.stock - COALESCE(
                (SELECT SUM(h.quantity) FROM inventory_holds h
                 WHERE h.product_id = p.id AND h.expires_at > NOW()), 0
              ) AS available
       FROM products p
       WHERE p.id = ? AND p.tenant_id = ?`,
      [item.productId, tenantId]
    ) as any;
    if (!rows || rows.length === 0) continue;
    if (Number(rows[0].available) < item.quantity) {
      return { ok: false, conflict: rows[0].name || item.productName || item.productId };
    }
  }
  return { ok: true };
}

async function createHolds(
  orderId: string,
  tenantId: string,
  items: { productId: string; quantity: number }[],
  expiresAt: Date
): Promise<void> {
  for (const item of items) {
    if (!item.productId) continue;
    await pool.query(
      `INSERT INTO inventory_holds (id, order_id, product_id, tenant_id, quantity, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), orderId, item.productId, tenantId, item.quantity, expiresAt]
    );
  }
}

async function releaseHolds(orderId: string): Promise<void> {
  await pool.query('DELETE FROM inventory_holds WHERE order_id = ?', [orderId]);
}

async function extendHolds(orderId: string, newExpiresAt: Date): Promise<void> {
  await pool.query(
    'UPDATE inventory_holds SET expires_at = ? WHERE order_id = ?',
    [newExpiresAt, orderId]
  );
}

// =============================================
// PUBLIC: Crear pedido desde el storefront (sin auth)
// =============================================
router.post(
  '/public',
  [
    body('customerName').notEmpty().withMessage('Nombre del cliente es requerido'),
    body('customerPhone').notEmpty().withMessage('Teléfono es requerido'),
    body('customerEmail').optional().isEmail().withMessage('Email inválido'),
    body('customerCedula').optional().notEmpty(),
    body('department').optional().notEmpty(),
    body('municipality').optional().notEmpty(),
    body('address').optional().notEmpty(),
    body('neighborhood').optional().notEmpty(),
    body('notes').optional(),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto'),
    body('items.*.productId').notEmpty().withMessage('ID de producto requerido'),
    body('items.*.productName').notEmpty().withMessage('Nombre de producto requerido'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Cantidad debe ser al menos 1'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Precio unitario inválido'),
    body('deliveryLatitude').optional().isFloat().withMessage('Latitud inválida'),
    body('deliveryLongitude').optional().isFloat().withMessage('Longitud inválida'),
    body('clientUserId').optional().notEmpty(),
    body('tenantId').optional().notEmpty(),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const {
        customerName, customerPhone, customerEmail, customerCedula,
        department, municipality, address, neighborhood, notes,
        items, tenantId: requestedTenantId, paymentMethod, shippingCost = 0, discount = 0,
        deliveryLatitude, deliveryLongitude, clientUserId
      } = req.body;

      // Find tenant
      let tenantId = requestedTenantId;
      if (!tenantId) {
        const [tenants] = await pool.query(
          'SELECT id FROM tenants WHERE status = ? ORDER BY id ASC LIMIT 1',
          ['activo']
        ) as any;
        if (!tenants || tenants.length === 0) {
          res.status(400).json({ success: false, error: 'No hay tienda disponible' });
          return;
        }
        tenantId = tenants[0].id;
      }

      // Verificar stock disponible (descontando holds activos de otros checkouts)
      const stockCheck = await checkStockAvailability(items, tenantId);
      if (!stockCheck.ok) {
        res.status(409).json({
          success: false,
          error: `Stock insuficiente para "${stockCheck.conflict}". Otro cliente está en proceso de compra o el stock se agotó.`,
        });
        return;
      }

      // Generate order number
      const orderNumber = `PED-${Date.now().toString(36).toUpperCase()}`;
      const orderId = uuidv4();

      // Calculate totals
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
      const total = Math.max(0, subtotal + shippingCost - discount);

      // Append coupon to notes if code provided
      const couponNote = req.body.couponCode
        ? ` [Cupón: ${req.body.couponCode} - Descuento: $${discount}]`
        : '';
      const finalNotes = (notes || '') + couponNote;

      // Calcular peso total del pedido y auto-asignar vehículo
      const totalWeightKg = await calcOrderWeight(
        items.map((i: any) => ({ productId: i.productId, quantity: i.quantity }))
      );
      const assignedVehicleId = totalWeightKg > 0
        ? await autoAssignVehicle(tenantId, totalWeightKg)
        : null;

      // Insert order
      await pool.query(
        `INSERT INTO storefront_orders
          (id, tenant_id, order_number, customer_name, customer_phone, customer_email, customer_cedula,
           department, municipality, address, neighborhood, delivery_latitude, delivery_longitude,
           notes, subtotal, shipping_cost, discount, total, payment_method, client_user_id,
           total_weight_kg, vehicle_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
        [orderId, tenantId, orderNumber, customerName, customerPhone, customerEmail || null, customerCedula || null,
          department || null, municipality || null, address || null, neighborhood || null,
          deliveryLatitude || null, deliveryLongitude || null, finalNotes,
          subtotal, shippingCost, discount, total, paymentMethod || null, clientUserId || null,
          totalWeightKg || null, assignedVehicleId]
      );

      // Insert order items (con descuento por item para reportes DIAN)
      for (const item of items) {
        await pool.query(
          `INSERT INTO storefront_order_items
            (order_id, product_id, product_name, product_image, quantity, unit_price, original_price, discount_percent, total_price, size, color,
             is_preorder, preorder_ship_start, preorder_ship_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.productId, item.productName, item.productImage || null,
            item.quantity, item.unitPrice, item.originalPrice || item.unitPrice, item.discountPercent || 0,
            item.unitPrice * item.quantity,
            item.size || null, item.color || null,
            item.isPreorder ? 1 : 0, item.preorderShipStart || null, item.preorderShipEnd || null]
        );
      }

      // Crear holds de 24h para contraentrega
      const holdExpiry24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createHolds(orderId, tenantId, items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })), holdExpiry24h).catch(() => {});

      // Fire merchant notification (async, non-blocking)
      try {
        const notifTitle = `Nuevo pedido #${orderNumber}`;
        const notifMsg = `${customerName} realizó un pedido por $${total.toLocaleString('es-CO')}`;
        await pool.query(
          `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
           VALUES (?, 'new_order', ?, ?, ?)`,
          [tenantId, notifTitle, notifMsg, JSON.stringify({ orderId, orderNumber, customerName, total, paymentMethod })]
        );
      } catch { /* notifications are non-critical */ }

      // Atribución de afiliado por enlace (?ref=TOKEN). No bloquea la respuesta.
      affiliatesService.attributeOrder({ refToken: req.body?.refToken, tenantId, orderId, orderTotalCop: total }).catch(() => {});

      res.status(201).json({
        success: true,
        data: {
          orderId,
          orderNumber,
          total,
          totalWeightKg,
          vehicleAssigned: !!assignedVehicleId,
          status: 'pendiente',
          message: 'Pedido creado exitosamente'
        }
      });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ success: false, error: 'Error al crear el pedido' });
    }
  }
);

// =============================================
// PUBLIC: Crear preferencia Checkout Pro de MercadoPago
// =============================================
router.post(
  '/mp-preference',
  [
    body('customerName').notEmpty(),
    body('customerPhone').notEmpty(),
    body('customerEmail').optional().isEmail(),
    body('items').isArray({ min: 1 }),
    body('items.*.productId').notEmpty(),
    body('items.*.productName').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitPrice').isFloat({ min: 0 }),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      // Read MP token from env or platform_settings DB
      let mpToken = config.mp.accessToken;
      let frontendUrl = config.mp.frontendUrl;
      if (!mpToken) {
        const [psRows] = await pool.query(
          "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('mp_access_token','frontend_url')"
        ) as any;
        for (const r of psRows) {
          if (r.setting_key === 'mp_access_token') mpToken = r.setting_value;
          if (r.setting_key === 'frontend_url') frontendUrl = r.setting_value || frontendUrl;
        }
      }
      if (!mpToken) {
        res.status(503).json({ success: false, error: 'Pago en línea no configurado. Configúralo en el panel de administración.' });
        return;
      }

      const {
        customerName, customerPhone, customerEmail, customerCedula,
        department, municipality, address, neighborhood, notes,
        items, tenantId: requestedTenantId, couponCode, discount = 0,
      } = req.body;

      // Find tenant
      let tenantId = requestedTenantId;
      if (!tenantId) {
        const [tenants] = await pool.query(
          'SELECT id FROM tenants WHERE status = ? ORDER BY id ASC LIMIT 1',
          ['activo']
        ) as any;
        if (!tenants || tenants.length === 0) {
          res.status(400).json({ success: false, error: 'No hay tienda disponible' });
          return;
        }
        tenantId = tenants[0].id;
      }

      // Verificar si el descuento online está habilitado para este tenant
      let onlineDiscountEnabled = false;
      try {
        const [siRows] = await pool.query(
          'SELECT online_discount_enabled FROM store_info WHERE tenant_id = ? LIMIT 1', [tenantId]
        ) as any;
        if (siRows?.length > 0) onlineDiscountEnabled = siRows[0].online_discount_enabled === 1;
      } catch { /* column may not exist */ }

      // Verificar stock disponible antes de crear la preferencia
      const mpStockCheck = await checkStockAvailability(items, tenantId);
      if (!mpStockCheck.ok) {
        res.status(409).json({
          success: false,
          error: `Stock insuficiente para "${mpStockCheck.conflict}". Otro cliente está en proceso de compra o el stock se agotó.`,
        });
        return;
      }

      // Aplicar descuento online si está habilitado (10%)
      const ONLINE_DISCOUNT = 0.10;
      const discountedItems = items.map((item: any) => ({
        ...item,
        unitPrice: onlineDiscountEnabled
          ? Math.round(Number(item.unitPrice) * (1 - ONLINE_DISCOUNT))
          : Number(item.unitPrice),
      }));

      const subtotal = discountedItems.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
      const total = Math.max(0, subtotal - discount);

      const orderNumber = `PED-${Date.now().toString(36).toUpperCase()}`;
      const orderId = uuidv4();
      const couponNote = couponCode ? ` [Cupón: ${couponCode} - Desc: $${discount}]` : '';
      const onlineDiscountNote = onlineDiscountEnabled ? '[PAGO EN LÍNEA MP -10%] ' : '[PAGO EN LÍNEA MP] ';
      const finalNotes = `${onlineDiscountNote}${notes || ''}${couponNote}`.trim();

      // ── CREAR PREFERENCIA MP PRIMERO — si falla, no se inserta la orden ──
      const mpClient = new MercadoPagoConfig({ accessToken: mpToken });
      const preferenceClient = new Preference(mpClient);

      const preference = await preferenceClient.create({
        body: {
          external_reference: orderId,
          items: discountedItems.map((item: any) => ({
            id: item.productId,
            title: item.productName,
            quantity: parseInt(item.quantity, 10),
            unit_price: parseFloat(Number(item.unitPrice).toFixed(2)),
            currency_id: 'COP',
          })),
          payer: {
            name: customerName,
            email: customerEmail || 'cliente@tienda.com',
            phone: { number: customerPhone },
            identification: customerCedula ? { type: 'CC', number: customerCedula } : undefined,
          },
          back_urls: {
            success: `${frontendUrl}/?mp=success&order=${orderId}`,
            failure: `${frontendUrl}/?mp=failure&order=${orderId}`,
            pending: `${frontendUrl}/?mp=pending&order=${orderId}`,
          },
          auto_return: 'approved',
          metadata: { orderId, orderNumber },
        },
      });

      // Insertar orden solo si la preferencia MP fue exitosa
      await pool.query(
        `INSERT INTO storefront_orders
          (id, tenant_id, order_number, customer_name, customer_phone, customer_email, customer_cedula,
           department, municipality, address, neighborhood, notes, subtotal, shipping_cost, discount,
           total, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'mercadopago', 'pendiente')`,
        [orderId, tenantId, orderNumber, customerName, customerPhone, customerEmail || null, customerCedula || null,
          department || null, municipality || null, address || null, neighborhood || null, finalNotes,
          subtotal, discount, total]
      );

      const itemDiscountPct = onlineDiscountEnabled ? 10 : 0;
      for (const item of discountedItems) {
        await pool.query(
          `INSERT INTO storefront_order_items
            (order_id, product_id, product_name, product_image, quantity, unit_price, original_price, discount_percent, total_price,
             is_preorder, preorder_ship_start, preorder_ship_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.productId, item.productName, item.productImage || null,
            item.quantity, item.unitPrice, item.originalUnitPrice || item.unitPrice, itemDiscountPct,
            item.unitPrice * item.quantity,
            item.isPreorder ? 1 : 0, item.preorderShipStart || null, item.preorderShipEnd || null]
        );
      }

      // Crear holds de 3h para pago en línea
      const holdExpiry3h = new Date(Date.now() + 3 * 60 * 60 * 1000);
      await createHolds(orderId, tenantId, discountedItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity })), holdExpiry3h).catch(() => {});

      res.status(201).json({
        success: true,
        data: {
          orderId,
          orderNumber,
          total,
          initPoint: preference.init_point,
          sandboxInitPoint: preference.sandbox_init_point,
        },
      });
    } catch (error) {
      console.error('MP preference error:', error);
      res.status(500).json({ success: false, error: 'Error al crear preferencia de pago' });
    }
  }
);

// =============================================
// PUBLIC: Crear aplicación de crédito con ADDI
// =============================================
router.post(
  '/addi-application',
  [
    body('customerName').notEmpty(),
    body('customerPhone').notEmpty(),
    body('customerEmail').optional().isEmail(),
    body('items').isArray({ min: 1 }),
    body('items.*.productId').notEmpty(),
    body('items.*.productName').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitPrice').isFloat({ min: 0 }),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      // Read ADDI credentials from env or platform_settings DB
      let addiClientId = process.env.ADDI_CLIENT_ID || '';
      let addiClientSecret = process.env.ADDI_CLIENT_SECRET || '';
      let addiStoreSlug = process.env.ADDI_STORE_SLUG || '';
      let addiProduction = process.env.ADDI_PRODUCTION === 'true';

      if (!addiClientId || !addiClientSecret) {
        const [psRows] = await pool.query(
          "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('addi_client_id','addi_client_secret','addi_store_slug','addi_production')"
        ) as any;
        for (const r of psRows) {
          if (r.setting_key === 'addi_client_id') addiClientId = r.setting_value || addiClientId;
          if (r.setting_key === 'addi_client_secret') addiClientSecret = r.setting_value || addiClientSecret;
          if (r.setting_key === 'addi_store_slug') addiStoreSlug = r.setting_value || addiStoreSlug;
          if (r.setting_key === 'addi_production') addiProduction = r.setting_value === 'true';
        }
      }

      // Use staging credentials as fallback if nothing configured
      if (!addiClientId) addiClientId = 'y61CPhOS0YB7wxz8BgKBpQt4YcTsW0wi';
      if (!addiClientSecret) addiClientSecret = 'U6zgGfhZ_F-HLbqyM70fkssviIQ2PDL34phvGIL4wIppfoSXv-z63mrldcrnUZUi';

      const addiAudience = addiProduction ? 'https://api.addi.com' : 'https://api.staging.addi.com';
      const addiAuthUrl = addiProduction ? 'https://auth.addi.com/oauth/token' : 'https://auth.addi-staging.com/oauth/token';
      const addiApiUrl = addiProduction ? 'https://api.addi.com' : 'https://api.staging.addi.com';
      const frontendUrl = config.mp.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';

      // Step 1: Authenticate with ADDI
      const authRes = await fetch(addiAuthUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience: addiAudience,
          grant_type: 'client_credentials',
          client_id: addiClientId,
          client_secret: addiClientSecret,
        }),
      });

      if (!authRes.ok) {
        const authErr = await authRes.text();
        console.error('ADDI auth error:', authErr);
        res.status(503).json({ success: false, error: 'Error al autenticar con ADDI. Verifica las credenciales.' });
        return;
      }

      const authData: any = await authRes.json();
      const addiToken = authData.access_token;
      if (!addiToken) {
        res.status(503).json({ success: false, error: 'No se recibió token de ADDI.' });
        return;
      }

      const {
        customerName, customerPhone, customerEmail, customerCedula,
        department, municipality, address, neighborhood, notes,
        items, tenantId: requestedTenantId, couponCode, discount = 0,
      } = req.body;

      // Find tenant
      let tenantId = requestedTenantId;
      if (!tenantId) {
        const [tenants] = await pool.query(
          'SELECT id FROM tenants WHERE status = ? ORDER BY id ASC LIMIT 1',
          ['activo']
        ) as any;
        if (!tenants || tenants.length === 0) {
          res.status(400).json({ success: false, error: 'No hay tienda disponible' });
          return;
        }
        tenantId = tenants[0].id;
      }

      const subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
      const total = Math.max(0, subtotal - discount);

      // Create order in DB
      const orderNumber = `PED-${Date.now().toString(36).toUpperCase()}`;
      const orderId = uuidv4();
      const couponNote = couponCode ? ` [Cupón: ${couponCode} - Desc: $${discount}]` : '';
      const finalNotes = `[PAGO ADDI] ${notes || ''}${couponNote}`.trim();

      await pool.query(
        `INSERT INTO storefront_orders
          (id, tenant_id, order_number, customer_name, customer_phone, customer_email, customer_cedula,
           department, municipality, address, neighborhood, notes, subtotal, shipping_cost, discount,
           total, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'addi', 'pendiente')`,
        [orderId, tenantId, orderNumber, customerName, customerPhone, customerEmail || null, customerCedula || null,
          department || null, municipality || null, address || null, neighborhood || null, finalNotes,
          subtotal, discount, total]
      );

      for (const item of items) {
        await pool.query(
          `INSERT INTO storefront_order_items
            (order_id, product_id, product_name, product_image, quantity, unit_price, original_price, discount_percent, total_price,
             is_preorder, preorder_ship_start, preorder_ship_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [orderId, item.productId, item.productName, item.productImage || null,
            item.quantity, item.unitPrice, item.originalUnitPrice || item.unitPrice,
            item.unitPrice * item.quantity,
            item.isPreorder ? 1 : 0, item.preorderShipStart || null, item.preorderShipEnd || null]
        );
      }

      // Step 2: Create ADDI application
      const nameParts = customerName.trim().split(' ');
      const firstName = nameParts[0] || customerName;
      const lastName = nameParts.slice(1).join(' ') || customerName;

      const addiPayload: Record<string, any> = {
        orderId,
        totalAmount: total,
        currency: 'COP',
        client: {
          firstName,
          lastName,
          email: customerEmail || '',
          cellphone: customerPhone,
          document: customerCedula || '',
          documentType: 'CC',
        },
        products: items.map((item: any) => ({
          sku: String(item.productId),
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        redirectUrl: `${frontendUrl}/?addi=success&order=${orderId}`,
        cancelUrl: `${frontendUrl}/?addi=cancel&order=${orderId}`,
        // Webhook server-side para confirmar el pago aunque el cliente no vuelva por la redirección
        callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/orders/addi-webhook`,
      };

      if (addiStoreSlug) {
        addiPayload.store = { slug: addiStoreSlug };
      }

      if (address) {
        addiPayload.pickUpAddress = {
          city: municipality || '',
          street: address,
        };
      }

      const appRes = await fetch(`${addiApiUrl}/v1/online-applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${addiToken}`,
        },
        body: JSON.stringify(addiPayload),
      });

      const appData: any = await appRes.json();

      if (!appRes.ok) {
        console.error('ADDI application error:', appData);
        res.status(502).json({ success: false, error: appData?.message || 'Error al crear aplicación de crédito en ADDI.' });
        return;
      }

      const applicationUrl = appData.applicationUrl || appData.url || appData.redirectUrl;
      if (!applicationUrl) {
        console.error('ADDI response missing URL:', appData);
        res.status(502).json({ success: false, error: 'ADDI no devolvió una URL de pago.' });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          orderId,
          orderNumber,
          total,
          applicationUrl,
        },
      });
    } catch (error) {
      console.error('ADDI application error:', error);
      res.status(500).json({ success: false, error: 'Error al crear la aplicación de crédito ADDI.' });
    }
  }
);

// =============================================
// PUBLIC: Webhook de ADDI (confirmación server-side)
// ADDI llama a este callbackUrl al resolver la solicitud. Confirma el pedido
// aunque el cliente no regrese por la redirección (resuelve la carrera
// webhook-vs-redirección).
// =============================================
router.post('/addi-webhook', async (req: Request, res: Response) => {
  try {
    // Basic Auth opcional (addi_webhook_user/password en env o platform_settings)
    let webhookUser = process.env.ADDI_WEBHOOK_USER || '';
    let webhookPass = process.env.ADDI_WEBHOOK_PASSWORD || '';
    if (!webhookUser || !webhookPass) {
      const [psRows] = await pool.query(
        "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('addi_webhook_user','addi_webhook_password')"
      ) as any;
      for (const r of psRows) {
        if (r.setting_key === 'addi_webhook_user') webhookUser = r.setting_value || '';
        if (r.setting_key === 'addi_webhook_password') webhookPass = r.setting_value || '';
      }
    }
    if (webhookUser && webhookPass) {
      const authHeader = (req.headers['authorization'] as string) || '';
      const expected = 'Basic ' + Buffer.from(`${webhookUser}:${webhookPass}`).toString('base64');
      if (authHeader !== expected) {
        console.warn('ADDI webhook: unauthorized request');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    } else {
      console.warn('ADDI webhook: sin credenciales configuradas — aceptando sin auth. Configura addi_webhook_user/addi_webhook_password.');
    }

    const payload = req.body;
    const { orderId, status } = payload || {};

    if (orderId && status) {
      const statusMap: Record<string, string> = {
        APPROVED: 'confirmado', REJECTED: 'cancelado', DECLINED: 'cancelado', ABANDONED: 'cancelado',
      };
      const newStatus = statusMap[String(status).toUpperCase()];
      if (newStatus) {
        const [orderRows] = await pool.query(
          "SELECT id, tenant_id, order_number, customer_name, total, status FROM storefront_orders WHERE id = ? AND payment_method = 'addi' LIMIT 1",
          [orderId]
        ) as any;
        const order = orderRows?.[0];
        // Idempotencia: no re-procesar pedidos ya cerrados
        if (order && !['entregado', 'cancelado'].includes(order.status)) {
          await pool.query(
            'UPDATE storefront_orders SET status = ?, gateway_payment_id = COALESCE(gateway_payment_id, ?) WHERE id = ?',
            [newStatus, orderId, orderId]
          );
          console.log(`ADDI webhook: order ${orderId} → ${newStatus}`);
          if (newStatus === 'confirmado') {
            await extendHolds(orderId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).catch(() => {});
            try {
              await pool.query(
                `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
                 VALUES (?, 'new_order', ?, ?, ?)`,
                [order.tenant_id,
                 `Pago ADDI confirmado: #${order.order_number}`,
                 `${order.customer_name} pagó con ADDI $${Number(order.total).toLocaleString('es-CO')}`,
                 JSON.stringify({ orderId: order.id, orderNumber: order.order_number, paymentMethod: 'addi' })]
              );
            } catch { /* notifications non-critical */ }
          } else if (newStatus === 'cancelado') {
            await releaseHolds(orderId).catch(() => {});
          }
        }
      }
    }

    // ADDI espera HTTP 200 devolviendo el cuerpo recibido
    res.status(200).json(payload);
  } catch (error) {
    console.error('ADDI webhook error:', error);
    res.status(200).json(req.body); // siempre 200 para evitar reintentos de ADDI
  }
});

// =============================================
// PUBLIC: Estado de orden ADDI
// El frontend lo consulta al volver de ADDI. Reintenta hasta 3 veces (1s) para
// dar tiempo a que llegue el webhook antes de mostrar el resultado.
// =============================================
router.get('/addi-status/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    for (let attempt = 0; attempt < 3; attempt++) {
      const [rows] = await pool.query(
        "SELECT status FROM storefront_orders WHERE id = ? AND payment_method = 'addi' LIMIT 1",
        [orderId]
      ) as any;
      if (!rows?.length) { res.status(404).json({ success: false }); return; }
      if (rows[0].status !== 'pendiente') { res.json({ success: true, status: rows[0].status }); return; }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    const [rows] = await pool.query(
      "SELECT status FROM storefront_orders WHERE id = ? LIMIT 1",
      [orderId]
    ) as any;
    res.json({ success: true, status: rows?.[0]?.status || 'pendiente' });
  } catch {
    res.status(500).json({ success: false });
  }
});

// =============================================
// PUBLIC: Crear solicitud de crédito con Sistecredito
// =============================================

// Helper: load Sistecredito credentials from env or platform_settings
async function loadSisteCredentials() {
  let apiKey = process.env.SISTECREDITO_API_KEY || '';
  let apiSecret = process.env.SISTECREDITO_SECRET || process.env.SISTECREDITO_API_SECRET || '';
  let allyCode = process.env.SISTECREDITO_ALLY || process.env.SISTECREDITO_ALLY_CODE || '';
  let isProduction = process.env.SISTECREDITO_ENV === 'production' || process.env.SISTECREDITO_PRODUCTION === 'true';

  if (!apiKey) {
    const [psRows] = await pool.query(
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('sistecredito_api_key','sistecredito_api_secret','sistecredito_ally_code','sistecredito_production')"
    ) as any;
    for (const r of psRows) {
      if (r.setting_key === 'sistecredito_api_key') apiKey = r.setting_value || apiKey;
      if (r.setting_key === 'sistecredito_api_secret') apiSecret = r.setting_value || apiSecret;
      if (r.setting_key === 'sistecredito_ally_code') allyCode = r.setting_value || allyCode;
      if (r.setting_key === 'sistecredito_production') isProduction = r.setting_value === 'true';
    }
  }

  const baseUrl = isProduction
    ? 'https://api.sistecredito.com'
    : 'https://api-sandbox.sistecredito.com';

  return { apiKey, apiSecret, allyCode, isProduction, baseUrl };
}

// Helper: build auth headers for Sistecredito
// Uses HMAC-SHA256 if secret is provided, otherwise Bearer token
function buildSisteHeaders(apiKey: string, apiSecret: string, payloadStr: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };

  if (apiSecret) {
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(payloadStr)
      .digest('hex');
    headers['x-signature'] = signature;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

router.post(
  '/sistecredito-application',
  [
    body('customerName').notEmpty(),
    body('customerPhone').notEmpty(),
    body('customerEmail').optional().isEmail(),
    body('customerCedula').notEmpty().withMessage('La cédula es requerida para Sistecredito'),
    body('items').isArray({ min: 1 }),
    body('items.*.productId').notEmpty(),
    body('items.*.productName').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitPrice').isFloat({ min: 0 }),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { apiKey, apiSecret, allyCode, baseUrl } = await loadSisteCredentials();

      if (!apiKey) {
        res.status(503).json({ success: false, error: 'Sistecredito no está configurado. Configúralo en el panel de administración.' });
        return;
      }

      const frontendUrl = config.mp.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

      const {
        customerName, customerPhone, customerEmail, customerCedula,
        department, municipality, address, notes,
        items, tenantId: requestedTenantId, couponCode, discount = 0,
      } = req.body;

      // Find tenant
      let tenantId = requestedTenantId;
      if (!tenantId) {
        const [tenants] = await pool.query(
          'SELECT id FROM tenants WHERE status = ? ORDER BY id ASC LIMIT 1',
          ['activo']
        ) as any;
        if (!tenants || tenants.length === 0) {
          res.status(400).json({ success: false, error: 'No hay tienda disponible' });
          return;
        }
        tenantId = tenants[0].id;
      }

      const subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
      const total = Math.max(0, subtotal - discount);

      // Create order in DB
      const orderNumber = `PED-${Date.now().toString(36).toUpperCase()}`;
      const orderId = uuidv4();
      const couponNote = couponCode ? ` [Cupón: ${couponCode} - Desc: $${discount}]` : '';
      const finalNotes = `[PAGO SISTECREDITO] ${notes || ''}${couponNote}`.trim();

      await pool.query(
        `INSERT INTO storefront_orders
          (id, tenant_id, order_number, customer_name, customer_phone, customer_email, customer_cedula,
           department, municipality, address, notes, subtotal, shipping_cost, discount,
           total, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'sistecredito', 'pendiente')`,
        [orderId, tenantId, orderNumber, customerName, customerPhone, customerEmail || null, customerCedula || null,
          department || null, municipality || null, address || null, finalNotes,
          subtotal, discount, total]
      );

      for (const item of items) {
        await pool.query(
          `INSERT INTO storefront_order_items
            (order_id, product_id, product_name, product_image, quantity, unit_price, original_price, discount_percent, total_price,
             is_preorder, preorder_ship_start, preorder_ship_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [orderId, item.productId, item.productName, item.productImage || null,
            item.quantity, item.unitPrice, item.originalUnitPrice || item.unitPrice,
            item.unitPrice * item.quantity,
            item.isPreorder ? 1 : 0, item.preorderShipStart || null, item.preorderShipEnd || null]
        );
      }

      // Build payload following Sistecredito structure
      const sistePayload: Record<string, any> = {
        customer: {
          name: customerName,
          document: customerCedula,
          phone: customerPhone,
          email: customerEmail || '',
          address: address || '',
          city: municipality || '',
          department: department || '',
        },
        order: {
          reference: orderNumber,
          value: total,
          currency: 'COP',
        },
        redirectUrl: `${frontendUrl}/?sistecredito=success&order=${orderId}`,
        cancelUrl: `${frontendUrl}/?sistecredito=cancel&order=${orderId}`,
        notifyUrl: `${backendUrl}/api/orders/sistecredito-webhook`,
      };

      if (allyCode) sistePayload.allyCode = allyCode;

      const payloadStr = JSON.stringify(sistePayload);
      const headers = buildSisteHeaders(apiKey, apiSecret, payloadStr);

      const appRes = await fetch(`${baseUrl}/credit/application`, {
        method: 'POST',
        headers,
        body: payloadStr,
      });

      const appData: any = await appRes.json();

      if (!appRes.ok) {
        console.error('Sistecredito application error:', appData);
        res.status(502).json({
          success: false,
          error: appData?.message || appData?.mensaje || appData?.error || 'Error al crear solicitud en Sistecredito.',
        });
        return;
      }

      // Handle response: approval / rejection / redirect link
      const status = appData.status || appData.estado || '';
      if (status === 'rejected' || status === 'rechazado') {
        // Update order status to reflect rejection
        await pool.query(
          "UPDATE storefront_orders SET notes = CONCAT(notes, ' [RECHAZADO POR SISTECREDITO]') WHERE id = ?",
          [orderId]
        );
        res.status(200).json({
          success: false,
          error: appData.message || appData.mensaje || 'Crédito no aprobado por Sistecredito.',
          rejected: true,
        });
        return;
      }

      // Approved or pending — get redirect URL
      const applicationUrl =
        appData.url ||
        appData.redirectUrl ||
        appData.urlRedireccion ||
        appData.applicationUrl ||
        appData.link;

      if (!applicationUrl) {
        // Sistecredito may approve inline (no redirect needed)
        if (status === 'approved' || status === 'aprobado') {
          await pool.query("UPDATE storefront_orders SET status = 'confirmado' WHERE id = ?", [orderId]);
          res.status(201).json({
            success: true,
            data: { orderId, orderNumber, total, approved: true },
          });
          return;
        }
        console.error('Sistecredito response missing URL:', appData);
        res.status(502).json({ success: false, error: 'Sistecredito no devolvió una URL de validación.' });
        return;
      }

      res.status(201).json({
        success: true,
        data: { orderId, orderNumber, total, applicationUrl },
      });
    } catch (error) {
      console.error('Sistecredito application error:', error);
      res.status(500).json({ success: false, error: 'Error al crear la solicitud de crédito con Sistecredito.' });
    }
  }
);

// =============================================
// PUBLIC: Webhook de MercadoPago
// =============================================
router.post('/mercadopago-webhook', async (req: Request, res: Response) => {
  try {
    // Load MP credentials from DB / env
    let mpToken = config.mp.accessToken;
    let mpWebhookSecret: string | null = null;
    const [psRows] = await pool.query(
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('mp_access_token','mp_webhook_secret')"
    ) as any;
    for (const r of psRows) {
      if (r.setting_key === 'mp_access_token' && !mpToken) mpToken = r.setting_value;
      if (r.setting_key === 'mp_webhook_secret') mpWebhookSecret = r.setting_value;
    }

    // Verify MercadoPago HMAC-SHA256 signature
    // MP signature header format: "ts=<timestamp>,v1=<hmac>"
    if (mpWebhookSecret) {
      const sigHeader = req.headers['x-signature'] as string || '';
      const requestId = req.headers['x-request-id'] as string || '';
      const dataId = (req.query['data.id'] || req.body?.data?.id) as string || '';
      const tsMatch = sigHeader.match(/ts=([^,]+)/);
      const v1Match = sigHeader.match(/v1=([^,]+)/);

      if (!tsMatch || !v1Match) {
        audit.webhookInvalidSignature('mercadopago', req.ip);
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const ts = tsMatch[1];
      const receivedHmac = v1Match[1];
      const manifest = `id:${dataId};request-date:${ts};`;
      const expectedHmac = crypto
        .createHmac('sha256', mpWebhookSecret)
        .update(manifest)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))) {
        audit.webhookInvalidSignature('mercadopago', req.ip);
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const topic = req.query.topic || req.body?.type;
    // req.query['data.id'] → webhook firmado nuevo; req.body?.data?.id → cuerpo nuevo; req.query.id → IPN (deprecado)
    const paymentId = req.query['data.id'] || req.body?.data?.id || req.query.id;

    if (!mpToken || !paymentId || (topic !== 'payment' && topic !== 'payment_intent')) {
      res.status(200).json({ received: true });
      return;
    }

    // Fetch payment details from MP API
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });

    if (!mpRes.ok) {
      console.error('MP webhook: failed to fetch payment', paymentId);
      res.status(200).json({ received: true });
      return;
    }

    const payment = await mpRes.json() as any;
    const orderId = payment.external_reference;
    const mpStatus = (payment.status || '').toLowerCase();

    if (!orderId) {
      res.status(200).json({ received: true });
      return;
    }

    if (mpStatus === 'approved') {
      // Guardar idempotencia: solo procesar si la orden seguía 'pendiente' (evita
      // re-disparar efectos ante webhooks duplicados de MP).
      const [upd] = await pool.query(
        "UPDATE storefront_orders SET status = 'confirmado', gateway_payment_id = ? WHERE id = ? AND status = 'pendiente'",
        [String(paymentId), orderId]
      ) as any;
      if (upd.affectedRows > 0) {
        console.log(`MP webhook: order ${orderId} confirmed (payment ${paymentId})`);
        // Extender hold a 30 días al confirmar pago
        const holdExpiry30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await extendHolds(orderId, holdExpiry30d).catch(() => {});
        // Notificar al comerciante (no crítico)
        try {
          const [oRows] = await pool.query(
            'SELECT tenant_id, order_number, customer_name, total FROM storefront_orders WHERE id = ? LIMIT 1',
            [orderId]
          ) as any;
          const o = oRows?.[0];
          if (o) {
            await pool.query(
              `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
               VALUES (?, 'new_order', ?, ?, ?)`,
              [o.tenant_id,
               `Pago MercadoPago confirmado: #${o.order_number}`,
               `${o.customer_name} pagó con MercadoPago $${Number(o.total).toLocaleString('es-CO')}`,
               JSON.stringify({ orderId, orderNumber: o.order_number, paymentMethod: 'mercadopago' })]
            );
          }
        } catch { /* notifications non-critical */ }
      }
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      await pool.query(
        "UPDATE storefront_orders SET status = 'cancelado' WHERE id = ? AND status = 'pendiente'",
        [orderId]
      );
      await releaseHolds(orderId).catch(() => {});
      console.log(`MP webhook: order ${orderId} cancelled (${mpStatus})`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('MP webhook error:', error);
    res.status(200).json({ received: true }); // always 200 to prevent MP retries
  }
});

// =============================================
// PUBLIC: Webhook de Sistecredito
// =============================================
router.post('/sistecredito-webhook', async (req: Request, res: Response) => {
  try {
    const { apiKey, apiSecret } = await loadSisteCredentials();

    // Verify HMAC signature if secret is configured
    if (apiSecret) {
      const receivedSig = req.headers['x-signature'] as string || '';
      const payloadStr = JSON.stringify(req.body);
      const expectedSig = crypto
        .createHmac('sha256', apiSecret)
        .update(payloadStr)
        .digest('hex');
      const receivedBuf = Buffer.from(receivedSig.padEnd(expectedSig.length, '\0'));
      const expectedBuf = Buffer.from(expectedSig);
      const sigValid = receivedBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(receivedBuf, expectedBuf);
      if (!sigValid) {
        console.warn('Sistecredito webhook: invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } else if (apiKey) {
      // Some integrations send the API key as a header for webhook validation
      const receivedKey = req.headers['x-api-key'] as string || '';
      if (receivedKey && receivedKey !== apiKey) {
        console.warn('Sistecredito webhook: invalid api key');
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }
    }

    const { reference, status, orderId: webhookOrderId } = req.body;
    const resolvedRef = webhookOrderId || reference;

    if (!resolvedRef) {
      res.status(400).json({ error: 'Missing order reference' });
      return;
    }

    // Find order by orderId or orderNumber
    const [orderRows] = await pool.query(
      "SELECT id, tenant_id, order_number, customer_name, total, status FROM storefront_orders WHERE id = ? OR order_number = ? LIMIT 1",
      [resolvedRef, resolvedRef]
    ) as any;

    if (!orderRows || orderRows.length === 0) {
      console.warn('Sistecredito webhook: order not found:', resolvedRef);
      res.status(200).json({ received: true }); // always 200 to avoid retries
      return;
    }

    const order = orderRows[0];
    const normalizedStatus = (status || '').toLowerCase();

    if ((normalizedStatus === 'approved' || normalizedStatus === 'aprobado') && order.status === 'pendiente') {
      // Idempotente: solo confirma si seguía 'pendiente'
      const [upd] = await pool.query(
        "UPDATE storefront_orders SET status = 'confirmado', gateway_payment_id = COALESCE(gateway_payment_id, ?) WHERE id = ? AND status = 'pendiente'",
        [order.id, order.id]
      ) as any;
      if (upd.affectedRows > 0) {
        console.log(`Sistecredito webhook: order ${order.id} confirmed`);
        // Extender hold a 30 días al confirmar pago
        await extendHolds(order.id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).catch(() => {});
        // Notificar al comerciante (no crítico)
        try {
          await pool.query(
            `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
             VALUES (?, 'new_order', ?, ?, ?)`,
            [order.tenant_id,
             `Pago Sistecredito confirmado: #${order.order_number}`,
             `${order.customer_name} pagó con Sistecredito $${Number(order.total).toLocaleString('es-CO')}`,
             JSON.stringify({ orderId: order.id, orderNumber: order.order_number, paymentMethod: 'sistecredito' })]
          );
        } catch { /* notifications non-critical */ }
      }
    } else if ((normalizedStatus === 'rejected' || normalizedStatus === 'rechazado') && order.status === 'pendiente') {
      await pool.query(
        "UPDATE storefront_orders SET status = 'cancelado' WHERE id = ? AND status = 'pendiente'",
        [order.id]
      );
      await releaseHolds(order.id).catch(() => {});
      console.log(`Sistecredito webhook: order ${order.id} cancelled (rejected)`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Sistecredito webhook error:', error);
    res.status(200).json({ received: true }); // always 200 to avoid retries
  }
});

// =============================================
// PUBLIC: Estado de orden Sistecredito
// El frontend lo consulta al volver de Sistecredito. Reintenta hasta 3 veces
// (1s) para dar tiempo a que llegue el webhook (carrera webhook-vs-redirección).
// =============================================
router.get('/sistecredito-status/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    for (let attempt = 0; attempt < 3; attempt++) {
      const [rows] = await pool.query(
        "SELECT status FROM storefront_orders WHERE id = ? AND payment_method = 'sistecredito' LIMIT 1",
        [orderId]
      ) as any;
      if (!rows?.length) { res.status(404).json({ success: false }); return; }
      if (rows[0].status !== 'pendiente') { res.json({ success: true, status: rows[0].status }); return; }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    const [rows] = await pool.query(
      "SELECT status FROM storefront_orders WHERE id = ? LIMIT 1",
      [orderId]
    ) as any;
    res.json({ success: true, status: rows?.[0]?.status || 'pendiente' });
  } catch {
    res.status(500).json({ success: false });
  }
});

// =============================================
// PUBLIC: Cancelar orden de pasarela abandonada
// =============================================
// Called by frontend when user returns with ?mp=failure or ?mp=pending without paying
router.put('/cancel-gateway/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ success: false, error: 'orderId requerido' });
      return;
    }
    // Only cancel if the order is still pending (not yet paid/confirmed)
    await pool.query(
      "UPDATE storefront_orders SET status = 'cancelado' WHERE id = ? AND payment_method IN ('mercadopago', 'addi', 'sistecredito') AND status = 'pendiente'",
      [orderId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel gateway order error:', error);
    res.status(500).json({ success: false, error: 'Error al cancelar orden' });
  }
});

// =============================================
// AUTHENTICATED: Endpoints para comerciantes
// =============================================
router.use(authenticate);

// GET /api/orders — Listar pedidos del tenant
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().notEmpty(),
    query('search').optional().notEmpty(),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;

      let whereClause = 'WHERE o.tenant_id = ?';
      const params: any[] = [tenantId];

      if (status) {
        whereClause += ' AND o.status = ?';
        params.push(status);
      }

      if (search) {
        whereClause += ' AND (o.customer_name LIKE ? OR o.order_number LIKE ? OR o.customer_phone LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM storefront_orders o ${whereClause}`,
        params
      ) as any;
      const total = countResult[0].total;

      // Get orders
      const [orders] = await pool.query(
        `SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
                o.customer_phone as customerPhone, o.customer_email as customerEmail,
                o.customer_cedula as customerCedula, o.department, o.municipality,
                o.address, o.neighborhood, o.delivery_latitude as deliveryLatitude,
                o.delivery_longitude as deliveryLongitude, o.notes, o.subtotal,
                o.shipping_cost as shippingCost, o.discount, o.total, o.status,
                o.payment_method as paymentMethod, o.delivery_driver_id as deliveryDriverId,
                o.delivery_status as deliveryStatus, d.name as driverName,
                o.created_at as createdAt, o.updated_at as updatedAt
         FROM storefront_orders o
         LEFT JOIN users d ON d.id = o.delivery_driver_id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ) as any;

      // Get items for each order
      for (const order of orders) {
        const [items] = await pool.query(
          `SELECT oi.id, oi.product_id as productId, oi.product_name as productName,
                  oi.product_image as productImage, oi.quantity, oi.unit_price as unitPrice,
                  oi.original_price as originalPrice, oi.discount_percent as discountPercent,
                  oi.total_price as totalPrice, oi.size, oi.color
           FROM storefront_order_items oi
           WHERE oi.order_id = ?`,
          [order.id]
        ) as any;
        order.items = items;
      }

      res.json({
        success: true,
        data: {
          orders,
          pagination: { total, page, limit, pages: Math.ceil(total / limit) }
        }
      });
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener pedidos' });
    }
  }
);

// GET /api/orders/stats — Estadísticas de pedidos
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const [stats] = await pool.query(
      `SELECT
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmado' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'preparando' THEN 1 ELSE 0 END) as preparing,
        SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status = 'entregado' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status != 'cancelado' THEN total ELSE 0 END) as totalRevenue
       FROM storefront_orders
       WHERE tenant_id = ?`,
      [tenantId]
    ) as any;

    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Order stats error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
});

// GET /api/orders/:id — Detalle de un pedido
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const orderId = req.params.id;

    const [orders] = await pool.query(
      `SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
              o.customer_phone as customerPhone, o.customer_email as customerEmail,
              o.customer_cedula as customerCedula, o.department, o.municipality,
              o.address, o.neighborhood, o.notes, o.subtotal, o.shipping_cost as shippingCost,
              o.discount, o.total, o.status, o.payment_method as paymentMethod,
              o.created_at as createdAt, o.updated_at as updatedAt
       FROM storefront_orders o
       WHERE o.id = ? AND o.tenant_id = ?`,
      [orderId, tenantId]
    ) as any;

    if (orders.length === 0) {
      res.status(404).json({ success: false, error: 'Pedido no encontrado' });
      return;
    }

    const [items] = await pool.query(
      `SELECT oi.id, oi.product_id as productId, oi.product_name as productName,
              oi.product_image as productImage, oi.quantity, oi.unit_price as unitPrice,
              oi.total_price as totalPrice, oi.size, oi.color
       FROM storefront_order_items oi
       WHERE oi.order_id = ?`,
      [orderId]
    ) as any;

    res.json({ success: true, data: { ...orders[0], items } });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener pedido' });
  }
});

// PUT /api/orders/:id/status — Actualizar estado del pedido
router.put(
  '/:id/status',
  [
    param('id').notEmpty(),
    body('status').isIn(['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado'])
      .withMessage('Estado inválido'),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const tenantId = (req as any).user.tenantId;
      const userId = (req as any).user.id;
      const userName = (req as any).user.name || 'Sistema';
      const orderId = req.params.id;
      const { status } = req.body;

      // Get current order
      const [orderRows] = await connection.query(
        `SELECT o.*, o.order_number as orderNumber, o.customer_name as customerName,
                o.customer_phone as customerPhone, o.customer_email as customerEmail,
                o.customer_cedula as customerCedula
         FROM storefront_orders o
         WHERE o.id = ? AND o.tenant_id = ? FOR UPDATE`,
        [orderId, tenantId]
      ) as any;

      if (orderRows.length === 0) {
        await connection.rollback();
        res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        return;
      }

      const order = orderRows[0];

      // Prevent re-delivering or re-cancelling
      if (order.status === 'entregado') {
        await connection.rollback();
        res.status(400).json({ success: false, error: 'El pedido ya fue entregado y facturado' });
        return;
      }
      if (order.status === 'cancelado') {
        await connection.rollback();
        res.status(400).json({ success: false, error: 'El pedido ya fue cancelado' });
        return;
      }

      // Update order status
      await connection.query(
        'UPDATE storefront_orders SET status = ? WHERE id = ?',
        [status, orderId]
      );

      let invoiceNumber: string | null = null;
      let ivaEnabled = false;

      // ================================================================
      // When marked as "entregado" → Generate sale + deduct stock
      // ================================================================
      if (status === 'entregado') {
        // Get order items
        const [orderItems] = await connection.query(
          `SELECT oi.product_id as productId, oi.product_name as productName,
                  oi.quantity, oi.unit_price as unitPrice, oi.original_price as originalPrice,
                  oi.discount_percent as discountPercent, oi.total_price as totalPrice
           FROM storefront_order_items oi
           WHERE oi.order_id = ?`,
          [orderId]
        ) as any;

        // Generate invoice number
        const [seqRows] = await connection.query(
          'SELECT current_number, prefix FROM invoice_sequence WHERE tenant_id = ? FOR UPDATE',
          [tenantId]
        ) as any;

        let currentNumber = 0;
        let prefix = 'FAC';

        if (!seqRows || seqRows.length === 0) {
          // Initialize sequence if it doesn't exist
          await connection.query(
            "INSERT INTO invoice_sequence (tenant_id, prefix, current_number) VALUES (?, 'FAC', 0)",
            [tenantId]
          );
        } else {
          currentNumber = seqRows[0].current_number;
          prefix = seqRows[0].prefix || 'FAC';
        }

        currentNumber += 1;
        invoiceNumber = `${prefix}-${currentNumber.toString().padStart(5, '0')}`;

        await connection.query(
          'UPDATE invoice_sequence SET current_number = ? WHERE tenant_id = ?',
          [currentNumber, tenantId]
        );

        // Calculate totals — IVA solo si está habilitado en store_info
        const subtotal = orderItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice), 0);
        try {
          const [ivaRows] = await connection.query(
            'SELECT enable_iva FROM store_info WHERE tenant_id = ? LIMIT 1', [tenantId]
          ) as any;
          ivaEnabled = ivaRows.length > 0 && ivaRows[0].enable_iva != null ? Boolean(ivaRows[0].enable_iva) : false;
        } catch { ivaEnabled = false; }
        const tax = ivaEnabled ? Math.round(subtotal * 0.19 * 100) / 100 : 0;
        const total = subtotal + tax;

        // Check for active cash session
        const [activeSessionRows] = await connection.query(
          'SELECT id FROM cash_sessions WHERE status = ? AND tenant_id = ? LIMIT 1',
          ['abierta', tenantId]
        ) as any;
        const cashSessionId = activeSessionRows.length > 0 ? activeSessionRows[0].id : null;

        const saleId = uuidv4();

        // Insert sale
        await connection.query(
          `INSERT INTO sales (id, tenant_id, invoice_number, customer_id, customer_name, customer_phone, customer_email,
            subtotal, tax, discount, total, payment_method, amount_paid, change_amount, seller_id, seller_name, cash_session_id, notes, status)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'transferencia', ?, 0, ?, ?, ?, ?, 'completada')`,
          [
            saleId, tenantId, invoiceNumber,
            order.customer_name, order.customer_phone, order.customer_email,
            subtotal, tax, Number(order.discount) || 0, total,
            total, // amount_paid = total (paid in full)
            userId, userName, cashSessionId,
            `Pedido online ${order.order_number}`
          ]
        );

        // Insert sale items + deduct stock + register stock movements
        for (const item of orderItems) {
          const itemId = uuidv4();

          // Get product SKU and current stock
          let productSku = 'ONLINE';
          let previousStock = 0;
          if (item.productId) {
            const [prodRows] = await connection.query(
              'SELECT sku, stock FROM products WHERE id = ? FOR UPDATE',
              [item.productId]
            ) as any;
            if (prodRows.length > 0) {
              productSku = prodRows[0].sku;
              previousStock = prodRows[0].stock;

              // Deduct stock
              await connection.query(
                'UPDATE products SET stock = stock - ? WHERE id = ? AND tenant_id = ?',
                [item.quantity, item.productId, tenantId]
              );

              // Register stock movement
              await connection.query(
                `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id)
                 VALUES (?, ?, ?, 'venta', ?, ?, ?, ?, ?, ?)`,
                [
                  uuidv4(), tenantId, item.productId,
                  item.quantity, previousStock, previousStock - item.quantity,
                  `Venta online ${invoiceNumber}`, saleId, userId
                ]
              );
            }
          }

          // Insert sale item (unit_price = precio original, discount = % descuento, subtotal = precio final * cantidad)
          const saleUnitPrice = item.originalPrice || item.unitPrice;
          const saleDiscount = item.discountPercent || 0;
          await connection.query(
            `INSERT INTO sale_items (id, tenant_id, sale_id, product_id, product_name, product_sku, quantity, unit_price, discount, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [itemId, tenantId, saleId, item.productId, item.productName, productSku, item.quantity, saleUnitPrice, saleDiscount, Number(item.totalPrice)]
          );
        }

        // Link order to the generated sale
        await connection.query(
          'UPDATE storefront_orders SET payment_method = ? WHERE id = ?',
          [`Factura: ${invoiceNumber}`, orderId]
        );
      }

      // Liberar holds al entregar o cancelar
      if (status === 'entregado' || status === 'cancelado') {
        await releaseHolds(orderId).catch(() => {});
      }

      await connection.commit();

      // Alegra: enviar factura electrónica async (no bloquea la respuesta)
      if (status === 'entregado' && invoiceNumber) {
        setImmediate(async () => {
          try {
            const { alegraService } = await import('../alegra/alegra.service');
            const [oi] = await pool.query(
              `SELECT oi.product_name as productName, oi.quantity, oi.total_price as totalPrice
               FROM storefront_order_items oi WHERE oi.order_id = ?`, [orderId]
            ) as any;
            await alegraService.createInvoice({
              tenantId, invoiceNumber,
              customerName: order.customer_name || 'Consumidor Final',
              customerEmail: order.customer_email || undefined,
              customerPhone: order.customer_phone || undefined,
              customerCedula: order.customer_cedula || undefined,
              date: new Date().toISOString().split('T')[0],
              items: (oi as any[]).map((i: any) => ({
                name: i.productName, quantity: i.quantity,
                price: Number(i.totalPrice) / i.quantity, applyTax: ivaEnabled,
              })),
              observations: `Pedido online ${order.order_number}`,
            });
          } catch { /* Alegra no crítico */ }
        });
      }

      res.json({
        success: true,
        data: {
          id: orderId,
          status,
          ...(invoiceNumber ? { invoiceNumber, message: `Factura ${invoiceNumber} generada y stock descontado` } : {})
        }
      });
    } catch (error) {
      await connection.rollback();
      console.error('Update order status error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar estado' });
    } finally {
      connection.release();
    }
  }
);

export const ordersRoutes: ReturnType<typeof Router> = router;
