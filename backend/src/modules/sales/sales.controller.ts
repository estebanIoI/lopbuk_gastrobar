import { Response, NextFunction } from 'express';
import { salesService, SaleFilters, DailyReportData } from './sales.service';
import { AuthRequest } from '../../common/middleware';
import { PaymentMethod, SaleStatus } from '../../common/types';

export class SalesController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: SaleFilters = {};

      if (req.query.status) {
        filters.status = req.query.status as SaleStatus;
      }

      if (req.query.paymentMethod) {
        filters.paymentMethod = req.query.paymentMethod as PaymentMethod;
      }

      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }

      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      // Vendedor: solo puede ver sus propias ventas del día de hoy
      if (req.user!.role === 'vendedor') {
        filters.sellerId = req.user!.userId;
        filters.todayOnly = true;
      }

      const result = await salesService.findAll(req.user!.tenantId!, page, limit, filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sale = await salesService.findById(req.params.id);

      res.json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  }

  async findByInvoiceNumber(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sale = await salesService.findByInvoiceNumber(req.params.invoiceNumber);

      res.json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const saleData = {
        ...req.body,
        sellerId: req.user!.userId,
        sellerName: req.user!.name || req.body.sellerName || 'Empleado',
      };

      const sale = await salesService.create(req.user!.tenantId!, saleData);

      res.status(201).json({
        success: true,
        data: sale,
        message: 'Venta registrada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sale = await salesService.cancel(req.params.id, req.user!.userId, req.user!.tenantId!);

      res.json({
        success: true,
        data: sale,
        message: 'Venta anulada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentSales(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const sales = await salesService.getRecentSales(req.user!.tenantId!, limit);

      res.json({
        success: true,
        data: sales,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVendedoresPerformance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to, sellerId } = req.query as { from?: string; to?: string; sellerId?: string };
      const data = await salesService.getVendedoresPerformance(
        req.user!.tenantId!,
        from,
        to,
        sellerId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getVendedorSales(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sellerId } = req.params;
      const { from, to } = req.query as { from?: string; to?: string };
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await salesService.getVendedorSales(
        req.user!.tenantId!,
        sellerId,
        from,
        to,
        page,
        limit
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await salesService.getStats(req.user!.tenantId!);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getDailyReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const report: DailyReportData = await salesService.getDailyReport(tenantId, date);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
}

export const salesController = new SalesController();
