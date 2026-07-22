/**
 * Permisos granulares del sistema.
 * Un cargo de empleado puede tener cualquier combinación de estos permisos.
 * Los roles 'comerciante' y 'superadmin' tienen acceso total sin importar permisos.
 */
export const PERMISSIONS = {
  VENTAS: 'ventas',               // Crear y consultar ventas
  COMPRAS: 'compras',             // Crear y consultar compras / proveedores
  INVENTARIO: 'inventario',       // Ver y ajustar inventario / movimientos
  CLIENTES: 'clientes',           // Gestionar clientes y créditos
  CREDITOS: 'creditos',           // Gestionar fiados y créditos
  REPORTES: 'reportes',           // Ver dashboard y reportes
  CAJA: 'caja',                   // Abrir/cerrar sesiones de caja
  EMPLEADOS: 'empleados',         // Ver lista de empleados
  CONFIGURACION: 'configuracion', // Configuración de tienda / categorías
  PEDIDOS: 'pedidos',             // Ver y gestionar pedidos del storefront
  CATEGORIAS: 'categorias',       // Gestionar categorías de productos
  RECETAS: 'recetas',             // Gestionar recetas / productos compuestos
  SERVICIOS: 'servicios',         // Gestionar servicios
  // Ventas — visibilidad (política de autorización a nivel de función / ownership).
  SALES_READ_ALL: 'sales.read.all', // Ver TODAS las ventas del tenant
  SALES_READ_OWN: 'sales.read.own', // Ver solo las ventas propias (seller_id = usuario)
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/**
 * Política centralizada de lectura de ventas (BFLA).
 * - `comerciante`/`superadmin`: acceso total al tenant (convención del sistema).
 * - permiso explícito `sales.read.all`: acceso total (futuro modelo por permisos finos).
 * - `vendedor`: acotado a lo suyo hasta migrar a permisos finos.
 * - cualquier otro rol autenticado con acceso a ventas: visión del tenant (comportamiento actual).
 * No depende de un `role === 'vendedor'` disperso: un solo punto de verdad, listo para crecer.
 */
export function canReadAllSales(user: { role?: string | null; permissions?: string[] | null }): boolean {
  if (user.role === 'superadmin' || user.role === 'comerciante') return true;
  const perms = user.permissions ?? [];
  if (perms.includes(PERMISSIONS.SALES_READ_ALL)) return true;
  if (user.role === 'vendedor') return false;
  return true;
}
