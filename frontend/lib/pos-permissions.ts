/**
 * Perfiles por rol del POS táctil (RestBar).
 *
 * Refleja en la UI las mismas fronteras que ya aplica el backend
 * (restbar.routes.ts): CASHIER_ROLES para cobrar, WAITER_ROLES para
 * agregar/enviar/imprimir, ADMIN_ROLES para gestión de mesas/descuentos.
 * Así cada usuario ve únicamente sus herramientas — interfaz más limpia y
 * una capa extra de seguridad (defensa en profundidad; el backend sigue
 * validando con 403 si algo se saltara la UI).
 *
 * Nota: el sistema no tiene roles literales "capitán" ni "gerente"; sus
 * capacidades (mover/fusionar mesas, descuentos, anulaciones, auditoría) se
 * asignan a los roles administrativos (comerciante / administrador_rb / superadmin).
 */

const ADMIN_ROLES = ['superadmin', 'comerciante', 'administrador_rb']

export interface PosCapabilities {
  canAddItems: boolean       // agregar productos a la comanda
  canSend: boolean           // enviar a cocina / bar
  canPrintBill: boolean      // imprimir pre-cuenta (CUENTA)
  canPay: boolean            // cobrar (COBRAR + modal de pago)
  canManageTables: boolean   // cambiar / mover / fusionar mesas (capitán/admin)
  canDiscount: boolean       // aplicar descuentos (gerente/admin)
  canVoidSent: boolean       // anular ítems ya enviados a cocina (gerente/admin)
  profileLabel: string       // etiqueta legible del perfil activo
}

/** Etiqueta legible del perfil según el rol. */
function labelFor(role: string): string {
  switch (role) {
    case 'superadmin':
    case 'comerciante':
    case 'administrador_rb': return 'Administrador'
    case 'cajero': return 'Cajero'
    case 'vendedor': return 'Vendedor'
    case 'mesero': return 'Mesero'
    default: return 'Operador'
  }
}

export function posCaps(role?: string | null): PosCapabilities {
  const r = (role ?? '').trim()
  const isAdmin = ADMIN_ROLES.includes(r)
  const isWaiter = isAdmin || ['mesero', 'vendedor', 'cajero'].includes(r)
  const isCashier = isAdmin || ['cajero', 'vendedor'].includes(r)

  return {
    canAddItems: isWaiter,
    canSend: isWaiter,
    canPrintBill: isWaiter,     // el backend permite CUENTA a mesero y cajero
    canPay: isCashier,          // COBRAR restringido a cajero/vendedor/admin
    canManageTables: isAdmin,   // capitán/admin
    canDiscount: isAdmin,       // gerente/admin
    canVoidSent: isAdmin,       // gerente/admin
    profileLabel: labelFor(r),
  }
}
