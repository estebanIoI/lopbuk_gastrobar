'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Badge {
  id: string
  icon: string
  title: string
  description: string
}

const MAX_BADGES = 4

const ICON_SUGGESTIONS = [
  'Truck',
  'Shield',
  'Headphones',
  'CreditCard',
  'Clock',
  'Award',
  'Star',
  'ThumbsUp',
  'Package',
  'RefreshCw',
  'Lock',
  'Heart',
]

export function TrustBadgesEditor() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const loadBadges = async () => {
    setLoading(true)
    try {
      const res = await api.getTrustBadges()
      if (res.success && res.data) {
        setBadges(res.data)
      }
    } catch {
      toast.error('Error al cargar insignias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBadges()
  }, [])

  const handleAdd = async () => {
    if (badges.length >= MAX_BADGES) {
      toast.error(`Máximo ${MAX_BADGES} insignias permitidas`)
      return
    }

    try {
      const res = await api.createTrustBadge({
        icon: 'Star',
        title: '',
        description: '',
      })
      if (res.success) {
        toast.success('Insignia agregada')
        loadBadges()
      } else {
        toast.error(res.error || 'Error al agregar')
      }
    } catch {
      toast.error('Error al agregar insignia')
    }
  }

  const handleUpdate = async (badge: Badge) => {
    setSavingIds((prev) => new Set(prev).add(badge.id))
    try {
      const res = await api.updateTrustBadge(badge.id, {
        icon: badge.icon,
        title: badge.title,
        description: badge.description,
      })
      if (res.success) {
        toast.success('Insignia actualizada')
      } else {
        toast.error(res.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error al actualizar insignia')
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(badge.id)
        return next
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await api.deleteTrustBadge(id)
      if (res.success) {
        toast.success('Insignia eliminada')
        setBadges((prev) => prev.filter((b) => b.id !== id))
      } else {
        toast.error(res.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar insignia')
    }
  }

  const handleFieldChange = (id: string, field: keyof Badge, value: string) => {
    setBadges((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Insignias de Confianza</h2>
          <p className="text-sm text-muted-foreground">
            {badges.length}/{MAX_BADGES} insignias
          </p>
        </div>
        <Button onClick={handleAdd} disabled={badges.length >= MAX_BADGES}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar badge
        </Button>
      </div>

      {loading ? (
        <Card variant="glass">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : badges.length === 0 ? (
        <Card variant="glass">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg">No hay insignias configuradas.</p>
            <p className="text-sm mt-1">Agrega badges como "Envío gratis", "Compra segura", etc.</p>
            <Button className="mt-4" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar badge
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {badges.map((badge) => {
            const isSaving = savingIds.has(badge.id)
            return (
              <Card key={badge.id} variant="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Badge</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(badge.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`icon-${badge.id}`}>Ícono</Label>
                    <div className="space-y-2">
                      <Input
                        id={`icon-${badge.id}`}
                        value={badge.icon}
                        onChange={(e) => handleFieldChange(badge.id, 'icon', e.target.value)}
                        placeholder="Ej: Truck, Shield, Headphones"
                      />
                      <div className="flex flex-wrap gap-1">
                        {ICON_SUGGESTIONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => handleFieldChange(badge.id, 'icon', icon)}
                            className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                              badge.icon === icon
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:bg-muted'
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`title-${badge.id}`}>Título</Label>
                    <Input
                      id={`title-${badge.id}`}
                      value={badge.title}
                      onChange={(e) => handleFieldChange(badge.id, 'title', e.target.value)}
                      placeholder="Ej: Envío gratis"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`desc-${badge.id}`}>Descripción</Label>
                    <Textarea
                      id={`desc-${badge.id}`}
                      value={badge.description}
                      onChange={(e) => handleFieldChange(badge.id, 'description', e.target.value)}
                      placeholder="Ej: En pedidos superiores a $50.000"
                      rows={2}
                    />
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleUpdate(badge)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Guardar
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
