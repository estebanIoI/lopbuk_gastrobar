'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SectionEditorProps {
  config: Record<string, any>
  onChange: (config: Record<string, any>) => void
}

export function SectionEditorProductGrid({ config, onChange }: SectionEditorProps) {
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
        <CardTitle>Productos (Grid)</CardTitle>
        <CardDescription>
          Muestra productos en una cuadrícula
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionTitle">Título de la sección</Label>
          <Input
            id="sectionTitle"
            value={config.sectionTitle || ''}
            onChange={(e) => handleChange('sectionTitle', e.target.value)}
            placeholder="Ej: Nuestros Productos"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source">Origen de productos</Label>
          <select
            id="source"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={config.source || 'manual'}
            onChange={(e) => handleChange('source', e.target.value)}
          >
            <option value="manual">Manual</option>
            <option value="category">Por categoría</option>
            <option value="brand">Por marca</option>
            <option value="featured">Destacados</option>
            <option value="tag">Por tag</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="columns">Número de columnas (2-6)</Label>
          <Input
            id="columns"
            type="number"
            min={2}
            max={6}
            value={config.columns || 4}
            onChange={(e) => handleChange('columns', Number(e.target.value))}
          />
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
