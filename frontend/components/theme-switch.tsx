'use client'

// Interruptor de tema (claro/oscuro) minimalista.
// La ANIMACIÓN se conserva intacta: reveal circular con View Transitions API
// (barrido del tema desde el botón). Solo el botón se simplificó a un icono
// Sol/Luna limpio, alineado con los demás iconos del header.
import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

const CSS = `
/* View Transitions: reveal circular limpio (sin cross-fade) — animación intacta */
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
::view-transition-new(root) { z-index: 2147483646; }
::view-transition-old(root) { z-index: 1; }
`

export function ThemeSwitch({ size = 18 }: { size?: number }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => setMounted(true), [])

  const isDark = mounted ? (resolvedTheme || theme) === 'dark' : true

  const toggle = () => {
    const next = isDark ? 'light' : 'dark'
    const doc: any = document
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(next); return
    }
    const rect = ref.current?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 40
    const y = rect ? rect.top + rect.height / 2 : 40
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const t = doc.startViewTransition(() => setTheme(next))
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 480, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      )
    }).catch(() => {})
  }

  return (
    <>
      <style>{CSS}</style>
      <button
        ref={ref}
        onClick={toggle}
        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        aria-label="Cambiar tema"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        {/* Sol / Luna con crossfade + rotación suave (independiente del reveal de tema) */}
        <Sun
          size={size}
          className={`absolute transition-all duration-300 ${isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}
        />
        <Moon
          size={size}
          className={`absolute transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}
        />
      </button>
    </>
  )
}
