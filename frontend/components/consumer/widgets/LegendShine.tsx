'use client'

/**
 * LegendShine — barrido de brillo sutil para superficies LEGEND (C7.6).
 * Colócalo dentro de un contenedor `relative overflow-hidden`.
 */
export default function LegendShine() {
  return (
    <>
      <style>{`@keyframes lgShine{0%{transform:translateX(-150%) skewX(-12deg)}55%,100%{transform:translateX(280%) skewX(-12deg)}}`}</style>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/4"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.28), transparent)', animation: 'lgShine 5s ease-in-out infinite' }}
      />
    </>
  )
}
