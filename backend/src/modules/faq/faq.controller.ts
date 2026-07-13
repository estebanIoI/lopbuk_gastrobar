import { Response, NextFunction } from 'express';
import { faqService } from './faq.service';
import { AuthRequest } from '../../common/middleware';

export class FaqController {
  async findAllCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const categories = await faqService.findAllCategories(tenantId);
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const category = await faqService.createCategory(tenantId, req.body);
      res.status(201).json({ success: true, data: category, message: 'Categoría creada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const category = await faqService.updateCategory(tenantId, req.params.id, req.body);
      res.json({ success: true, data: category, message: 'Categoría actualizada' });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await faqService.deleteCategory(tenantId, req.params.id);
      res.json({ success: true, message: 'Categoría eliminada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async findAllItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const categoryId = req.query.categoryId as string | undefined;
      const items = await faqService.findAllItems(tenantId, categoryId);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }

  async createItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const item = await faqService.createItem(tenantId, req.body);
      res.status(201).json({ success: true, data: item, message: 'Pregunta creada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const item = await faqService.updateItem(tenantId, req.params.id, req.body);
      res.json({ success: true, data: item, message: 'Pregunta actualizada' });
    } catch (error) {
      next(error);
    }
  }

  async deleteItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await faqService.deleteItem(tenantId, req.params.id);
      res.json({ success: true, message: 'Pregunta eliminada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async findPublic(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantSlug = (req.query.store || req.query.slug) as string;
      if (!tenantSlug) {
        res.status(400).json({ success: false, error: 'El parámetro store es requerido' });
        return;
      }
      const data = await faqService.findPublic(tenantSlug);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const faqController = new FaqController();
