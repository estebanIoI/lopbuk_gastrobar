import { Response, NextFunction } from 'express';
import { tenantsService } from './tenants.service';
import { AuthRequest } from '../../common/middleware';

export class TenantsController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await tenantsService.findAll(page, limit, search);

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
      const tenant = await tenantsService.findById(req.params.id);

      res.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenant = await tenantsService.create(req.body);

      res.status(201).json({
        success: true,
        data: tenant,
        message: 'Tenant creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenant = await tenantsService.update(req.params.id, req.body);

      res.json({
        success: true,
        data: tenant,
        message: 'Tenant actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenant = await tenantsService.toggleStatus(req.params.id);

      res.json({
        success: true,
        data: tenant,
        message: `Tenant ${tenant.status === 'activo' ? 'activado' : 'suspendido'} exitosamente`,
      });
    } catch (error) {
      next(error);
    }
  }

  async resetSalesData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const counts = await tenantsService.resetSalesData(req.params.id);
      const total = counts.sales;
      res.json({
        success: true,
        data: counts,
        message: `Ventas reiniciadas: ${total} venta(s) eliminada(s). El comercio puede empezar de cero.`,
      });
    } catch (error) {
      next(error);
    }
  }

  async activateTrial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = Number(req.body?.days) || 7;
      const tenant = await tenantsService.activateTrial(req.params.id, days);
      res.json({
        success: true,
        data: tenant,
        message: `Período de prueba de ${days} días activado con plan empresarial`,
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivateTrial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const revertPlan = (req.body?.revertPlan as string) || 'basico';
      const tenant = await tenantsService.deactivateTrial(req.params.id, revertPlan);
      res.json({
        success: true,
        data: tenant,
        message: 'Período de prueba desactivado',
      });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await tenantsService.destroy(req.params.id);
      res.json({
        success: true,
        data: result,
        message: `Comercio "${result.name}" eliminado definitivamente`,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await tenantsService.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPlatformSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await tenantsService.getPlatformSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updatePlatformSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, value } = req.body;
      await tenantsService.updatePlatformSetting(key, value);
      res.json({ success: true, message: 'Configuración actualizada' });
    } catch (error) {
      next(error);
    }
  }

  async getBusinessTypes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = await tenantsService.getBusinessTypes();
      res.json({ success: true, data: types });
    } catch (error) {
      next(error);
    }
  }

  async createBusinessType(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = await tenantsService.createBusinessType(req.body.name);
      res.json({ success: true, data: types, message: 'Categoría creada' });
    } catch (error) {
      next(error);
    }
  }

  async deleteBusinessType(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = await tenantsService.deleteBusinessType(req.params.name);
      res.json({ success: true, data: types, message: 'Categoría eliminada' });
    } catch (error) {
      next(error);
    }
  }

  async getModules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await tenantsService.getModules(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateModules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await tenantsService.updateModules(req.params.id, req.body.modules);
      res.json({ success: true, data, message: 'Módulos actualizados' });
    } catch (error) {
      next(error);
    }
  }

  async getMarketplaceCards(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await tenantsService.getMarketplaceCards();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateMarketplaceCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await tenantsService.updateMarketplaceCard(req.params.id, req.body);
      res.json({ success: true, message: 'Tarjeta actualizada' });
    } catch (error) {
      next(error);
    }
  }
}

export const tenantsController = new TenantsController();
