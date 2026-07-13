'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Pencil, Save, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface FaqCategory {
  id: string
  name: string
}

interface FaqItem {
  id: string
  category_id: string
  question: string
  answer: string
}

export function FaqManager() {
  const [categories, setCategories] = useState<FaqCategory[]>([])
  const [items, setItems] = useState<FaqItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [loadingCategories, setLoadingCategories] = useState(true)

  const [editingCategory, setEditingCategory] = useState<FaqCategory | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)

  const [editingItem, setEditingItem] = useState<FaqItem | null>(null)
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [savingItem, setSavingItem] = useState(false)

  const loadCategories = async () => {
    setLoadingCategories(true)
    try {
      const res = await api.getFaqCategories()
      if (res.success && res.data) {
        setCategories(res.data)
      }
    } catch {
      toast.error('Error al cargar categorías')
    } finally {
      setLoadingCategories(false)
    }
  }

  const loadItems = async (categoryId: string) => {
    try {
      const res = await api.getFaqItems(categoryId)
      if (res.success && res.data) {
        setItems(res.data)
      }
    } catch {
      toast.error('Error al cargar preguntas')
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      loadItems(selectedCategoryId)
    } else {
      setItems([])
    }
  }, [selectedCategoryId])

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setSavingCategory(true)
    try {
      const res = await api.createFaqCategory({ name: newCategoryName.trim() })
      if (res.success) {
        toast.success('Categoría creada')
        setNewCategoryName('')
        setIsAddingCategory(false)
        loadCategories()
      } else {
        toast.error(res.error || 'Error al crear categoría')
      }
    } catch {
      toast.error('Error al crear categoría')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) return
    setSavingCategory(true)
    try {
      const res = await api.updateFaqCategory(editingCategory.id, {
        name: newCategoryName.trim(),
      })
      if (res.success) {
        toast.success('Categoría actualizada')
        setEditingCategory(null)
        setNewCategoryName('')
        loadCategories()
      } else {
        toast.error(res.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error al actualizar categoría')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await api.deleteFaqCategory(id)
      if (res.success) {
        toast.success('Categoría eliminada')
        if (selectedCategoryId === id) {
          setSelectedCategoryId(null)
        }
        loadCategories()
      } else {
        toast.error(res.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar categoría')
    }
  }

  const handleCreateItem = async () => {
    if (!selectedCategoryId || !newQuestion.trim() || !newAnswer.trim()) return
    setSavingItem(true)
    try {
      const res = await api.createFaqItem({
        category_id: selectedCategoryId,
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
      })
      if (res.success) {
        toast.success('Pregunta creada')
        setNewQuestion('')
        setNewAnswer('')
        setIsAddingItem(false)
        loadItems(selectedCategoryId)
      } else {
        toast.error(res.error || 'Error al crear pregunta')
      }
    } catch {
      toast.error('Error al crear pregunta')
    } finally {
      setSavingItem(false)
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem || !newQuestion.trim() || !newAnswer.trim()) return
    setSavingItem(true)
    try {
      const res = await api.updateFaqItem(editingItem.id, {
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
      })
      if (res.success) {
        toast.success('Pregunta actualizada')
        setEditingItem(null)
        setNewQuestion('')
        setNewAnswer('')
        loadItems(editingItem.category_id)
      } else {
        toast.error(res.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error al actualizar pregunta')
    } finally {
      setSavingItem(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await api.deleteFaqItem(id)
      if (res.success) {
        toast.success('Pregunta eliminada')
        if (selectedCategoryId) loadItems(selectedCategoryId)
      } else {
        toast.error(res.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar pregunta')
    }
  }

  const startEditCategory = (cat: FaqCategory) => {
    setEditingCategory(cat)
    setNewCategoryName(cat.name)
    setIsAddingCategory(false)
  }

  const startEditItem = (item: FaqItem) => {
    setEditingItem(item)
    setNewQuestion(item.question)
    setNewAnswer(item.answer)
    setIsAddingItem(false)
  }

  const cancelCategoryForm = () => {
    setEditingCategory(null)
    setNewCategoryName('')
    setIsAddingCategory(false)
  }

  const cancelItemForm = () => {
    setEditingItem(null)
    setNewQuestion('')
    setNewAnswer('')
    setIsAddingItem(false)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left panel: Categories */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Categorías FAQ</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setIsAddingCategory(true)
                setEditingCategory(null)
                setNewCategoryName('')
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(isAddingCategory || editingCategory) && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="categoryName">Nombre</Label>
              <Input
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nombre de la categoría"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    editingCategory ? handleUpdateCategory() : handleCreateCategory()
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                  disabled={savingCategory}
                >
                  {savingCategory ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelCategoryForm}>
                  <X className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {loadingCategories ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay categorías. Crea la primera.
            </p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                  selectedCategoryId === cat.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <span className="text-sm font-medium">{cat.name}</span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-xs" onClick={() => startEditCategory(cat)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Right panel: Items */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {selectedCategory ? `Preguntas — ${selectedCategory.name}` : 'Preguntas'}
            </CardTitle>
            {selectedCategoryId && (
              <Button
                size="sm"
                onClick={() => {
                  setIsAddingItem(true)
                  setEditingItem(null)
                  setNewQuestion('')
                  setNewAnswer('')
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nueva pregunta
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedCategoryId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Selecciona una categoría para ver sus preguntas.
            </p>
          ) : (isAddingItem || editingItem) ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-2">
                <Label htmlFor="itemQuestion">Pregunta</Label>
                <Input
                  id="itemQuestion"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Escribe la pregunta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemAnswer">Respuesta</Label>
                <Textarea
                  id="itemAnswer"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Escribe la respuesta"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={editingItem ? handleUpdateItem : handleCreateItem}
                  disabled={savingItem}
                >
                  {savingItem ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelItemForm}>
                  <X className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay preguntas en esta categoría.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {item.answer}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon-xs" onClick={() => startEditItem(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
