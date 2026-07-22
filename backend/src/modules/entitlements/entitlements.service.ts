/**
 * ============================================================================
 *  ENTITLEMENTS — Servicio
 * ============================================================================
 * Fuente de verdad de la autorización de la plataforma. Toda decisión de acceso
 * se resuelve contra los entitlements del usuario, NUNCA contra `role`.
 *
 * Reutiliza la infraestructura existente (`users`, `tenants`, `store_info`) y añade
 * la tabla `user_entitlements`. La activación de negocio ocurre en UNA transacción
 * y todos los valores sensibles (tenant_id, owner_id, role, plan) se calculan en el
 * servidor: jamás se confía en el frontend.
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  ENTITLEMENTS, ENTITLEMENT_SOURCE, EntitlementKey, EntitlementSource,
  PLAN_ENTITLEMENTS, TENANT_PLAN_TO_PLAN_KEY, WORKSPACE_RULES, WorkspaceDef, MERCHANT_ENTITLEMENTS,
} from './entitlements.catalog';

/** Ejecutor SQL: acepta el pool compartido o una conexión de transacción. */
interface SqlExecutor {
  execute: (sql: string, values?: unknown[]) => Promise<unknown>;
}

interface EntitlementRow extends RowDataPacket {
  entitlement: string;
  tenant_id: string | null;
  source: string;
  status: string;
}

export interface UserEntitlements {
  entitlements: EntitlementKey[];
  workspaces: WorkspaceDef[];
}

function slugify(input: string): string {
  return (input || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'negocio';
}

export class EntitlementsService {
  /** Lista los entitlements ACTIVOS de un usuario (claves string). */
  async listActive(userId: string): Promise<EntitlementKey[]> {
    const [rows] = await db.execute<EntitlementRow[]>(
      "SELECT entitlement FROM user_entitlements WHERE user_id = ? AND status = 'active'",
      [userId]
    );
    return rows.map(r => r.entitlement as EntitlementKey);
  }

  /** ¿El usuario tiene ALGUNO de estos entitlements activos? */
  async hasAny(userId: string, keys: EntitlementKey[]): Promise<boolean> {
    if (keys.length === 0) return false;
    const placeholders = keys.map(() => '?').join(', ');
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT 1 FROM user_entitlements
        WHERE user_id = ? AND status = 'active' AND entitlement IN (${placeholders}) LIMIT 1`,
      [userId, ...keys]
    );
    return rows.length > 0;
  }

  /** Otorga (idempotente) un entitlement. Usa la conexión de transacción si se pasa. */
  async grant(
    userId: string,
    entitlement: EntitlementKey,
    opts: { tenantId?: string | null; source?: EntitlementSource; metadata?: unknown; exec?: SqlExecutor } = {}
  ): Promise<void> {
    const exec: SqlExecutor = opts.exec ?? (db as unknown as SqlExecutor);
    await exec.execute(
      `INSERT INTO user_entitlements (id, user_id, entitlement, tenant_id, source, status, metadata, granted_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, now())
       ON DUPLICATE KEY UPDATE
         status = 'active', tenant_id = VALUES(tenant_id), source = VALUES(source),
         metadata = VALUES(metadata), revoked_at = NULL, updated_at = now()`,
      [uuidv4(), userId, entitlement, opts.tenantId ?? null,
       opts.source ?? ENTITLEMENT_SOURCE.MANUAL,
       opts.metadata != null ? JSON.stringify(opts.metadata) : null]
    );
  }

  /** Revoca un entitlement (soft: status='revoked'). */
  async revoke(userId: string, entitlement: EntitlementKey): Promise<void> {
    await db.execute(
      "UPDATE user_entitlements SET status = 'revoked', revoked_at = now() WHERE user_id = ? AND entitlement = ?",
      [userId, entitlement]
    );
  }

  /** Otorga automáticamente el derecho base a todo usuario registrado. Backend-only. */
  async grantDefault(userId: string, exec?: SqlExecutor): Promise<void> {
    await this.grant(userId, ENTITLEMENTS.OS_LEGEND_FREE, { source: ENTITLEMENT_SOURCE.DEFAULT, exec });
  }

  /** Aplica el BUNDLE completo de un plan (regla obligatoria: p.ej. enterprise → OS Legend Pro). */
  async applyPlan(
    userId: string,
    planKey: keyof typeof PLAN_ENTITLEMENTS,
    opts: { tenantId?: string | null; source?: EntitlementSource; exec?: SqlExecutor } = {}
  ): Promise<void> {
    const bundle = PLAN_ENTITLEMENTS[planKey];
    if (!bundle) throw new AppError(`Plan de entitlements desconocido: ${planKey}`, 400);
    for (const key of bundle) {
      const isMerchant = MERCHANT_ENTITLEMENTS.includes(key);
      await this.grant(userId, key, {
        tenantId: isMerchant ? (opts.tenantId ?? null) : null,
        source: opts.source ?? ENTITLEMENT_SOURCE.PLAN,
        exec: opts.exec,
      });
    }
  }

  /** Sincroniza entitlements desde el plan legacy del tenant (`tenants.plan`). */
  async syncFromTenantPlan(userId: string, tenantPlan: string, tenantId: string, exec?: SqlExecutor): Promise<void> {
    const planKey = TENANT_PLAN_TO_PLAN_KEY[tenantPlan] ?? 'merchant_basic';
    await this.applyPlan(userId, planKey, { tenantId, source: ENTITLEMENT_SOURCE.PLAN, exec });
  }

  /** Deriva los workspaces disponibles a partir de los entitlements (data-driven). */
  deriveWorkspaces(keys: EntitlementKey[]): WorkspaceDef[] {
    const owned = new Set(keys);
    return WORKSPACE_RULES
      .filter(w => w.requiresAnyOf.some(req => owned.has(req)))
      .sort((a, b) => a.order - b.order);
  }

  /** Entitlements + workspaces resueltos para un usuario (para GET /me/*). */
  async resolveForUser(userId: string): Promise<UserEntitlements> {
    const entitlements = await this.listActive(userId);
    return { entitlements, workspaces: this.deriveWorkspaces(entitlements) };
  }

  /**
   * Activa un negocio SOBRE la cuenta actual (nunca crea otro usuario).
   * Transacción única. Todo valor sensible se calcula en el servidor.
   */
  async activateMerchant(
    userId: string,
    input: { businessName: string; businessType?: string }
  ): Promise<{ tenantId: string; slug: string } & UserEntitlements> {
    const businessName = (input.businessName || '').trim();
    if (businessName.length < 2) throw new AppError('El nombre del negocio es requerido', 400);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Cargar la cuenta actual (bloqueada) y validar que no sea ya comerciante.
      const [userRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id, name, email, tenant_id FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      if (userRows.length === 0) throw new AppError('Usuario no encontrado', 404);
      const user = userRows[0];
      if (user.tenant_id) throw new AppError('Esta cuenta ya tiene un negocio activo', 409);
      if (await this.hasAny(userId, MERCHANT_ENTITLEMENTS)) {
        throw new AppError('Esta cuenta ya tiene un negocio activo', 409);
      }

      // 2. Slug único calculado en servidor.
      let slug = slugify(businessName);
      for (let i = 0; i < 5; i++) {
        const [dup] = await connection.execute<RowDataPacket[]>('SELECT id FROM tenants WHERE slug = ? LIMIT 1', [slug]);
        if (dup.length === 0) break;
        slug = `${slugify(businessName)}-${uuidv4().slice(0, 4)}`;
      }

      // 3. Crear tenant (plan de arranque = 'basico' → Merchant Basic; upgrades por el flujo MP).
      const tenantId = uuidv4();
      const startingTenantPlan = 'basico';
      await connection.execute<ResultSetHeader>(
        `INSERT INTO tenants (id, name, slug, business_type, plan, max_users, max_products, status, owner_id)
         VALUES (?, ?, ?, ?, ?, 5, 500, 'activo', ?)`,
        [tenantId, businessName, slug, input.businessType || null, startingTenantPlan, userId]
      );

      // 4. Vincular la MISMA cuenta como comerciante (compat con el RBAC actual, backend-only).
      await connection.execute(
        "UPDATE users SET tenant_id = ?, role = 'comerciante' WHERE id = ?",
        [tenantId, userId]
      );

      // 5. store_info mínimo (el panel del comerciante lo espera).
      await connection.execute<ResultSetHeader>(
        `INSERT INTO store_info (tenant_id, name, address, phone, tax_id, email)
         VALUES (?, ?, '', '', '', ?)`,
        [tenantId, businessName, user.email]
      );

      // 6. Otorgar el bundle de entitlements del plan de arranque (dentro de la MISMA transacción).
      await this.syncFromTenantPlan(userId, startingTenantPlan, tenantId, connection as unknown as SqlExecutor);
      // Asegurar el derecho base de consumidor (no se pierde OS Legend al activar negocio).
      await this.grant(userId, ENTITLEMENTS.OS_LEGEND_FREE, {
        source: ENTITLEMENT_SOURCE.DEFAULT, exec: connection as unknown as SqlExecutor,
      });

      await connection.commit();

      const resolved = await this.resolveForUser(userId);
      return { tenantId, slug, ...resolved };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

export const entitlementsService = new EntitlementsService();
