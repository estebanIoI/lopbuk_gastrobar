import { io, Socket } from 'socket.io-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '')

let scannerSocket: Socket | null = null

export function getScannerSocket(): Socket {
  if (!scannerSocket) {
    scannerSocket = io(`${SOCKET_URL}/scanner`, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    })
  }
  return scannerSocket
}

export function disconnectScannerSocket() {
  if (scannerSocket) {
    scannerSocket.disconnect()
    scannerSocket = null
  }
}

// ── Delivery / ops (repartidor de plataforma): namespace raíz ──
let deliverySocket: Socket | null = null

export function getDeliverySocket(): Socket {
  if (!deliverySocket) {
    deliverySocket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })
  }
  return deliverySocket
}

export function disconnectDeliverySocket() {
  if (deliverySocket) {
    deliverySocket.disconnect()
    deliverySocket = null
  }
}

// ── Vault / Drops (V2): contador de cupos en vivo ──
let vaultSocket: Socket | null = null

export function getVaultSocket(): Socket {
  if (!vaultSocket) {
    vaultSocket = io(`${SOCKET_URL}/vault`, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })
  }
  return vaultSocket
}

// ── RestBar / Terminal POS — multi-waiter real-time ──
let restbarSocket: Socket | null = null

export function getRestbarSocket(): Socket {
  if (!restbarSocket) {
    restbarSocket = io(`${SOCKET_URL}/restbar`, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })
  }
  return restbarSocket
}

export function disconnectRestbarSocket() {
  if (restbarSocket) {
    restbarSocket.disconnect()
    restbarSocket = null
  }
}
