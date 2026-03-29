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

  async activateTrial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenant = await tenantsService.activateTrial(req.params.id);
      res.json({
        success: true,
        data: tenant,
        message: 'Período de prueba de 7 días activado con plan empresarial',
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
}

export const tenantsController = new TenantsController();
