import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { ResultSetHeader } from 'mysql2/promise';

type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditPayload {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  action: string;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(payload: AuditPayload): Promise<void> {
    try {
      await db.execute<ResultSetHeader>(
        `INSERT INTO audit_log
         (id, tenant_id, user_id, user_email, action, severity, entity_type, entity_id, details, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          payload.tenantId,
          payload.userId || null,
          payload.userEmail || null,
          payload.action,
          payload.severity || 'info',
          payload.entityType || null,
          payload.entityId || null,
          payload.details ? JSON.stringify(payload.details) : null,
          payload.ipAddress || null,
          payload.userAgent || null,
        ]
      );
    } catch {
      // Audit failure must never block business operations
    }
  }
}

export const auditService = new AuditService();
