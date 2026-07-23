import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { earnPoints, getLoyaltyConfig } from '../loyalty/loyalty.routes';

// ─── Row interfaces ───────────────────────────────────────────────
interface ServiceRow extends RowDataPacket {
  id: string; tenant_id: string; name: string; description: string | null;
  category: string | null; service_type: string; price: number; price_type: string;
  duration_minutes: number | null; image_url: string | null;
  requires_payment: boolean; max_advance_days: number; cancellation_hours: number;
  is_active: boolean; is_published: boolean; sort_order: number;
  created_at: Date; updated_at: Date;
}

interface AvailabilityRow extends RowDataPacket {
  id: string; service_id: string; tenant_id: string; day_of_week: number;
  start_time: string; end_time: string; slot_duration_minutes: number;
  max_simultaneous: number; is_active: boolean;
}

interface BlockedPeriodRow extends RowDataPacket {
  id: string; tenant_id: string; service_id: string | null;
  blocked_date: Date; start_time: string | null; end_time: string | null;
  reason: string | null; created_at: Date;
}

interface BookingRow extends RowDataPacket {
  id: string; tenant_id: string; service_id: string; service_name: string;
  booking_type: string; client_name: string; client_phone: string;
  client_email: string | null; client_notes: string | null;
  booking_date: Date | null; start_time: string | null; end_time: string | null;
  preferred_date_range: string | null; project_description: string | null;
  budget_range: string | null; status: string; payment_status: string;
  amount_paid: number; merchant_notes: string | null;
  created_at: Date; updated_at: Date;
}

interface CountRow extends RowDataPacket { total: number; }

// ─── Mappers ─────────────────────────────────────────────────────
// benefits es JSON: mysql2 puede devolverlo ya parseado (array) o como string
const parseBenefits = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : []; }
    catch { return []; }
  }
  return [];
};

// Modalidades de un servicio: array de { id, name, price, durationMinutes }.
// Permite que un mismo servicio (ej. "Uñas") ofrezca varias opciones con su propio
// precio (Gelish $250, Esculturales $360…) que el cliente elige al agendar.
export interface ServiceOption { id: string; name: string; price: number; durationMinutes: number | null }
const parseOptions = (raw: unknown): ServiceOption[] => {
  let arr: any = raw;
  if (typeof raw === 'string' && raw.trim()) { try { arr = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((o: any) => ({
      id: String(o?.id || '').trim() || uuidv4(),
      name: String(o?.name || '').trim().slice(0, 200),
      price: Number(o?.price) || 0,
      durationMinutes: o?.durationMinutes != null && Number(o.durationMinutes) > 0 ? Number(o.durationMinutes) : null,
    }))
    .filter((o) => o.name.length > 0);
};
// Snapshot de la modalidad elegida al reservar (sobrevive a cambios posteriores del servicio).
const parseSelectedOption = (raw: unknown): ServiceOption | null => {
  let o: any = raw;
  if (typeof raw === 'string' && raw.trim()) { try { o = JSON.parse(raw); } catch { return null; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (!o.name) return null;
  return { id: String(o.id || ''), name: String(o.name), price: Number(o.price) || 0, durationMinutes: o.durationMinutes != null ? Number(o.durationMinutes) : null };
};

const mapService = (r: ServiceRow) => ({
  id: r.id, tenantId: r.tenant_id, name: r.name, description: r.description,
  category: r.category, serviceType: r.service_type, price: Number(r.price),
  priceType: r.price_type, durationMinutes: r.duration_minutes,
  imageUrl: r.image_url, benefits: parseBenefits((r as any).benefits),
  preparation: (r as any).preparation ?? null,
  addonServiceIds: parseBenefits((r as any).addon_service_ids),
  specialistIds: parseBenefits((r as any).specialist_ids),
  options: parseOptions((r as any).options),
  requiresPayment: Boolean(r.requires_payment),
  maxAdvanceDays: r.max_advance_days, cancellationHours: r.cancellation_hours,
  isActive: Boolean(r.is_active), isPublished: Boolean(r.is_published),
  sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapAvailability = (r: AvailabilityRow) => ({
  id: r.id, serviceId: r.service_id, dayOfWeek: r.day_of_week,
  startTime: r.start_time, endTime: r.end_time,
  slotDurationMinutes: r.slot_duration_minutes,
  maxSimultaneous: r.max_simultaneous, isActive: Boolean(r.is_active),
});

const mapBlocked = (r: BlockedPeriodRow) => ({
  id: r.id, serviceId: r.service_id, blockedDate: r.blocked_date,
  startTime: r.start_time, endTime: r.end_time, reason: r.reason,
  createdAt: r.created_at,
});

const mapBooking = (r: BookingRow) => ({
  id: r.id, tenantId: r.tenant_id, serviceId: r.service_id,
  serviceName: r.service_name, bookingType: r.booking_type,
  clientName: r.client_name, clientPhone: r.client_phone,
  clientEmail: r.client_email, clientNotes: r.client_notes,
  bookingDate: r.booking_date, startTime: r.start_time, endTime: r.end_time,
  preferredDateRange: r.preferred_date_range,
  projectDescription: r.project_description, budgetRange: r.budget_range,
  status: r.status, paymentStatus: r.payment_status,
  amountPaid: Number(r.amount_paid), merchantNotes: r.merchant_notes,
  addons: parseAddons((r as any).addons),
  selectedOption: parseSelectedOption((r as any).selected_option),
  totalAmount: Number((r as any).total_amount ?? 0),
  specialistId: (r as any).specialist_id ?? null,
  specialistName: (r as any).specialist_name ?? null,
  loyaltyAwarded: Boolean((r as any).loyalty_awarded),
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapWaitlist = (r: any) => ({
  id: r.id, tenantId: r.tenant_id, serviceId: r.service_id, serviceName: r.service_name,
  clientName: r.client_name, clientPhone: r.client_phone, desiredDate: r.desired_date,
  note: r.note, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapSpecialist = (r: any) => ({
  id: r.id, tenantId: r.tenant_id, name: r.name, title: r.title,
  photoUrl: r.photo_url, isActive: Boolean(r.is_active), sortOrder: r.sort_order,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// addons de una reserva: array de { id, name, price } (snapshot al reservar)
const parseAddons = (raw: unknown): Array<{ id: string; name: string; price: number }> => {
  let arr: any = raw;
  if (typeof raw === 'string' && raw.trim()) { try { arr = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({ id: String(a.id), name: String(a.name), price: Number(a.price) || 0 }));
};

// ─── Service class ────────────────────────────────────────────────
export class ServicesService {

  // ── SERVICES CRUD ──────────────────────────────────────────────
  async findAll(tenantId: string) {
    const [rows] = await db.execute<ServiceRow[]>(
      'SELECT * FROM services WHERE tenant_id = ? ORDER BY sort_order, name',
      [tenantId]
    );
    return rows.map(mapService);
  }

  async findById(id: string, tenantId: string) {
    const [rows] = await db.execute<ServiceRow[]>(
      'SELECT * FROM services WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!rows.length) throw new AppError('Servicio no encontrado', 404);
    return mapService(rows[0]);
  }

  async create(tenantId: string, data: {
    name: string; description?: string; category?: string;
    serviceType: 'cita' | 'asesoria' | 'contacto'; price?: number;
    priceType?: string; durationMinutes?: number; imageUrl?: string;
    benefits?: string[]; preparation?: string; addonServiceIds?: string[]; specialistIds?: string[];
    options?: Array<{ id?: string; name: string; price: number; durationMinutes?: number | null }>;
    requiresPayment?: boolean; maxAdvanceDays?: number;
    cancellationHours?: number; sortOrder?: number;
  }) {
    const id = uuidv4();
    const benefits = Array.isArray(data.benefits)
      ? data.benefits.map((b) => String(b).trim()).filter(Boolean) : [];
    const addonIds = Array.isArray(data.addonServiceIds)
      ? [...new Set(data.addonServiceIds.map((x) => String(x).trim()).filter(Boolean))] : [];
    const specialistIds = Array.isArray(data.specialistIds)
      ? [...new Set(data.specialistIds.map((x) => String(x).trim()).filter(Boolean))] : [];
    const options = parseOptions(data.options);
    await db.execute<ResultSetHeader>(
      `INSERT INTO services
        (id, tenant_id, name, description, category, service_type, price, price_type,
         duration_minutes, image_url, benefits, preparation, addon_service_ids, specialist_ids, options, requires_payment, max_advance_days, cancellation_hours, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, data.name, data.description || null, data.category || null,
        data.serviceType, data.price || 0, data.priceType || 'fijo',
        data.durationMinutes || null, data.imageUrl || null,
        benefits.length ? JSON.stringify(benefits) : null, data.preparation?.trim() || null,
        addonIds.length ? JSON.stringify(addonIds) : null,
        specialistIds.length ? JSON.stringify(specialistIds) : null,
        options.length ? JSON.stringify(options) : null,
        data.requiresPayment ? 1 : 0, data.maxAdvanceDays || 30,
        data.cancellationHours || 24, data.sortOrder || 0,
      ]
    );
    return this.findById(id, tenantId);
  }

  async update(id: string, tenantId: string, data: Partial<{
    name: string; description: string; category: string; serviceType: string;
    price: number; priceType: string; durationMinutes: number; imageUrl: string;
    benefits: string[]; preparation: string; addonServiceIds: string[]; specialistIds: string[];
    options: Array<{ id?: string; name: string; price: number; durationMinutes?: number | null }>;
    requiresPayment: boolean; maxAdvanceDays: number; cancellationHours: number;
    isActive: boolean; isPublished: boolean; sortOrder: number;
  }>) {
    const fields: string[] = [];
    const values: unknown[] = [];

    // benefits/addons (JSON) y preparation se manejan aparte por su normalización
    if ('benefits' in data) {
      const benefits = Array.isArray(data.benefits)
        ? data.benefits.map((b) => String(b).trim()).filter(Boolean) : [];
      fields.push('benefits = ?');
      values.push(benefits.length ? JSON.stringify(benefits) : null);
    }
    if ('preparation' in data) {
      fields.push('preparation = ?');
      values.push(data.preparation?.trim() || null);
    }
    if ('addonServiceIds' in data) {
      const addonIds = Array.isArray(data.addonServiceIds)
        ? [...new Set(data.addonServiceIds.map((x) => String(x).trim()).filter(Boolean))] : [];
      fields.push('addon_service_ids = ?');
      values.push(addonIds.length ? JSON.stringify(addonIds) : null);
    }
    if ('specialistIds' in data) {
      const specialistIds = Array.isArray(data.specialistIds)
        ? [...new Set(data.specialistIds.map((x) => String(x).trim()).filter(Boolean))] : [];
      fields.push('specialist_ids = ?');
      values.push(specialistIds.length ? JSON.stringify(specialistIds) : null);
    }
    if ('options' in data) {
      const options = parseOptions((data as any).options);
      fields.push('options = ?');
      values.push(options.length ? JSON.stringify(options) : null);
    }

    const map: Record<string, string> = {
      name: 'name', description: 'description', category: 'category',
      serviceType: 'service_type', price: 'price', priceType: 'price_type',
      durationMinutes: 'duration_minutes', imageUrl: 'image_url',
      requiresPayment: 'requires_payment', maxAdvanceDays: 'max_advance_days',
      cancellationHours: 'cancellation_hours', isActive: 'is_active',
      isPublished: 'is_published', sortOrder: 'sort_order',
    };

    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = ?`);
        values.push((data as Record<string, unknown>)[key]);
      }
    }

    if (!fields.length) throw new AppError('Sin cambios', 400);

    values.push(id, tenantId);
    await db.execute(
      `UPDATE services SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );
    return this.findById(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM services WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!result.affectedRows) throw new AppError('Servicio no encontrado', 404);
  }

  // ── AVAILABILITY ──────────────────────────────────────────────
  async getAvailability(serviceId: string) {
    const [rows] = await db.execute<AvailabilityRow[]>(
      'SELECT * FROM service_availability WHERE service_id = ? ORDER BY day_of_week, start_time',
      [serviceId]
    );
    return rows.map(mapAvailability);
  }

  async setAvailability(serviceId: string, tenantId: string, slots: Array<{
    dayOfWeek: number; startTime: string; endTime: string;
    slotDurationMinutes: number; maxSimultaneous: number;
  }>) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'DELETE FROM service_availability WHERE service_id = ?',
        [serviceId]
      );
      for (const slot of slots) {
        await connection.execute(
          `INSERT INTO service_availability
            (id, service_id, tenant_id, day_of_week, start_time, end_time, slot_duration_minutes, max_simultaneous)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), serviceId, tenantId, slot.dayOfWeek, slot.startTime,
           slot.endTime, slot.slotDurationMinutes, slot.maxSimultaneous]
        );
      }
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
    return this.getAvailability(serviceId);
  }

  // ── BLOCKED PERIODS ───────────────────────────────────────────
  async getBlockedPeriods(tenantId: string, serviceId?: string) {
    let query = 'SELECT * FROM service_blocked_periods WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (serviceId) {
      query += ' AND (service_id = ? OR service_id IS NULL)';
      params.push(serviceId);
    }
    query += ' ORDER BY blocked_date';
    const [rows] = await db.execute<BlockedPeriodRow[]>(query, params);
    return rows.map(mapBlocked);
  }

  async addBlockedPeriod(tenantId: string, data: {
    serviceId?: string; blockedDate: string;
    startTime?: string; endTime?: string; reason?: string;
  }) {
    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO service_blocked_periods (id, tenant_id, service_id, blocked_date, start_time, end_time, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.serviceId || null, data.blockedDate,
       data.startTime || null, data.endTime || null, data.reason || null]
    );
    const [rows] = await db.execute<BlockedPeriodRow[]>(
      'SELECT * FROM service_blocked_periods WHERE id = ?', [id]
    );
    return mapBlocked(rows[0]);
  }

  async removeBlockedPeriod(id: string, tenantId: string) {
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM service_blocked_periods WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!result.affectedRows) throw new AppError('Período no encontrado', 404);
  }

  // ── AVAILABLE SLOTS ───────────────────────────────────────────
  async getAvailableSlots(serviceId: string, tenantId: string, dateStr: string): Promise<string[]> {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0=Sun

    // 1. Get service availability for this day
    const [availRows] = await db.execute<AvailabilityRow[]>(
      `SELECT * FROM service_availability
       WHERE service_id = ? AND day_of_week = ? AND is_active = TRUE`,
      [serviceId, dayOfWeek]
    );
    if (!availRows.length) return [];

    // 2. Check if date is fully blocked (service-specific or tenant-wide)
    const [fullBlocks] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM service_blocked_periods
       WHERE tenant_id = ? AND blocked_date = ? AND start_time IS NULL
         AND (service_id = ? OR service_id IS NULL)`,
      [tenantId, dateStr, serviceId]
    );
    if (fullBlocks.length) return [];

    // 3. Get partial blocks for this date
    const [partialBlocks] = await db.execute<BlockedPeriodRow[]>(
      `SELECT start_time, end_time FROM service_blocked_periods
       WHERE tenant_id = ? AND blocked_date = ? AND start_time IS NOT NULL
         AND (service_id = ? OR service_id IS NULL)`,
      [tenantId, dateStr, serviceId]
    );

    // 4. Get existing bookings (pending + confirmed) + reservas temporales activas (holds)
    const [bookingRows] = await db.execute<RowDataPacket[]>(
      `SELECT start_time, end_time FROM service_bookings
       WHERE service_id = ? AND booking_date = ? AND status IN ('pendiente', 'confirmada')`,
      [serviceId, dateStr]
    );
    const [holdRows] = await db.execute<RowDataPacket[]>(
      `SELECT start_time, end_time FROM service_slot_holds
       WHERE service_id = ? AND booking_date = ? AND expires_at > NOW()`,
      [serviceId, dateStr]
    );
    const bookings = [...(bookingRows as any[]), ...(holdRows as any[])];

    const availableSlots: string[] = [];

    for (const avail of availRows) {
      const slotMin = avail.slot_duration_minutes;
      const maxSim = avail.max_simultaneous;

      // Generate all slots for this availability block
      const [sh, sm] = avail.start_time.split(':').map(Number);
      const [eh, em] = avail.end_time.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      for (let t = startMinutes; t + slotMin <= endMinutes; t += slotMin) {
        const slotHH = String(Math.floor(t / 60)).padStart(2, '0');
        const slotMM = String(t % 60).padStart(2, '0');
        const slotTime = `${slotHH}:${slotMM}`;
        const slotEndMin = t + slotMin;
        const slotEndHH = String(Math.floor(slotEndMin / 60)).padStart(2, '0');
        const slotEndMM = String(slotEndMin % 60).padStart(2, '0');
        const slotEndTime = `${slotEndHH}:${slotEndMM}`;

        // Check partial blocks
        const isBlocked = partialBlocks.some((b) => {
          if (!b.start_time || !b.end_time) return false;
          const [bsh, bsm] = b.start_time.split(':').map(Number);
          const [beh, bem] = b.end_time.split(':').map(Number);
          const bStart = bsh * 60 + bsm;
          const bEnd = beh * 60 + bem;
          return t < bEnd && slotEndMin > bStart;
        });
        if (isBlocked) continue;

        // Count concurrent bookings
        const concurrent = bookings.filter((b) => {
          if (!b.start_time) return false;
          const [bsh, bsm] = b.start_time.split(':').map(Number);
          const [beh, bem] = (b.end_time as string).split(':').map(Number);
          const bStart = bsh * 60 + bsm;
          const bEnd = beh * 60 + bem;
          return t < bEnd && slotEndMin > bStart;
        }).length;

        if (concurrent < maxSim) {
          availableSlots.push(`${slotTime}-${slotEndTime}`);
        }
      }
    }

    return availableSlots;
  }

  // ── SLOTS CON ESTADO (Fase 1 UX premium) ──────────────────────
  // Devuelve TODOS los slots del día con su estado, no solo los disponibles,
  // para que la UI muestre ocupado/bloqueado/últimos cupos y no todo igual.
  private buildDaySlots(
    availRows: AvailabilityRow[],
    partialBlocks: BlockedPeriodRow[],
    bookings: RowDataPacket[],
    nowMinutes: number | null, // minutos del día si es hoy; null si es fecha futura
  ): Array<{ time: string; endTime: string; status: string; spotsLeft: number }> {
    const out: Array<{ time: string; endTime: string; status: string; spotsLeft: number }> = [];
    const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    for (const avail of availRows) {
      const slotMin = avail.slot_duration_minutes;
      const maxSim = avail.max_simultaneous;
      const startMinutes = toMin(avail.start_time);
      const endMinutes = toMin(avail.end_time);

      for (let t = startMinutes; t + slotMin <= endMinutes; t += slotMin) {
        const slotEndMin = t + slotMin;
        const time = fmt(t);
        const endTime = fmt(slotEndMin);

        const blocked = partialBlocks.some((b) => {
          if (!b.start_time || !b.end_time) return false;
          return t < toMin(b.end_time as string) && slotEndMin > toMin(b.start_time as string);
        });
        const concurrent = bookings.filter((b) => {
          if (!b.start_time) return false;
          return t < toMin(b.end_time as string) && slotEndMin > toMin(b.start_time as string);
        }).length;
        const spotsLeft = Math.max(0, maxSim - concurrent);

        let status: string;
        if (nowMinutes != null && t <= nowMinutes) status = 'pasado';
        else if (blocked) status = 'bloqueado';
        else if (concurrent >= maxSim) status = 'ocupado';
        else status = 'disponible';

        out.push({ time, endTime, status, spotsLeft });
      }
    }

    // Escasez: si quedan pocos disponibles en el día, marcarlos "últimos cupos".
    const availableIdx = out.map((s, i) => (s.status === 'disponible' ? i : -1)).filter(i => i >= 0);
    for (const i of availableIdx) {
      if (out[i].spotsLeft === 1 || availableIdx.length <= 3) out[i].status = 'ultimos_cupos';
    }
    return out;
  }

  /** Slots del día con estado (para el modal de reserva premium). */
  async getSlotsWithStatus(serviceId: string, tenantId: string, dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();

    const [availRows] = await db.execute<AvailabilityRow[]>(
      `SELECT * FROM service_availability WHERE service_id = ? AND day_of_week = ? AND is_active = TRUE`,
      [serviceId, dayOfWeek]
    );
    if (!availRows.length) return { closed: true, slots: [] as any[] };

    const [fullBlocks] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM service_blocked_periods
       WHERE tenant_id = ? AND blocked_date = ? AND start_time IS NULL AND (service_id = ? OR service_id IS NULL)`,
      [tenantId, dateStr, serviceId]
    );
    if (fullBlocks.length) return { closed: true, blocked: true, slots: [] as any[] };

    const [partialBlocks] = await db.execute<BlockedPeriodRow[]>(
      `SELECT start_time, end_time FROM service_blocked_periods
       WHERE tenant_id = ? AND blocked_date = ? AND start_time IS NOT NULL AND (service_id = ? OR service_id IS NULL)`,
      [tenantId, dateStr, serviceId]
    );
    const [bookingRows] = await db.execute<RowDataPacket[]>(
      `SELECT start_time, end_time FROM service_bookings
       WHERE service_id = ? AND booking_date = ? AND status IN ('pendiente','confirmada')`,
      [serviceId, dateStr]
    );
    const [holdRows] = await db.execute<RowDataPacket[]>(
      `SELECT start_time, end_time FROM service_slot_holds
       WHERE service_id = ? AND booking_date = ? AND expires_at > NOW()`,
      [serviceId, dateStr]
    );
    const bookings = [...(bookingRows as any[]), ...(holdRows as any[])];

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowMinutes = dateStr === todayStr ? (new Date().getHours() * 60 + new Date().getMinutes()) : null;

    return { closed: false, slots: this.buildDaySlots(availRows, partialBlocks, bookings, nowMinutes) };
  }

  /** Disponibilidad por día del mes (para pintar cupos/estado bajo cada número). */
  async getMonthAvailability(serviceId: string, tenantId: string, year: number, month: number) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [availRows] = await db.execute<AvailabilityRow[]>(
      `SELECT * FROM service_availability WHERE service_id = ? AND is_active = TRUE`, [serviceId]
    );
    const availByDow = new Map<number, AvailabilityRow[]>();
    for (const a of availRows) { const k = (a as any).day_of_week; (availByDow.get(k) || availByDow.set(k, []).get(k))!.push(a); }

    const [blocks] = await db.execute<RowDataPacket[]>(
      `SELECT blocked_date, start_time, end_time FROM service_blocked_periods
       WHERE tenant_id = ? AND blocked_date BETWEEN ? AND ? AND (service_id = ? OR service_id IS NULL)`,
      [tenantId, monthStart, monthEnd, serviceId]
    );
    const [bookingRows] = await db.execute<RowDataPacket[]>(
      `SELECT booking_date, start_time, end_time FROM service_bookings
       WHERE service_id = ? AND booking_date BETWEEN ? AND ? AND status IN ('pendiente','confirmada')`,
      [serviceId, monthStart, monthEnd]
    );
    const [holdRows] = await db.execute<RowDataPacket[]>(
      `SELECT booking_date, start_time, end_time FROM service_slot_holds
       WHERE service_id = ? AND booking_date BETWEEN ? AND ? AND expires_at > NOW()`,
      [serviceId, monthStart, monthEnd]
    );
    const bookings = [...(bookingRows as any[]), ...(holdRows as any[])];

    const dateKey = (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
    const todayStr = new Date().toISOString().slice(0, 10);
    const result: Record<string, { available: number; status: 'libre' | 'pocos' | 'lleno' | 'cerrado' }> = {};

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (dateStr < todayStr) continue;
      const dow = new Date(dateStr + 'T00:00:00').getDay();
      const dayAvail = availByDow.get(dow) || [];
      if (!dayAvail.length) { result[dateStr] = { available: 0, status: 'cerrado' }; continue; }

      const dayBlocks = (blocks as any[]).filter(b => dateKey(b.blocked_date) === dateStr);
      if (dayBlocks.some(b => !b.start_time)) { result[dateStr] = { available: 0, status: 'cerrado' }; continue; }
      const partial = dayBlocks.filter(b => b.start_time);
      const dayBookings = (bookings as any[]).filter(b => dateKey(b.booking_date) === dateStr);
      const nowMinutes = dateStr === todayStr ? (new Date().getHours() * 60 + new Date().getMinutes()) : null;

      const slots = this.buildDaySlots(dayAvail, partial as any, dayBookings as any, nowMinutes);
      const available = slots.filter(s => s.status === 'disponible' || s.status === 'ultimos_cupos').length;
      const status = available === 0 ? 'lleno' : available <= 3 ? 'pocos' : 'libre';
      result[dateStr] = { available, status };
    }
    return result;
  }

  // ── PUBLIC: list published services by tenant slug ─────────────
  // ── SPECIALISTS (Fase 5) ──────────────────────────────────────
  async listSpecialists(tenantId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM service_specialists WHERE tenant_id = ? AND is_active = TRUE ORDER BY sort_order, name',
      [tenantId]
    );
    return rows.map(mapSpecialist);
  }

  async createSpecialist(tenantId: string, data: { name: string; title?: string; photoUrl?: string; sortOrder?: number }) {
    if (!data.name?.trim()) throw new AppError('Nombre requerido', 400);
    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO service_specialists (id, tenant_id, name, title, photo_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.name.trim(), data.title?.trim() || null, data.photoUrl?.trim() || null, data.sortOrder || 0]
    );
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM service_specialists WHERE id = ?', [id]);
    return mapSpecialist(rows[0]);
  }

  async updateSpecialist(id: string, tenantId: string, data: Partial<{ name: string; title: string; photoUrl: string; isActive: boolean; sortOrder: number }>) {
    const fields: string[] = [];
    const values: unknown[] = [];
    const map: Record<string, string> = { name: 'name', title: 'title', photoUrl: 'photo_url', isActive: 'is_active', sortOrder: 'sort_order' };
    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = ?`);
        const v = (data as Record<string, unknown>)[key];
        values.push(key === 'isActive' ? (v ? 1 : 0) : (typeof v === 'string' ? v.trim() || null : v));
      }
    }
    if (!fields.length) throw new AppError('Sin cambios', 400);
    values.push(id, tenantId);
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE service_specialists SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values
    );
    if (!result.affectedRows) throw new AppError('Especialista no encontrado', 404);
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM service_specialists WHERE id = ?', [id]);
    return mapSpecialist(rows[0]);
  }

  // Soft delete: se preserva el nombre ya snapshoteado en reservas existentes
  async removeSpecialist(id: string, tenantId: string) {
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE service_specialists SET is_active = 0 WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (!result.affectedRows) throw new AppError('Especialista no encontrado', 404);
  }

  // Especialistas activos que realizan un servicio publicado, en el orden configurado
  async getPublicSpecialists(serviceId: string, tenantId: string) {
    const [svcRows] = await db.execute<ServiceRow[]>(
      'SELECT specialist_ids FROM services WHERE id = ? AND tenant_id = ? AND is_active = TRUE AND is_published = TRUE',
      [serviceId, tenantId]
    );
    if (!svcRows.length) return [];
    const ids = parseBenefits((svcRows[0] as any).specialist_ids);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM service_specialists WHERE tenant_id = ? AND is_active = TRUE AND id IN (${placeholders})`,
      [tenantId, ...ids]
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean).map((r: any) => ({
      id: r.id, name: r.name, title: r.title, photoUrl: r.photo_url,
    }));
  }

  // Complementos (cross-sell) publicados de un servicio, en el orden configurado
  async getPublicAddons(serviceId: string, tenantId: string) {
    const [svcRows] = await db.execute<ServiceRow[]>(
      'SELECT addon_service_ids FROM services WHERE id = ? AND tenant_id = ? AND is_active = TRUE AND is_published = TRUE',
      [serviceId, tenantId]
    );
    if (!svcRows.length) return [];
    const ids = parseBenefits((svcRows[0] as any).addon_service_ids)
      .filter((x) => x !== serviceId); // nunca ofrecerse a sí mismo
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.execute<ServiceRow[]>(
      `SELECT * FROM services
       WHERE tenant_id = ? AND is_active = TRUE AND is_published = TRUE AND id IN (${placeholders})`,
      [tenantId, ...ids]
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    // Respetar el orden configurado por el comerciante
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is ServiceRow => !!r)
      .map((r) => ({
        id: r.id, name: r.name, price: Number(r.price), priceType: r.price_type,
        durationMinutes: r.duration_minutes, imageUrl: r.image_url,
        description: r.description,
      }));
  }

  async findPublicBySlug(slug: string) {
    const [tenants] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [slug]
    );
    if (!tenants.length) throw new AppError('Tienda no encontrada', 404);
    const tenantId = tenants[0].id;
    const [rows] = await db.execute<ServiceRow[]>(
      'SELECT * FROM services WHERE tenant_id = ? AND is_published = TRUE AND is_active = TRUE ORDER BY sort_order, name',
      [tenantId]
    );
    return { tenantId, services: rows.map(mapService) };
  }

  // ── BOOKINGS ──────────────────────────────────────────────────
  async findBookings(tenantId: string, filters?: {
    serviceId?: string; status?: string; dateFrom?: string; dateTo?: string;
    page?: number; limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    const conditions = ['tenant_id = ?'];
    const values: unknown[] = [tenantId];

    if (filters?.serviceId) { conditions.push('service_id = ?'); values.push(filters.serviceId); }
    if (filters?.status) { conditions.push('status = ?'); values.push(filters.status); }
    if (filters?.dateFrom) { conditions.push('(booking_date >= ? OR booking_date IS NULL)'); values.push(filters.dateFrom); }
    if (filters?.dateTo) { conditions.push('(booking_date <= ? OR booking_date IS NULL)'); values.push(filters.dateTo); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [countRows] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM service_bookings ${where}`, values
    );
    const total = countRows[0].total;
    const [rows] = await db.execute<BookingRow[]>(
      `SELECT * FROM service_bookings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, String(limit), String(offset)]
    );
    return {
      data: rows.map(mapBooking),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── RESERVA TEMPORAL (hold) — anti doble reserva (F2) ─────────
  /** Aparta un cupo por 5 min mientras el cliente completa sus datos. */
  async createHold(serviceId: string, tenantId: string, dateStr: string, startTime: string) {
    // Limpiar holds vencidos (mantenimiento oportunista)
    await db.execute('DELETE FROM service_slot_holds WHERE expires_at < NOW()');

    // El slot debe existir y estar disponible (getAvailableSlots ya cuenta holds activos)
    const available = await this.getAvailableSlots(serviceId, tenantId, dateStr);
    const match = available.find((s) => s.startsWith(startTime));
    if (!match) throw new AppError('Ese horario ya no está disponible', 409);
    const endTime = match.split('-')[1];

    const { randomBytes } = await import('crypto');
    const holdToken = randomBytes(18).toString('base64url');
    const id = uuidv4();
    await db.execute(
      `INSERT INTO service_slot_holds (id, tenant_id, service_id, hold_token, booking_date, start_time, end_time, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
      [id, tenantId, serviceId, holdToken, dateStr, startTime, endTime]
    );
    // Devolver el momento de expiración calculado por la BD (consistente con NOW())
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT expires_at AS expiresAt FROM service_slot_holds WHERE id = ?', [id]
    );
    return { holdToken, expiresAt: (rows as any[])[0]?.expiresAt };
  }

  async releaseHold(holdToken: string) {
    await db.execute('DELETE FROM service_slot_holds WHERE hold_token = ?', [holdToken]);
    return { released: true };
  }

  async createBooking(tenantId: string, data: {
    serviceId: string; clientName: string; clientPhone: string;
    clientEmail?: string; clientNotes?: string;
    bookingDate?: string; startTime?: string; holdToken?: string;
    addonIds?: string[]; specialistId?: string; optionId?: string;
    preferredDateRange?: string; projectDescription?: string; budgetRange?: string;
  }) {
    // Validate service belongs to tenant and is active
    const [svcRows] = await db.execute<ServiceRow[]>(
      'SELECT * FROM services WHERE id = ? AND tenant_id = ? AND is_active = TRUE',
      [data.serviceId, tenantId]
    );
    if (!svcRows.length) throw new AppError('Servicio no disponible', 404);
    const svc = svcRows[0];

    // ── Especialista (Fase 5): solo se acepta si el servicio lo ofrece y está
    // activo. Se snapshotea el nombre (sobrevive a bajas/renombres posteriores).
    let specialistId: string | null = null;
    let specialistName: string | null = null;
    if (data.specialistId) {
      const allowedSpecialists = parseBenefits((svc as any).specialist_ids);
      if (!allowedSpecialists.includes(data.specialistId)) {
        throw new AppError('El especialista seleccionado no atiende este servicio', 400);
      }
      const [spRows] = await db.execute<RowDataPacket[]>(
        'SELECT id, name FROM service_specialists WHERE id = ? AND tenant_id = ? AND is_active = TRUE',
        [data.specialistId, tenantId]
      );
      if (!spRows.length) throw new AppError('El especialista seleccionado no está disponible', 400);
      specialistId = spRows[0].id;
      specialistName = spRows[0].name;
    }

    // ── Cross-sell: resolver complementos SIEMPRE en el servidor (nunca confiar
    // en el precio del cliente). Solo se aceptan add-ons que el servicio realmente
    // ofrece, que existen, están activos y publicados.
    const allowedAddonIds = parseBenefits((svc as any).addon_service_ids);
    const requestedAddonIds = Array.isArray(data.addonIds)
      ? [...new Set(data.addonIds.map((x) => String(x).trim()).filter(Boolean))] : [];
    const validAddonIds = requestedAddonIds.filter((x) => allowedAddonIds.includes(x));
    let addons: Array<{ id: string; name: string; price: number }> = [];
    if (validAddonIds.length) {
      const placeholders = validAddonIds.map(() => '?').join(',');
      const [addonRows] = await db.execute<ServiceRow[]>(
        `SELECT id, name, price FROM services
         WHERE tenant_id = ? AND is_active = TRUE AND is_published = TRUE AND id IN (${placeholders})`,
        [tenantId, ...validAddonIds]
      );
      addons = addonRows.map((a) => ({ id: a.id, name: a.name, price: Number(a.price) }));
    }
    // ── Modalidad (opción del servicio): resuelta SIEMPRE en el servidor. Si el
    // servicio ofrece opciones y el cliente eligió una válida, su precio manda sobre
    // el precio base del servicio. Se snapshotea para que sobreviva a cambios futuros.
    const svcOptions = parseOptions((svc as any).options);
    let selectedOption: ServiceOption | null = null;
    if (data.optionId) {
      selectedOption = svcOptions.find((o) => o.id === data.optionId) || null;
      if (!selectedOption) throw new AppError('La modalidad seleccionada no está disponible', 400);
    } else if (svcOptions.length > 0) {
      // El servicio tiene modalidades pero no se eligió ninguna → obligamos a elegir.
      throw new AppError('Debes elegir una modalidad para este servicio', 400);
    }

    const baseServicePrice = ['fijo', 'desde'].includes(svc.price_type) ? Number(svc.price) : 0;
    const basePrice = selectedOption ? selectedOption.price : baseServicePrice;
    const totalAmount = basePrice + addons.reduce((s, a) => s + a.price, 0);

    let endTime: string | null = null;

    // For cita type: validate slot is available
    if (svc.service_type === 'cita' && data.bookingDate && data.startTime) {
      // Consumir el hold del cliente ANTES de re-validar: así su propia reserva
      // temporal no cuenta como ocupante (pero sí las de otros / las citas reales).
      if (data.holdToken) {
        await db.execute('DELETE FROM service_slot_holds WHERE hold_token = ?', [data.holdToken]);
      }
      const available = await this.getAvailableSlots(data.serviceId, tenantId, data.bookingDate);
      const matchingSlot = available.find((s) => s.startsWith(data.startTime!));
      if (!matchingSlot) throw new AppError('El horario seleccionado no está disponible', 400);
      endTime = matchingSlot.split('-')[1];

      // Guard: un mismo especialista no puede tener dos citas solapadas
      if (specialistId) {
        const [clash] = await db.execute<CountRow[]>(
          `SELECT COUNT(*) AS total FROM service_bookings
           WHERE tenant_id = ? AND specialist_id = ? AND booking_date = ?
             AND status IN ('pendiente','confirmada')
             AND start_time < ? AND end_time > ?`,
          [tenantId, specialistId, data.bookingDate, endTime, data.startTime]
        );
        if (clash[0].total > 0) {
          throw new AppError('Ese especialista ya tiene una cita en ese horario. Elige otro especialista u otra hora.', 409);
        }
      }
    }

    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO service_bookings
        (id, tenant_id, service_id, service_name, booking_type, client_name, client_phone,
         client_email, client_notes, booking_date, start_time, end_time,
         preferred_date_range, project_description, budget_range, addons, selected_option, total_amount,
         specialist_id, specialist_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, data.serviceId, svc.name, svc.service_type,
        data.clientName, data.clientPhone, data.clientEmail || null,
        data.clientNotes || null,
        data.bookingDate || null, data.startTime || null, endTime,
        data.preferredDateRange || null, data.projectDescription || null,
        data.budgetRange || null,
        addons.length ? JSON.stringify(addons) : null,
        selectedOption ? JSON.stringify(selectedOption) : null,
        totalAmount,
        specialistId, specialistName,
      ]
    );

    const [rows] = await db.execute<BookingRow[]>(
      'SELECT * FROM service_bookings WHERE id = ?', [id]
    );
    return mapBooking(rows[0]);
  }

  async updateBookingStatus(id: string, tenantId: string, data: {
    status?: string; merchantNotes?: string;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.status) { fields.push('status = ?'); values.push(data.status); }
    if (data.merchantNotes !== undefined) { fields.push('merchant_notes = ?'); values.push(data.merchantNotes); }
    if (!fields.length) throw new AppError('Sin cambios', 400);
    values.push(id, tenantId);
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE service_bookings SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );
    if (!result.affectedRows) throw new AppError('Reserva no encontrada', 404);

    // Fidelidad al completar: acredita puntos UNA vez (idempotente) según el total
    if (data.status === 'completada') {
      await this.awardLoyaltyForBooking(id, tenantId).catch(() => {});
    }

    const [rows] = await db.execute<BookingRow[]>(
      'SELECT * FROM service_bookings WHERE id = ?', [id]
    );
    return mapBooking(rows[0]);
  }

  // Acredita puntos de fidelidad por una reserva completada (una sola vez)
  private async awardLoyaltyForBooking(bookingId: string, tenantId: string) {
    const cfg = await getLoyaltyConfig(tenantId);
    if (!cfg.enabled) return;
    const [rows] = await db.execute<BookingRow[]>(
      'SELECT * FROM service_bookings WHERE id = ? AND tenant_id = ?', [bookingId, tenantId]
    );
    if (!rows.length) return;
    const b = rows[0] as any;
    if (b.loyalty_awarded) return; // ya acreditado
    const amount = Number(b.total_amount) || 0;
    // Marcar primero (evita doble acreditación por condiciones de carrera)
    const [upd] = await db.execute<ResultSetHeader>(
      'UPDATE service_bookings SET loyalty_awarded = 1 WHERE id = ? AND loyalty_awarded = 0', [bookingId]
    );
    if (!upd.affectedRows) return;
    if (amount > 0) {
      await earnPoints(tenantId, b.client_phone, b.client_name, amount, bookingId).catch(() => {});
    }
  }

  // Reprogramar una cita: revalida disponibilidad y respeta el guard de especialista
  async rescheduleBooking(id: string, tenantId: string, data: { bookingDate: string; startTime: string }) {
    const [rows] = await db.execute<BookingRow[]>(
      'SELECT * FROM service_bookings WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (!rows.length) throw new AppError('Reserva no encontrada', 404);
    const bk = rows[0] as any;
    if (bk.booking_type !== 'cita') throw new AppError('Solo se reprograman citas', 400);
    if (['cancelada', 'completada', 'no_asistio'].includes(bk.status)) {
      throw new AppError('No se puede reprogramar una reserva cerrada', 400);
    }
    if (!data.bookingDate || !data.startTime) throw new AppError('Fecha y hora requeridas', 400);

    const available = await this.getAvailableSlots(bk.service_id, tenantId, data.bookingDate);
    const match = available.find((s) => s.startsWith(data.startTime));
    if (!match) throw new AppError('El nuevo horario no está disponible', 409);
    const endTime = match.split('-')[1];

    // Guard de solape del especialista (excluyendo esta misma reserva)
    if (bk.specialist_id) {
      const [clash] = await db.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM service_bookings
         WHERE tenant_id = ? AND specialist_id = ? AND booking_date = ? AND id <> ?
           AND status IN ('pendiente','confirmada')
           AND start_time < ? AND end_time > ?`,
        [tenantId, bk.specialist_id, data.bookingDate, id, endTime, data.startTime]
      );
      if (clash[0].total > 0) throw new AppError('Ese especialista ya tiene una cita en ese horario.', 409);
    }

    await db.execute(
      'UPDATE service_bookings SET booking_date = ?, start_time = ?, end_time = ? WHERE id = ? AND tenant_id = ?',
      [data.bookingDate, data.startTime, endTime, id, tenantId]
    );
    const [out] = await db.execute<BookingRow[]>('SELECT * FROM service_bookings WHERE id = ?', [id]);
    return mapBooking(out[0]);
  }

  // ── WAITLIST (Fase 6) ──────────────────────────────────────────
  async joinWaitlist(tenantId: string, data: {
    serviceId: string; clientName: string; clientPhone: string; desiredDate?: string; note?: string;
  }) {
    const [svcRows] = await db.execute<ServiceRow[]>(
      'SELECT name FROM services WHERE id = ? AND tenant_id = ? AND is_active = TRUE AND is_published = TRUE',
      [data.serviceId, tenantId]
    );
    if (!svcRows.length) throw new AppError('Servicio no disponible', 404);
    if (!data.clientName?.trim() || !data.clientPhone?.trim()) throw new AppError('Nombre y teléfono requeridos', 400);
    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO service_waitlist (id, tenant_id, service_id, service_name, client_name, client_phone, desired_date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.serviceId, svcRows[0].name, data.clientName.trim(), data.clientPhone.trim(),
       data.desiredDate || null, data.note?.trim() || null]
    );
    return { id };
  }

  async listWaitlist(tenantId: string, filters?: { status?: string; serviceId?: string }) {
    const conditions = ['tenant_id = ?'];
    const values: unknown[] = [tenantId];
    if (filters?.status) { conditions.push('status = ?'); values.push(filters.status); }
    if (filters?.serviceId) { conditions.push('service_id = ?'); values.push(filters.serviceId); }
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM service_waitlist WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      values
    );
    return rows.map(mapWaitlist);
  }

  async updateWaitlistStatus(id: string, tenantId: string, status: string) {
    if (!['pendiente', 'notificado', 'convertido', 'cancelado'].includes(status)) {
      throw new AppError('Estado inválido', 400);
    }
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE service_waitlist SET status = ? WHERE id = ? AND tenant_id = ?', [status, id, tenantId]
    );
    if (!result.affectedRows) throw new AppError('Entrada no encontrada', 404);
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM service_waitlist WHERE id = ?', [id]);
    return mapWaitlist(rows[0]);
  }

  // ── STATS de reservas (Fase 6) ─────────────────────────────────
  async getBookingStats(tenantId: string, days = 30) {
    const [statusRows] = await db.execute<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS n FROM service_bookings
       WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY status`,
      [tenantId, days]
    );
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of statusRows) { byStatus[r.status] = Number(r.n); total += Number(r.n); }

    const completed = byStatus['completada'] || 0;
    const noShow = byStatus['no_asistio'] || 0;
    const attended = completed + noShow;
    const noShowRate = attended > 0 ? Math.round((noShow / attended) * 100) : 0;

    const [revRows] = await db.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM service_bookings
       WHERE tenant_id = ? AND status = 'completada' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [tenantId, days]
    );
    const revenue = Number(revRows[0].revenue) || 0;

    const [topSvc] = await db.execute<RowDataPacket[]>(
      `SELECT service_name AS name, COUNT(*) AS n FROM service_bookings
       WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY service_name ORDER BY n DESC LIMIT 5`,
      [tenantId, days]
    );
    const [topSpec] = await db.execute<RowDataPacket[]>(
      `SELECT specialist_name AS name, COUNT(*) AS n FROM service_bookings
       WHERE tenant_id = ? AND specialist_name IS NOT NULL AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY specialist_name ORDER BY n DESC LIMIT 5`,
      [tenantId, days]
    );
    const [waitRows] = await db.execute<CountRow[]>(
      "SELECT COUNT(*) AS total FROM service_waitlist WHERE tenant_id = ? AND status = 'pendiente'",
      [tenantId]
    );

    return {
      days, total, byStatus, completed, noShowRate, revenue,
      pendingWaitlist: Number((waitRows[0] as any).total) || 0,
      topServices: topSvc.map((r) => ({ name: r.name, count: Number(r.n) })),
      topSpecialists: topSpec.map((r) => ({ name: r.name, count: Number(r.n) })),
    };
  }
}

export const servicesService = new ServicesService();
