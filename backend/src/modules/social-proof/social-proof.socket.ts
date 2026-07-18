import { Server, Socket } from 'socket.io';

/**
 * Presencia de espectadores por producto (Social Proof · datos reales).
 *
 * Los clientes se unen a la sala `product:<id>` mientras miran un producto. El
 * conteo de espectadores es el TAMAÑO REAL de la sala — no un número inventado.
 * Al desconectarse o salir del producto, dejan la sala y el conteo baja.
 *
 * Se emite `viewers` a la sala cada vez que alguien entra/sale, para que el PDP
 * refleje el número en vivo sin sondear.
 */

let nsp: ReturnType<Server['of']> | null = null;

const PRODUCT_ROOM = (productId: string) => `product:${productId}`;

/** Espectadores concurrentes reales de un producto (tamaño de la sala). */
export function getProductViewers(productId: string): number {
  if (!nsp) return 0;
  const room = nsp.adapter.rooms.get(PRODUCT_ROOM(productId));
  return room ? room.size : 0;
}

function emitViewers(productId: string) {
  if (!nsp) return;
  nsp.to(PRODUCT_ROOM(productId)).emit('viewers', { productId, viewers: getProductViewers(productId) });
}

export function initSocialProofSocket(io: Server) {
  nsp = io.of('/social-proof');

  nsp.on('connection', (socket: Socket) => {
    let currentProduct: string | null = null;

    socket.on('view-product', (productId: string) => {
      if (!productId) return;
      // Un socket mira un producto a la vez: sale del anterior.
      if (currentProduct && currentProduct !== productId) {
        socket.leave(PRODUCT_ROOM(currentProduct));
        emitViewers(currentProduct);
      }
      currentProduct = productId;
      socket.join(PRODUCT_ROOM(productId));
      emitViewers(productId);
    });

    socket.on('leave-product', (productId: string) => {
      const pid = productId || currentProduct;
      if (pid) {
        socket.leave(PRODUCT_ROOM(pid));
        if (pid === currentProduct) currentProduct = null;
        emitViewers(pid);
      }
    });

    socket.on('disconnect', () => {
      if (currentProduct) {
        // La sala ya se limpió al desconectar; recalcular y emitir a los que queden.
        emitViewers(currentProduct);
      }
    });
  });
}
