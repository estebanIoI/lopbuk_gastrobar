/**
 * Contrato del Block Registry (Fase 1.5 · Product Experience Platform).
 *
 * Única fuente de verdad de los bloques de plantilla de producto. De aquí se
 * derivan catálogo del editor, defaults, validación, formulario, preview y
 * render. El backend solo conoce la allowlist de `type` y valida ESTRUCTURA.
 *
 * Regla de oro del módulo: la plantilla define ESTRUCTURA, nunca contenido del
 * producto. Los settings referencian {{product.*}} / page_content; jamás
 * guardan precios, títulos ni descripciones literales.
 */

import type { ComponentType } from 'react'
import type { ZodType } from 'zod'
import type { TemplateVarsContext } from '@/lib/template-vars'

// ── Datos que la tienda inyecta al render ─────────────────────────────────────

export interface ProductPageContent {
  videoUrl?: string
  benefits?: Array<{ icon?: string; text: string }>
  faqs?: Array<{ q: string; a: string }>
  testimonials?: Array<{ name?: string; text: string; rating?: number; imageUrl?: string }>
  comparisonRows?: Array<{ feature: string; ours: string; theirs: string }>
}

export interface TemplateReview {
  rating: number
  text: string
  author?: string
  date?: string
  photo?: string | null
  /**
   * true SOLO si proviene de una reseña real del producto (orden verificada).
   * Los testimonios manuales del comerciante NUNCA la llevan: mostrarlos como
   * verificados induce a error al comprador.
   */
  verified?: boolean
}

export interface TemplateRelatedProduct {
  id: string | number
  name: string
  price: number
  imageUrl?: string | null
}

export interface BundleItemView {
  productId: string
  variantId: string | null
  quantity: number
  name: string
  variantName: string | null
  imageUrl: string | null
  unitPrice: number
  inStock: boolean
}

export interface BundleView {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  label: string | null
  items: BundleItemView[]
  regularTotal: number
  bundlePrice: number
  savings: number
  savingsPct: number
  inStock: boolean
}

/** Social Proof — SOLO datos reales (ventas, stock, reseñas, espectadores). */
export interface SocialProofData {
  viewers: number
  soldRecent: number
  soldTotal: number
  recentDays: number
  lastPurchaseAt: string | null
  stock: number | null
  lowStock: boolean
  reviewCount: number
  avgRating: number | null
}

export interface SectionRendererCtx extends TemplateVarsContext {
  pageContent?: ProductPageContent | null
  reviews?: TemplateReview[]
  relatedProducts?: TemplateRelatedProduct[]
  onRelatedClick?: (id: string) => void
  onCta?: () => void
  formatPrice?: (v: number) => string
  /** Bundles publicados para este producto (los inyecta la tienda). */
  bundles?: BundleView[]
  /** Agrega todos los ítems del bundle al carrito con su precio de combo. */
  onAddBundle?: (bundleId: string) => void
  /** Señales de prueba social reales (las inyecta la tienda). */
  socialProof?: SocialProofData | null
  /** true = fondo claro (tema de la tienda) */
  isLightBg?: boolean
  accentColor?: string
}

// ── Sección persistida ────────────────────────────────────────────────────────

/**
 * `type` es string (no unión cerrada) a propósito: una plantilla guardada puede
 * traer un bloque de una versión más nueva. El renderer lo ignora con gracia en
 * vez de romper la tienda.
 */
export interface TemplateSection {
  id: string
  type: string
  settings: Record<string, any>
  order: number
  visible: boolean
}

// ── Props de bloque ───────────────────────────────────────────────────────────

export interface BlockRenderProps<S = any> {
  /** settings ya parseados por el schema del bloque (defaults aplicados) */
  settings: S
  section: TemplateSection
  ctx: SectionRendererCtx
  /** resuelve {{product.*}} / {{store.*}} */
  tv: (t: string) => string
  /** clase de texto principal según fondo */
  tx: string
  /** clase de texto atenuado según fondo */
  tmuted: string
}

export interface BlockEditorProps {
  /** settings CRUDOS (sin parsear): preserva claves desconocidas */
  settings: Record<string, any>
  /** parche superficial de una clave */
  set: (key: string, value: any) => void
}

export type BlockCategory = 'contenido' | 'medios' | 'confianza' | 'conversion'

export interface BlockDefinition<S = any> {
  /** id estable y persistido. Debe existir en la allowlist del backend. */
  type: string
  label: string
  desc: string
  category: BlockCategory
  /**
   * Contrato de settings. Obligatorio:
   *  - todo campo con .default()  → un campo ausente nunca es error
   *  - .passthrough()             → claves desconocidas sobreviven
   *  - .catch()                   → settings corruptos degradan, no rompen
   */
  schema: ZodType<S>
  Render: ComponentType<BlockRenderProps<S>>
  Editor: ComponentType<BlockEditorProps>
}

export type AnyBlockDefinition = BlockDefinition<any>
