/**
 * Contrato de secciones de plantilla de producto (JSON-driven, tipo Shopify).
 * La plantilla guarda ESTRUCTURA; el contenido del producto llega por
 * {{product.*}} + products.page_content. El frontend replica estos tipos
 * en components/product-template/.
 */

// Allowlist estructural: el backend solo valida que el `type` esté aquí; el
// contrato completo (schema, editor, render) vive en el Block Registry del
// frontend (lib/product-blocks). El test de contrato garantiza que esta lista y
// el registry no se desincronicen.
export const SECTION_TYPES = [
  // Fase 1.5 (bloques base)
  'benefits',      // ✓ beneficios en bloques (icono + texto)
  'rich_text',     // título + texto (markdown-lite) + imagen opcional
  'video',         // YouTube / TikTok / Instagram / Shorts / GIF / MP4
  'faq',           // acordeón (preguntas de plantilla + page_content.faqs)
  'testimonials',  // reviews verificadas del producto + testimonios de page_content
  'comparison',    // tabla "tu producto vs competencia"
  'urgency',       // stock real y/o countdown (solo datos reales)
  'guarantees',    // trust badges
  'image_banner',  // imagen full-width + texto + CTA
  'related',       // productos relacionados configurables
  // Fase 2 (bloques de conversión)
  'hero',          // cabecera: slider/precio/badges/CTA (todo desde el producto)
  'feature_grid',  // grid icono + título + descripción
  'cta',           // botón de acción configurable
  'before_after',  // comparador de imágenes con slider
  'multimedia',    // carrusel de videos/reels/GIF/imágenes
  'spacer',        // espacio en blanco / divisor
  // Fase 3 (Bundle Builder)
  'bundle',        // combos asignados al producto (ctx.bundles)
  // Fase 5 (Social Proof Engine · solo datos reales)
  'social_proof',  // señales reales: viendo ahora, vendidos, última compra, reseñas
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export interface TemplateSection {
  /** uuid corto único dentro de la plantilla */
  id: string;
  type: SectionType;
  /** settings específicos por tipo (validación laxa: el renderer usa defaults) */
  settings: Record<string, unknown>;
  order: number;
  visible: boolean;
}

const MAX_SECTIONS = 25;

/**
 * Normaliza y valida el array de secciones que llega del editor.
 * Lanza string de error legible si algo es inválido.
 */
export function normalizeSections(raw: unknown): TemplateSection[] {
  if (!Array.isArray(raw)) throw new Error('sections debe ser un array');
  if (raw.length > MAX_SECTIONS) throw new Error(`Máximo ${MAX_SECTIONS} secciones por plantilla`);

  return raw.map((s: any, i: number) => {
    if (!s || typeof s !== 'object') throw new Error(`Sección ${i + 1} inválida`);
    if (!SECTION_TYPES.includes(s.type)) throw new Error(`Tipo de sección desconocido: "${s.type}"`);
    const settings = s.settings && typeof s.settings === 'object' ? s.settings : {};
    // Límite de tamaño defensivo: settings gigantes degradan la carga pública
    if (JSON.stringify(settings).length > 20000) {
      throw new Error(`La sección ${i + 1} (${s.type}) tiene una configuración demasiado grande`);
    }
    return {
      id: String(s.id || `sec-${i}-${Date.now().toString(36)}`),
      type: s.type as SectionType,
      settings,
      order: Number.isFinite(Number(s.order)) ? Number(s.order) : i,
      visible: s.visible !== false,
    };
  }).sort((a, b) => a.order - b.order);
}
