import { Response, NextFunction } from 'express';
import { purchasesService, CreatePurchaseData } from './purchases.service';
import { invoiceOcrService } from './invoice-ocr.service';
import { AppError, AuthRequest } from '../../common/middleware';

export class PurchasesController {
  async ocrInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };
      if (!imageBase64) throw new AppError('Falta la imagen de la factura', 400);

      // Acepta data URLs (data:image/jpeg;base64,....)
      const match = /^data:(.+?);base64,(.*)$/.exec(imageBase64);
      if (match) {
        mimeType = mimeType || match[1];
        imageBase64 = match[2];
      }
      mimeType = mimeType || 'image/jpeg';

      const result = await invoiceOcrService.extractAndMatch(
        req.user!.tenantId!,
        imageBase64,
        mimeType
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await purchasesService.findAll(req.user!.tenantId!, page, limit);

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await purchasesService.findById(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreatePurchaseData = req.body;
      const invoice = await purchasesService.create(
        req.user!.tenantId!,
        req.user!.userId,
        data
      );

      res.status(201).json({
        success: true,
        data: invoice,
        message: 'Factura de compra registrada y stock actualizado',
      });
    } catch (error) {
      next(error);
    }
  }

  async getSuppliers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const suppliers = await purchasesService.getSuppliers(req.user!.tenantId!);
      res.json({ success: true, data: suppliers });
    } catch (error) {
      next(error);
    }
  }

  async createSupplier(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplier = await purchasesService.createSupplier(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: supplier, message: 'Proveedor creado exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async getNextInvoiceNumber(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const number = await purchasesService.getNextInvoiceNumber(req.user!.tenantId!);
      res.json({ success: true, data: number });
    } catch (error) {
      next(error);
    }
  }

  async getSupplierStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await purchasesService.getSupplierStats(req.user!.tenantId!, req.params.supplierId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const purchasesController = new PurchasesController();
