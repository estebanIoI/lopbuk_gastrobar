'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Save, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Step {
  step: number
  instruction: string
}

interface Props {
  recipe?: any
  onClose: () => void
  onSave: () => void
}

const DIFFICULTY_OPTIONS = ['fácil', 'medio', 'difícil']

export function RecipeEditor({ recipe, onClose, onSave }: Props) {
  const [title, setTitle] = useState(recipe?.title || '')
  const [description, setDescription] = useState(recipe?.description || '')
  const [imageUrl, setImageUrl] = useState(recipe?.image_url || '')
  const [prepTime, setPrepTime] = useState(recipe?.prep_time?.toString() || '')
  const [difficulty, setDifficulty] = useState(recipe?.difficulty || 'fácil')
  const [servings, setServings] = useState(recipe?.servings?.toString() || '')
  const [steps, setSteps] = useState<Step[]>(
    recipe?.steps && Array.isArray(recipe.steps)
      ? recipe.steps.map((s: any, i: number) => ({
          step: s.step || i + 1,
          instruction: s.instruction || '',
        }))
      : [{ step: 1, instruction: '' }]
  )
  const [tips, setTips] = useState(recipe?.tips || '')
  const [tags, setTags] = useState(
    Array.isArray(recipe?.tags) ? recipe.tags.join(', ') : recipe?.tags || ''
  )
  const [saving, setSaving] = useState(false)

  const handleAddStep = () => {
    setSteps((prev) => [...prev, { step: prev.length + 1, instruction: '' }])
  }

  const handleRemoveStep = (index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step: i + 1 }))
    )
  }

  const handleStepChange = (index: number, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, instruction: value } : s))
    )
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('El título es obligatorio')
      return
    }

    setSaving(true)
    try {
      const data = {
        title: title.trim(),
        description,
        image_url: imageUrl,
        prep_time: prepTime ? parseInt(prepTime, 10) : null,
        difficulty,
        servings: servings ? parseInt(servings, 10) : null,
        steps: steps.filter((s) => s.instruction.trim()),
        tips,
        tags: tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
      }

      let res
      if (recipe?.id) {
        res = await api.updateRecipePage(recipe.id, data)
      } else {
        res = await api.createRecipePage(data)
      }

      if (res.success) {
        toast.success(recipe?.id ? 'Receta actualizada' : 'Receta creada')
        onSave()
      } else {
        toast.error(res.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error al guardar receta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{recipe?.id ? 'Editar receta' : 'Nueva receta'}</CardTitle>
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
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de la receta"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descripción de la receta"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl">URL de imagen</Label>
          <Input
            id="imageUrl"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="prepTime">Tiempo de preparación (min)</Label>
            <Input
              id="prepTime"
              type="number"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              placeholder="Ej: 30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Dificultad</Label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-background">
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Porciones</Label>
            <Input
              id="servings"
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="Ej: 4"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Pasos</Label>
            <Button variant="outline" size="sm" onClick={handleAddStep}>
              <Plus className="h-3 w-3 mr-1" />
              Agregar paso
            </Button>
          </div>
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 text-sm font-medium text-muted-foreground w-6 shrink-0">
                {i + 1}.
              </span>
              <Textarea
                value={s.instruction}
                onChange={(e) => handleStepChange(i, e.target.value)}
                placeholder={`Paso ${i + 1}`}
                rows={2}
                className="flex-1"
              />
              {steps.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveStep(i)}
                  className="text-destructive mt-1"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tips">Tips / Consejos</Label>
          <Textarea
            id="tips"
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            placeholder="Tips adicionales para esta receta"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Ej: vegano, sin gluten, postre"
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
            {recipe?.id ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
