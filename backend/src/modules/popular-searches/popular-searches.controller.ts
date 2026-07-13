import { Response, NextFunction, Request } from 'express';
import { popularSearchesService } from './popular-searches.service';
import { AuthRequest } from '../../common/middleware';

export class PopularSearchesController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const items = await popularSearchesService.findAll(tenantId);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const item = await popularSearchesService.create(tenantId, req.body);
      res.status(201).json({ success: true, data: item, message: 'Búsqueda creada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const item = await popularSearchesService.update(tenantId, parseInt(req.params.id), req.body);
      res.json({ success: true, data: item, message: 'Búsqueda actualizada' });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await popularSearchesService.delete(tenantId, parseInt(req.params.id));
      res.json({ success: true, message: 'Búsqueda eliminada exitosamente' });
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
      const items = await popularSearchesService.findPublic(store);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
}

export const popularSearchesController = new PopularSearchesController();
