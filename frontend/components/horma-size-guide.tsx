'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Ruler } from 'lucide-react'

// Tabla de medidas de una horma, lista para usar en la ficha de producto del storefront.
//
// Uso A (ya tienes el objeto horma):
//   <HormaSizeGuide horma={producto.horma} />
// Uso B (solo tienes el id):
//   <HormaSizeGuide hormaId={producto.hormaId} />

interface SizeMeasures { ancho?: number; largo?: number; manga?: number }
type SizeChart = Record<string, SizeMeasures>
interface HormaLike {
  name?: string
  hasSleeves?: boolean
  sizeChart?: SizeChart
}

interface Props {
  horma?: HormaLike | null
  hormaId?: string | null
  className?: string
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

export function HormaSizeGuide({ horma: hormaProp, hormaId, className }: Props) {
  const [horma, setHorma] = useState<HormaLike | null>(hormaProp ?? null)

  useEffect(() => {
    let active = true
    if (!hormaProp && hormaId) {
      api.getHorma(hormaId).then(res => {
        if (active && res.success && res.data) setHorma(res.data as HormaLike)
      })
    } else {
      setHorma(hormaProp ?? null)
    }
    return () => { active = false }
  }, [hormaProp, hormaId])

  const chart = horma?.sizeChart
  if (!chart || Object.keys(chart).length === 0) return null

  // Ordena tallas de forma natural
  const sizes = Object.keys(chart).sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase())
    const ib = SIZE_ORDER.indexOf(b.toUpperCase())
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const hasManga = horma?.hasSleeves !== false &&
    sizes.some(s => chart[s]?.manga != null)
  const rows: { key: keyof SizeMeasures; label: string }[] = [
    { key: 'ancho', label: 'Ancho' },
    { key: 'largo', label: 'Largo' },
    ...(hasManga ? [{ key: 'manga' as const, label: 'Manga' }] : []),
  ]

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">
        <Ruler className="h-4 w-4" />
        Guía de tallas{horma?.name ? ` · ${horma.name}` : ''} (cm)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-medium">Talla</th>
              {sizes.map(s => <th key={s} className="p-2 font-medium text-center">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-b last:border-0">
                <td className="p-2 text-muted-foreground">{row.label}</td>
                {sizes.map(s => (
                  <td key={s} className="p-2 text-center">{chart[s]?.[row.key] ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
