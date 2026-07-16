'use client'

// ══ Daimuz Loader ══
// Loader de marca full-screen usado en TODA la plataforma. Reemplaza el video mp4
// por la animación de gota vibrante que cae en agua quieta (<DropLoader />).
// Mismo overlay full-screen y backdrop (#050816), así que todos los usos de
// <BoxLoader /> / <FullPageLoader /> siguen funcionando igual.

import { DropLoader } from '@/components/drop-loader'

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ background: '#050816' }}>
      <DropLoader />
    </div>
  )
}

export function BoxLoader() {
  return <FullScreenLoader />
}

export function FullPageLoader() {
  return <FullScreenLoader />
}
