import { Response, NextFunction, Request } from 'express';
import { trustBadgesService } from './trust-badges.service';
import { AuthRequest } from '../../common/middleware';

export class TrustBadgesController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const badges = await trustBadgesService.findAll(tenantId);
      res.json({ success: true, data: badges });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const badge = await trustBadgesService.create(tenantId, req.body);
      res.status(201).json({ success: true, data: badge, message: 'Insignia creada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const badge = await trustBadgesService.update(tenantId, req.params.id, req.body);
      res.json({ success: true, data: badge, message: 'Insignia actualizada' });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await trustBadgesService.delete(tenantId, req.params.id);
      res.json({ success: true, message: 'Insignia eliminada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async findPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const store = (req.query.store as string) || '';
      if (!store) {
        res.json({ success: true, data: [] });
        return;
      }
      const badges = await trustBadgesService.findPublic(store);
      res.json({ success: true, data: badges });
    } catch (error) {
      next(error);
    }
  }
}

export const trustBadgesController = new TrustBadgesController();
