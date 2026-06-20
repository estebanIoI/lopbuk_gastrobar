'use client'

/**
 * Preview del tema NUEVO de detalle de producto estilo Mercado Libre.
 * Ruta: /preview/product-ml  — datos mock, no toca el storefront real.
 */
import { ProductDetailML, type MLProduct, type MLSeller, type MLReview, type MLQuestion } from '@/components/theme-ml/product-detail-ml'

const img = (seed: string) => `https://picsum.photos/seed/${seed}/640/640`

const product: MLProduct = {
  id: 'mt-041s',
  name: 'Extractor De Jugos Mertec Mt-041s Acero Inoxidable Gris',
  condition: 'Nuevo',
  soldCount: 25,
  stock: 2,
  salePrice: 239900,
  offerPrice: 143900,
  isOnOffer: true,
  rating: 5,
  ratingCount: 4,
  images: [img('juicer1'), img('juicer2'), img('juicer3'), img('juicer4')],
  features: [
    'Voltaje: 110V.',
    'Capacidad de 800ml.',
    'Con recolector de pulpa.',
    'Potencia de 500W.',
    '2 velocidades ajustables.',
  ],
  variants: [
    { id: 'v1', color: 'Gris', colorHex: '#9ca3af', stock: 2, images: [img('juicer1')] },
    { id: 'v2', color: 'Negro', colorHex: '#111111', stock: 5, images: [img('juicer2')] },
    { id: 'v3', color: 'Plateado', colorHex: '#c0c0c0', stock: 0, images: [img('juicer3')] },
  ],
  description:
    'Extractor de Jugos MERTEC MT-041S - 500W, Acero Inoxidable, 2 Velocidades, Boca Ancha, Jugos Frescos y Saludables\n\n' +
    'Transforma tu salud con el Extractor de Jugos MERTEC MT-041S, tu aliado para jugos naturales y nutritivos. ' +
    'Su potente motor de 500W y conducto de alimentación ancho extraen eficientemente frutas y verduras, conservando sus nutrientes. ' +
    'Con un elegante diseño de base de acero inoxidable, 2 velocidades ajustables y un cierre seguro, este extractor de 800ml de capacidad de jugo y 1500ml de pulpa te ofrece durabilidad y frescura en cada vaso.\n\n' +
    'Características Destacadas:\n• Jugo Fresco al Instante: Prepara jugos nutritivos en segundos.\n• Potente Motor de 500W: Extracción rápida y eficiente.',
}

const seller: MLSeller = {
  name: 'Mertec',
  isOfficial: true,
  logoUrl: img('mertec-logo'),
  salesText: '+10 mil ventas',
  level: 'MercadoLíder Platinum',
  reputation: 5,
}

const related: MLProduct[] = [
  { id: 'r1', name: 'Extractor De Jugo Automático You R2817s Con 1000w Y Vaso', salePrice: 186583, offerPrice: 163720, isOnOffer: true, images: [img('rel1')] },
  { id: 'r2', name: 'Extractor De Jugos Home Elements Negro Con Accesorios', salePrice: 269900, offerPrice: 233910, isOnOffer: true, images: [img('rel2')] },
  { id: 'r3', name: 'Extractor De Jugos Breville Juice Fountain Cold XL Acero', salePrice: 2350000, offerPrice: 2115000, isOnOffer: true, images: [img('rel3')] },
  { id: 'r4', name: 'Extractor De Jugos Automatico Frutas Y Verduras 500W', salePrice: 199990, offerPrice: 174279, isOnOffer: true, images: [img('rel4')] },
]

const reviews: MLReview[] = [
  { rating: 5, text: 'Excelente extractor, muy potente y fácil de limpiar. Llegó rápido y bien empacado.', location: 'Colombia', date: 'Hace 2 semanas', photo: img('rev1'), likes: 3 },
  { rating: 5, text: 'Cumple con lo prometido, los jugos quedan deliciosos. Recomendado.', location: 'Colombia', date: 'Hace 1 mes', photo: img('rev2'), likes: 1 },
  { rating: 4, text: 'Buen producto por el precio, aunque hace un poco de ruido.', location: 'Colombia', date: 'Hace 1 mes', likes: 0 },
]

const questions: MLQuestion[] = [
  { q: '¿Sirve para extraer jugo de naranja?', a: 'Sí, funciona perfecto con cítricos y todo tipo de frutas y verduras.', date: 'Hace 3 días' },
  { q: '¿Tiene garantía?', a: 'Sí, 12 meses de garantía de fábrica.', date: 'Hace 1 semana' },
]

export default function PreviewProductMLPage() {
  return (
    <div className="min-h-screen bg-[#ededed] py-6">
      <div className="mx-auto max-w-[1200px] bg-white rounded-md shadow-sm overflow-hidden">
        <ProductDetailML
          product={product}
          seller={seller}
          related={related}
          reviews={reviews}
          questions={questions}
          qtyPromo={{ secondUnitPct: 43, tiers: [{ minQty: 3, discountPct: 50 }] }}
          onPromoSelect={(u, q) => console.log('promo', { unitPrice: u, qty: q })}
          onClose={() => alert('Cerrar')}
          onAddToCart={(qty, v) => alert(`Agregar al carrito: ${qty} · ${v?.label ?? 'sin variante'}`)}
          onBuyNow={(qty, v) => alert(`Comprar ahora: ${qty} · ${v?.label ?? 'sin variante'}`)}
          onSelectRelated={(p) => alert(`Ir a: ${p.name}`)}
        />
      </div>
    </div>
  )
}
