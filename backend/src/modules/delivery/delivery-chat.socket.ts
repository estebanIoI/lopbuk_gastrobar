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

    // ── Join ops center room (superadmin / comerciante) ────────────────────
    socket.on('join-ops', ({ tenantId }: { tenantId: string }) => {
      if (!tenantId) return;
      socket.join(`ops:${tenantId}`);
    });
  });
}
