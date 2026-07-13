'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface SearchTerm {
  id: string
  term: string
  position: number
}

const MAX_ITEMS = 10

export function PopularSearchesEditor() {
  const [terms, setTerms] = useState<SearchTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [newTerm, setNewTerm] = useState('')
  const [adding, setAdding] = useState(false)

  const loadTerms = async () => {
    setLoading(true)
    try {
      const res = await api.getPopularSearches()
      if (res.success && res.data) {
        const sorted = Array.isArray(res.data)
          ? [...res.data].sort((a, b) => (a.position || 0) - (b.position || 0))
          : []
        setTerms(sorted)
      }
    } catch {
      toast.error('Error al cargar búsquedas populares')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTerms()
  }, [])

  const handleAdd = async () => {
    if (!newTerm.trim()) return
    if (terms.length >= MAX_ITEMS) {
      toast.error(`Máximo ${MAX_ITEMS} términos permitidos`)
      return
    }

    setAdding(true)
    try {
      const res = await api.createPopularSearch({
        term: newTerm.trim(),
        position: terms.length,
      })
      if (res.success) {
        toast.success('Término agregado')
        setNewTerm('')
        loadTerms()
      } else {
        toast.error(res.error || 'Error al agregar')
      }
    } catch {
      toast.error('Error al agregar término')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await api.deletePopularSearch(id)
      if (res.success) {
        toast.success('Término eliminado')
        setTerms((prev) => prev.filter((t) => t.id !== id))
      } else {
        toast.error(res.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar término')
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= terms.length) return

    const updated = [...terms]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setTerms(updated)

    try {
      const item = updated[newIndex]
      await api.updatePopularSearch(item.id, {
        term: item.term,
        position: newIndex,
      })
    } catch {
      toast.error('Error al reordenar')
      loadTerms()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Búsquedas Populares</h2>
          <p className="text-sm text-muted-foreground">
            {terms.length}/{MAX_ITEMS} términos
          </p>
        </div>
      </div>

      <Card variant="glass">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <Input
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Nuevo término de búsqueda"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
            />
            <Button onClick={handleAdd} disabled={adding || terms.length >= MAX_ITEMS}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Agregar</span>
            </Button>
          </div>

          {terms.length >= MAX_ITEMS && (
            <p className="text-xs text-amber-400">
              Has alcanzado el límite de {MAX_ITEMS} términos.
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : terms.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay términos de búsqueda. Agrega el primero.
            </p>
          ) : (
            <div className="space-y-1">
              {terms.map((term, index) => (
                <div
                  key={term.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-3"
                >
                  <span className="text-xs text-muted-foreground w-5 text-center">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{term.term}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === terms.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(term.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
