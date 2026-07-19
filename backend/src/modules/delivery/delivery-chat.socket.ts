import { Server as SocketIOServer } from 'socket.io';

/**
 * Delivery Chat Socket.IO module.
 * Rooms use namespace: "delivery-chat:<roomId>"
 *
 * Events emitted FROM client:
 *   join-delivery-chat  { roomId }
 *   leave-delivery-chat { roomId }
 *   delivery-typing     { roomId, senderName, isTyping }
 *
 * Events broadcast TO clients in room:
 *   delivery-message    { ...message }        — new message
 *   delivery-typing     { senderName, isTyping }
 *   delivery-read       { roomId, userId }
 *   delivery-status     { orderId, newStatus } — delivery status change
 */
export function initDeliveryChatSocket(io: SocketIOServer): void {
  // Store io globally so HTTP routes can emit
  (global as any).__deliveryIO = io;

  io.on('connection', (socket) => {
    // ── Join a delivery chat room ──────────────────────────────────────────
    socket.on('join-delivery-chat', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      socket.join(`delivery-chat:${roomId}`);
    });

    // ── Leave a delivery chat room ─────────────────────────────────────────
    socket.on('leave-delivery-chat', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      socket.leave(`delivery-chat:${roomId}`);
    });

    // ── Typing indicator ───────────────────────────────────────────────────
    socket.on(
      'delivery-typing',
      ({ roomId, senderName, isTyping }: { roomId: string; senderName: string; isTyping: boolean }) => {
        if (!roomId) return;
        socket.to(`delivery-chat:${roomId}`).emit('delivery-typing', { senderName, isTyping });
      }
    );

    // ── Courier location update (broadcast to ops viewers) ──────────────────
    socket.on(
      'courier-location',
      ({ courierId, lat, lng, tenantId }: { courierId: string; lat: number; lng: number; tenantId: string }) => {
        socket.to(`ops:${tenantId}`).emit('courier-location', { courierId, lat, lng });
      }
    );

    // ── Join sala de seguimiento del cliente (público, por tracking token) ──
    // El token ya es el secreto del pedido: quien lo tiene puede ver el estado.
    // Solo recibe eventos; nunca puede emitir hacia esta sala.
    socket.on('join-tracking', ({ token }: { token: string }) => {
      if (!token) return;
      socket.join(`tracking:${token}`);
    });

    socket.on('leave-tracking', ({ token }: { token: string }) => {
      if (!token) return;
      socket.leave(`tracking:${token}`);
    });

    // ── Join ops center room (superadmin / comerciante) ────────────────────
    socket.on('join-ops', ({ tenantId }: { tenantId: string }) => {
      if (!tenantId) return;
      socket.join(`ops:${tenantId}`);
    });

    // ── Join como repartidor: se une SOLO a las salas ops de sus comercios ──
    // Repartidor de un comercio → su tenant. Repartidor de plataforma (tenant NULL)
    // → los comercios asignados en courier_tenants. La resolución es server-side
    // (no confía en una lista enviada por el cliente).
    socket.on('join-courier', async ({ userId }: { userId: string }) => {
      if (!userId) { socket.emit('courier-joined', { tenantIds: [] }); return; }
      try {
        const pool = (await import('../../config/database')).default;
        const [uRows] = await pool.query(
          "SELECT tenant_id FROM users WHERE id = ? AND role = 'repartidor' AND is_active = 1",
          [userId]
        ) as any;
        if (!uRows.length) { socket.emit('courier-joined', { tenantIds: [] }); return; }
        let tenantIds: string[];
        if (uRows[0].tenant_id) {
          tenantIds = [uRows[0].tenant_id];
        } else {
          const [ctRows] = await pool.query(
            'SELECT tenant_id FROM courier_tenants WHERE courier_user_id = ?',
            [userId]
          ) as any;
          tenantIds = (ctRows as any[]).map((r) => r.tenant_id);
        }
        for (const tid of tenantIds) socket.join(`ops:${tid}`);
        socket.emit('courier-joined', { tenantIds });
      } catch {
        socket.emit('courier-joined', { tenantIds: [] });
      }
    });
  });
}
