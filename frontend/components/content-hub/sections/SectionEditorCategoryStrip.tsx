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

export function SectionEditorCategoryStrip({ config, onChange }: SectionEditorProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Barra de Categorías</CardTitle>
        <CardDescription>
          Barra horizontal con categorías estilo navegación superior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionTitle">Título de la sección</Label>
          <Input
            id="sectionTitle"
            value={config.sectionTitle || ''}
            onChange={(e) => handleChange('sectionTitle', e.target.value)}
            placeholder="Ej: Categorías"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categories">Categorías (separadas por coma)</Label>
          <Textarea
            id="categories"
            value={config.categories || ''}
            onChange={(e) => handleChange('categories', e.target.value)}
            placeholder="Ej: tragos, pizzas, hamburguesas, postres"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showIcons"
            checked={config.showIcons ?? true}
            onChange={(e) => handleChange('showIcons', e.target.checked)}
          />
          <Label htmlFor="showIcons">Mostrar íconos de categorías</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="textSize">Tamaño de texto</Label>
          <select
            id="textSize"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={config.textSize || 'medium'}
            onChange={(e) => handleChange('textSize', e.target.value)}
          >
            <option value="small">Pequeño</option>
            <option value="medium">Mediano</option>
            <option value="large">Grande</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="backgroundColor">Color de fondo</Label>
          <Input
            id="backgroundColor"
            type="color"
            value={config.backgroundColor || '#000000'}
            onChange={(e) => handleChange('backgroundColor', e.target.value)}
            className="h-10 w-16 p-1 cursor-pointer"
          />
        </div>

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
