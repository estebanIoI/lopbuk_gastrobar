'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Save, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  page?: any
  onClose: () => void
  onSave: () => void
}

const PAGE_TYPES = [
  { value: 'corporate', label: 'Corporativa' },
  { value: 'legal', label: 'Legal' },
  { value: 'custom', label: 'Personalizada' },
]

export function ContentPageEditor({ page, onClose, onSave }: Props) {
  const [title, setTitle] = useState(page?.title || '')
  const [slug, setSlug] = useState(page?.slug || '')
  const [pageType, setPageType] = useState(page?.page_type || 'custom')
  const [metaTitle, setMetaTitle] = useState(page?.meta_title || '')
  const [metaDescription, setMetaDescription] = useState(page?.meta_description || '')
  const [content, setContent] = useState(page?.content || '')
  const [isPublished, setIsPublished] = useState(page?.is_published || false)
  const [saving, setSaving] = useState(false)

  const generateSlug = useCallback((val: string) => {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }, [])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!page?.slug) {
      setSlug(generateSlug(val))
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('El título es obligatorio')
      return
    }
    if (!slug.trim()) {
      toast.error('El slug es obligatorio')
      return
    }

    setSaving(true)
    try {
      const data = {
        title: title.trim(),
        slug: slug.trim(),
        page_type: pageType,
        meta_title: metaTitle.trim() || title.trim(),
        meta_description: metaDescription.trim(),
        content,
        is_published: isPublished,
      }

      let res
      if (page?.id) {
        res = await api.updateContentPage(page.id, data)
      } else {
        res = await api.createContentPage(data)
      }

      if (res.success) {
        toast.success(page?.id ? 'Página actualizada' : 'Página creada')
        onSave()
      } else {
        toast.error(res.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error al guardar página')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{page?.id ? 'Editar página' : 'Nueva página'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Título de la página"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="slug-de-la-pagina"
          />
          <p className="text-xs text-muted-foreground">URL: /{slug || '...'}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pageType">Tipo de página</Label>
          <select
            id="pageType"
            value={pageType}
            onChange={(e) => setPageType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {PAGE_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-background">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta título (SEO)</Label>
            <Input
              id="metaTitle"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Título para motores de búsqueda"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta descripción (SEO)</Label>
            <Input
              id="metaDescription"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="Descripción breve para SEO"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Contenido</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contenido HTML de la página..."
            rows={12}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Puedes usar HTML para dar formato al contenido.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <Label htmlFor="published" className="text-sm font-medium">
              Publicada
            </Label>
            <p className="text-xs text-muted-foreground">
              Visible para los visitantes del sitio
            </p>
          </div>
          <Switch
            id="published"
            checked={isPublished}
            onCheckedChange={setIsPublished}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {page?.id ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
