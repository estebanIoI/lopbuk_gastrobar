import { Server, Socket } from 'socket.io';

let nsp: ReturnType<Server['of']> | null = null;

export function initRestbarSocket(io: Server) {
  nsp = io.of('/restbar');

  nsp.on('connection', (socket: Socket) => {
    console.log(`[restbar:socket] connected ${socket.id}`);

    socket.on('join-table', (orderId: string) => {
      if (orderId) {
        socket.join(`order:${orderId}`);
        console.log(`[restbar:socket] ${socket.id} joined order:${orderId}`);
      }
    });

    socket.on('leave-table', (orderId: string) => {
      if (orderId) {
        socket.leave(`order:${orderId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[restbar:socket] disconnected ${socket.id}`);
    });
  });
}

export function emitOrderChanged(orderId: string) {
  if (nsp) {
    nsp.to(`order:${orderId}`).emit('order-changed', { orderId });
  }
}

export function emitItemStatusChanged(orderId: string, itemId: string, status: string) {
  if (nsp) {
    nsp.to(`order:${orderId}`).emit('item-status-changed', { orderId, itemId, status });
  }
}
