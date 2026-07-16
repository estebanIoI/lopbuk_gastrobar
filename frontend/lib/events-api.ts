const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

async function evt<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ success: boolean; data?: T; error?: string; pagination?: any }> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers, credentials: 'include' })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || data.message || 'Error' }
    return data
  } catch {
    return { success: false, error: 'Error de conexión' }
  }
}

export const eventsApi = {
  // ── Public ─────────────────────────────────────
  getPublicEvents: (slug: string, params?: Record<string, string>) =>
    evt(`/events/public?slug=${slug}${params ? '&' + new URLSearchParams(params) : ''}`),
  getPublicEvent: (slug: string, eventId?: string) =>
    evt(`/events/public/${slug}${eventId ? `?eventId=${eventId}` : ''}`),
  getAvailability: (slug: string, eventId?: string) =>
    evt(`/events/public/${slug}/availability${eventId ? `?eventId=${eventId}` : ''}`),
  createHold: (slug: string, data: { ticketTypeId: string; quantity: number; eventId?: string; traceId?: string }) =>
    evt(`/events/public/${slug}/hold`, { method: 'POST', body: JSON.stringify(data) }),
  releaseHold: (slug: string, holdToken: string) =>
    evt(`/events/public/${slug}/release-hold`, { method: 'POST', body: JSON.stringify({ holdToken }) }),
  createCheckout: (slug: string, data: {
    holdToken: string; customerName: string; customerEmail?: string;
    customerPhone?: string; customerDocument?: string; couponCode?: string; redirectUrl?: string; eventId?: string;
  }) => evt(`/events/public/${slug}/checkout`, { method: 'POST', body: JSON.stringify(data) }),
  getBookingStatus: (reference: string) =>
    evt(`/events/public/booking/${reference}`),
  validateCoupon: (slug: string, data: { code: string; ticketTypeId: string; quantity: number; eventId?: string }) =>
    evt(`/events/public/${slug}/validate-coupon`, { method: 'POST', body: JSON.stringify(data) }),

  // ── Admin Events ───────────────────────────────
  getEvents: (params?: Record<string, string>) =>
    evt(`/events?${new URLSearchParams(params || {})}`),
  getEvent: (id: string) =>
    evt(`/events/${id}`),
  get: (id: string) =>
    evt(`/events/${id}`),
  createEvent: (data: any) =>
    evt('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id: string, data: any) =>
    evt(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id: string) =>
    evt(`/events/${id}`, { method: 'DELETE' }),
  publishEvent: (id: string) =>
    evt(`/events/${id}/publish`, { method: 'PATCH' }),
  unpublishEvent: (id: string) =>
    evt(`/events/${id}/unpublish`, { method: 'PATCH' }),

  // ── Venues ─────────────────────────────────────
  getVenues: () => evt('/events/venues/list'),
  createVenue: (data: any) =>
    evt('/events/venues', { method: 'POST', body: JSON.stringify(data) }),
  updateVenue: (id: string, data: any) =>
    evt(`/events/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVenue: (id: string) =>
    evt(`/events/venues/${id}`, { method: 'DELETE' }),

  // ── Seat Maps ──────────────────────────────────
  getSeatMaps: () => evt('/events/seat-maps/list'),
  createSeatMap: (data: any) =>
    evt('/events/seat-maps', { method: 'POST', body: JSON.stringify(data) }),

  // ── Ticket Types ───────────────────────────────
  getTicketTypes: (eventId: string) =>
    evt(`/events/${eventId}/ticket-types`),
  createTicketType: (eventId: string, data: any) =>
    evt(`/events/${eventId}/ticket-types`, { method: 'POST', body: JSON.stringify(data) }),
  updateTicketType: (eventId: string, ttid: string, data: any) =>
    evt(`/events/${eventId}/ticket-types/${ttid}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTicketType: (eventId: string, ttid: string) =>
    evt(`/events/${eventId}/ticket-types/${ttid}`, { method: 'DELETE' }),

  // ── Check-in ───────────────────────────────────
  validateTicket: (eventId: string, code: string) =>
    evt(`/events/checkin/${eventId}/ticket/${code}`),
  checkin: (eventId: string, code: string) =>
    evt(`/events/checkin/${eventId}/ticket/${code}`, { method: 'POST' }),
  batchSyncCheckin: (eventId: string, checkins: { ticket_code: string; checked_in_at: string }[]) =>
    evt(`/events/checkin/${eventId}/batch-sync`, { method: 'POST', body: JSON.stringify({ checkins }) }),
  checkinStats: (eventId: string) =>
    evt(`/events/checkin/${eventId}/stats`),

  // ── Bookings ───────────────────────────────────
  getBookings: (eventId: string, params?: Record<string, string>) =>
    evt(`/events/${eventId}/bookings?${new URLSearchParams(params || {})}`),

  // ── Analytics ──────────────────────────────────
  getAnalytics: (eventId: string) =>
    evt(`/events/${eventId}/analytics`),
  getTimeline: (eventId: string) =>
    evt(`/events/${eventId}/timeline`),

  // ── Transfer ───────────────────────────────────
  transferTicket: (data: { itemId: string; toName: string; toEmail?: string }) =>
    evt('/events/transfer', { method: 'POST', body: JSON.stringify(data) }),
}
