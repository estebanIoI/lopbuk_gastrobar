import { Response, NextFunction, Request } from 'express';
import { contentPagesService } from './content-pages.service';
import { AuthRequest } from '../../common/middleware';

export class ContentPagesController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const pages = await contentPagesService.findAll(tenantId);
      res.json({ success: true, data: pages });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = await contentPagesService.findById(tenantId, parseInt(req.params.id));
      res.json({ success: true, data: page });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = await contentPagesService.create(tenantId, req.body);
      res.status(201).json({ success: true, data: page, message: 'Página creada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = await contentPagesService.update(tenantId, parseInt(req.params.id), req.body);
      res.json({ success: true, data: page, message: 'Página actualizada' });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await contentPagesService.delete(tenantId, parseInt(req.params.id));
      res.json({ success: true, message: 'Página eliminada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async findPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const store = (req.query.store as string) || '';
      const slug = req.params.slug;
      if (!store || !slug) {
        res.status(400).json({ success: false, error: 'Parámetros store y slug requeridos' });
        return;
      }
      const page = await contentPagesService.findPublicBySlug(store, slug);
      res.json({ success: true, data: page });
    } catch (error) {
      next(error);
    }
  }
}

export const contentPagesController = new ContentPagesController();
