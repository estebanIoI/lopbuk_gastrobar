/**
 * Block Registry — única fuente de verdad de los bloques de plantilla.
 *
 * Agregar un bloque nuevo:
 *   1. crear `blocks/mi-bloque.tsx` exportando un BlockDefinition
 *   2. añadirlo al array BLOCKS de abajo
 *   3. añadir su `type` a SECTION_TYPES en
 *      backend/src/modules/product-templates/section-types.ts
 *
 * El paso 3 lo vigila el test de contrato (lib/product-blocks/__tests__).
 * De aquí se derivan catálogo, defaults, validación, formulario, preview y
 * render: no hay listas paralelas que mantener.
 */

import type { AnyBlockDefinition, TemplateSection } from './types'
import { heroBlock } from './blocks/hero'
import { benefitsBlock } from './blocks/benefits'
import { featureGridBlock } from './blocks/feature-grid'
import { richTextBlock } from './blocks/rich-text'
import { videoBlock } from './blocks/video'
import { multimediaBlock } from './blocks/multimedia'
import { beforeAfterBlock } from './blocks/before-after'
import { faqBlock } from './blocks/faq'
import { testimonialsBlock } from './blocks/testimonials'
import { comparisonBlock } from './blocks/comparison'
import { urgencyBlock } from './blocks/urgency'
import { guaranteesBlock } from './blocks/guarantees'
import { imageBannerBlock } from './blocks/image-banner'
import { ctaBlock } from './blocks/cta'
import { bundleBlock } from './blocks/bundle'
import { socialProofBlock } from './blocks/social-proof'
import { relatedBlock } from './blocks/related'
import { spacerBlock } from './blocks/spacer'

/** El orden define el orden del catálogo en el editor. */
export const BLOCKS: AnyBlockDefinition[] = [
  heroBlock,
  benefitsBlock,
  featureGridBlock,
  richTextBlock,
  videoBlock,
  multimediaBlock,
  beforeAfterBlock,
  faqBlock,
  testimonialsBlock,
  comparisonBlock,
  urgencyBlock,
  guaranteesBlock,
  imageBannerBlock,
  ctaBlock,
  bundleBlock,
  socialProofBlock,
  relatedBlock,
  spacerBlock,
]

const BY_TYPE: Map<string, AnyBlockDefinition> = new Map(BLOCKS.map(b => [b.type, b]))

if (BY_TYPE.size !== BLOCKS.length) {
  throw new Error('[product-blocks] hay tipos de bloque duplicados en BLOCKS')
}

/** Lista de tipos registrados. Debe coincidir con la allowlist del backend. */
export const BLOCK_TYPES: string[] = BLOCKS.map(b => b.type)

/** Definición de un tipo, o null si es desconocido (plantilla de versión futura). */
export function getBlock(type: string): AnyBlockDefinition | null {
  return BY_TYPE.get(type) ?? null
}

export function isKnownBlock(type: string): boolean {
  return BY_TYPE.has(type)
}

/**
 * Defaults derivados del schema — no hay defaults duplicados en ningún lado.
 * `schema.parse({})` funciona porque todo campo lleva .default().
 */
export function blockDefaults(type: string): Record<string, any> {
  const b = getBlock(type)
  if (!b) return {}
  return b.schema.parse({}) as Record<string, any>
}

/**
 * Parsea settings crudos para RENDER. Nunca lanza: los schemas llevan .catch(),
 * así que unos settings corruptos degradan a defaults en vez de tumbar la
 * tienda. Devuelve null si el tipo no está registrado.
 */
export function parseSettings(type: string, settings: unknown): Record<string, any> | null {
  const b = getBlock(type)
  if (!b) return null
  return b.schema.parse(settings ?? {}) as Record<string, any>
}

/** Crea una sección nueva con los defaults del schema. */
export function newSection(type: string, order: number): TemplateSection {
  const id = `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return { id, type, settings: blockDefaults(type), order, visible: true }
}
