import { Response, NextFunction } from 'express';
import { suppliersService } from './suppliers.service';
import { AuthRequest } from '../../common/middleware';

export class SuppliersController {

  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.findAll(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.findById(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.create(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.update(req.params.id, req.user!.tenantId!, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await suppliersService.delete(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: { message: 'Proveedor eliminado' } });
    } catch (err) { next(err); }
  }

  async getProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.getProducts(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async linkProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.linkProduct(req.params.id, req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  async unlinkProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await suppliersService.unlinkProduct(req.params.id, req.params.productId, req.user!.tenantId!);
      res.json({ success: true, data: { message: 'Producto desvinculado' } });
    } catch (err) { next(err); }
  }
}

export const suppliersController = new SuppliersController();
