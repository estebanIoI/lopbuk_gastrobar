import { Response, NextFunction, Request } from 'express';
import { newsletterService } from './newsletter.service';
import { AuthRequest } from '../../common/middleware';
import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

export class NewsletterController {
  async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, acceptedTerms, store } = req.body;

      if (!email || acceptedTerms === undefined) {
        res.status(400).json({ success: false, error: 'Email y acceptedTerms son requeridos' });
        return;
      }

      // Se exige la tienda: suscribir a un tenant "al azar" (el más antiguo) contaminaba la
      // lista de un comercio con correos de otro. La suscripción es siempre por tienda.
      if (!store) {
        res.status(400).json({ success: false, error: 'El parámetro store es requerido' });
        return;
      }
      const [tenants] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
        [store]
      );
      if (tenants.length === 0) {
        res.status(404).json({ success: false, error: 'Tienda no encontrada' });
        return;
      }
      const tenantId = tenants[0].id as string;

      const subscriber = await newsletterService.subscribe(tenantId, email, acceptedTerms);
      res.status(201).json({ success: true, data: subscriber, message: 'Suscripción exitosa' });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await newsletterService.findAll(tenantId, page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const subscribers = await newsletterService.exportCSV(tenantId);
      res.json({ success: true, data: subscribers });
    } catch (error) {
      next(error);
    }
  }
}

export const newsletterController = new NewsletterController();
