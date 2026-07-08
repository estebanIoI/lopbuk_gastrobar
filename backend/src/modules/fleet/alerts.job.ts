/**
 * Alertas automáticas de flota (job diario):
 * - Documentos por vencer: SOAT / tecnomecánica / seguro (≤15 días o vencidos)
 * - Mantenimiento preventivo vencido por kilometraje
 * - Consumo de combustible anómalo (>30% sobre el promedio de la flota)
 * Cada alerta llega como merchant_notification (una vez por día por ítem).
 */
import pool from '../../config/database';

const DAY_MS = 24 * 60 * 60 * 1000;

async function notify(tenantId: string, title: string, message: string, data: Record<string, unknown>): Promise<void> {
  // Evitar duplicados: misma alerta (título) ya emitida hoy
  const [dup] = await pool.query(
    `SELECT id FROM merchant_notifications
      WHERE tenant_id = ? AND type = 'fleet_alert' AND title = ? AND DATE(created_at) = CURDATE() LIMIT 1`,
    [tenantId, title]
  ) as any;
  if (dup.length > 0) return;
  await pool.query(
    `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
     VALUES (?, 'fleet_alert', ?, ?, ?)`,
    [tenantId, title, message, JSON.stringify(data)]
  );
}

export async function runFleetAlerts(): Promise<number> {
  let count = 0;

  // 1. Documentos por vencer o vencidos
  const [docs] = await pool.query(
    `SELECT id, tenant_id, name, plate,
            soat_expiry, tecno_expiry, insurance_expiry,
            DATEDIFF(soat_expiry, CURDATE()) AS soatDays,
            DATEDIFF(tecno_expiry, CURDATE()) AS tecnoDays,
            DATEDIFF(insurance_expiry, CURDATE()) AS insuranceDays
       FROM fleet_vehicles
      WHERE status != 'inactivo'
        AND (soat_expiry IS NOT NULL OR tecno_expiry IS NOT NULL OR insurance_expiry IS NOT NULL)`
  ) as any;
  for (const v of docs as any[]) {
    const label = `${v.name}${v.plate ? ` (${v.plate})` : ''}`;
    const checks: Array<[string, number | null]> = [
      ['SOAT', v.soatDays], ['Tecnomecánica', v.tecnoDays], ['Seguro', v.insuranceDays],
    ];
    for (const [doc, daysLeft] of checks) {
      if (daysLeft == null || daysLeft > 15) continue;
      const title = daysLeft < 0
        ? `⛔ ${doc} VENCIDO: ${label}`
        : `⚠️ ${doc} vence en ${daysLeft} día(s): ${label}`;
      await notify(v.tenant_id, title,
        daysLeft < 0 ? `El ${doc} venció hace ${Math.abs(daysLeft)} día(s). El vehículo no debería circular.`
          : `Renueva el ${doc} antes del vencimiento para no parar el vehículo.`,
        { vehicleId: v.id, doc, daysLeft });
      count++;
    }
  }

  // 2. Mantenimiento preventivo por kilometraje
  const [maint] = await pool.query(
    `SELECT id, tenant_id, name, plate, odometer_km, last_maintenance_km, maintenance_every_km
       FROM fleet_vehicles
      WHERE status != 'inactivo' AND maintenance_every_km > 0
        AND (odometer_km - last_maintenance_km) >= maintenance_every_km`
  ) as any;
  for (const v of maint as any[]) {
    const overKm = Number(v.odometer_km) - Number(v.last_maintenance_km) - Number(v.maintenance_every_km);
    await notify(v.tenant_id,
      `🔧 Mantenimiento vencido: ${v.name}${v.plate ? ` (${v.plate})` : ''}`,
      `Lleva ${Number(v.odometer_km) - Number(v.last_maintenance_km)} km desde el último mantenimiento (regla: cada ${v.maintenance_every_km} km${overKm > 0 ? `, excedido por ${overKm} km` : ''}).`,
      { vehicleId: v.id });
    count++;
  }

  // 2b. Mantenimiento preventivo por fecha (próximo servicio programado ≤7 días o vencido)
  const [maintDate] = await pool.query(
    `SELECT id, tenant_id, name, plate, next_maintenance_date,
            DATEDIFF(next_maintenance_date, CURDATE()) AS days
       FROM fleet_vehicles
      WHERE status != 'inactivo' AND next_maintenance_date IS NOT NULL
        AND DATEDIFF(next_maintenance_date, CURDATE()) <= 7`
  ) as any;
  for (const v of maintDate as any[]) {
    const days = Number(v.days);
    await notify(v.tenant_id,
      days < 0
        ? `🔧 Servicio programado VENCIDO: ${v.name}${v.plate ? ` (${v.plate})` : ''}`
        : `🔧 Servicio programado en ${days} día(s): ${v.name}${v.plate ? ` (${v.plate})` : ''}`,
      days < 0 ? `El mantenimiento programado venció hace ${Math.abs(days)} día(s).`
        : `Agenda el mantenimiento antes de la fecha para no parar el vehículo.`,
      { vehicleId: v.id, days });
    count++;
  }

  // 3. Consumo anómalo: costo de combustible por entrega >30% sobre el promedio del tenant (30 días)
  const [consumption] = await pool.query(
    `SELECT t.tenant_id, t.vehicle_id, v.name, v.plate, t.fuel, t.deliveries,
            (t.fuel / NULLIF(t.deliveries, 0)) AS costPerDelivery,
            avgt.avgCost
       FROM (SELECT e.tenant_id, e.vehicle_id, SUM(e.amount) AS fuel,
                    (SELECT COUNT(*) FROM storefront_orders o
                      WHERE o.vehicle_id = e.vehicle_id AND o.dispatch_status = 'entregado'
                        AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS deliveries
               FROM fleet_vehicle_expenses e
              WHERE e.type = 'combustible' AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              GROUP BY e.tenant_id, e.vehicle_id) t
       JOIN fleet_vehicles v ON v.id = t.vehicle_id
       JOIN (SELECT e2.tenant_id, SUM(e2.amount) / NULLIF((SELECT COUNT(*) FROM storefront_orders o2
                      WHERE o2.tenant_id = e2.tenant_id AND o2.dispatch_status = 'entregado'
                        AND o2.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0) AS avgCost
               FROM fleet_vehicle_expenses e2
              WHERE e2.type = 'combustible' AND e2.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              GROUP BY e2.tenant_id) avgt ON avgt.tenant_id = t.tenant_id
      WHERE t.deliveries >= 5 AND (t.fuel / t.deliveries) > avgt.avgCost * 1.3`
  ) as any;
  for (const c of consumption as any[]) {
    await notify(c.tenant_id,
      `⛽ Consumo alto: ${c.name}${c.plate ? ` (${c.plate})` : ''}`,
      `Su costo de combustible por entrega ($${Math.round(c.costPerDelivery).toLocaleString('es-CO')}) supera en más del 30% el promedio de tu flota.`,
      { vehicleId: c.vehicle_id });
    count++;
  }

  return count;
}

/** Arranca el job: primera corrida 2 min después del boot, luego cada 24h. */
export function startFleetAlertsJob(): void {
  const run = () =>
    runFleetAlerts()
      .then(n => { if (n > 0) console.log(`[fleet] alertas emitidas: ${n}`); })
      .catch(e => console.error('[fleet] alerts job failed:', e?.message || e));
  setTimeout(run, 120_000).unref();
  setInterval(run, DAY_MS).unref();
}
