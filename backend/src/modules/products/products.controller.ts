import { Response, NextFunction } from 'express';
import { productsService, ProductFilters } from './products.service';
import { productImageAnalyzerService } from './product-image-analyzer.service';
import { Category, StockStatus, ProductType } from '../../common/types';
import { AppError, AuthRequest } from '../../common/middleware';
import { db } from '../../config';

export class ProductsController {
  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: ProductFilters = {};

      if (req.query.category) {
        filters.category = req.query.category as Category;
      }

      if (req.query.productType) {
        filters.productType = req.query.productType as ProductType;
      }

      if (req.query.stockStatus) {
        filters.stockStatus = req.query.stockStatus as StockStatus;
      }

      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      if (req.query.minPrice) {
        filters.minPrice = parseFloat(req.query.minPrice as string);
      }

      if (req.query.maxPrice) {
        filters.maxPrice = parseFloat(req.query.maxPrice as string);
      }

      if (req.query.sedeId) {
        filters.sedeId = req.query.sedeId as string;
      }

      const result = await productsService.findAll(tenantId, page, limit, filters);

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
      const tenantId = req.user!.tenantId!;
      const product = await productsService.findById(req.params.id, tenantId);

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async findBySku(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const product = await productsService.findBySku(req.params.sku, tenantId);

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async findByBarcode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const product = await productsService.findByBarcode(req.params.barcode, tenantId);

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const product = await productsService.create(tenantId, req.body);

      res.status(201).json({
        success: true,
        data: product,
        message: 'Producto creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const product = await productsService.update(req.params.id, req.body, tenantId);

      res.json({
        success: true,
        data: product,
        message: 'Producto actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      await productsService.delete(req.params.id, tenantId);

      res.json({
        success: true,
        message: 'Producto eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const { ids } = req.body;
      const result = await productsService.bulkDelete(ids, tenantId);
      res.json({
        success: true,
        data: result,
        message: `${result.deleted} producto(s) eliminado(s)${result.skipped ? ` · ${result.skipped} omitido(s) (tienen ventas asociadas)` : ''}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkCreate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const { products } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Se requiere un array de productos no vacío',
        });
        return;
      }

      if (products.length > 500) {
        res.status(400).json({
          success: false,
          error: 'El máximo de productos por lote es 500',
        });
        return;
      }

      const result = await productsService.bulkCreate(tenantId, products);

      res.status(result.totalFailed > 0 ? 207 : 201).json({
        success: true,
        data: result,
        message: `${result.totalCreated} productos creados, ${result.totalFailed} fallaron`,
      });
    } catch (error) {
      next(error);
    }
  }

  async getImageUrls(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const [rows] = await (db as any).execute(
        `SELECT id, name, image_url AS imageUrl
         FROM products
         WHERE tenant_id = ? AND image_url IS NOT NULL AND image_url != ''
         ORDER BY created_at DESC`,
        [tenantId]
      );
      res.json({ success: true, data: rows });
    } catch (error) { next(error); }
  }

  // POST /api/products/analyze-image — Detecta producto + variantes + precios desde una foto con IA
  async analyzeImage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };
      if (!imageBase64) throw new AppError('Falta la imagen del producto', 400);

      // Acepta data URLs (data:image/jpeg;base64,....)
      const match = /^data:(.+?);base64,(.*)$/.exec(imageBase64);
      if (match) {
        mimeType = mimeType || match[1];
        imageBase64 = match[2];
      }
      mimeType = mimeType || 'image/jpeg';

      const result = await productImageAnalyzerService.analyze(
        req.user!.tenantId!,
        imageBase64,
        mimeType
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async bulkCreateWithVariants(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Se requiere un array de items no vacío' });
        return;
      }
      if (items.length > 100) {
        res.status(400).json({ success: false, error: 'Máximo 100 productos por llamada' });
        return;
      }
      const result = await productsService.bulkCreateWithVariants(tenantId, items);
      res.status(result.totalFailed > 0 ? 207 : 201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getLowStock(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const products = await productsService.getLowStock(tenantId);

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOutOfStock(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const products = await productsService.getOutOfStock(tenantId);

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;

      const filters: ProductFilters = {};
      if (req.query.category) filters.category = req.query.category as Category;
      if (req.query.productType) filters.productType = req.query.productType as ProductType;
      if (req.query.stockStatus) filters.stockStatus = req.query.stockStatus as StockStatus;
      if (req.query.search) filters.search = req.query.search as string;

      const csv = await productsService.exportCsv(tenantId, filters);

      const date = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inventario_${date}.csv"`);
      res.send('\uFEFF' + csv); // BOM para que Excel abra con tildes correctas
    } catch (error) {
      next(error);
    }
  }

  async updatePreorder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const {
        isPreorder,
        preorderWindowEnd = null,
        preorderShipStart = null,
        preorderShipEnd = null,
        preorderBadgeText = 'Pre-orden',
        preorderPolicyText = null,
      } = req.body;

      const product = await productsService.updatePreorder(req.params.id, tenantId, {
        isPreorder,
        preorderWindowEnd,
        preorderShipStart,
        preorderShipEnd,
        preorderBadgeText,
        preorderPolicyText,
      });

      res.json({
        success: true,
        data: product,
        message: isPreorder ? 'Pre-orden activada' : 'Pre-orden desactivada',
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdatePreorder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const {
        productIds,          // string[] | undefined — si vacío/ausente → todos
        isPreorder,
        preorderWindowEnd = null,
        preorderShipStart = null,
        preorderShipEnd = null,
        preorderBadgeText = 'Pre-orden',
        preorderPolicyText = null,
      } = req.body;

      const updated = await productsService.bulkUpdatePreorder(tenantId, {
        productIds: productIds?.length ? productIds : null,
        isPreorder,
        preorderWindowEnd,
        preorderShipStart,
        preorderShipEnd,
        preorderBadgeText,
        preorderPolicyText,
      });

      res.json({
        success: true,
        data: { updatedCount: updated },
        message: `Pre-orden ${isPreorder ? 'activada' : 'desactivada'} en ${updated} producto(s)`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const productsController = new ProductsController();
