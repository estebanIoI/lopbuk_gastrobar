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

export function SectionEditorNewsletter({ config, onChange }: SectionEditorProps) {
  const handleChange = (key: string, value: string) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Newsletter</CardTitle>
        <CardDescription>
          Formulario de suscripción al newsletter
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Ej: Suscríbete a nuestro newsletter"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtítulo</Label>
          <Input
            id="subtitle"
            value={config.subtitle || ''}
            onChange={(e) => handleChange('subtitle', e.target.value)}
            placeholder="Ej: Recibe las mejores ofertas y novedades"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailPlaceholder">Placeholder del email</Label>
          <Input
            id="emailPlaceholder"
            value={config.emailPlaceholder || ''}
            onChange={(e) => handleChange('emailPlaceholder', e.target.value)}
            placeholder="Ej: tu@email.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buttonText">Texto del botón</Label>
          <Input
            id="buttonText"
            value={config.buttonText || ''}
            onChange={(e) => handleChange('buttonText', e.target.value)}
            placeholder="Ej: Suscribirme"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="termsText">Texto del checkbox (términos)</Label>
          <Input
            id="termsText"
            value={config.termsText || ''}
            onChange={(e) => handleChange('termsText', e.target.value)}
            placeholder="Ej: Acepto los términos y condiciones"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bgColor">Color de fondo</Label>
          <Input
            id="bgColor"
            type="color"
            value={config.bgColor || '#000000'}
            onChange={(e) => handleChange('bgColor', e.target.value)}
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
