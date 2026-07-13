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

interface FooterColumn {
  title: string
  links: string
}

export function SectionEditorFooter({ config, onChange }: SectionEditorProps) {
  const columns: FooterColumn[] = config.columns || [
    { title: '', links: '' },
    { title: '', links: '' },
    { title: '', links: '' },
    { title: '', links: '' },
  ]

  const handleChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  const handleColumnChange = (index: number, field: keyof FooterColumn, value: string) => {
    const updated = columns.map((col, i) =>
      i === index ? { ...col, [field]: value } : col
    )
    handleChange('columns', updated)
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Footer</CardTitle>
        <CardDescription>
          Pie de página con columnas de links, contacto, redes sociales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email de contacto</Label>
          <Input
            id="contactEmail"
            value={config.contactEmail || ''}
            onChange={(e) => handleChange('contactEmail', e.target.value)}
            placeholder="Ej: contacto@lopbuk.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={config.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="Ej: +56 9 1234 5678"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="copyright">Texto de copyright</Label>
          <Input
            id="copyright"
            value={config.copyright || ''}
            onChange={(e) => handleChange('copyright', e.target.value)}
            placeholder="Ej: © 2026 Lopbuk. Todos los derechos reservados."
          />
        </div>

        {columns.map((col, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-4">
            <Label className="text-sm font-semibold">Columna {i + 1}</Label>
            <div className="space-y-2">
              <Label htmlFor={`col-${i}-title`}>Título</Label>
              <Input
                id={`col-${i}-title`}
                value={col.title}
                onChange={(e) => handleColumnChange(i, 'title', e.target.value)}
                placeholder={`Ej: ${i === 0 ? 'Menú' : i === 1 ? 'Sobre nosotros' : i === 2 ? 'Ayuda' : 'Legal'}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`col-${i}-links`}>Links (separados por comas)</Label>
              <Input
                id={`col-${i}-links`}
                value={col.links}
                onChange={(e) => handleColumnChange(i, 'links', e.target.value)}
                placeholder="Ej: Nombre|/ruta, Otro|/otra-ruta"
              />
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <Label htmlFor="googlePlayUrl">Google Play URL</Label>
          <Input
            id="googlePlayUrl"
            value={config.googlePlayUrl || ''}
            onChange={(e) => handleChange('googlePlayUrl', e.target.value)}
            placeholder="https://play.google.com/..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="appStoreUrl">App Store URL</Label>
          <Input
            id="appStoreUrl"
            value={config.appStoreUrl || ''}
            onChange={(e) => handleChange('appStoreUrl', e.target.value)}
            placeholder="https://apps.apple.com/..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instagramUrl">Instagram URL</Label>
          <Input
            id="instagramUrl"
            value={config.instagramUrl || ''}
            onChange={(e) => handleChange('instagramUrl', e.target.value)}
            placeholder="https://instagram.com/..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="facebookUrl">Facebook URL</Label>
          <Input
            id="facebookUrl"
            value={config.facebookUrl || ''}
            onChange={(e) => handleChange('facebookUrl', e.target.value)}
            placeholder="https://facebook.com/..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tiktokUrl">TikTok URL</Label>
          <Input
            id="tiktokUrl"
            value={config.tiktokUrl || ''}
            onChange={(e) => handleChange('tiktokUrl', e.target.value)}
            placeholder="https://tiktok.com/..."
          />
        </div>

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
