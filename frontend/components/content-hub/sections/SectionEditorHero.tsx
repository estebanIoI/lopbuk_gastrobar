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

export function SectionEditorHero({ config, onChange }: SectionEditorProps) {
  const handleChange = (key: string, value: string) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Hero / Banner Principal</CardTitle>
        <CardDescription>
          El banner principal de la página con título, descripción y llamado a la acción
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="eyebrow">Eyebrow text (badge pequeño superior)</Label>
          <Input
            id="eyebrow"
            value={config.eyebrow || ''}
            onChange={(e) => handleChange('eyebrow', e.target.value)}
            placeholder="Ej: Nueva colección"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Título (h1)</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Ej: Sabores que conquistan"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtítulo (p)</Label>
          <Textarea
            id="subtitle"
            value={config.subtitle || ''}
            onChange={(e) => handleChange('subtitle', e.target.value)}
            placeholder="Ej: Descubre nuestra selección de platos..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctaText">Texto del botón CTA</Label>
          <Input
            id="ctaText"
            value={config.ctaText || ''}
            onChange={(e) => handleChange('ctaText', e.target.value)}
            placeholder="Ej: Ver menú"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctaLink">Link del botón</Label>
          <Input
            id="ctaLink"
            value={config.ctaLink || ''}
            onChange={(e) => handleChange('ctaLink', e.target.value)}
            placeholder="Ej: /menu"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bgImage">URL imagen de fondo</Label>
          <Input
            id="bgImage"
            value={config.bgImage || ''}
            onChange={(e) => handleChange('bgImage', e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="badgeText">Texto del badge circular (ej: -30%)</Label>
          <Input
            id="badgeText"
            value={config.badgeText || ''}
            onChange={(e) => handleChange('badgeText', e.target.value)}
            placeholder="Ej: -30%"
          />
        </div>

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
