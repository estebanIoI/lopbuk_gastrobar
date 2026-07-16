/**
 * DropLoader — una gota vibrante que cae en agua quieta y genera ondas concéntricas.
 * Animación pura CSS (ver .drop-loader en globals.css).
 */
export function DropLoader({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`} role="status" aria-label={label || 'Cargando'}>
      <div className="drop-loader">
        <span className="drop" />
        <span className="ripple" />
        <span className="ripple r2" />
        <span className="ripple r3" />
        <span className="ripple r4" />
        <span className="ripple r5" />
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}

export default DropLoader
