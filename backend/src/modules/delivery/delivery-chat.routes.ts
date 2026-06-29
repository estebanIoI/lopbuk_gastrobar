import { Router, Response } from 'express';
import { param } from 'express-validator';
import { authenticate, AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

// =============================================================================
// GET /api/delivery-chat/room/:orderId — obtener o crear room para un pedido
// =============================================================================
router.get(
  '/room/:orderId',
  [param('orderId').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const { orderId } = req.params;
      const tenantId = req.user!.tenantId;

      // Verificar que el pedido existe y pertenece al tenant
      const [orderRows] = await pool.query(
        `SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
                o.customer_phone as customerPhone, o.delivery_status as deliveryStatus,
                o.delivery_driver_id as driverId, u.name as driverName
         FROM storefront_orders o
         LEFT JOIN users u ON u.id = o.delivery_driver_id
         WHERE o.id = ? ${tenantId ? 'AND o.tenant_id = ?' : ''}
         LIMIT 1`,
        tenantId ? [orderId, tenantId] : [orderId]
      ) as any;

      if (!orderRows.length) {
        res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        return;
      }

      const order = orderRows[0];

      // Buscar room existente o crear uno nuevo
      let [roomRows] = await pool.query(
        'SELECT id, status, created_at as createdAt FROM delivery_chat_rooms WHERE order_id = ? LIMIT 1',
        [orderId]
      ) as any;

      if (!roomRows.length) {
        const roomId = uuidv4();
        await pool.query(
          'INSERT INTO delivery_chat_rooms (id, order_id, tenant_id, status) VALUES (?, ?, ?, ?)',
          [roomId, orderId, tenantId || '', 'active']
        );
        roomRows = [{ id: roomId, status: 'active', createdAt: new Date().toISOString() }];
      }

      res.json({
        success: true,
        data: {
          room: roomRows[0],
          order,
        },
      });
    } catch (error: any) {
      console.error('Get chat room error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener sala de chat' });
    }
  }
);

// =============================================================================
// GET /api/delivery-chat/room/:roomId/messages — listar mensajes
// =============================================================================
router.get(
  '/room/:roomId/messages',
  [param('roomId').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const { roomId } = req.params;
      const limit = Math.min(Number(req.query.limit || 50), 100);
      const before = req.query.before as string | undefined;

      let sql = `SELECT id, room_id as roomId, sender_id as senderId, sender_name as senderName,
                        sender_role as senderRole, message, message_type as messageType,
                        read_at as readAt, created_at as createdAt
                 FROM delivery_chat_messages WHERE room_id = ?`;
      const params: any[] = [roomId];
      if (before) { sql += ' AND created_at < ?'; params.push(before); }
      sql += ' ORDER BY created_at ASC LIMIT ?';
      params.push(limit);

      const [messages] = await pool.query(sql, params) as any;

      res.json({ success: true, data: messages });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Error al obtener mensajes' });
    }
  }
);

// =============================================================================
// POST /api/delivery-chat/room/:roomId/messages — enviar mensaje
// El socket emite a todos en el room en tiempo real.
// =============================================================================
router.post(
  '/room/:roomId/messages',
  [param('roomId').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const { roomId } = req.params;
      const userId = req.user!.userId!;
      const role = req.user!.role || 'unknown';
      const { message, messageType = 'text' } = req.body as { message: string; messageType?: string };

      if (!message?.trim() && messageType === 'text') {
        res.status(400).json({ success: false, error: 'Mensaje no puede estar vacío' });
        return;
      }

      // Verificar room existe y está activo
      const [roomRows] = await pool.query(
        'SELECT id, status FROM delivery_chat_rooms WHERE id = ?',
        [roomId]
      ) as any;

      if (!roomRows.length) {
        res.status(404).json({ success: false, error: 'Sala no encontrada' });
        return;
      }
      if (roomRows[0].status === 'closed') {
        res.status(400).json({ success: false, error: 'La sala está cerrada' });
        return;
      }

      // Resolver nombre del usuario
      const [userRows] = await pool.query(
        'SELECT name FROM users WHERE id = ? LIMIT 1',
        [userId]
      ) as any;
      const senderName = userRows[0]?.name || 'Usuario';

      const senderRole = role === 'repartidor' ? 'repartidor'
        : (role === 'superadmin' || role === 'comerciante') ? 'comercio'
        : 'sistema';

      const msgId = uuidv4();
      await pool.query(
        `INSERT INTO delivery_chat_messages
           (id, room_id, sender_id, sender_name, sender_role, message, message_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [msgId, roomId, userId, senderName, senderRole, message.trim(), messageType]
      );

      const newMsg = {
        id: msgId, roomId, senderId: userId, senderName, senderRole,
        message: message.trim(), messageType,
        readAt: null, createdAt: new Date().toISOString(),
      };

      // Emitir via Socket.IO (si el io está disponible globalmente)
      const io = (global as any).__deliveryIO;
      if (io) {
        io.to(`delivery-chat:${roomId}`).emit('delivery-message', newMsg);
      }

      res.json({ success: true, data: newMsg });
    } catch (error: any) {
      console.error('Send message error:', error);
      res.status(500).json({ success: false, error: 'Error al enviar mensaje' });
    }
  }
);

// =============================================================================
// POST /api/delivery-chat/room/:roomId/read — marcar mensajes como leídos
// =============================================================================
router.post(
  '/room/:roomId/read',
  [param('roomId').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const { roomId } = req.params;
      const userId = req.user!.userId!;

      await pool.query(
        'UPDATE delivery_chat_messages SET read_at = NOW() WHERE room_id = ? AND sender_id != ? AND read_at IS NULL',
        [roomId, userId]
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Error al marcar como leído' });
    }
  }
);

// =============================================================================
// GET /api/delivery-chat/active-rooms — rooms activos del tenant (ops center)
// =============================================================================
router.get(
  '/active-rooms',
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      const [rooms] = await pool.query(
        `SELECT r.id, r.order_id as orderId, r.status, r.created_at as createdAt,
                o.order_number as orderNumber, o.customer_name as customerName,
                o.delivery_status as deliveryStatus,
                u.name as driverName,
                (SELECT message FROM delivery_chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
                (SELECT created_at FROM delivery_chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as lastMessageAt,
                (SELECT COUNT(*) FROM delivery_chat_messages WHERE room_id = r.id AND read_at IS NULL AND sender_role != 'comercio') as unreadCount
         FROM delivery_chat_rooms r
         LEFT JOIN storefront_orders o ON o.id = r.order_id
         LEFT JOIN users u ON u.id = o.delivery_driver_id
         WHERE r.tenant_id = ? AND r.status = 'active'
         ORDER BY lastMessageAt DESC
         LIMIT 50`,
        [tenantId]
      ) as any;

      res.json({ success: true, data: rooms });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Error al obtener salas activas' });
    }
  }
);

export default router;
