'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Trash2, Pencil, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { RecipeEditor } from './RecipeEditor'

const DIFFICULTY_LABELS: Record<string, string> = {
  fácil: 'Fácil',
  facil: 'Fácil',
  medio: 'Medio',
  difícil: 'Difícil',
  dificil: 'Difícil',
}

export function RecipeList() {
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [recipes, setRecipes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const res = await api.getRecipePages()
      if (res.success && res.data) {
        setRecipes(res.data)
      }
    } catch {
      toast.error('Error al cargar recetas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecipes()
  }, [])

  const handleDelete = async (id: string) => {
    try {
      const res = await api.deleteRecipePage(id)
      if (res.success) {
        toast.success('Receta eliminada')
        setRecipes((prev) => prev.filter((r) => r.id !== id))
      } else {
        toast.error(res.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar receta')
    }
  }

  const handleEdit = (recipe: any) => {
    setSelectedRecipe(recipe)
    setView('editor')
  }

  const handleNew = () => {
    setSelectedRecipe(null)
    setView('editor')
  }

  const handleEditorClose = () => {
    setView('list')
    setSelectedRecipe(null)
  }

  const handleEditorSave = () => {
    setView('list')
    setSelectedRecipe(null)
    loadRecipes()
  }

  if (view === 'editor') {
    return (
      <RecipeEditor
        recipe={selectedRecipe}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Recetas</h2>
          <p className="text-sm text-muted-foreground">
            {recipes.length} {recipes.length === 1 ? 'receta' : 'recetas'}
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva receta
        </Button>
      </div>

      {loading ? (
        <Card variant="glass">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : recipes.length === 0 ? (
        <Card variant="glass">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg">No hay recetas. Crea la primera.</p>
            <Button className="mt-4" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Crear receta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card variant="glass">
          <CardContent className="p-0">
            <Table variant="glass">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dificultad</TableHead>
                  <TableHead>Porciones</TableHead>
                  <TableHead>Tiempo prep.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.title}</TableCell>
                    <TableCell>
                      {DIFFICULTY_LABELS[recipe.difficulty] || recipe.difficulty || '-'}
                    </TableCell>
                    <TableCell>{recipe.servings || '-'}</TableCell>
                    <TableCell>
                      {recipe.prep_time ? `${recipe.prep_time} min` : '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          recipe.is_active !== false
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {recipe.is_active !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(recipe)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(recipe.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
