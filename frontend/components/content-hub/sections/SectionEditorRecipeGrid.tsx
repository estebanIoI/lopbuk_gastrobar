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

export function SectionEditorRecipeGrid({ config, onChange }: SectionEditorProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Recetas</CardTitle>
        <CardDescription>
          Muestra recetas en tarjetas con imagen, precio y link
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionTitle">Título de la sección</Label>
          <Input
            id="sectionTitle"
            value={config.sectionTitle || ''}
            onChange={(e) => handleChange('sectionTitle', e.target.value)}
            placeholder="Ej: Nuestras Recetas"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source">Origen de recetas</Label>
          <select
            id="source"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={config.source || 'manual'}
            onChange={(e) => handleChange('source', e.target.value)}
          >
            <option value="manual">Manual</option>
            <option value="all">Todas</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="columns">Número de columnas (3-4)</Label>
          <Input
            id="columns"
            type="number"
            min={3}
            max={4}
            value={config.columns || 3}
            onChange={(e) => handleChange('columns', Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seeAllText">Texto &quot;Ver todas&quot;</Label>
          <Input
            id="seeAllText"
            value={config.seeAllText || ''}
            onChange={(e) => handleChange('seeAllText', e.target.value)}
            placeholder="Ej: Ver todas las recetas"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seeAllLink">Link &quot;Ver todas&quot;</Label>
          <Input
            id="seeAllLink"
            value={config.seeAllLink || ''}
            onChange={(e) => handleChange('seeAllLink', e.target.value)}
            placeholder="Ej: /recetas"
          />
        </div>

        <div className="space-y-2">
          <Label>Selector de personas</Label>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input
              type="checkbox"
              checked={config.showPeopleSelector || false}
              onChange={(e) => handleChange('showPeopleSelector', e.target.checked)}
            />
            Mostrar / Ocultar
          </label>
        </div>

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
