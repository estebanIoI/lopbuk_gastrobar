'use client'

/**
 * Renderer JSON-driven de las plantillas de producto.
 *
 * Ya no conoce ningún bloque: todo se resuelve contra el Block Registry
 * (`lib/product-blocks`), única fuente de verdad. Un solo código de render:
 * la tienda pública Y la vista previa del editor usan este mismo componente.
 *
 * Este archivo se conserva como punto de entrada estable — `landing-page.tsx`
 * y el editor importan de aquí desde antes del refactor.
 */

import { resolveTemplateVars } from '@/lib/template-vars'
import { getBlock, parseSettings } from '@/lib/product-blocks/registry'
import type { TemplateSection, SectionRendererCtx } from '@/lib/product-blocks/types'

// Re-exports de compatibilidad: los consumidores siguen importando desde aquí.
export type {
  TemplateSection,
  SectionRendererCtx,
  ProductPageContent,
  TemplateReview,
  TemplateRelatedProduct,
} from '@/lib/product-blocks/types'

/**
 * Antes era una unión cerrada de 10 tipos. Ahora es string: el conjunto de
 * bloques lo define el registry en runtime, y una plantilla guardada puede
 * traer un tipo de una versión más nueva.
 */
export type SectionType = string

export function SectionRenderer({ sections, ctx }: { sections: TemplateSection[]; ctx: SectionRendererCtx }) {
  if (!sections || sections.length === 0) return null
  // Colorimetría: acento de marca con fallback (regla brain/colorimetria)
  const accent = ctx.accentColor || 'var(--brand-green, #00833E)'
  const tx = ctx.isLightBg ? 'text-black' : 'text-white'
  const tmuted = ctx.isLightBg ? 'text-black/60' : 'text-white/60'
  const fullCtx: SectionRendererCtx = { ...ctx, accentColor: accent }
  const tv = (t: string) => resolveTemplateVars(t, fullCtx)

  return (
    <div className="space-y-10">
      {sections
        .filter(s => s.visible !== false)
        .sort((a, b) => a.order - b.order)
        .map(s => {
          const def = getBlock(s.type)
          // Tipo desconocido (plantilla de una versión futura): se ignora con gracia.
          if (!def) return null
          const settings = parseSettings(s.type, s.settings)
          const Render = def.Render
          return (
            <section key={s.id} data-template-section={s.type}>
              <Render settings={settings} section={s} ctx={fullCtx} tv={tv} tx={tx} tmuted={tmuted} />
            </section>
          )
        })}
    </div>
  )
}
