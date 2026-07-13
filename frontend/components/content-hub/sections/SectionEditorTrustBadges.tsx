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

interface BadgeConfig {
  icon: string
  title: string
  description: string
}

export function SectionEditorTrustBadges({ config, onChange }: SectionEditorProps) {
  const badges: BadgeConfig[] = config.badges || [
    { icon: '', title: '', description: '' },
    { icon: '', title: '', description: '' },
    { icon: '', title: '', description: '' },
  ]

  const handleChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  const handleBadgeChange = (index: number, field: keyof BadgeConfig, value: string) => {
    const updated = badges.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    )
    handleChange('badges', updated)
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Insignias de Confianza</CardTitle>
        <CardDescription>
          Muestra badges de confianza como envíos, seguridad, atención al cliente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sectionTitle">Título de la sección</Label>
          <Input
            id="sectionTitle"
            value={config.sectionTitle || ''}
            onChange={(e) => handleChange('sectionTitle', e.target.value)}
            placeholder="Ej: Confían en nosotros"
          />
        </div>

        {badges.map((badge, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-4">
            <Label className="text-sm font-semibold">Badge {i + 1}</Label>
            <div className="space-y-2">
              <Label htmlFor={`badge-${i}-icon`}>Ícono</Label>
              <Input
                id={`badge-${i}-icon`}
                value={badge.icon}
                onChange={(e) => handleBadgeChange(i, 'icon', e.target.value)}
                placeholder="Ej: Truck, Shield, Headphones"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`badge-${i}-title`}>Título</Label>
              <Input
                id={`badge-${i}-title`}
                value={badge.title}
                onChange={(e) => handleBadgeChange(i, 'title', e.target.value)}
                placeholder="Ej: Envío gratis"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`badge-${i}-description`}>Descripción</Label>
              <Input
                id={`badge-${i}-description`}
                value={badge.description}
                onChange={(e) => handleBadgeChange(i, 'description', e.target.value)}
                placeholder="Ej: En pedidos superiores a $50.000"
              />
            </div>
          </div>
        ))}

        <Button onClick={() => onChange(config)}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
