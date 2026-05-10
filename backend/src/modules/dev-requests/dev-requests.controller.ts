import { Request, Response, NextFunction } from 'express';
import { devRequestsService, DevRequestStatus, DevRequestType } from './dev-requests.service';
import { AppError } from '../../common/middleware';

// ── Comerciante ───────────────────────────────────────────────────────────────

export async function getMyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).user.tenantId;
    const { status, type } = req.query as { status?: DevRequestStatus; type?: DevRequestType };
    const data = await devRequestsService.findByTenant(tenantId, { status, type });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user.tenantId) throw new AppError('Solo los comerciantes pueden crear solicitudes', 403);
    const { title, description, type, priority } = req.body;
    const data = await devRequestsService.create(user.tenantId, user.id, {
      title, description, type, priority,
      requesterName: user.name || user.email,
      tenantName: user.tenantName || null,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteMyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).user.tenantId;
    await devRequestsService.deleteByTenant(tenantId, req.params.id);
    res.json({ success: true, message: 'Solicitud eliminada' });
  } catch (err) { next(err); }
}

export async function confirmQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).user.tenantId;
    await devRequestsService.confirmQuoteByTenant(tenantId, req.params.id);
    res.json({ success: true, message: 'Cotización confirmada' });
  } catch (err) { next(err); }
}

// ── Superadmin ────────────────────────────────────────────────────────────────

export async function getAllRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, type, tenantId } = req.query as { status?: DevRequestStatus; type?: DevRequestType; tenantId?: string };
    const data = await devRequestsService.findAll({ status, type, tenantId });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function quoteRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { estimatedHours, pricePerHour, adminNotes } = req.body;
    const data = await devRequestsService.quote(req.params.id, { estimatedHours, pricePerHour, adminNotes });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateRequestStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, adminNotes, rejectionReason } = req.body;
    const data = await devRequestsService.updateStatus(req.params.id, status, { adminNotes, rejectionReason });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getDevSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await devRequestsService.getSettings();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateDevSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { hourlyRate, whatsapp } = req.body;
    const data = await devRequestsService.saveSettings({
      hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : undefined,
      whatsapp,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).user.tenantId;
    const backUrl = req.body.backUrl || req.headers.origin as string || 'http://localhost:3000';
    const data = await devRequestsService.createCheckout(tenantId, req.params.id, backUrl);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
