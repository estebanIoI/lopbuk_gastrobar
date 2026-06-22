'use client'

/**
 * useIsDesktop — breakpoint reactivo (C3). Devuelve null hasta montar (evita
 * mismatch SSR) y luego true/false. Permite renderizar UN solo shell del
 * Consumer OS por viewport (sin doble-montaje ni doble-fetch).
 */
import { useEffect, useState } from 'react'

export function useIsDesktop(query = '(min-width: 768px)'): boolean | null {
  const [is, setIs] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setIs(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return is
}
