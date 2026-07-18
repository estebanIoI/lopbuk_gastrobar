import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

/**
 * Checkout Experience (Fase 4).
 *
 * Capa de PERSONALIZACIÓN del checkout: NO reemplaza el flujo de pedido, solo
 * ajusta presentación (encabezado, CTA, mensaje, bloques informativos) y los
 * campos del formulario (label/placeholder/visible/obligatorio).
 *
 * Regla de seguridad: los campos NÚCLEO (nombre, teléfono) no se pueden ocultar
 * ni volver opcionales — se necesitan para procesar el pedido. El servidor lo
 * fuerza aunque el editor mande otra cosa, para que un comerciante no rompa su
 * propio checkout. NADA aquí genera prueba social simulada (eso es Fase 5, solo
 * datos reales).
 */

export type CheckoutFieldKey =
  | 'nombre' | 'apellido' | 'telefono' | 'email' | 'cedula'
  | 'direccion' | 'barrio' | 'ciudad' | 'departamento' | 'comentario';

/** Campos que jamás se pueden ocultar/volver opcionales (rompen el pedido). */
export const CORE_FIELDS: CheckoutFieldKey[] = ['nombre', 'telefono'];

export const ALL_FIELDS: CheckoutFieldKey[] = [
  'nombre', 'apellido', 'telefono', 'email', 'cedula',
  'direccion', 'barrio', 'ciudad', 'departamento', 'comentario',
];

export interface FieldConfig {
  label?: string;
  placeholder?: string;
  visible: boolean;
  required: boolean;
  order: number;
}

export interface InfoBlock {
  icon?: string;
  title: string;
  text?: string;
}

export interface CheckoutExperienceConfig {
  header: { show: boolean; title: string; subtitle: string; icon: string };
  cta: { text: string; subtext: string; icon: string; sticky: boolean };
  bottomMessage: { show: boolean; title: string; text: string; icon: string };
  infoBlocks: InfoBlock[];
  fields: Record<string, FieldConfig>;
}

/** Config por defecto: reproduce el checkout actual (labels/placeholders de hoy). */
export function defaultConfig(): CheckoutExperienceConfig {
  const F = (order: number, label: string, placeholder: string, visible = true, required = false): FieldConfig =>
    ({ label, placeholder, visible, required, order });
  return {
    header: { show: true, title: 'Finalizar compra', subtitle: 'Ingresa tus datos para completar el pedido', icon: '🛒' },
    cta: { text: 'Confirmar pedido', subtext: 'Pago contra entrega disponible', icon: '', sticky: false },
    bottomMessage: {
      show: false,
      title: '',
      text: 'Al finalizar tu compra te contactaremos por WhatsApp para coordinar la entrega.',
      icon: '💬',
    },
    infoBlocks: [
      { icon: '🔒', title: 'Pago seguro', text: 'Tus datos están protegidos' },
      { icon: '🚚', title: 'Envío 24–48h', text: 'Cobertura nacional' },
    ],
    fields: {
      nombre:      F(0, 'Nombre completo', 'Ingresa tu nombre completo', true, true),
      apellido:    F(1, 'Apellido', 'Apellido', false, false),
      telefono:    F(2, 'Teléfono / WhatsApp', 'Ej: 3001234567', true, true),
      email:       F(3, 'Correo electrónico', 'ejemplo@correo.com', true, false),
      cedula:      F(4, 'Cédula / Documento', 'Número de documento', true, false),
      direccion:   F(5, 'Dirección de entrega', 'Calle, carrera, número...', true, true),
      barrio:      F(6, 'Barrio', 'Nombre del barrio', true, false),
      ciudad:      F(7, 'Ciudad', 'Ciudad', true, true),
      departamento:F(8, 'Departamento', 'Departamento', true, true),
      comentario:  F(9, 'Comentario', 'Instrucciones especiales, preferencias de entrega...', true, false),
    },
  };
}

/** Fuerza las invariantes de seguridad sobre una config (venga de donde venga). */
export function sanitize(raw: any): CheckoutExperienceConfig {
  const def = defaultConfig();
  const cfg: CheckoutExperienceConfig = {
    header: { ...def.header, ...(raw?.header || {}) },
    cta: { ...def.cta, ...(raw?.cta || {}) },
    bottomMessage: { ...def.bottomMessage, ...(raw?.bottomMessage || {}) },
    infoBlocks: Array.isArray(raw?.infoBlocks)
      ? raw.infoBlocks.filter((b: any) => b && b.title).map((b: any) => ({ icon: String(b.icon || ''), title: String(b.title), text: b.text ? String(b.text) : '' }))
      : def.infoBlocks,
    fields: {},
  };
  for (const key of ALL_FIELDS) {
    const d = def.fields[key];
    const r = raw?.fields?.[key] || {};
    const isCore = CORE_FIELDS.includes(key);
    cfg.fields[key] = {
      label: r.label != null ? String(r.label).slice(0, 60) : d.label,
      placeholder: r.placeholder != null ? String(r.placeholder).slice(0, 120) : d.placeholder,
      // Núcleo: siempre visible y obligatorio, sin importar lo que mande el editor.
      visible: isCore ? true : (r.visible !== undefined ? !!r.visible : d.visible),
      required: isCore ? true : (r.required !== undefined ? !!r.required : d.required),
      order: Number.isFinite(r.order) ? Number(r.order) : d.order,
    };
  }
  return cfg;
}

export class CheckoutExperienceService {
  private parse(raw: unknown): CheckoutExperienceConfig {
    if (raw == null) return defaultConfig();
    const obj = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
    return sanitize(obj);
  }

  async get(tenantId: string): Promise<CheckoutExperienceConfig> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT config FROM checkout_experiences WHERE tenant_id = ?',
      [tenantId]
    );
    if (rows.length === 0) return defaultConfig();
    return this.parse(rows[0].config);
  }

  async save(tenantId: string, raw: any): Promise<CheckoutExperienceConfig> {
    const cfg = sanitize(raw);
    await db.execute(
      `INSERT INTO checkout_experiences (tenant_id, config) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE config = VALUES(config)`,
      [tenantId, JSON.stringify(cfg)]
    );
    return cfg;
  }

  /** Restaura la config por defecto (borra la personalización). */
  async reset(tenantId: string): Promise<CheckoutExperienceConfig> {
    await db.execute('DELETE FROM checkout_experiences WHERE tenant_id = ?', [tenantId]);
    return defaultConfig();
  }
}

export const checkoutExperienceService = new CheckoutExperienceService();
