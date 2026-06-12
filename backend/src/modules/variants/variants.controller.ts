import { Request, Response, NextFunction } from 'express';
import { variantsService } from './variants.service';
import { importService, ImportService } from './import.service';
import { AuthRequest } from '../../common/middleware';

export class VariantsController {

  // ── Variants ──────────────────────────────────────────────────────────────

  async findByProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.findByProduct(req.params.productId, tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.findById(req.params.id, tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.create(req.params.productId, tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.update(req.params.id, tenantId, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      await variantsService.softDelete(req.params.id, tenantId);
      res.json({ success: true, data: { message: 'Variante eliminada' } });
    } catch (err) { next(err); }
  }

  async adjustStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const { quantity, type, reason } = req.body;
      const variant = await variantsService.findById(req.params.id, tenantId);
      const data = await variantsService.adjustStock({
        variantId: req.params.id,
        productId: variant.productId,
        tenantId, quantity, type, reason,
        createdBy: req.user!.id,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getMovements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.getMovements(req.params.id, tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Price Tiers ────────────────────────────────────────────────────────────

  async getTiers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.findTiersByVariant(req.params.id, tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async resolvePrice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const qty = Number(req.body.qty ?? req.query.qty ?? 1);
      const data = await variantsService.resolvePrice(req.params.id, qty, tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async createTier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.createTier(req.params.id, tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateTier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const data = await variantsService.updateTier(req.params.tierId, tenantId, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async deleteTier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      await variantsService.deleteTier(req.params.tierId, tenantId);
      res.json({ success: true, data: { message: 'Tier eliminado' } });
    } catch (err) { next(err); }
  }

  // ── CSV Import ─────────────────────────────────────────────────────────────

  async importCsv(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId!;
      const csvText: string = req.body.csv;
      if (!csvText) {
        return res.status(400).json({ success: false, error: 'Campo "csv" requerido' });
      }
      const rows = ImportService.parseCsv(csvText);
      const result = await importService.importFromCsv(tenantId, rows);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async importTemplate(_req: Request, res: Response) {
    const template = 'Handle,Product Name,Attribute: Color,Attribute: Size,Variant SKU,Variant Stock,Base Price,Cost Price,Supplier\n' +
      'body-siso-premium,Body Siso Premium,Negro,Única,SE-SISO-BLK,15,45000,30000,SE Sport\n' +
      'body-siso-premium,Body Siso Premium,Marfil,Única,SE-SISO-IVR,0,45000,30000,SE Sport\n';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_variantes.csv"');
    res.send(template);
  }
}

export const variantsController = new VariantsController();
