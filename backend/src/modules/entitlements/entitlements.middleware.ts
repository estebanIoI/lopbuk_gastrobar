/**
 * ============================================================================
 *  ENTITLEMENTS — Middleware de autorización
 * ============================================================================
 * Autoriza por ENTITLEMENT (consultado en backend), nunca por `role` del JWT.
 * El JWT solo identifica al usuario; los permisos mutables se leen de la BD.
 *
 * Uso:
 *   router.get('/panel', authenticate, requireEntitlement(ENTITLEMENTS.MERCHANT_BASIC,
 *              ENTITLEMENTS.MERCHANT_PRO, ENTITLEMENTS.MERCHANT_ENTERPRISE), handler)
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware';
import { entitlementsService } from './entitlements.service';
import { EntitlementKey } from './entitlements.catalog';
import { audit } from '../../utils/audit-logger';

/** Exige que el usuario tenga AL MENOS UNO de los entitlements indicados. */
export const requireEntitlement = (...required: EntitlementKey[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }
      const ok = await entitlementsService.hasAny(req.user.userId, required);
      if (!ok) {
        audit.unauthorizedAccess(req.path, req.ip, req.user.userId);
        res.status(403).json({
          success: false,
          error: 'No tienes acceso a esta funcionalidad',
          code: 'ENTITLEMENT_REQUIRED',
        });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
