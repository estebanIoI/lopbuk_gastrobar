'use client'

// ══ Daimuz Cinematic Loader — reemplazo del BoxLoader antiguo ══
// El loader original Uiverse se mantiene abajo como fallback.

import { DaimuzLoader, DaimuzFullPageLoader } from '@/components/loaders/daimuz-loader'

export function BoxLoader() {
  return <DaimuzLoader loading={true} />
}

export function FullPageLoader() {
  return <DaimuzFullPageLoader />
}
