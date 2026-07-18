// Mapeo entre las "secciones" internas del panel (activeSection) y los slugs
// usados en la URL (/panel/<slug>). Esto permite que cada página del comerciante
// tenga un link propio y compartible.
//
// Si agregas una sección nueva en el sidebar, añade aquí su slug.

export const SECTION_TO_SLUG: Record<string, string> = {
  // Admin / plataforma
  'superadmin': 'superadmin',
  'pagina-principal': 'pagina-principal',
  // Núcleo
  'dashboard': 'inicio',
  'contenido': 'contenido',
  'inventory': 'inventario',
  'recipes': 'recetas',
  'purchases': 'compras',
  // Tienda online
  'tienda': 'tienda',
  'pedidos': 'pedidos',
  'cupones': 'cupones',
  'reviews': 'resenas',
  'services': 'servicios',
  'cartilla': 'cartilla',
  'perfil': 'perfil',
  'servicios-pro': 'servicios-pro',
  'gym': 'gimnasio',
  // Gastrobar
  'gastrobar-ops': 'gastrobar',
  'merma': 'merma',
  'restbar': 'restbar',
  // Operaciones
  'pos': 'pos',
  'cash-register': 'caja',
  'invoices': 'facturacion',
  'customers': 'clientes',
  'engagement': 'engagement',
  'fiados': 'fiados',
  'vendedores': 'empleados',
  'fleet': 'flota',
  'realestate': 'inmobiliaria',
  'workorders': 'tapiceria',
  // Reportes
  'history': 'historial',
  'analytics': 'analisis',
  'finances': 'finanzas',
  // Configuración
  'printers': 'impresoras',
  'settings': 'configuracion',
  'dev-requests': 'solicitudes',
}

// Mapa inverso slug -> sección
export const SLUG_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_TO_SLUG).map(([section, slug]) => [slug, section])
)

// Sección por defecto al entrar al panel
export const DEFAULT_SECTION = 'dashboard'
export const DEFAULT_SLUG = SECTION_TO_SLUG[DEFAULT_SECTION]

/** Devuelve el slug de URL para una sección interna. */
export function slugForSection(section: string): string {
  return SECTION_TO_SLUG[section] ?? DEFAULT_SLUG
}

/** Devuelve la sección interna para un slug de URL (o null si no existe). */
export function sectionForSlug(slug: string): string | null {
  return SLUG_TO_SECTION[slug] ?? null
}

/** Ruta completa del panel para una sección, p.ej. '/panel/inventario'. */
export function panelHref(section: string): string {
  return `/panel/${slugForSection(section)}`
}
