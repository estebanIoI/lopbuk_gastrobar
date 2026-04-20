import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware';
import { vendedoresService } from './vendedores.service';

export class VendedoresController {
  async getSellers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await vendedoresService.getSellers(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async updateSellerConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await vendedoresService.updateSellerConfig(
        req.user!.tenantId!,
        req.params.sellerId,
        {
          commissionType: req.body.commissionType,
          commissionValue: Number(req.body.commissionValue),
          salaryBase: Number(req.body.salaryBase),
          monthlyGoal: Number(req.body.monthlyGoal),
          goalBonus: Number(req.body.goalBonus),
        }
      );
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async getPerformance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const data = await vendedoresService.getPerformance(req.user!.tenantId!, from, to);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async getAdjustments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to, sellerId } = req.query as { from?: string; to?: string; sellerId?: string };
      if (!from || !to) { res.status(400).json({ success: false, error: 'from y to son requeridos' }); return; }
      const data = await vendedoresService.getAdjustments(req.user!.tenantId!, from, to, sellerId);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async addAdjustment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await vendedoresService.addAdjustment(req.user!.tenantId!, {
        ...req.body,
        createdBy: req.user!.userId,
      });
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  }

  async deleteAdjustment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await vendedoresService.deleteAdjustment(req.user!.tenantId!, req.params.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  }

  async generatePayroll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await vendedoresService.generatePayroll(req.user!.tenantId!, {
        ...req.body,
        generatedBy: req.user!.userId,
      });
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  }

  async getPayrollHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await vendedoresService.getPayrollHistory(req.user!.tenantId!, page, limit);
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  }

  async markPayrollPaid(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await vendedoresService.markPayrollPaid(req.user!.tenantId!, req.body.ids);
      res.json({ success: true });
    } catch (e) { next(e); }
  }

  async deletePayrollRecord(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await vendedoresService.deletePayrollRecord(req.user!.tenantId!, req.params.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  }
}

export const vendedoresController = new VendedoresController();
