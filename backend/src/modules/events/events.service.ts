import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import type { CreateEventDTO, CreateVenueDTO, CreateTicketTypeDTO } from './events.types';

export class EventsService {
  // ── Venues ──────────────────────────────────────
  async findVenues(tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_venues WHERE tenant_id = ? AND is_active = 1 ORDER BY name',
      [tenantId]
    );
    return rows;
  }

  async findVenueById(id: string, tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_venues WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (!rows.length) throw new AppError('Venue no encontrado', 404);
    return rows[0];
  }

  async createVenue(tenantId: string, data: CreateVenueDTO) {
    if (!data.name) throw new AppError('El nombre es requerido', 400);
    const id = uuidv4();
    await db.query(
      `INSERT INTO event_venues (id, tenant_id, name, description, address, city,
       latitude, longitude, contact_phone, contact_email, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.name, data.description || null, data.address || null, data.city || null,
       data.latitude ?? null, data.longitude ?? null, data.contactPhone || null,
       data.contactEmail || null, data.capacity || 0]
    );
    return this.findVenueById(id, tenantId);
  }

  async updateVenue(id: string, tenantId: string, data: Partial<CreateVenueDTO>) {
    await this.findVenueById(id, tenantId);
    const sets: string[] = []; const vals: any[] = [];
    const map: Record<string, string> = {
      name: 'name', description: 'description', address: 'address', city: 'city',
      latitude: 'latitude', longitude: 'longitude', contactPhone: 'contact_phone',
      contactEmail: 'contact_email', capacity: 'capacity',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((data as any)[key] !== undefined) { sets.push(`${col} = ?`); vals.push((data as any)[key]); }
    }
    if (sets.length === 0) return this.findVenueById(id, tenantId);
    vals.push(id, tenantId);
    await db.query(`UPDATE event_venues SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    return this.findVenueById(id, tenantId);
  }

  async deleteVenue(id: string, tenantId: string) {
    await db.query('UPDATE event_venues SET is_active = 0 WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return { deleted: true };
  }

  // ── Seat Maps ───────────────────────────────────
  async findSeatMaps(tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_seat_maps WHERE tenant_id = ? AND is_active = 1 ORDER BY name', [tenantId]
    );
    return rows;
  }

  async findSeatMapById(id: string, tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_seat_maps WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (!rows.length) throw new AppError('Mapa de asientos no encontrado', 404);
    return rows[0];
  }

  async createSeatMap(tenantId: string, data: { name: string; venueId: string; layout: any }) {
    const id = uuidv4();
    await db.query(
      'INSERT INTO event_seat_maps (id, tenant_id, venue_id, name, layout) VALUES (?, ?, ?, ?, ?)',
      [id, tenantId, data.venueId, data.name, JSON.stringify(data.layout || {})]
    );
    return this.findSeatMapById(id, tenantId);
  }

  async updateSeatMap(id: string, tenantId: string, data: { name?: string; layout?: any }) {
    const sets: string[] = []; const vals: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
    if (data.layout !== undefined) { sets.push('layout = ?'); vals.push(JSON.stringify(data.layout)); }
    if (sets.length === 0) return this.findSeatMapById(id, tenantId);
    vals.push(id, tenantId);
    await db.query(`UPDATE event_seat_maps SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    return this.findSeatMapById(id, tenantId);
  }

  async deleteSeatMap(id: string, tenantId: string) {
    await db.query('UPDATE event_seat_maps SET is_active = 0 WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return { deleted: true };
  }

  // ── Events CRUD ─────────────────────────────────
  async findAll(tenantId: string, filters: { status?: string; from?: string; to?: string; limit?: number; offset?: number }) {
    const conditions = ['e.tenant_id = ?', 'e.is_active = 1'];
    const values: any[] = [tenantId];
    if (filters.status) { conditions.push('e.status = ?'); values.push(filters.status); }
    if (filters.from)   { conditions.push('e.event_date >= ?'); values.push(filters.from); }
    if (filters.to)     { conditions.push('e.event_date <= ?'); values.push(filters.to); }
    const where = conditions.join(' AND ');
    const limit = Math.min(Number(filters.limit) || 50, 200);
    const offset = Number(filters.offset) || 0;

    const [total] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM merchant_events e WHERE ${where}`, values
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.*, ev.name AS venue_name
       FROM merchant_events e
       LEFT JOIN event_venues ev ON ev.id = e.venue_id
       WHERE ${where} ORDER BY e.event_date DESC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    return {
      data: rows,
      pagination: { limit, offset, total: (total as any)[0]?.total || 0 },
    };
  }

  async findById(id: string, tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.*, ev.name AS venue_name
       FROM merchant_events e
       LEFT JOIN event_venues ev ON ev.id = e.venue_id
       WHERE e.id = ? AND e.tenant_id = ? LIMIT 1`, [id, tenantId]
    );
    if (!rows.length) throw new AppError('Evento no encontrado', 404);
    const event = rows[0];
    const [tickets] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY sort_order', [id]
    );
    return { ...event, ticketTypes: tickets };
  }

  async findPublic(filters: { tenantId?: string; slug?: string; limit?: number; offset?: number }) {
    const conditions = ['e.status = ?', 'e.is_active = 1'];
    const values: any[] = ['published'];
    if (filters.tenantId) { conditions.push('e.tenant_id = ?'); values.push(filters.tenantId); }
    if (filters.slug) {
      conditions.push('t.slug = ?');
      values.push(filters.slug);
    }
    const where = conditions.join(' AND ');
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = Number(filters.offset) || 0;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.id, e.title, e.short_description, e.event_date, e.end_date, e.cover_image,
              e.category, e.tags, e.event_type, e.min_age,
              ev.name AS venue_name, ev.city,
              t.slug AS store_slug, t.name AS store_name,
              (SELECT MIN(price) FROM event_ticket_types WHERE event_id = e.id AND is_active = 1) AS price_from
       FROM merchant_events e
       JOIN tenants t ON t.id = e.tenant_id
       LEFT JOIN event_venues ev ON ev.id = e.venue_id
       ${conditions.includes('t.slug') ? '' : 'JOIN tenants t2 ON t2.id = e.tenant_id AND t2.status = \'activo\''}
       WHERE ${where} ORDER BY e.event_date ASC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    return { data: rows, limit, offset };
  }

  async findPublicBySlug(slug: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.*, ev.name AS venue_name, ev.address, ev.city, ev.latitude, ev.longitude
       FROM merchant_events e
       JOIN tenants t ON t.id = e.tenant_id AND t.slug = ?
       LEFT JOIN event_venues ev ON ev.id = e.venue_id
       WHERE e.status = 'published' AND e.is_active = 1 AND e.event_date >= CURDATE() - INTERVAL 1 DAY
       ORDER BY e.event_date ASC LIMIT 1`, [slug]
    );
    if (!rows.length) return null;
    const event = rows[0];
    const [tickets] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY sort_order', [event.id]
    );
    return { ...event, ticketTypes: tickets };
  }

  // Evento público específico (por comercio) — usado para carteleras con varios eventos.
  async findPublicEventById(slug: string, eventId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.*, ev.name AS venue_name, ev.address, ev.city, ev.latitude, ev.longitude
       FROM merchant_events e
       JOIN tenants t ON t.id = e.tenant_id AND t.slug = ?
       LEFT JOIN event_venues ev ON ev.id = e.venue_id
       WHERE e.id = ? AND e.status = 'published' AND e.is_active = 1
       LIMIT 1`, [slug, eventId]
    );
    if (!rows.length) return null;
    const event = rows[0];
    const [tickets] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY sort_order', [event.id]
    );
    return { ...event, ticketTypes: tickets };
  }

  async getAvailability(eventId: string, tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ett.*,
        (SELECT COALESCE(SUM(quantity), 0) FROM event_seat_holds WHERE ticket_type_id = ett.id AND expires_at > NOW()) AS active_holds
       FROM event_ticket_types ett
       WHERE ett.event_id = ? AND ett.tenant_id = ? AND ett.is_active = 1
       ORDER BY ett.sort_order`,
      [eventId, tenantId]
    );
    return rows.map((r: any) => ({
      ...r,
      available: r.capacity === 0 ? 9999 : r.capacity - r.tickets_sold - (r.active_holds || 0),
    }));
  }

  async create(tenantId: string, data: CreateEventDTO) {
    if (!data.title) throw new AppError('El título es requerido', 400);
    if (!data.eventDate) throw new AppError('La fecha de inicio es requerida', 400);
    const id = uuidv4();
    await db.query(
      `INSERT INTO merchant_events (id, tenant_id, venue_id, seat_map_id, title, description,
       short_description, event_date, end_date, location, cover_image, gallery, video_url,
       category, tags, ticket_price, capacity, refund_policy, min_age, max_tickets_per_user,
       is_featured, event_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [id, tenantId, data.venueId || null, data.seatMapId || null, data.title,
       data.description || null, data.shortDescription || null, data.eventDate,
       data.endDate || null, data.location || null, data.coverImage || null,
       data.gallery ? JSON.stringify(data.gallery) : null, data.videoUrl || null,
       data.category || null, data.tags ? JSON.stringify(data.tags) : null,
       data.ticketPrice ?? null, data.capacity ?? null, data.refundPolicy || 'none',
       data.minAge || 0, data.maxTicketsPerUser || 10, data.isFeatured ? 1 : 0,
       data.eventType || 'general']
    );
    return this.findById(id, tenantId);
  }

  async update(id: string, tenantId: string, data: Partial<CreateEventDTO>) {
    await this.findById(id, tenantId);
    const sets: string[] = []; const vals: any[] = [];
    const map: Record<string, string> = {
      title: 'title', description: 'description', shortDescription: 'short_description',
      eventDate: 'event_date', endDate: 'end_date', location: 'location',
      coverImage: 'cover_image', videoUrl: 'video_url', category: 'category',
      ticketPrice: 'ticket_price', capacity: 'capacity',
      refundPolicy: 'refund_policy', minAge: 'min_age',
      maxTicketsPerUser: 'max_tickets_per_user', eventType: 'event_type',
      venueId: 'venue_id', seatMapId: 'seat_map_id',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((data as any)[key] !== undefined) { sets.push(`${col} = ?`); vals.push((data as any)[key]); }
    }
    if (data.gallery !== undefined) { sets.push('gallery = ?'); vals.push(JSON.stringify(data.gallery)); }
    if (data.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(data.tags)); }
    if (data.isFeatured !== undefined) { sets.push('is_featured = ?'); vals.push(data.isFeatured ? 1 : 0); }
    if (sets.length === 0) return this.findById(id, tenantId);
    vals.push(id, tenantId);
    await db.query(`UPDATE merchant_events SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    return this.findById(id, tenantId);
  }

  async delete(id: string, tenantId: string) {
    await db.query('UPDATE merchant_events SET is_active = 0 WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return { deleted: true };
  }

  async publish(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    const [tt] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM event_ticket_types WHERE event_id = ? AND is_active = 1', [id]
    );
    if (((tt as any)[0]?.cnt || 0) === 0) {
      throw new AppError('El evento necesita al menos un tipo de entrada activo para publicarse', 400);
    }
    await db.query('UPDATE merchant_events SET status = ? WHERE id = ?', ['published', id]);
    return this.findById(id, tenantId);
  }

  async unpublish(id: string, tenantId: string) {
    await db.query('UPDATE merchant_events SET status = ? WHERE id = ? AND tenant_id = ?', ['draft', id, tenantId]);
    return { unpublished: true };
  }

  // ── Ticket Types ────────────────────────────────
  async findTicketTypes(eventId: string, tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_ticket_types WHERE event_id = ? AND tenant_id = ? AND is_active = 1 ORDER BY sort_order',
      [eventId, tenantId]
    );
    return rows;
  }

  async createTicketType(eventId: string, tenantId: string, data: CreateTicketTypeDTO) {
    const id = uuidv4();
    await db.query(
      `INSERT INTO event_ticket_types (id, event_id, tenant_id, name, description, price, capacity, max_per_order, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, eventId, tenantId, data.name, data.description || null, data.price, data.capacity || 0, data.maxPerOrder || 10, data.sortOrder || 0]
    );
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_ticket_types WHERE id = ?', [id]
    );
    return rows[0];
  }

  async updateTicketType(id: string, tenantId: string, data: Partial<CreateTicketTypeDTO>) {
    const sets: string[] = []; const vals: any[] = [];
    const map: Record<string, string> = {
      name: 'name', description: 'description', price: 'price',
      capacity: 'capacity', maxPerOrder: 'max_per_order', sortOrder: 'sort_order',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((data as any)[key] !== undefined) { sets.push(`${col} = ?`); vals.push((data as any)[key]); }
    }
    if (sets.length === 0) {
      const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM event_ticket_types WHERE id = ?', [id]);
      return rows[0];
    }
    vals.push(id, tenantId);
    await db.query(`UPDATE event_ticket_types SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM event_ticket_types WHERE id = ?', [id]);
    return rows[0];
  }

  async deleteTicketType(id: string, tenantId: string) {
    await db.query('UPDATE event_ticket_types SET is_active = 0 WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return { deleted: true };
  }

  // ── Bookings Admin ──────────────────────────────
  async findBookings(eventId: string, tenantId: string, params?: { limit?: number; offset?: number }) {
    const limit = Math.min(Number(params?.limit) || 50, 200);
    const offset = Number(params?.offset) || 0;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT eb.*, GROUP_CONCAT(CONCAT(ebi.ticket_code, '|', ebi.status, '|', ebi.seat_label) SEPARATOR ';;') AS items_raw
       FROM event_bookings eb
       LEFT JOIN event_booking_items ebi ON ebi.booking_id = eb.id
       WHERE eb.event_id = ? AND eb.tenant_id = ?
       GROUP BY eb.id ORDER BY eb.created_at DESC LIMIT ? OFFSET ?`,
      [eventId, tenantId, limit, offset]
    );
    return { data: rows, limit, offset };
  }

  // ── Analytics ───────────────────────────────────
  async getAnalytics(eventId: string, tenantId: string) {
    const [eventRows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM merchant_events WHERE id = ? AND tenant_id = ?', [eventId, tenantId]
    );
    if (!eventRows.length) throw new AppError('Evento no encontrado', 404);

    const queries = {
      sales: `SELECT COUNT(*) AS total_bookings, COALESCE(SUM(total_amount), 0) AS total_revenue, COALESCE(SUM(quantity), 0) AS total_sold
              FROM event_bookings WHERE event_id = ? AND status = 'confirmed'`,
      checkins: `SELECT COUNT(*) AS total_checkins FROM event_booking_items WHERE booking_id IN
                  (SELECT id FROM event_bookings WHERE event_id = ? AND status = 'confirmed') AND status = 'used'`,
      byTicketType: `SELECT ett.name, ett.tickets_sold, ett.capacity, ett.price,
                      COALESCE(SUM(ebi.price), 0) AS revenue
                      FROM event_ticket_types ett
                      LEFT JOIN event_booking_items ebi ON ebi.ticket_type_id = ett.id
                      LEFT JOIN event_bookings eb ON eb.id = ebi.booking_id AND eb.status = 'confirmed'
                      WHERE ett.event_id = ? AND ett.is_active = 1
                      GROUP BY ett.id ORDER BY ett.sort_order`,
      byHour: `SELECT HOUR(eb.created_at) AS hour, COUNT(*) AS count
                FROM event_bookings eb WHERE eb.event_id = ? AND eb.status = 'confirmed'
                GROUP BY HOUR(created_at) ORDER BY hour`,
      byGateway: `SELECT gateway, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS revenue
                   FROM event_payment_transactions WHERE booking_id IN
                   (SELECT id FROM event_bookings WHERE event_id = ?)
                   AND status = 'approved' GROUP BY gateway`,
    };

    const [sales] = await db.query<RowDataPacket[]>(queries.sales, [eventId]);
    const [checkins] = await db.query<RowDataPacket[]>(queries.checkins, [eventId]);
    const [byTicketType] = await db.query<RowDataPacket[]>(queries.byTicketType, [eventId]);
    const [byHour] = await db.query<RowDataPacket[]>(queries.byHour, [eventId]);
    const [byGateway] = await db.query<RowDataPacket[]>(queries.byGateway, [eventId]);

    return {
      summary: {
        total_sold: (sales[0] as any)?.total_sold || 0,
        total_revenue: Number((sales[0] as any)?.total_revenue || 0),
        total_bookings: (sales[0] as any)?.total_bookings || 0,
        total_checkins: (checkins[0] as any)?.total_checkins || 0,
      },
      by_ticket_type: byTicketType,
      sales_by_hour: byHour,
      by_gateway: byGateway,
    };
  }
}

export const eventsService = new EventsService();
