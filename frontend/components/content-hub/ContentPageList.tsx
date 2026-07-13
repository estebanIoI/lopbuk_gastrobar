'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Trash2, Pencil, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContentPageEditor } from './ContentPageEditor'

export function ContentPageList() {
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [pages, setPages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPage, setSelectedPage] = useState<any>(null)

  const loadPages = async () => {
    setLoading(true)
    try {
      const res = await api.getContentPages()
      if (res.success && res.data) {
        setPages(res.data)
      }
    } catch {
      toast.error('Error al cargar páginas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPages()
  }, [])

  const handleDelete = async (id: string) => {
    try {
      const res = await api.deleteContentPage(id)
      if (res.success) {
        toast.success('Página eliminada')
        setPages((prev) => prev.filter((p) => p.id !== id))
      } else {
        toast.error(res.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar página')
    }
  }

  const handleEdit = (page: any) => {
    setSelectedPage(page)
    setView('editor')
  }

  const handleNew = () => {
    setSelectedPage(null)
    setView('editor')
  }

  const handleEditorClose = () => {
    setView('list')
    setSelectedPage(null)
  }

  const handleEditorSave = () => {
    setView('list')
    setSelectedPage(null)
    loadPages()
  }

  if (view === 'editor') {
    return (
      <ContentPageEditor
        page={selectedPage}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />
    )
  }

  const PAGE_TYPE_LABELS: Record<string, string> = {
    corporate: 'Corporativa',
    legal: 'Legal',
    custom: 'Personalizada',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Páginas de Contenido</h2>
          <p className="text-sm text-muted-foreground">
            {pages.length} {pages.length === 1 ? 'página' : 'páginas'}
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva página
        </Button>
      </div>

      {loading ? (
        <Card variant="glass">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : pages.length === 0 ? (
        <Card variant="glass">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg">No hay páginas. Crea la primera.</p>
            <Button className="mt-4" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Crear página
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card variant="glass">
          <CardContent className="p-0">
            <Table variant="glass">
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell className="text-muted-foreground">/{page.slug}</TableCell>
                    <TableCell>
                      {PAGE_TYPE_LABELS[page.page_type] || page.page_type}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          page.is_published
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {page.is_published ? 'Publicada' : 'Borrador'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(page)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(page.id)}
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
