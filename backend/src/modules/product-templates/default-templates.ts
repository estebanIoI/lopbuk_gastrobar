/**
 * Plantillas semilla por vertical (Moda / Tecnología / Belleza).
 * Se crean una vez por tenant al abrir el editor sin plantillas.
 * Usan variables {{product.*}} / {{store.*}} — nunca contenido fijo de producto.
 */
import { TemplateSection } from './section-types';

const sec = (type: TemplateSection['type'], order: number, settings: Record<string, unknown>): TemplateSection => ({
  id: `seed-${type}-${order}`,
  type,
  settings,
  order,
  visible: true,
});

export const DEFAULT_TEMPLATES: Array<{ name: string; description: string; sections: TemplateSection[] }> = [
  {
    name: 'Moda',
    description: 'Ropa y calzado: beneficios, guía de tallas, testimonios y FAQ',
    sections: [
      sec('benefits', 0, {
        title: '¿Por qué elegir {{product.title}}?',
        columns: 2,
        items: [
          { icon: '🚚', text: 'Envío rápido a todo el país' },
          { icon: '✅', text: 'Calidad premium garantizada' },
          { icon: '💵', text: 'Paga contra entrega' },
          { icon: '🔄', text: 'Cambios de talla sin costo' },
        ],
      }),
      sec('rich_text', 1, {
        title: 'Guía de tallas',
        body: 'Elige tu talla habitual. Si estás entre dos tallas, te recomendamos la mayor.\n- **S**: 34-36\n- **M**: 38-40\n- **L**: 42-44\n- **XL**: 46-48',
      }),
      sec('testimonials', 2, { title: 'Lo que dicen nuestras clientas', maxItems: 6 }),
      sec('faq', 3, {
        title: 'Preguntas frecuentes',
        items: [
          { q: '¿Puedo cambiar la talla?', a: 'Sí, tienes cambio de talla sin costo dentro de los 5 días siguientes a la entrega.' },
          { q: '¿Cuánto tarda el envío?', a: 'Entre 2 y 5 días hábiles según tu ciudad.' },
          { q: '¿Puedo pagar contra entrega?', a: 'Sí, pagas en efectivo cuando recibes tu pedido.' },
        ],
      }),
      sec('related', 4, { title: 'Completa tu look', source: 'category', maxItems: 4 }),
    ],
  },
  {
    name: 'Tecnología',
    description: 'Electrónica: comparación, especificaciones, video y garantías',
    sections: [
      sec('comparison', 0, {
        title: '{{product.title}} vs otros',
        ourLabel: '{{product.title}}',
        theirLabel: 'Otros',
        rows: [
          { feature: 'Garantía real', ours: '✓ Incluida', theirs: '✗' },
          { feature: 'Soporte local', ours: '✓ Por WhatsApp', theirs: '✗' },
          { feature: 'Producto original', ours: '✓ Certificado', theirs: '?' },
        ],
      }),
      sec('rich_text', 1, { title: 'Especificaciones', body: '{{product.description}}' }),
      sec('video', 2, { title: 'Míralo en acción', url: '' }),
      sec('guarantees', 3, {
        items: [
          { icon: '🛡️', title: 'Garantía', text: 'Cobertura por defectos de fábrica' },
          { icon: '📦', title: 'Empaque seguro', text: 'Protegido para el envío' },
          { icon: '💬', title: 'Soporte', text: 'Te acompañamos por WhatsApp' },
        ],
      }),
      sec('related', 4, { title: 'Accesorios recomendados', source: 'category', maxItems: 4 }),
    ],
  },
  {
    name: 'Belleza',
    description: 'Cosmética: banner, testimonios, ingredientes y urgencia',
    sections: [
      sec('image_banner', 0, { imageUrl: '', title: 'Resultados reales', subtitle: 'Antes y después de usar {{product.title}}', ctaText: '', ctaAction: 'buy' }),
      sec('testimonials', 1, { title: 'Clientas felices', maxItems: 6 }),
      sec('rich_text', 2, { title: 'Ingredientes y modo de uso', body: '{{product.description}}' }),
      sec('urgency', 3, { message: '🔥 Quedan {{product.stock}} unidades disponibles', showStock: true }),
      sec('faq', 4, {
        title: 'Preguntas frecuentes',
        items: [
          { q: '¿Sirve para piel sensible?', a: 'Consulta los ingredientes; si tienes dudas escríbenos por WhatsApp.' },
          { q: '¿Cuánto dura?', a: 'Con uso diario, aproximadamente 30 días.' },
        ],
      }),
    ],
  },
];
