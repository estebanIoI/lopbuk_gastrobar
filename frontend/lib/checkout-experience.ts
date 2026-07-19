/**
 * Checkout Experience (Fase 4) — tipos y defaults del lado del cliente.
 * Espeja el contrato del backend (checkout-experience.service). El checkout
 * consume esta config para personalizar presentación; sin config, usa defaults
 * y se ve como hoy.
 */

export type CheckoutFieldKey =
  | 'nombre' | 'apellido' | 'telefono' | 'email' | 'cedula'
  | 'direccion' | 'barrio' | 'ciudad' | 'departamento' | 'comentario'

/** Campos que no se pueden ocultar ni volver opcionales (el backend lo fuerza). */
export const CORE_FIELDS: CheckoutFieldKey[] = ['nombre', 'telefono']

export const ALL_FIELDS: CheckoutFieldKey[] = [
  'nombre', 'apellido', 'telefono', 'email', 'cedula',
  'direccion', 'barrio', 'ciudad', 'departamento', 'comentario',
]

export const FIELD_LABELS: Record<CheckoutFieldKey, string> = {
  nombre: 'Nombre', apellido: 'Apellido', telefono: 'Teléfono / WhatsApp', email: 'Correo',
  cedula: 'Cédula', direccion: 'Dirección', barrio: 'Barrio', ciudad: 'Ciudad',
  departamento: 'Departamento', comentario: 'Comentario',
}

export interface FieldConfig {
  label?: string
  placeholder?: string
  visible: boolean
  required: boolean
  order: number
}

export interface InfoBlock {
  icon?: string
  title: string
  text?: string
}

export interface CheckoutExperienceConfig {
  header: { show: boolean; title: string; subtitle: string; icon: string }
  cta: { text: string; subtext: string; icon: string; sticky: boolean }
  bottomMessage: { show: boolean; title: string; text: string; icon: string }
  infoBlocks: InfoBlock[]
  fields: Record<string, FieldConfig>
}

const F = (order: number, label: string, placeholder: string, visible = true, required = false): FieldConfig =>
  ({ label, placeholder, visible, required, order })

export function defaultCheckoutConfig(): CheckoutExperienceConfig {
  return {
    header: { show: true, title: 'Finalizar compra', subtitle: 'Ingresa tus datos para completar el pedido', icon: '🛒' },
    cta: { text: 'Confirmar pedido', subtext: 'Pago contra entrega disponible', icon: '', sticky: false },
    bottomMessage: { show: false, title: '', text: 'Al finalizar tu compra te contactaremos por WhatsApp para coordinar la entrega.', icon: '💬' },
    infoBlocks: [
      { icon: '🔒', title: 'Pago seguro', text: 'Tus datos están protegidos' },
      { icon: '🚚', title: 'Envío 24–48h', text: 'Cobertura nacional' },
    ],
    fields: {
      nombre:       F(0, 'Nombre completo', 'Ingresa tu nombre completo', true, true),
      apellido:     F(1, 'Apellido', 'Apellido', false, false),
      telefono:     F(2, 'Teléfono / WhatsApp', 'Ej: 3001234567', true, true),
      email:        F(3, 'Correo electrónico', 'ejemplo@correo.com', true, false),
      cedula:       F(4, 'Cédula / Documento', 'Número de documento', true, false),
      direccion:    F(5, 'Dirección de entrega', 'Calle, carrera, número...', true, true),
      barrio:       F(6, 'Barrio', 'Nombre del barrio', true, false),
      ciudad:       F(7, 'Ciudad', 'Ciudad', true, true),
      departamento: F(8, 'Departamento', 'Departamento', true, true),
      comentario:   F(9, 'Comentario', 'Instrucciones especiales, preferencias de entrega...', true, false),
    },
  }
}

/** Merge tolerante de una config parcial sobre los defaults (para consumo seguro). */
export function withCheckoutDefaults(raw: Partial<CheckoutExperienceConfig> | null | undefined): CheckoutExperienceConfig {
  const def = defaultCheckoutConfig()
  if (!raw) return def
  const fields: Record<string, FieldConfig> = {}
  for (const k of ALL_FIELDS) {
    const isCore = CORE_FIELDS.includes(k)
    // Tipado explícito: sin esto el fallback `{}` hace que TS pierda la forma
    const r: Partial<FieldConfig> = raw.fields?.[k] ?? {}
    fields[k] = {
      label: r.label ?? def.fields[k].label,
      placeholder: r.placeholder ?? def.fields[k].placeholder,
      visible: isCore ? true : (r.visible ?? def.fields[k].visible),
      required: isCore ? true : (r.required ?? def.fields[k].required),
      order: Number.isFinite(r.order) ? r.order! : def.fields[k].order,
    }
  }
  return {
    header: { ...def.header, ...(raw.header || {}) },
    cta: { ...def.cta, ...(raw.cta || {}) },
    bottomMessage: { ...def.bottomMessage, ...(raw.bottomMessage || {}) },
    infoBlocks: Array.isArray(raw.infoBlocks) ? raw.infoBlocks : def.infoBlocks,
    fields,
  }
}
