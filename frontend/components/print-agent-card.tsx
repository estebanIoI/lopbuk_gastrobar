'use client'

/**
 * PrintAgentCard — sección "Programa de impresión" del módulo Impresoras.
 * Permite descargar el Agente de Impresión local, generar el código de vinculación y ver
 * el estado de los equipos conectados. El agente hace de puente nube→impresora LAN.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, MonitorDown, Copy, RefreshCw, Trash2, CheckCircle2, Circle, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

type Agent = { id: string; name: string | null; pairingCode: string; paired: boolean; lastSeenAt: string | null; online: boolean }

export function PrintAgentCard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [downloading, setDownloading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    const res = await api.getPrintAgentStatus()
    if (res.success) setAgents(res.data?.agents || [])
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(load, 30_000) // refresca estado de conexión
    return () => clearInterval(id)
  }, [load])

  const pendingCode = agents.find(a => !a.paired)?.pairingCode || null

  const download = async () => {
    setDownloading(true)
    const res = await api.downloadPrintAgent()
    setDownloading(false)
    if (res.success) toast.success('Descargando el programa…')
    else toast.error(res.error || 'No se pudo descargar')
  }

  const generate = async () => {
    setGenerating(true)
    const res = await api.createPrintAgentCode()
    setGenerating(false)
    if (res.success) { await load(); toast.success('Código de vinculación listo') }
    else toast.error(res.error || 'No se pudo generar el código')
  }

  const copy = (code: string) => { navigator.clipboard.writeText(code); toast.success('Código copiado') }

  const remove = async (a: Agent) => {
    if (!confirm(`¿Eliminar este equipo de impresión?`)) return
    await api.deletePrintAgent(a.id)
    await load()
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <MonitorDown className="h-5 w-5 text-emerald-400" /> Programa de impresión
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Las impresoras en red (LAN) imprimen a través de un programa que se instala en un
          computador del local. Descárgalo, ábrelo y pégale el código de vinculación.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Paso 1: descargar */}
          <div className="flex-1 rounded-lg border border-gray-800 bg-gray-950/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-300">1. Descarga el programa</p>
            <Button onClick={download} disabled={downloading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {downloading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Descargar programa
            </Button>
            <p className="text-[11px] text-gray-500">
              Al abrirlo, Windows puede mostrar un aviso de seguridad → <span className="text-gray-400">Más información → Ejecutar de todas formas</span>.
            </p>
          </div>

          {/* Paso 2: código de vinculación */}
          <div className="flex-1 rounded-lg border border-gray-800 bg-gray-950/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-300">2. Código de vinculación</p>
            {pendingCode ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-center text-lg font-mono tracking-widest text-emerald-400 bg-black/40 rounded py-1.5">{pendingCode}</code>
                <Button variant="outline" size="icon" onClick={() => copy(pendingCode)} className="border-gray-700"><Copy className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button onClick={generate} disabled={generating} variant="outline" className="w-full border-gray-700">
                {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Generar código
              </Button>
            )}
            <p className="text-[11px] text-gray-500">Pega este código en el programa la primera vez que lo abras.</p>
          </div>
        </div>

        {/* Equipos conectados */}
        {agents.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-400">Equipos</p>
            {agents.map(a => (
              <div key={a.id} className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-950/50 px-3 py-2">
                {a.paired
                  ? (a.online ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-gray-600" />)
                  : <Circle className="h-4 w-4 text-amber-500" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{a.name || 'Equipo sin nombre'}</p>
                  <p className="text-[11px] text-gray-500">
                    {!a.paired ? `Sin vincular · código ${a.pairingCode}`
                      : a.online ? 'En línea' : `Desconectado${a.lastSeenAt ? ' · visto ' + new Date(a.lastSeenAt).toLocaleString('es-CO') : ''}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
