import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Módulo de protección de datos personales — Ley 1581 de 2012 (Habeas Data)
 * con prácticas RGPD como estándar técnico.
 *
 * - consent_records: registro inmutable (solo INSERT; revocar = granted=0 nuevo).
 * - data_subject_requests: solicitudes de titulares con SLA de 10 días hábiles.
 * - Exportación (derecho de acceso) y borrado por anonimización (derecho al olvido):
 *   se conservan los registros transaccionales por obligación fiscal, sin PII.
 */

export type ConsentType =
  | 'data_processing'
  | 'terms'
  | 'marketing_whatsapp'
  | 'marketing_email'
  | 'analytics_tracking';

export type ConsentSource = 'checkout' | 'cookie_banner' | 'whatsapp' | 'admin' | 'signup';

interface ConsentInput {
  tenantId: string;
  subjectType?: 'customer' | 'guest' | 'chat_contact';
  subjectId?: string | null;
  identifier: string; // teléfono o email normalizado
  consentType: ConsentType;
  granted: boolean;
  policyVersion?: string;
  source: ConsentSource;
  ipAddress?: string;
  userAgent?: string;
}

const DSR_SLA_BUSINESS_DAYS = 10; // Ley 1581 art. 14: respuesta en máximo 10 días hábiles

/** Suma N días hábiles (lun-vie) a la fecha dada. */
function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

/** Normaliza teléfono/email para usar como identificador estable de consentimiento. */
export function normalizeIdentifier(value: string): string {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('@')) return v;
  return v.replace(/\D/g, '');
}

const normName = (s: unknown) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export class PrivacyService {
  // ── Auditoría persistente ────────────────────────────────────────────────
  // A diferencia de utils/audit-logger (stdout), los eventos de privacidad se
  // persisten en audit_log: son la prueba de cumplimiento ante la SIC.
  private async writeAudit(params: {
    tenantId: string;
    userId?: string | null;
    userEmail?: string | null;
    action: string;
    severity?: 'info' | 'warning' | 'critical';
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await db.execute(
        `INSERT INTO audit_log (id, tenant_id, user_id, user_email, action, severity, entity_type, entity_id, details, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          params.tenantId,
          params.userId || null,
          params.userEmail || null,
          params.action,
          params.severity || 'info',
          params.entityType,
          params.entityId || null,
          params.details ? JSON.stringify(params.details) : null,
          params.ipAddress || null,
          params.userAgent || null,
        ]
      );
    } catch (e: any) {
      // La auditoría no debe tumbar la operación de negocio, pero sí quedar rastro
      console.error('[privacy] audit_log write failed:', e?.message || e);
    }
  }

  // ── Consentimientos ──────────────────────────────────────────────────────

  async recordConsent(input: ConsentInput): Promise<string> {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO consent_records
         (id, tenant_id, subject_type, subject_id, identifier, consent_type, granted, policy_version, source, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.tenantId,
        input.subjectType || 'guest',
        input.subjectId || null,
        normalizeIdentifier(input.identifier),
        input.consentType,
        input.granted ? 1 : 0,
        input.policyVersion || '1.0',
        input.source,
        input.ipAddress || null,
        (input.userAgent || '').slice(0, 500) || null,
      ]
    );
    return id;
  }

  /**
   * Registra el paquete de consentimientos del checkout público.
   * Devuelve el id del consentimiento principal (data_processing) para
   * guardarlo en la orden como prueba.
   */
  async recordCheckoutConsents(params: {
    tenantId: string;
    phone: string;
    acceptsMarketing?: boolean;
    policyVersion?: string;
    ipAddress?: string;
    userAgent?: string;
    /** Canal donde se capturó (default checkout web; el agente IA usa 'whatsapp') */
    source?: ConsentSource;
  }): Promise<string> {
    const base = {
      tenantId: params.tenantId,
      subjectType: 'guest' as const,
      identifier: params.phone,
      policyVersion: params.policyVersion,
      source: params.source || ('checkout' as const),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    };
    const consentId = await this.recordConsent({ ...base, consentType: 'data_processing', granted: true });
    await this.recordConsent({ ...base, consentType: 'terms', granted: true });
    if (params.acceptsMarketing !== undefined) {
      await this.recordConsent({
        ...base,
        consentType: 'marketing_whatsapp',
        granted: !!params.acceptsMarketing,
      });
    }
    return consentId;
  }

  /** Estado vigente de un consentimiento: el registro más reciente por identifier+type. */
  async hasConsent(tenantId: string, identifier: string, consentType: ConsentType): Promise<boolean> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT granted FROM consent_records
        WHERE tenant_id = ? AND identifier = ? AND consent_type = ?
        ORDER BY created_at DESC, id DESC LIMIT 1`,
      [tenantId, normalizeIdentifier(identifier), consentType]
    );
    return rows.length > 0 && rows[0].granted === 1;
  }

  // ── Solicitudes de titulares (DSR) ───────────────────────────────────────

  /**
   * Solicitud creada por el cliente final desde la tienda pública.
   * Anti-enumeración: exige que el nombre coincida con un pedido o cliente
   * previo de ese teléfono (mismo patrón que /orders/public/lookup). Si no
   * coincide, la solicitud se crea igual pero marcada como no verificada.
   */
  async createPublicRequest(params: {
    tenantId: string;
    requestType: 'access' | 'rectify' | 'erase' | 'revoke_consent';
    identifier: string;
    requesterName: string;
    details?: string;
  }): Promise<{ id: string; dueAt: Date }> {
    const identifier = normalizeIdentifier(params.identifier);
    if (identifier.length < 5) {
      throw new AppError('Identificador inválido: usa el teléfono o email con el que compraste', 400);
    }

    // Evitar spam: máx. 3 solicitudes abiertas por identificador y tenant
    const [open] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM data_subject_requests
        WHERE tenant_id = ? AND identifier = ? AND status IN ('pending','in_progress')`,
      [params.tenantId, identifier]
    );
    if (Number(open[0].total) >= 3) {
      throw new AppError('Ya tienes solicitudes en curso. El comercio debe responderlas antes de crear otra.', 429);
    }

    // Verificación ligera de identidad contra pedidos previos
    let verified = false;
    const reqName = normName(params.requesterName);
    const [orders] = await db.execute<RowDataPacket[]>(
      `SELECT customer_name FROM storefront_orders
        WHERE tenant_id = ? AND REPLACE(REPLACE(customer_phone,' ',''),'+','') LIKE ?
        ORDER BY created_at DESC LIMIT 1`,
      [params.tenantId, `%${identifier.slice(-10)}`]
    );
    if (orders.length > 0) {
      const stored = normName(orders[0].customer_name);
      verified = !!stored && (stored === reqName || stored.split(' ')[0] === reqName.split(' ')[0]);
    }

    const id = uuidv4();
    const dueAt = addBusinessDays(new Date(), DSR_SLA_BUSINESS_DAYS);
    await db.execute(
      `INSERT INTO data_subject_requests
         (id, tenant_id, request_type, status, identifier, requester_name, verification_method, details, due_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        id,
        params.tenantId,
        params.requestType,
        identifier,
        params.requesterName,
        verified ? 'phone_name_match' : 'unverified',
        params.details || null,
        dueAt,
      ]
    );

    await this.writeAudit({
      tenantId: params.tenantId,
      action: 'dsr_created',
      entityType: 'data_subject_request',
      entityId: id,
      details: { requestType: params.requestType, verified },
    });

    return { id, dueAt };
  }

  async listRequests(tenantId: string, status?: string): Promise<RowDataPacket[]> {
    const params: string[] = [tenantId];
    let where = 'WHERE tenant_id = ?';
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, request_type AS requestType, status, identifier, requester_name AS requesterName,
              verification_method AS verificationMethod, details, requested_at AS requestedAt,
              due_at AS dueAt, completed_at AS completedAt, handled_by AS handledBy, notes
         FROM data_subject_requests ${where}
         ORDER BY requested_at DESC LIMIT 200`,
      params
    );
    return rows;
  }

  async updateRequest(
    tenantId: string,
    id: string,
    data: { status?: 'pending' | 'in_progress' | 'completed' | 'denied'; notes?: string },
    handledBy: string
  ): Promise<void> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, status FROM data_subject_requests WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Solicitud no encontrada', 404);

    const updates: string[] = ['handled_by = ?'];
    const values: (string | null)[] = [handledBy];
    if (data.status) {
      updates.push('status = ?');
      values.push(data.status);
      if (data.status === 'completed' || data.status === 'denied') {
        updates.push('completed_at = NOW()');
      }
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes || null);
    }
    values.push(id, tenantId);
    await db.execute(
      `UPDATE data_subject_requests SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );

    if (data.status === 'completed' || data.status === 'denied') {
      await this.writeAudit({
        tenantId,
        userId: handledBy,
        action: `dsr_${data.status}`,
        entityType: 'data_subject_request',
        entityId: id,
      });
    }
  }

  // ── Derecho de acceso: exportación consolidada ───────────────────────────

  async exportCustomerData(tenantId: string, customerId: string, requestedBy: string): Promise<Record<string, unknown>> {
    const [customers] = await db.execute<RowDataPacket[]>(
      `SELECT id, cedula, name, phone, email, address, credit_limit AS creditLimit, notes,
              is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
         FROM customers WHERE id = ? AND tenant_id = ?`,
      [customerId, tenantId]
    );
    if (customers.length === 0) throw new AppError('Cliente no encontrado', 404);
    const customer = customers[0];
    const phoneDigits = normalizeIdentifier(String(customer.phone || ''));

    // Pedidos del storefront por teléfono (el guest checkout no enlaza customer_id)
    let orders: RowDataPacket[] = [];
    if (phoneDigits.length >= 7) {
      const [orderRows] = await db.execute<RowDataPacket[]>(
        `SELECT id, order_number AS orderNumber, customer_name AS customerName, customer_phone AS customerPhone,
                customer_email AS customerEmail, customer_cedula AS customerCedula, department, municipality,
                address, neighborhood, delivery_latitude AS deliveryLatitude, delivery_longitude AS deliveryLongitude,
                notes, subtotal, shipping_cost AS shippingCost, discount, total, status,
                payment_method AS paymentMethod, created_at AS createdAt
           FROM storefront_orders
          WHERE tenant_id = ? AND REPLACE(REPLACE(customer_phone,' ',''),'+','') LIKE ?
          ORDER BY created_at DESC LIMIT 500`,
        [tenantId, `%${phoneDigits.slice(-10)}`]
      );
      orders = orderRows;
    }

    // Ventas POS asociadas por customer_id
    const [sales] = await db.execute<RowDataPacket[]>(
      `SELECT id, invoice_number AS invoiceNumber, customer_name AS customerName, customer_phone AS customerPhone,
              customer_email AS customerEmail, total, payment_method AS paymentMethod, status, created_at AS createdAt
         FROM sales WHERE tenant_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 500`,
      [tenantId, customerId]
    );

    // Conversaciones del chatbot por teléfono
    let chatSessions: RowDataPacket[] = [];
    if (phoneDigits.length >= 7) {
      const [sessionRows] = await db.execute<RowDataPacket[]>(
        `SELECT id, customer_name AS customerName, customer_phone AS customerPhone, created_at AS createdAt
           FROM chatbot_sessions
          WHERE tenant_id = ? AND REPLACE(REPLACE(COALESCE(customer_phone,''),' ',''),'+','') LIKE ?
          ORDER BY created_at DESC LIMIT 100`,
        [tenantId, `%${phoneDigits.slice(-10)}`]
      );
      chatSessions = sessionRows;
    }

    // Consentimientos registrados
    const [consents] = await db.execute<RowDataPacket[]>(
      `SELECT consent_type AS consentType, granted, policy_version AS policyVersion, source, created_at AS createdAt
         FROM consent_records WHERE tenant_id = ? AND identifier = ?
         ORDER BY created_at DESC LIMIT 200`,
      [tenantId, phoneDigits || normalizeIdentifier(String(customer.email || ''))]
    );

    await this.writeAudit({
      tenantId,
      userId: requestedBy,
      action: 'pii_export',
      severity: 'warning',
      entityType: 'customer',
      entityId: customerId,
      details: { orders: orders.length, sales: sales.length, chatSessions: chatSessions.length },
    });

    return {
      exportedAt: new Date().toISOString(),
      legalBasis: 'Ley 1581 de 2012, art. 8 (derecho de acceso)',
      customer,
      storefrontOrders: orders,
      posSales: sales,
      chatbotSessions: chatSessions,
      consentHistory: consents,
    };
  }

  // ── Derecho al olvido: anonimización irreversible ────────────────────────

  async eraseCustomer(tenantId: string, customerId: string, handledBy: string): Promise<{ anonymized: Record<string, number> }> {
    const [customers] = await db.execute<RowDataPacket[]>(
      `SELECT c.id, c.phone, c.email,
              COALESCE((SELECT SUM(s.total) FROM sales s
                 WHERE s.customer_id = c.id AND s.payment_method = 'fiado' AND s.status = 'completada'), 0)
            - COALESCE((SELECT SUM(cp.amount) FROM credit_payments cp WHERE cp.customer_id = c.id), 0) AS balance
         FROM customers c WHERE c.id = ? AND c.tenant_id = ?`,
      [customerId, tenantId]
    );
    if (customers.length === 0) throw new AppError('Cliente no encontrado', 404);
    if (Number(customers[0].balance) > 0) {
      throw new AppError('No se puede anonimizar un cliente con saldo pendiente (crédito fiado activo)', 400);
    }

    const phoneDigits = normalizeIdentifier(String(customers[0].phone || ''));
    const counts: Record<string, number> = {};

    // 1. Cliente: PII fuera, registro queda para integridad referencial de ventas
    const [custRes] = await db.execute<ResultSetHeader>(
      `UPDATE customers
          SET name = '[ANONIMIZADO]', cedula = CONCAT('ANON-', LEFT(id, 8)), phone = NULL, email = NULL,
              address = NULL, notes = NULL, is_active = 0, deleted_at = NOW(), anonymized_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
      [customerId, tenantId]
    );
    counts.customers = custRes.affectedRows;

    // 1b. Ventas POS: el snapshot de identidad sale, los montos quedan (obligación fiscal)
    const [salesRes] = await db.execute<ResultSetHeader>(
      `UPDATE sales
          SET customer_name = '[ANONIMIZADO]', customer_phone = NULL, customer_email = NULL
        WHERE tenant_id = ? AND customer_id = ?`,
      [tenantId, customerId]
    );
    counts.posSales = salesRes.affectedRows;

    if (phoneDigits.length >= 7) {
      const phonePattern = `%${phoneDigits.slice(-10)}`;

      // 2. Pedidos del storefront: se conservan montos/estados, sin identidad ni ubicación
      const [orderRes] = await db.execute<ResultSetHeader>(
        `UPDATE storefront_orders
            SET customer_name = '[ANONIMIZADO]', customer_phone = '0', customer_email = NULL,
                customer_cedula = NULL, address = NULL, neighborhood = NULL,
                delivery_latitude = NULL, delivery_longitude = NULL, notes = NULL
          WHERE tenant_id = ? AND REPLACE(REPLACE(customer_phone,' ',''),'+','') LIKE ?`,
        [tenantId, phonePattern]
      );
      counts.storefrontOrders = orderRes.affectedRows;

      // 3. Conversaciones del chatbot de ese teléfono: sesiones anonimizadas y mensajes borrados
      const [sessions] = await db.execute<RowDataPacket[]>(
        `SELECT id FROM chatbot_sessions
          WHERE tenant_id = ? AND REPLACE(REPLACE(COALESCE(customer_phone,''),' ',''),'+','') LIKE ?`,
        [tenantId, phonePattern]
      );
      counts.chatbotSessions = sessions.length;
      counts.chatbotMessages = 0;
      for (const s of sessions) {
        const [msgRes] = await db.execute<ResultSetHeader>(
          'DELETE FROM chatbot_messages WHERE session_id = ?',
          [s.id]
        );
        counts.chatbotMessages += msgRes.affectedRows;
        await db.execute(
          `UPDATE chatbot_sessions SET customer_name = '[ANONIMIZADO]', customer_phone = NULL WHERE id = ?`,
          [s.id]
        );
      }
    }

    // Prueba de cumplimiento: queda el evento, no la identidad
    await this.writeAudit({
      tenantId,
      userId: handledBy,
      action: 'pii_erasure',
      severity: 'critical',
      entityType: 'customer',
      entityId: customerId,
      details: counts,
    });

    return { anonymized: counts };
  }
}

export const privacyService = new PrivacyService();
