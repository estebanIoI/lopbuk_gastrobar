// Tipos para el checkout público (landing page)

export interface ProductoCarrito {
  id: number;
  tempId?: string;
  nombre: string;
  precio: number;
  precioOriginal?: number;
  descuentoPorcentaje?: number;
  cantidad: number;
  imagen: string;
  tallaSeleccionada?: string;
  colorSeleccionado?: string;
  perfumeSeleccionado?: string;
  // Variante seleccionada (talla/color/peso/material)
  variantId?: string;
  variantLabel?: string;
  // IDs de las opciones de modificador (adiciones) elegidas — el backend resuelve sus
  // priceDelta reales para blindar el precio (que no se confíe del frontend).
  modifierOptionIds?: string[];
  // Precios por volumen (mayorista) — permiten recalcular el precio cuando cambia la
  // cantidad total del producto en el carrito (sumando todas sus variantes / mix & match).
  priceTiers?: { minQty: number; price: number; marginPct?: number }[];
  /** Precio base de la variante SIN tier aplicado — referencia para recalcular hacia arriba/abajo. */
  tierBasePrice?: number;
  tenantId?: string;
  storeName?: string;
  availableForDelivery?: boolean;
  deliveryType?: 'domicilio' | 'envio' | 'ambos' | null;
  // Peso del producto (ferretería) en kg para cálculo de flota
  weightKg?: number | null;
  productType?: string;
  // Precompra (presale) — se mantienen aliases legacy para compat.
  isPresale?: boolean;
  presaleBadgeText?: string;
  presaleShipStart?: string | null;
  presaleShipEnd?: string | null;
  isPreorder?: boolean;
  preorderShipStart?: string | null;
  preorderShipEnd?: string | null;
  preorderBadgeText?: string;
  // Combo por día — línea de combo a precio fijo. El backend revalida el precio del tamaño
  // y descuenta stock de los productos componentes (comboItemIds).
  comboId?: string;
  comboSizeCount?: number;
  comboItemIds?: string[];
}

export interface PedidoForm {
  nombre: string;
  telefono: string;
  email: string;
  cedula: string;
  departamento: string;
  municipio: string;
  direccion: string;
  barrio: string;
  notas: string;
}

export interface PedidoConfirmado {
  numeroPedido: string;
  email: string;
  productos: ProductoCarrito[];
  total: number;
  fecha: string;
  vehiculoAsignado?: { tipoVehiculo: string; pesoTotal: number } | null;
  /** Desglose opcional para el resumen del modal de confirmación. */
  subtotal?: number;
  envio?: number;
  descuento?: number;
  /** Etiqueta del método de pago elegido (p. ej. "Contra entrega"). */
  metodoPago?: string;
}

export interface CuponValidacion {
  valido: boolean;
  mensaje?: string;
  descuento?: number;
  tipo?: 'porcentaje' | 'fijo';
}
