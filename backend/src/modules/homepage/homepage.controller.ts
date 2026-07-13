import { Response, NextFunction, Request } from 'express';
import { homepageService } from './homepage.service';
import { AuthRequest } from '../../common/middleware';

export class HomepageController {
  async getConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const config = await homepageService.getConfig(tenantId);
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async saveConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const { sections } = req.body;

      if (!sections || !Array.isArray(sections)) {
        res.status(400).json({ success: false, error: 'El campo sections es requerido y debe ser un array' });
        return;
      }

      const config = await homepageService.saveConfig(tenantId, sections);
      res.json({ success: true, data: config, message: 'Configuración guardada exitosamente' });
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
      const sections = await homepageService.findPublic(store);
      res.json({ success: true, data: sections });
    } catch (error) {
      next(error);
    }
  }

  async findPlatformPublic(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sections = await homepageService.findPlatformPublic();
      res.json({ success: true, data: sections });
    } catch (error) {
      next(error);
    }
  }
}

export const homepageController = new HomepageController();
