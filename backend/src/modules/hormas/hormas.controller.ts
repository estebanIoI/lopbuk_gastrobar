import { Response, NextFunction } from 'express';
import { hormasService } from './hormas.service';
import { AuthRequest } from '../../common/middleware';

export class HormasController {

  // ── Hormas ────────────────────────────────────────────────────────────────

  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await hormasService.findAll(tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await hormasService.findById(req.params.id, tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await hormasService.create(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await hormasService.update(req.params.id, tenantId, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      await hormasService.softDelete(req.params.id, tenantId);
      res.json({ success: true, data: { message: 'Horma eliminada' } });
    } catch (err) { next(err); }
  }

  // ── Colores (paleta) ───────────────────────────────────────────────────────

  async getColors(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await hormasService.findColors(req.params.id, tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async addColor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await hormasService.addColor(req.params.id, tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateColor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      await hormasService.updateColor(req.params.colorId, tenantId, req.body);
      res.json({ success: true, data: { message: 'Color actualizado' } });
    } catch (err) { next(err); }
  }

  async removeColor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      await hormasService.removeColor(req.params.colorId, tenantId);
      res.json({ success: true, data: { message: 'Color eliminado de la paleta' } });
    } catch (err) { next(err); }
  }
}

export const hormasController = new HormasController();
