import { Response, NextFunction } from 'express';
import { customersService } from './customers.service';
import { AuthRequest } from '../../common/middleware';

export class CustomersController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await customersService.findAll(tenantId, page, limit, search);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const query = req.query.q as string || '';

      if (!query || query.length < 2) {
        res.json({
          success: true,
          data: [],
        });
        return;
      }

      const customers = await customersService.search(tenantId, query);

      res.json({
        success: true,
        data: customers,
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const customer = await customersService.findById(tenantId, req.params.id);

      res.json({
        success: true,
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const customer = await customersService.create(tenantId, req.body);

      res.status(201).json({
        success: true,
        data: customer,
        message: 'Cliente creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const customer = await customersService.update(tenantId, req.params.id, req.body);

      res.json({
        success: true,
        data: customer,
        message: 'Cliente actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await customersService.delete(tenantId, req.params.id);

      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const balance = await customersService.getBalance(tenantId, req.params.id);

      res.json({
        success: true,
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customersController = new CustomersController();
