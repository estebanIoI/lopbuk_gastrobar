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

export function SectionEditorBrandChips({ config, onChange }: SectionEditorProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Marcas (Chips)</CardTitle>
        <CardDescription>
          Chips con nombres de marcas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionTitle">Título de la sección</Label>
          <Input
            id="sectionTitle"
            value={config.sectionTitle || ''}
            onChange={(e) => handleChange('sectionTitle', e.target.value)}
            placeholder="Ej: Nuestras mejores marcas"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brands">Marcas (separadas por coma)</Label>
          <Textarea
            id="brands"
            value={config.brands || ''}
            onChange={(e) => handleChange('brands', e.target.value)}
            placeholder="Ej: Albar, Besties, Bonaropa"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxItems">Cantidad visible antes de &quot;Ver más&quot;</Label>
          <Input
            id="maxItems"
            type="number"
            min={1}
            value={config.maxItems || 8}
            onChange={(e) => handleChange('maxItems', Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="chipStyle">Estilo de los chips</Label>
          <select
            id="chipStyle"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={config.chipStyle || 'pill'}
            onChange={(e) => handleChange('chipStyle', e.target.value)}
          >
            <option value="pill">Píldora</option>
            <option value="rounded">Redondeado</option>
            <option value="square">Cuadrado</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showLogos"
            checked={config.showLogos ?? true}
            onChange={(e) => handleChange('showLogos', e.target.checked)}
          />
          <Label htmlFor="showLogos">Mostrar logos de marcas</Label>
        </div>

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
