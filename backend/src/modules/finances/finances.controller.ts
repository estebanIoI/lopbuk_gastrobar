import { Response, NextFunction } from 'express';
import { financesService } from './finances.service';
import { AuthRequest } from '../../common/middleware';

export class FinancesController {

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  async getCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.query.type as string | undefined;
      const data = await financesService.getCategories(req.user!.tenantId!, type);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await financesService.createCategory(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data, message: 'Categoría creada' });
    } catch (err) { next(err); }
  }

  async updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await financesService.updateCategory(req.user!.tenantId!, req.params.id, req.body);
      res.json({ success: true, data, message: 'Categoría actualizada' });
    } catch (err) { next(err); }
  }

  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await financesService.deleteCategory(req.user!.tenantId!, req.params.id);
      res.json({ success: true, message: 'Categoría eliminada' });
    } catch (err) { next(err); }
  }

  async seedCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await financesService.seedDefaultCategories(req.user!.tenantId!);
      res.json({ success: true, message: 'Categorías por defecto inicializadas' });
    } catch (err) { next(err); }
  }

  // ── TRANSACTIONS ──────────────────────────────────────────────────────────

  async getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, categoryId, from, to, sourceType, page, limit } = req.query;
      const result = await financesService.getTransactions(req.user!.tenantId!, {
        type:       type       as string,
        categoryId: categoryId as string,
        from:       from       as string,
        to:         to         as string,
        sourceType: sourceType as string,
        page:  page  ? Number(page)  : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  async createTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await financesService.createTransaction(
        user.tenantId!, user.userId, user.name ?? user.email, req.body
      );
      res.status(201).json({ success: true, data, message: 'Transacción registrada' });
    } catch (err) { next(err); }
  }

  async updateTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await financesService.updateTransaction(req.user!.tenantId!, req.params.id, req.body);
      res.json({ success: true, data, message: 'Transacción actualizada' });
    } catch (err) { next(err); }
  }

  async deleteTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await financesService.deleteTransaction(req.user!.tenantId!, req.params.id);
      res.json({ success: true, message: 'Transacción eliminada' });
    } catch (err) { next(err); }
  }

  // ── SUMMARY & REPORTS ─────────────────────────────────────────────────────

  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const now = new Date();
      const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      const data = await financesService.getSummary(req.user!.tenantId!, year, month);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getCashflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const now = new Date();
      const from = (req.query.from as string) ?? `${now.getFullYear()}-01-01`;
      const to   = (req.query.to   as string) ?? now.toISOString().split('T')[0];
      const data = await financesService.getCashflow(req.user!.tenantId!, from, to);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── BUDGETS ───────────────────────────────────────────────────────────────

  async getBudgets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const now = new Date();
      const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      const data = await financesService.getBudgets(req.user!.tenantId!, year, month);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async upsertBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await financesService.upsertBudget(req.user!.tenantId!, req.body);
      res.json({ success: true, data, message: 'Presupuesto guardado' });
    } catch (err) { next(err); }
  }

  async deleteBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await financesService.deleteBudget(req.user!.tenantId!, req.params.id);
      res.json({ success: true, message: 'Presupuesto eliminado' });
    } catch (err) { next(err); }
  }
}

export const financesController = new FinancesController();
