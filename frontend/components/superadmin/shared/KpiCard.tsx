'use client'

/**
 * KpiCard — tarjeta de métrica reutilizable para el panel superadmin
 * (analítica, pedidos…). Muestra valor, delta vs período anterior y
 * un mini-sparkline opcional.
 */
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface KpiCardProps {
  label: string
  value: string | number
  /** Variación porcentual vs período anterior (ej. 12 = +12%). */
  delta?: number | null
  icon?: React.ElementType
  /** Serie corta para el sparkline (valores crudos). */
  sparkline?: number[]
  hint?: string
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (!points || points.length < 2) return null
  const w = 80, h = 24
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const stroke = positive ? '#10b981' : '#ef4444'
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function KpiCard({ label, value, delta, icon: _icon, sparkline, hint }: KpiCardProps) {
  const Icon = _icon as React.ComponentType<{ className?: string }>
  const hasDelta = delta != null && !isNaN(delta)
  const positive = (delta ?? 0) >= 0
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground/60" />}
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {hasDelta && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-500' : 'text-destructive'}`}>
                {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {positive ? '+' : ''}{delta!.toFixed(1)}%
                <span className="text-muted-foreground font-normal ml-1">vs anterior</span>
              </span>
            )}
            {hint && !hasDelta && <span className="text-xs text-muted-foreground">{hint}</span>}
          </div>
          {sparkline && <Sparkline points={sparkline} positive={positive} />}
        </div>
      </CardContent>
    </Card>
  )
}
