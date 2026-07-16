export interface CreateEventDTO {
  venueId?: string | null;
  seatMapId?: string | null;
  title: string;
  description?: string;
  shortDescription?: string;
  eventDate: string;
  endDate?: string;
  location?: string;
  coverImage?: string;
  gallery?: string[];
  videoUrl?: string;
  category?: string;
  tags?: string[];
  ticketPrice?: number;
  capacity?: number;
  refundPolicy?: 'none' | '24h' | '48h' | 'auto' | 'manual';
  minAge?: number;
  maxTicketsPerUser?: number;
  isFeatured?: boolean;
  eventType?: 'general' | 'zones' | 'seats';
}

export interface CreateVenueDTO {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;
}

export interface CreateTicketTypeDTO {
  name: string;
  description?: string;
  price: number;
  capacity?: number;
  maxPerOrder?: number;
  sortOrder?: number;
}

export interface HoldRequest {
  ticketTypeId: string;
  quantity: number;
  seatIds?: string[];
  customerSession?: string;
  traceId?: string;
}

export interface CheckoutRequest {
  holdToken: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerDocument?: string;
  couponCode?: string;
  redirectUrl?: string;
}

export interface BookingItem {
  id: string;
  bookingId: string;
  ticketTypeId?: string;
  zoneId?: string;
  seatLabel?: string;
  rowLabel?: string;
  price: number;
  ticketCode: string;
  qrData: string;
  status: 'active' | 'used' | 'cancelled' | 'transferred';
  ticketPdfUrl?: string;
  ticketWalletUrl?: string;
  guestName?: string;
  checkedInAt?: string;
}
