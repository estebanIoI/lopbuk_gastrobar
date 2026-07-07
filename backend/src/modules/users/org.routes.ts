/**
 * Organigrama del comercio — árbol de colaboradores + dossier consolidado.
 * El comerciante ve a todo su equipo jerárquicamente y, al abrir una tarjeta,
 * toda la información vinculada: salario, comisión, ventas generadas, vacaciones,
 * nómina, novedades, ajustes y vehículo asignado (ferretería).
 * Se monta bajo /api/users (importado por users.routes.ts).
 */
import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';

const router: ReturnType<typeof Router> = Router();

// GET /api/users/org-chart — todos los colaboradores del tenant (sin clientes)
router.get('/org-chart', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar, u.phone, u.cedula,
              u.is_active AS isActive, u.manager_id AS managerId,
              c.name AS cargoName
         FROM users u
         LEFT JOIN employee_cargos c ON c.id = u.cargo_id
        WHERE u.tenant_id = ? AND u.role NOT IN ('cliente')
        ORDER BY FIELD(u.role, 'comerciante') DESC, u.name ASC`,
      [tenantId]
    ) as any;
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Org chart error:', error);
    res.status(500).json({ success: false, error: 'Error al cargar el organigrama' });
  }
});

// PATCH /api/users/:id/manager — define a quién le reporta (con anti-ciclo)
router.patch(
  '/:id/manager',
  [param('id').notEmpty(), body('managerId').optional({ nullable: true }).isString(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const managerId = req.body.managerId || null;

      if (managerId === id) { res.status(400).json({ success: false, error: 'Un colaborador no puede reportarse a sí mismo' }); return; }

      // Ambos deben ser del mismo tenant
      const [users] = await pool.query(
        'SELECT id, manager_id FROM users WHERE id = ? AND tenant_id = ?', [id, tenantId]
      ) as any;
      if (!users.length) { res.status(404).json({ success: false, error: 'Colaborador no encontrado' }); return; }

      if (managerId) {
        const [mgr] = await pool.query(
          'SELECT id FROM users WHERE id = ? AND tenant_id = ?', [managerId, tenantId]
        ) as any;
        if (!mgr.length) { res.status(400).json({ success: false, error: 'Jefe inválido' }); return; }

        // Anti-ciclo: el nuevo jefe no puede colgar de este colaborador
        let cursor: string | null = managerId;
        const seen = new Set<string>();
        while (cursor) {
          if (cursor === id) { res.status(400).json({ success: false, error: 'Esa asignación crearía un ciclo en el organigrama' }); return; }
          if (seen.has(cursor)) break;
          seen.add(cursor);
          const [next] = await pool.query('SELECT manager_id FROM users WHERE id = ?', [cursor]) as any;
          cursor = next?.[0]?.manager_id || null;
        }
      }

      await pool.query('UPDATE users SET manager_id = ? WHERE id = ? AND tenant_id = ?', [managerId, id, tenantId]);
      res.json({ success: true, data: { id, managerId } });
    } catch (error) {
      console.error('Set manager error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar la jerarquía' });
    }
  }
);

// GET /api/users/:id/dossier — expediente consolidado del colaborador
router.get(
  '/:id/dossier',
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const year = new Date().getFullYear();
      const monthStart = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

      const [[person], [salesAll], [salesMonth], [vac], [payroll], [novelties], [adjustments], [vehicles]] = await Promise.all([
        pool.query(
          `SELECT u.id, u.name, u.email, u.role, u.avatar, u.phone, u.cedula,
                  u.department, u.municipality, u.address, u.is_active AS isActive, u.created_at AS createdAt,
                  u.manager_id AS managerId, m.name AS managerName,
                  u.commission_type AS commissionType, u.commission_value AS commissionValue,
                  u.salary_base AS salaryBase, u.monthly_goal AS monthlyGoal, u.goal_bonus AS goalBonus,
                  c.name AS cargoName, c.description AS cargoDescription, c.permissions AS cargoPermissions
             FROM users u
             LEFT JOIN users m ON m.id = u.manager_id
             LEFT JOIN employee_cargos c ON c.id = u.cargo_id
            WHERE u.id = ? AND u.tenant_id = ?`,
          [id, tenantId]
        ) as Promise<any>,
        pool.query(
          `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS amount
             FROM sales WHERE tenant_id = ? AND seller_id = ? AND status = 'completada'`,
          [tenantId, id]
        ) as Promise<any>,
        pool.query(
          `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS amount
             FROM sales WHERE tenant_id = ? AND seller_id = ? AND status = 'completada' AND created_at >= ?`,
          [tenantId, id, monthStart]
        ) as Promise<any>,
        pool.query(
          `SELECT days_granted AS daysGranted, days_used AS daysUsed
             FROM employee_vacation_balances WHERE tenant_id = ? AND user_id = ? AND year = ? LIMIT 1`,
          [tenantId, id, year]
        ) as Promise<any>,
        pool.query(
          `SELECT id, period_label AS periodLabel, total_pagar AS totalPagar, status,
                  paid_at AS paidAt, generated_at AS generatedAt
             FROM payroll_records WHERE tenant_id = ? AND seller_id = ?
            ORDER BY period_from DESC LIMIT 12`,
          [tenantId, id]
        ) as Promise<any>,
        pool.query(
          `SELECT id, type, start_date AS startDate, end_date AS endDate, days_count AS daysCount,
                  status, deducts_salary AS deductsSalary, deduct_amount AS deductAmount, description
             FROM employee_novelties WHERE tenant_id = ? AND user_id = ?
            ORDER BY start_date DESC LIMIT 12`,
          [tenantId, id]
        ) as Promise<any>,
        pool.query(
          `SELECT id, type, concept, amount, period_from AS periodFrom, period_to AS periodTo, created_at AS createdAt
             FROM payroll_adjustments WHERE tenant_id = ? AND seller_id = ?
            ORDER BY created_at DESC LIMIT 12`,
          [tenantId, id]
        ) as Promise<any>,
        // Vehículo(s) asignado(s) ahora: ruta activa como conductor, o pedido en curso
        pool.query(
          `SELECT DISTINCT v.id, v.name, v.plate, v.type, r.route_number AS routeNumber, r.status AS routeStatus
             FROM fleet_vehicles v
             JOIN dispatch_routes r ON r.vehicle_id = v.id
            WHERE r.tenant_id = ? AND r.driver_id = ? AND r.status IN ('planificada','cargando','en_ruta','retornando')
            UNION
           SELECT DISTINCT v2.id, v2.name, v2.plate, v2.type, NULL AS routeNumber, o.dispatch_status AS routeStatus
             FROM fleet_vehicles v2
             JOIN storefront_orders o ON o.vehicle_id = v2.id
            WHERE o.tenant_id = ? AND o.delivery_driver_id = ? AND o.dispatch_status IN ('cargado','despachado')`,
          [tenantId, id, tenantId, id]
        ) as Promise<any>,
      ]);

      if (!person.length) { res.status(404).json({ success: false, error: 'Colaborador no encontrado' }); return; }

      const p = person[0];
      const vacGranted = Number(vac[0]?.daysGranted ?? 15);
      const vacUsed = Number(vac[0]?.daysUsed ?? 0);

      // Responsabilidades del cargo: descripción + permisos (JSON → lista)
      let permissions: string[] = [];
      const rawPerms = p.cargoPermissions;
      if (rawPerms) {
        try { permissions = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms; }
        catch { permissions = []; }
      }

      res.json({
        success: true,
        data: {
          person: p,
          responsibilities: {
            cargo: p.cargoName || null,
            description: p.cargoDescription || null,
            permissions: Array.isArray(permissions) ? permissions : [],
          },
          compensation: {
            salaryBase: Number(p.salaryBase),
            commissionType: p.commissionType,
            commissionValue: Number(p.commissionValue),
            monthlyGoal: Number(p.monthlyGoal),
            goalBonus: Number(p.goalBonus),
          },
          generated: {
            allTime: { count: Number(salesAll[0].count), amount: Number(salesAll[0].amount) },
            thisMonth: { count: Number(salesMonth[0].count), amount: Number(salesMonth[0].amount) },
          },
          vacation: { year, daysGranted: vacGranted, daysUsed: vacUsed, daysLeft: vacGranted - vacUsed },
          payroll,
          novelties,
          adjustments,
          vehicles,
        },
      });
    } catch (error) {
      console.error('Dossier error:', error);
      res.status(500).json({ success: false, error: 'Error al cargar el expediente' });
    }
  }
);

export default router;
