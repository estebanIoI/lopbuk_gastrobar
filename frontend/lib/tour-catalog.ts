/**
 * Catálogo de pasos de la guía interactiva (onboarding tour).
 *
 * Cada paso apunta a un elemento del UI mediante `data-tour="<id>"`.
 * `targets` es una lista de candidatos: el motor usa el PRIMERO que exista
 * en el DOM, así el mismo catálogo funciona en el Tema 1 (sidebar, `nav-*`)
 * y en el Tema 2 (navbar verde, `navg-*`) sin duplicar pasos. Si ningún
 * target existe, el paso se muestra centrado (igual sigue explicando el módulo).
 *
 * Tono: conversacional y corto (1–2 frases). Nada de tecnicismos.
 */
export interface TourStep {
  /** Identificador estable del paso (lo usa el asistente para arrancar aquí). */
  id: string
  /** Valores de data-tour candidatos (tema 1 y tema 2). Omitir = paso centrado. */
  targets?: string[]
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Hola! 👋',
    body: 'Soy tu guía rápida. En menos de un minuto te muestro por dónde se mueve todo. ¿Vamos?',
  },
  {
    id: 'dashboard',
    targets: ['nav-dashboard', 'navg-home'],
    title: 'Tu inicio',
    body: 'Aquí ves cómo va el día de un vistazo: ventas, stock y lo que necesita tu atención.',
  },
  {
    id: 'inventory',
    targets: ['nav-inventory', 'navg-inventario'],
    title: 'Inventario',
    body: 'Tus productos, su stock y las recetas (BOM) para tus platos y combos viven aquí.',
  },
  {
    id: 'ventas',
    targets: ['nav-pos', 'navg-ventas'],
    title: 'Vender',
    body: 'Desde el Punto de Venta cobras en segundos. También tienes la caja y el historial.',
  },
  {
    id: 'gastrobar',
    targets: ['nav-restbar', 'navg-gastrobar'],
    title: 'Gastrobar',
    body: 'Tu salón, mesas, cocina y bar: toma pedidos, gestiona órdenes y controla la merma.',
  },
  {
    id: 'tienda',
    targets: ['nav-tienda-group', 'navg-tienda'],
    title: 'Tu tienda',
    body: 'Tu tienda online, los pedidos que llegan, cupones y reseñas, todo en un lugar.',
  },
  {
    id: 'clientes',
    targets: ['nav-customers', 'navg-clientes'],
    title: 'Clientes',
    body: 'Tu directorio de clientes, los fiados y tu equipo de trabajo.',
  },
  {
    id: 'reportes',
    targets: ['nav-analytics', 'navg-reportes'],
    title: 'Reportes',
    body: '¿Cómo va el negocio? Aquí están tus números y análisis para decidir mejor.',
  },
  {
    id: 'config',
    targets: ['nav-settings', 'navg-config'],
    title: 'Ajustes',
    body: 'Configura tu negocio, impresoras y usuarios cuando lo necesites.',
  },
  {
    id: 'search',
    targets: ['search'],
    title: 'Busca rápido',
    body: 'Encuentra un producto, una factura o un cliente escribiendo aquí.',
  },
  {
    id: 'notifications',
    targets: ['notifications'],
    title: 'Tus alertas',
    body: 'La campana te avisa cuando hay stock bajo o pedidos pendientes.',
  },
  {
    id: 'done',
    targets: ['tour-guide-btn'],
    title: '¡Listo! 🎉',
    body: 'Eso es lo esencial. Cuando quieras repasar, vuelve a tocar “Guía”. ¡Éxitos!',
  },
]

// ── Sub-guía detallada del Punto de Venta ──
export const POS_TOUR: TourStep[] = [
  {
    id: 'pos-search',
    targets: ['pos-search'],
    title: 'Busca el producto',
    body: 'Escribe el nombre, el SKU o escanea el código de barras. Toca el producto para agregarlo al carrito.',
  },
  {
    id: 'pos-cart',
    targets: ['pos-cart'],
    title: 'Tu carrito',
    body: 'Aquí ves lo que vas a cobrar. Cambia cantidades o aplica un descuento si lo necesitas.',
  },
  {
    id: 'pos-charge',
    targets: ['pos-charge'],
    title: 'Cobrar',
    body: 'Toca COBRAR, elige el método de pago (efectivo, tarjeta, fiado o mixto) y confirma. ¡Venta lista! 🎉',
  },
]

// ── Sub-guía detallada de Inventario ──
export const INVENTORY_TOUR: TourStep[] = [
  {
    id: 'inv-new',
    targets: ['inv-new'],
    title: 'Crear un producto',
    body: 'Toca “Agregar Producto”: pones nombre, precio y stock. Si vendes por tamaños o presentaciones, activas sus variantes (cada una con su propio stock).',
  },
  {
    id: 'inv-search',
    targets: ['inv-search'],
    title: 'Encuentra rápido',
    body: 'Busca cualquier producto por nombre, SKU, marca o código de barras.',
  },
  {
    id: 'inv-filters',
    targets: ['inv-filters'],
    title: 'Filtra tu inventario',
    body: 'Filtra por tipo, categoría o estado de stock — por ejemplo, ver solo lo agotado o lo que necesita reabastecerse.',
  },
]

// ── Sub-guía detallada de Pedidos ──
export const ORDERS_TOUR: TourStep[] = [
  {
    id: 'ped-search',
    targets: ['ped-search'],
    title: 'Encuentra un pedido',
    body: 'Busca por nombre del cliente, teléfono o número de pedido.',
  },
  {
    id: 'ped-filter',
    targets: ['ped-filter'],
    title: 'Filtra por estado',
    body: 'Muestra solo los pedidos pendientes, en preparación, enviados o entregados.',
  },
  {
    id: 'ped-flow',
    title: 'Avanza el pedido',
    body: 'En cada pedido avanzas su estado: pendiente → confirmado → preparando → enviado → entregado. Al marcarlo “Entregado” se genera la factura y se descuenta el stock automáticamente. ✅',
  },
]

// ── Sub-guía detallada de Clientes ──
export const CUSTOMERS_TOUR: TourStep[] = [
  {
    id: 'cli-new',
    targets: ['cli-new'],
    title: 'Registra un cliente',
    body: 'Toca “Nuevo Cliente” para guardar sus datos (cédula, nombre, teléfono). Así llevas su historial y sus fiados.',
  },
  {
    id: 'cli-stats',
    targets: ['cli-stats'],
    title: 'Saldos de un vistazo',
    body: 'Aquí ves cuántos clientes tienes, cuántos tienen saldo pendiente (fiados) y el total por cobrar.',
  },
  {
    id: 'cli-search',
    targets: ['cli-search'],
    title: 'Encuentra un cliente',
    body: 'Búscalo por cédula, nombre, teléfono o correo, y abre su ficha para ver su historial.',
  },
]

// ── Sub-guía detallada de Reportes ──
export const REPORTS_TOUR: TourStep[] = [
  {
    id: 'rep-tabs',
    targets: ['rep-tabs'],
    title: 'Gráficos y reportes',
    body: 'Cambia entre los Gráficos del negocio y los Reportes DIAN para tu contabilidad.',
  },
  {
    id: 'rep-metrics',
    targets: ['rep-metrics'],
    title: 'Tus indicadores',
    body: 'De un vistazo: margen bruto, ROI del inventario, ticket promedio y costo de tu stock.',
  },
  {
    id: 'rep-more',
    title: 'Profundiza cuando quieras',
    body: 'Más abajo verás ingresos vs costos, margen por categoría y tus productos más vendidos. En “Reportes DIAN” exportas la información.',
  },
]

// ── Sub-guía detallada de Caja ──
export const CASH_TOUR: TourStep[] = [
  {
    id: 'caja-open',
    targets: ['caja-open'],
    title: 'Abre tu caja',
    body: 'Al iniciar el turno, registra el efectivo inicial (base) para abrir la caja.',
  },
  {
    id: 'caja-flow',
    title: 'Durante el día y al cerrar',
    body: 'Durante el turno registras ingresos y retiros de efectivo. Al cerrar, el sistema compara el efectivo esperado con el que cuentas y te muestra el cuadre. 🧾',
  },
]

// ── Sub-guía detallada de Tienda ──
export const STORE_TOUR: TourStep[] = [
  {
    id: 'tnd-customize',
    targets: ['tnd-customize'],
    title: 'Personaliza tu tienda',
    body: 'Cambia el aspecto de tu tienda online: banner, colores, anuncios, cupones y reseñas.',
  },
  {
    id: 'tnd-search',
    targets: ['tnd-search'],
    title: 'Elige qué mostrar',
    body: 'Busca un producto para publicarlo u ocultarlo en tu tienda online.',
  },
  {
    id: 'tnd-filters',
    targets: ['tnd-filters'],
    title: 'Publica en masa',
    body: 'Filtra por publicados, ofertas, domicilio o sin publicar, y publica varios a la vez.',
  },
]

// ── Sub-guía detallada de Gastrobar / RestBar ──
export const GASTROBAR_TOUR: TourStep[] = [
  {
    id: 'gastro-intro',
    title: 'Tu operación de salón',
    body: 'El módulo Gastrobar reúne mesas, comandas, cocina (KDS) y bar. Cada rol (mesero, cocinero, cajero, bartender) ve su propia vista.',
  },
  {
    id: 'gastro-mesas',
    title: 'Mesas y comandas',
    body: 'Abre una mesa, toma el pedido con sus modificadores y envíalo a cocina o barra. El estado de cada plato se actualiza en tiempo real.',
  },
  {
    id: 'gastro-merma',
    title: 'Control de merma',
    body: 'Registra desperdicios y mermas para que tu inventario y tus costos reflejen la realidad de la cocina.',
  },
]

/** Todas las guías disponibles, por clave. */
export const TOURS: Record<string, TourStep[]> = {
  main: TOUR_STEPS,
  pos: POS_TOUR,
  inventory: INVENTORY_TOUR,
  orders: ORDERS_TOUR,
  customers: CUSTOMERS_TOUR,
  reports: REPORTS_TOUR,
  cash: CASH_TOUR,
  store: STORE_TOUR,
  gastrobar: GASTROBAR_TOUR,
}

/** Devuelve los pasos de una guía (cae a la principal si la clave no existe). */
export function getTour(key: string): TourStep[] {
  return TOURS[key] ?? TOUR_STEPS
}

/** Índice de un paso por su id dentro de una guía (para arrancar ahí). */
export function stepIndexById(id: string, tourKey = 'main'): number {
  const i = getTour(tourKey).findIndex(s => s.id === id)
  return i >= 0 ? i : 0
}
