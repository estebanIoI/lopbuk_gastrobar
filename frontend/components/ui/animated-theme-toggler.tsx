"use client"

import { useCallback, useRef } from "react"
import { flushSync } from "react-dom"
import type { ComponentPropsWithoutRef } from "react"

export type TransitionVariant =
  | "circle" | "square" | "triangle" | "diamond"
  | "hexagon" | "rectangle" | "star"

interface AnimatedThemeTogglerProps extends ComponentPropsWithoutRef<"button"> {
  duration?: number
  variant?: TransitionVariant
  fromCenter?: boolean
  isDark: boolean
  onToggle: () => void
}

function clipPaths(
  variant: TransitionVariant,
  cx: number, cy: number, maxR: number,
  vw: number, vh: number
): [string, string] {
  const collapsed = (n: number) =>
    `polygon(${Array.from({ length: n }, () => `${cx}px ${cy}px`).join(", ")})`

  switch (variant) {
    case "circle":
      return [`circle(0px at ${cx}px ${cy}px)`, `circle(${maxR}px at ${cx}px ${cy}px)`]
    case "diamond": {
      const R = maxR * Math.SQRT2
      const end = [`${cx}px ${cy - R}px`, `${cx + R}px ${cy}px`, `${cx}px ${cy + R}px`, `${cx - R}px ${cy}px`].join(", ")
      return [collapsed(4), `polygon(${end})`]
    }
    case "square": {
      const h = Math.max(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) * 1.05
      const end = [`${cx-h}px ${cy-h}px`, `${cx+h}px ${cy-h}px`, `${cx+h}px ${cy+h}px`, `${cx-h}px ${cy+h}px`].join(", ")
      return [collapsed(4), `polygon(${end})`]
    }
    default:
      return [`circle(0px at ${cx}px ${cy}px)`, `circle(${maxR}px at ${cx}px ${cy}px)`]
  }
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

export function AnimatedThemeToggler({
  className,
  duration = 450,
  variant = "circle",
  fromCenter = false,
  isDark,
  onToggle,
  ...props
}: AnimatedThemeTogglerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleClick = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    // If View Transitions not supported, toggle directly
    if (typeof document.startViewTransition !== "function") {
      onToggle()
      return
    }

    // Capture button position before deferring
    const vw = window.visualViewport?.width ?? window.innerWidth
    const vh = window.visualViewport?.height ?? window.innerHeight
    const { top, left, width, height } = button.getBoundingClientRect()
    const cx = fromCenter ? vw / 2 : left + width / 2
    const cy = fromCenter ? vh / 2 : top + height / 2
    const maxR = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy))

    // setTimeout(0) exits React's event-handler batching context so flushSync works
    setTimeout(() => {
      const root = document.documentElement
      root.style.setProperty("--vt-duration", `${duration}ms`)

      let transition: ReturnType<typeof document.startViewTransition>
      try {
        transition = document.startViewTransition(() => {
          flushSync(onToggle)
        })
      } catch {
        // flushSync failed — toggle directly as fallback
        onToggle()
        root.style.removeProperty("--vt-duration")
        return
      }

      transition.finished?.finally?.(() => {
        root.style.removeProperty("--vt-duration")
      })

      transition.ready?.then(() => {
        const [from, to] = clipPaths(variant, cx, cy, maxR, vw, vh)
        document.documentElement.animate(
          { clipPath: [from, to] },
          {
            duration,
            easing: "ease-in-out",
            fill: "forwards",
            pseudoElement: "::view-transition-new(root)",
          }
        )
      })
    }, 0)
  }, [variant, fromCenter, duration, onToggle])

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
