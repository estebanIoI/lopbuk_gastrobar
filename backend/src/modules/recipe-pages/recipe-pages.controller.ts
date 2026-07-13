import { Request, Response, NextFunction } from 'express';
import { recipePagesService } from './recipe-pages.service';
import { AuthRequest } from '../../common/middleware';

export class RecipePagesController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const pages = await recipePagesService.findAll(tenantId);
      res.json({ success: true, data: pages });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = await recipePagesService.findById(tenantId, req.params.id);
      res.json({ success: true, data: page });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = await recipePagesService.create(tenantId, req.body);
      res.status(201).json({ success: true, data: page, message: 'Página de receta creada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = await recipePagesService.update(tenantId, req.params.id, req.body);
      res.json({ success: true, data: page, message: 'Página de receta actualizada' });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await recipePagesService.delete(tenantId, req.params.id);
      res.json({ success: true, message: 'Página de receta eliminada exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async findPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const store = (req.query.store as string) || '';
      if (!store) {
        res.status(400).json({ success: false, error: 'El parámetro store es requerido' });
        return;
      }
      const data = await recipePagesService.findPublic(store);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const recipePagesController = new RecipePagesController();
