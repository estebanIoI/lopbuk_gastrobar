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

export function SectionEditorCategoryGrid({ config, onChange }: SectionEditorProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Categorías (Grid)</CardTitle>
        <CardDescription>
          Muestra categorías en una cuadrícula con imágenes circulares
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionTitle">Título de la sección</Label>
          <Input
            id="sectionTitle"
            value={config.sectionTitle || ''}
            onChange={(e) => handleChange('sectionTitle', e.target.value)}
            placeholder="Ej: Nuestras Categorías"
          />
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
          <Label htmlFor="categories">Selección de categorías</Label>
          <Textarea
            id="categories"
            value={config.categories || ''}
            onChange={(e) => handleChange('categories', e.target.value)}
            placeholder="IDs de categorías separados por comas"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seeMoreText">Texto &quot;Ver más&quot;</Label>
          <Input
            id="seeMoreText"
            value={config.seeMoreText || ''}
            onChange={(e) => handleChange('seeMoreText', e.target.value)}
            placeholder="Ej: Ver todas las categorías"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seeMoreLink">Link &quot;Ver más&quot;</Label>
          <Input
            id="seeMoreLink"
            value={config.seeMoreLink || ''}
            onChange={(e) => handleChange('seeMoreLink', e.target.value)}
            placeholder="Ej: /categorias"
          />
        </div>

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
