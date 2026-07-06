export interface ModuleDef {
  id: string
  name: string
  group: string
  groupLabel: string
  defaultOn: boolean
}

export const ALL_MODULES: ModuleDef[] = [
  // Gestión
  { id: 'dashboard',     name: 'Dashboard',        group: 'core',      groupLabel: 'Gestión',        defaultOn: true  },
  { id: 'inventory',     name: 'Inventario',        group: 'core',      groupLabel: 'Gestión',        defaultOn: true  },
  { id: 'purchases',     name: 'Compras',           group: 'core',      groupLabel: 'Gestión',        defaultOn: true  },
  { id: 'recipes',       name: 'Recetas BOM',       group: 'core',      groupLabel: 'Gestión',        defaultOn: false },
  // Gastrobar
  { id: 'gastrobar-ops', name: 'Centro de Mando',   group: 'gastrobar', groupLabel: 'Gastrobar Ops',  defaultOn: false },
  { id: 'merma',         name: 'Control de Merma',  group: 'gastrobar', groupLabel: 'Gastrobar Ops',  defaultOn: false },
  // Operaciones
  { id: 'restbar',       name: 'RestBar / Mesas',   group: 'ops',       groupLabel: 'Operaciones',    defaultOn: false },
  { id: 'pos',           name: 'Punto de Venta',    group: 'ops',       groupLabel: 'Operaciones',    defaultOn: true  },
  { id: 'cash-register', name: 'Caja',              group: 'ops',       groupLabel: 'Operaciones',    defaultOn: true  },
  { id: 'invoices',      name: 'Facturación',       group: 'ops',       groupLabel: 'Operaciones',    defaultOn: true  },
  { id: 'customers',     name: 'Clientes',          group: 'ops',       groupLabel: 'Operaciones',    defaultOn: true  },
  { id: 'fiados',        name: 'Fiados / Crédito',  group: 'ops',       groupLabel: 'Operaciones',    defaultOn: true  },
  { id: 'vendedores',    name: 'Empleados',         group: 'ops',       groupLabel: 'Operaciones',    defaultOn: true  },
  { id: 'organigrama',   name: 'Organigrama',       group: 'ops',       groupLabel: 'Operaciones',    defaultOn: true  },
  { id: 'fleet',         name: 'Mi Flota',          group: 'ops',       groupLabel: 'Operaciones',    defaultOn: false },
  { id: 'realestate',    name: 'Inmobiliaria',      group: 'ops',       groupLabel: 'Operaciones',    defaultOn: false },
  { id: 'workorders',    name: 'Órdenes de Trabajo', group: 'ops',      groupLabel: 'Operaciones',    defaultOn: false },
  { id: 'gym',           name: 'Gimnasio',          group: 'ops',       groupLabel: 'Operaciones',    defaultOn: false },
  // Tienda Online
  { id: 'tienda',        name: 'Mi Tienda',         group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  { id: 'pedidos',       name: 'Pedidos Online',    group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  { id: 'cupones',       name: 'Cupones',           group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  { id: 'reviews',       name: 'Reseñas',           group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  { id: 'services',      name: 'Servicios',         group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  { id: 'cartilla',      name: 'Cartilla Digital',  group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  { id: 'perfil',        name: 'Perfil público',    group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  { id: 'servicios-pro', name: 'Servicios Pro',     group: 'tienda',    groupLabel: 'Tienda Online',  defaultOn: false },
  // Reportes
  { id: 'history',       name: 'Historial',         group: 'reports',   groupLabel: 'Reportes',       defaultOn: true  },
  { id: 'analytics',     name: 'Análisis',          group: 'reports',   groupLabel: 'Reportes',       defaultOn: true  },
  { id: 'finances',      name: 'Finanzas',          group: 'reports',   groupLabel: 'Reportes',       defaultOn: true  },
  // Configuración
  { id: 'printers',      name: 'Impresoras',        group: 'config',    groupLabel: 'Configuración',  defaultOn: false },
  { id: 'settings',      name: 'Configuración',     group: 'config',    groupLabel: 'Configuración',  defaultOn: true  },
  { id: 'dev-requests',  name: 'Solicitudes Dev',   group: 'config',    groupLabel: 'Configuración',  defaultOn: true  },
]

export const DEFAULT_MODULES = ALL_MODULES.filter(m => m.defaultOn).map(m => m.id)

// ── Presets por tipo de negocio ───────────────────────────────────────────────
const BASE = ['dashboard','inventory','purchases','pos','cash-register','invoices','customers','fiados','vendedores','history','analytics','finances','settings','dev-requests']
const GASTRO = [...BASE, 'recipes','restbar','gastrobar-ops','merma']
const TIENDA = [...BASE, 'tienda','pedidos','cupones','reviews']

export const BUSINESS_PRESETS: Record<string, { label: string; modules: string[] }> = {
  restaurante:  { label: 'Restaurante',         modules: GASTRO },
  gastrobar:    { label: 'Gastrobar',           modules: GASTRO },
  bar:          { label: 'Bar / Cantina',       modules: GASTRO },
  cafeteria:    { label: 'Cafetería',           modules: GASTRO },
  panaderia:    { label: 'Panadería',           modules: GASTRO },
  ferreteria:   { label: 'Ferretería',          modules: [...BASE, 'fleet'] },
  ropa:         { label: 'Ropa / Moda',         modules: TIENDA },
  moda:         { label: 'Moda',                modules: TIENDA },
  calzado:      { label: 'Calzado',             modules: TIENDA },
  ecommerce:    { label: 'E-commerce',          modules: [...TIENDA, 'services'] },
  supermercado: { label: 'Supermercado',        modules: [...BASE, 'fleet'] },
  farmacia:     { label: 'Farmacia / Droguería',modules: BASE },
  cosmetica:    { label: 'Cosmética / Belleza', modules: TIENDA },
  electronica:  { label: 'Electrónica',         modules: [...BASE, 'fleet'] },
  tapiceria:    { label: 'Tapicería / Tapizados',modules: [...BASE.filter(m => m !== 'fiados'), 'workorders','recipes'] },
  servicios:    { label: 'Servicios Generales', modules: [...BASE, 'services','workorders'] },
  inmobiliaria: { label: 'Inmobiliaria',        modules: ['dashboard','customers','vendedores','realestate','finances','analytics','settings','dev-requests'] },
  transportes:  { label: 'Transportes / Flota', modules: [...BASE, 'fleet','workorders'] },
  gimnasio:     { label: 'Gimnasio / Fitness',  modules: [...BASE, 'gym'] },
  fitness:      { label: 'Centro Fitness',      modules: [...BASE, 'gym'] },
  crossfit:     { label: 'CrossFit / Box',      modules: [...BASE, 'gym'] },
  default:      { label: 'Genérico',            modules: DEFAULT_MODULES },
}

export function getPresetForBusinessType(businessType?: string | null): string[] {
  if (!businessType) return DEFAULT_MODULES
  const lower = businessType.toLowerCase().trim()
  if (BUSINESS_PRESETS[lower]) return BUSINESS_PRESETS[lower].modules
  // Keyword matching
  for (const [key, preset] of Object.entries(BUSINESS_PRESETS)) {
    if (key === 'default') continue
    if (lower.includes(key) || key.includes(lower)) return preset.modules
  }
  return DEFAULT_MODULES
}

export function resolveActiveModules(enabledModules?: string[] | null): string[] {
  if (!enabledModules || enabledModules.length === 0) return DEFAULT_MODULES
  return enabledModules
}
