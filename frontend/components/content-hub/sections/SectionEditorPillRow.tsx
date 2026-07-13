'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface SectionEditorProps {
  config: Record<string, any>
  onChange: (config: Record<string, any>) => void
}

export function SectionEditorPillRow({ config, onChange }: SectionEditorProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  const handleBadgeToggle = (badge: string) => {
    const badges: string[] = config.showBadges || []
    const updated = badges.includes(badge)
      ? badges.filter((b) => b !== badge)
      : [...badges, badge]
    handleChange('showBadges', updated)
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Pills de Filtro</CardTitle>
        <CardDescription>
          Fila de pills de filtro sobre una cuadrícula de productos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionTitle">Título de la sección</Label>
          <Input
            id="sectionTitle"
            value={config.sectionTitle || ''}
            onChange={(e) => handleChange('sectionTitle', e.target.value)}
            placeholder="Ej: Infaltables en tu hogar"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pills">Pills (separadas por coma)</Label>
          <Textarea
            id="pills"
            value={config.pills || ''}
            onChange={(e) => handleChange('pills', e.target.value)}
            placeholder="Ej: Bebidas solubles, Alimento mascotas, Aseo hogar"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="productSource">Origen de productos</Label>
          <select
            id="productSource"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={config.productSource || 'byCategory'}
            onChange={(e) => handleChange('productSource', e.target.value)}
          >
            <option value="byCategory">Por categoría</option>
            <option value="byBrand">Por marca</option>
            <option value="byTag">Por tag</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productSourceValue">Valor del origen (categoría/marca/tag)</Label>
          <Input
            id="productSourceValue"
            value={config.productSourceValue || ''}
            onChange={(e) => handleChange('productSourceValue', e.target.value)}
            placeholder="Ej: cervezas"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="columns">Número de columnas</Label>
          <select
            id="columns"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={config.columns || 4}
            onChange={(e) => handleChange('columns', Number(e.target.value))}
          >
            <option value={3}>3 columnas</option>
            <option value={4}>4 columnas</option>
            <option value={5}>5 columnas</option>
            <option value={6}>6 columnas</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Mostrar badges</Label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(config.showBadges || []).includes('Nuevo')}
                onChange={() => handleBadgeToggle('Nuevo')}
              />
              Nuevo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(config.showBadges || []).includes('Oferta')}
                onChange={() => handleBadgeToggle('Oferta')}
              />
              Oferta
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seeMoreText">Texto &quot;Ver más&quot;</Label>
          <Input
            id="seeMoreText"
            value={config.seeMoreText || ''}
            onChange={(e) => handleChange('seeMoreText', e.target.value)}
            placeholder="Ej: Ver todos los productos"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seeMoreLink">Link &quot;Ver más&quot;</Label>
          <Input
            id="seeMoreLink"
            value={config.seeMoreLink || ''}
            onChange={(e) => handleChange('seeMoreLink', e.target.value)}
            placeholder="Ej: /productos"
          />
        </div>

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
