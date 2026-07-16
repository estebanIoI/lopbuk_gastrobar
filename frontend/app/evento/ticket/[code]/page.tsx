'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeSVG } from 'qrcode.react'
import { Calendar, MapPin, Ticket, Download, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export default function TicketPage() {
  const { code } = useParams<{ code: string }>()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (code === 'pending') {
      setData({ status: 'pending', message: 'Tu pago está siendo procesado. Recibirás tu ticket pronto.' })
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const r = await fetch(`${API_URL}/events/checkin/any/ticket/${code}`, { credentials: 'include' })
        const j = await r.json()
        if (j.success && j.data?.item) setData(j.data)
        else setData({ status: 'error', message: 'Ticket no encontrado' })
      } catch { setData({ status: 'error', message: 'Error al cargar el ticket' }) }
      setLoading(false)
    }
    load()
  }, [code])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>

  if (data?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
          <h1 className="text-xl font-bold mb-2">Procesando tu compra</h1>
          <p className="text-muted-foreground">{data.message}</p>
        </Card>
      </div>
    )
  }

  if (data?.status === 'error' || !data?.item) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <h1 className="text-xl font-bold mb-2">Ticket no encontrado</h1>
          <p className="text-muted-foreground">{data?.message || 'Revisa el enlace e intenta de nuevo'}</p>
        </Card>
      </div>
    )
  }

  const item = data.item

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-sm w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground text-center">
          <Ticket className="h-8 w-8 mx-auto mb-2 opacity-80" />
          <h1 className="font-bold text-lg">Ticket de entrada</h1>
          <p className="text-sm opacity-80">{item.ticket_code}</p>
        </div>

        {/* QR */}
        <div className="p-6 flex justify-center bg-white">
          <QRCodeSVG value={item.ticket_code || code} size={180} level="M" />
        </div>

        {/* Details */}
        <div className="px-6 pb-6 space-y-2 text-sm">
          {item.guest_name && (
            <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Titular</span><span className="font-medium">{item.guest_name}</span></div>
          )}
          {item.seat_label && (
            <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Asiento</span><span className="font-medium">{item.seat_label}</span></div>
          )}
          {item.row_label && (
            <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Fila</span><span className="font-medium">{item.row_label}</span></div>
          )}
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Estado</span>
            <span className={`font-medium ${item.status === 'active' ? 'text-emerald-600' : item.status === 'used' ? 'text-blue-600' : 'text-red-600'}`}>
              {item.status === 'active' ? 'Activo' : item.status === 'used' ? 'Usado' : item.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6">
          <Button variant="outline" className="w-full" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" /> Descargar / Imprimir
          </Button>
        </div>
      </Card>
    </div>
  )
}
