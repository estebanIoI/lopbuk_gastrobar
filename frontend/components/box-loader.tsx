'use client'

// ══ Daimuz Video Loader ══
// Loader de marca por video, usado en TODA la plataforma. Reemplaza el antiguo loader
// de partículas (Three.js). Mismo overlay full-screen y fondo que el anterior (#050816),
// así que todos los usos de <BoxLoader /> / <FullPageLoader /> siguen funcionando igual.

const LOADER_SRC = '/loader-daimuz.mp4'

function VideoLoader() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: '#050816' }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={LOADER_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Cargando"
        // Llena la pantalla en ambos formatos (móvil vertical / escritorio horizontal):
        // object-cover recorta lo mínimo para cubrir sin franjas negras.
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      />
    </div>
  )
}

export function BoxLoader() {
  return <VideoLoader />
}

export function FullPageLoader() {
  return <VideoLoader />
}
