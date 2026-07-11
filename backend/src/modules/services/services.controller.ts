import { Request, Response, NextFunction } from 'express';
import { servicesService } from './services.service';
import { AuthRequest } from '../../common/middleware';

export class ServicesController {
  // ── SERVICES CRUD ─────────────────────────────────────────────
  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.findAll(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.findById(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.create(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data, message: 'Servicio creado' });
    } catch (e) { next(e); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.update(req.params.id, req.user!.tenantId!, req.body);
      res.json({ success: true, data, message: 'Servicio actualizado' });
    } catch (e) { next(e); }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await servicesService.remove(req.params.id, req.user!.tenantId!);
      res.json({ success: true, message: 'Servicio eliminado' });
    } catch (e) { next(e); }
  }

  // ── AVAILABILITY ─────────────────────────────────────────────
  async getAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.getAvailability(req.params.id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async setAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.setAvailability(
        req.params.id, req.user!.tenantId!, req.body.slots
      );
      res.json({ success: true, data, message: 'Horarios actualizados' });
    } catch (e) { next(e); }
  }

  // ── BLOCKED PERIODS ──────────────────────────────────────────
  async getBlocked(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.getBlockedPeriods(
        req.user!.tenantId!, req.query.serviceId as string | undefined
      );
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async addBlocked(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.addBlockedPeriod(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data, message: 'Fecha bloqueada' });
    } catch (e) { next(e); }
  }

  async removeBlocked(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await servicesService.removeBlockedPeriod(req.params.id, req.user!.tenantId!);
      res.json({ success: true, message: 'Bloqueo eliminado' });
    } catch (e) { next(e); }
  }

  // ── SLOTS (public) ───────────────────────────────────────────
  async getSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { date, store } = req.query as { date: string; store: string };
      if (!date) { res.status(400).json({ success: false, error: 'date requerido' }); return; }

      // Resolve tenantId from store slug
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const tenantId = tenants[0].id;

      const slots = await servicesService.getAvailableSlots(id, tenantId, date);
      res.json({ success: true, data: slots });
    } catch (e) { next(e); }
  }

  // ── SLOTS con estado (public, Fase 1 UX) ─────────────────────
  async getSlotsDetailed(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { date, store } = req.query as { date: string; store: string };
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const data = await servicesService.getSlotsWithStatus(id, tenants[0].id, date);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  // ── Reserva temporal / hold (public, Fase 2 UX) ─────────────
  async createHold(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { store } = req.query as { store: string };
      const { date, startTime } = req.body as { date: string; startTime: string };
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const data = await servicesService.createHold(id, tenants[0].id, date, startTime);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async releaseHold(req: Request, res: Response, next: NextFunction) {
    try {
      const { holdToken } = req.body as { holdToken: string };
      if (holdToken) await servicesService.releaseHold(holdToken);
      res.json({ success: true, data: { released: true } });
    } catch (e) { next(e); }
  }

  // ── SPECIALISTS (Fase 5) ─────────────────────────────────────
  async findSpecialists(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.listSpecialists(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async createSpecialist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.createSpecialist(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data, message: 'Especialista creado' });
    } catch (e) { next(e); }
  }

  async updateSpecialist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.updateSpecialist(req.params.id, req.user!.tenantId!, req.body);
      res.json({ success: true, data, message: 'Especialista actualizado' });
    } catch (e) { next(e); }
  }

  async removeSpecialist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await servicesService.removeSpecialist(req.params.id, req.user!.tenantId!);
      res.json({ success: true, message: 'Especialista eliminado' });
    } catch (e) { next(e); }
  }

  // Público: especialistas que realizan un servicio (para el modal de reserva)
  async getServiceSpecialists(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { store } = req.query as { store: string };
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const data = await servicesService.getPublicSpecialists(id, tenants[0].id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  // ── Complementos / cross-sell (public, Fase 4 UX) ────────────
  async getAddons(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { store } = req.query as { store: string };
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const data = await servicesService.getPublicAddons(id, tenants[0].id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  // ── Disponibilidad por día del mes (public, Fase 1 UX) ───────
  async getMonthAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { year, month, store } = req.query as { year: string; month: string; store: string };
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const data = await servicesService.getMonthAvailability(id, tenants[0].id, Number(year), Number(month));
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  // ── PUBLIC services ──────────────────────────────────────────
  async findPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const store = req.query.store as string;
      if (!store) { res.status(400).json({ success: false, error: 'store requerido' }); return; }
      const result = await servicesService.findPublicBySlug(store);
      res.json({ success: true, data: result.services });
    } catch (e) { next(e); }
  }

  // ── BOOKINGS (merchant) ───────────────────────────────────────
  async findBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await servicesService.findBookings(req.user!.tenantId!, {
        serviceId: req.query.serviceId as string,
        status: req.query.status as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  }

  // ── CREATE BOOKING (public) ───────────────────────────────────
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const store = req.query.store as string;
      if (!store) { res.status(400).json({ success: false, error: 'store requerido' }); return; }
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const tenantId = tenants[0].id;
      const booking = await servicesService.createBooking(tenantId, req.body);
      res.status(201).json({ success: true, data: booking, message: 'Reserva recibida. Te contactaremos para confirmar.' });
    } catch (e) { next(e); }
  }

  async updateBookingStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.updateBookingStatus(
        req.params.id, req.user!.tenantId!, req.body
      );
      res.json({ success: true, data, message: 'Reserva actualizada' });
    } catch (e) { next(e); }
  }

  // ── Reprogramar (Fase 6) ──────────────────────────────────────
  async rescheduleBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.rescheduleBooking(
        req.params.id, req.user!.tenantId!,
        { bookingDate: req.body.bookingDate, startTime: req.body.startTime }
      );
      res.json({ success: true, data, message: 'Cita reprogramada' });
    } catch (e) { next(e); }
  }

  // ── Métricas de reservas (Fase 6) ─────────────────────────────
  async getBookingStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await servicesService.getBookingStats(req.user!.tenantId!, days);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  // ── Lista de espera (Fase 6) ──────────────────────────────────
  async joinWaitlist(req: Request, res: Response, next: NextFunction) {
    try {
      const store = req.query.store as string;
      if (!store) { res.status(400).json({ success: false, error: 'store requerido' }); return; }
      const pool = (await import('../../config')).db;
      const [tenants] = await pool.execute<any[]>(
        "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]
      );
      if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
      const data = await servicesService.joinWaitlist(tenants[0].id, req.body);
      res.status(201).json({ success: true, data, message: 'Te avisaremos cuando se libere un cupo.' });
    } catch (e) { next(e); }
  }

  async findWaitlist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.listWaitlist(req.user!.tenantId!, {
        status: req.query.status as string, serviceId: req.query.serviceId as string,
      });
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async updateWaitlist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await servicesService.updateWaitlistStatus(req.params.id, req.user!.tenantId!, req.body.status);
      res.json({ success: true, data, message: 'Lista de espera actualizada' });
    } catch (e) { next(e); }
  }
}

export const servicesController = new ServicesController();
