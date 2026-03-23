import { Response, NextFunction } from 'express';
import { restbarService } from './restbar.service';
import { AuthRequest } from '../../common/middleware';

export class RestbarController {

  // ── TABLES ────────────────────────────────────────────────────────────────

  async getTables(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getTables(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async createTable(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.createTable(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data, message: 'Mesa creada exitosamente' });
    } catch (err) { next(err); }
  }

  async updateTable(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.updateTable(req.user!.tenantId!, req.params.id, req.body);
      res.json({ success: true, data, message: 'Mesa actualizada' });
    } catch (err) { next(err); }
  }

  async updateTableStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.updateTableStatus(req.user!.tenantId!, req.params.id, req.body.status);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async deleteTable(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await restbarService.deleteTable(req.user!.tenantId!, req.params.id);
      res.json({ success: true, message: 'Mesa eliminada' });
    } catch (err) { next(err); }
  }

  // ── MENU ──────────────────────────────────────────────────────────────────

  async getMenu(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getMenu(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async toggleAvailability(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.toggleMenuAvailability(req.user!.tenantId!, req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getMenuCatalog(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getMenuCatalog(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateMenuSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.updateMenuSettings(req.user!.tenantId!, req.params.id, req.body);
      res.json({ success: true, data, message: 'Configuración de menú actualizada' });
    } catch (err) { next(err); }
  }

  async getMenuItemYield(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getMenuItemYield(req.user!.tenantId!, req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── ORDERS ────────────────────────────────────────────────────────────────

  async getOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const data = await restbarService.getOrders(req.user!.tenantId!, status);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getOrderById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getOrderById(req.user!.tenantId!, req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await restbarService.createOrder(
        user.tenantId!, user.userId, user.name ?? user.email, req.body
      );
      res.status(201).json({ success: true, data, message: 'Comanda abierta' });
    } catch (err) { next(err); }
  }

  async addItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.addItem(req.user!.tenantId!, req.params.id, req.body);
      res.json({ success: true, data, message: 'Ítem agregado' });
    } catch (err) { next(err); }
  }

  async updateItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.updateItem(
        req.user!.tenantId!, req.params.id, req.params.itemId, req.body
      );
      res.json({ success: true, data, message: 'Ítem actualizado' });
    } catch (err) { next(err); }
  }

  async removeItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.removeItem(
        req.user!.tenantId!, req.params.id, req.params.itemId
      );
      res.json({ success: true, data, message: 'Ítem eliminado' });
    } catch (err) { next(err); }
  }

  async sendToKitchen(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.sendToKitchen(req.user!.tenantId!, req.params.id);
      res.json({ success: true, data, message: 'Pedido enviado a cocina/bar' });
    } catch (err) { next(err); }
  }

  // ── KITCHEN / BAR DISPLAY ─────────────────────────────────────────────────

  async getKitchenDisplay(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getAreaDisplay(req.user!.tenantId!, 'cocina');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getBarDisplay(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getAreaDisplay(req.user!.tenantId!, 'bar');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateItemStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.updateItemStatus(
        req.user!.tenantId!, req.params.itemId, req.body.status
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── PAYMENT ───────────────────────────────────────────────────────────────

  async updateOrderNotes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.updateOrderNotes(req.user!.tenantId!, req.params.id, req.body.notes ?? null);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getGuestBreakdown(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await restbarService.getGuestBreakdown(req.user!.tenantId!, req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async processPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await restbarService.processPayment(
        user.tenantId!, req.params.id, user.userId, user.name ?? user.email, req.body
      );
      res.json({ success: true, data, message: 'Pago procesado exitosamente' });
    } catch (err) { next(err); }
  }

  // ── REPORTS ───────────────────────────────────────────────────────────────

  async getDailySummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date as string | undefined;
      const data = await restbarService.getDailySummary(req.user!.tenantId!, date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const restbarController = new RestbarController();
