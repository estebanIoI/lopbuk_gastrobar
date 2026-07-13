'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Subscriber {
  id: string
  email: string
  subscribed_at: string
  is_active: boolean
}

export function NewsletterManager() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const loadSubscribers = async () => {
    setLoading(true)
    try {
      const res = await api.getNewsletterSubscribers(1, 5000)
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.subscribers || []
        setSubscribers(list)
        setTotalCount(res.pagination?.total || res.data?.total || list.length)
      }
    } catch {
      toast.error('Error al cargar suscriptores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubscribers()
  }, [])

  const handleExportCSV = () => {
    if (subscribers.length === 0) {
      toast.error('No hay suscriptores para exportar')
      return
    }

    setExporting(true)
    try {
      const csv =
        'Email,Fecha suscripción,Estado\n' +
        subscribers
          .map(
            (r) =>
              `${r.email},${r.subscribed_at},${r.is_active ? 'Activo' : 'Desuscrito'}`
          )
          .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'newsletter.csv'
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`${subscribers.length} suscriptores exportados`)
    } catch {
      toast.error('Error al exportar CSV')
    } finally {
      setExporting(false)
    }
  }

  const activeCount = subscribers.filter((s) => s.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Newsletter</h2>
          <p className="text-sm text-muted-foreground">
            {totalCount} suscriptores · {activeCount} activos
          </p>
        </div>
        <Button onClick={handleExportCSV} disabled={exporting || loading}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar CSV
        </Button>
      </div>

      {loading ? (
        <Card variant="glass">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : subscribers.length === 0 ? (
        <Card variant="glass">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg">No hay suscriptores aún.</p>
          </CardContent>
        </Card>
      ) : (
        <Card variant="glass">
          <CardContent className="p-0">
            <Table variant="glass">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Fecha suscripción</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.subscribed_at
                        ? new Date(sub.subscribed_at).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          sub.is_active
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {sub.is_active ? 'Activo' : 'Desuscrito'}
                      </span>
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
