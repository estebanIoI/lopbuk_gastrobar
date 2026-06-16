'use client'

// Respaldo y restauración del restaurante (Fase 4 · approval-gated).
// Descargar respaldo (solo lectura) y restaurar SOLO catálogo/config con vista
// previa + confirmación escrita. Pedidos, pagos y transacciones nunca se tocan.
import { useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function BackupPage() {
  const [downloading, setDownloading] = useState(false)
  const [backup, setBackup] = useState<any>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Record<string, number> | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<any>(null)

  const download = async () => {
    setDownloading(true)
    const r = await api.exportRestbarBackup()
    setDownloading(false)
    if (!r.success) { toast.error(r.error ?? 'Error al exportar'); return }
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `respaldo-restaurante-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Respaldo descargado')
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name); setPreview(null); setResult(null); setConfirmText('')
    const reader = new FileReader()
    reader.onload = () => {
      try { setBackup(JSON.parse(String(reader.result))) }
      catch { toast.error('Archivo JSON inválido'); setBackup(null) }
    }
    reader.readAsText(f)
  }

  const doPreview = async () => {
    if (!backup) return
    setWorking(true)
    const r = await api.previewRestbarRestore(backup)
    setWorking(false)
    if (r.success) setPreview(r.data?.willUpsert || {})
    else toast.error(r.error ?? 'Error en la vista previa')
  }

  const doRestore = async () => {
    if (!backup || confirmText !== 'RESTAURAR') return
    setWorking(true)
    const r = await api.restoreRestbarBackup(backup, confirmText)
    setWorking(false)
    if (r.success) { setResult(r.data?.restored || {}); toast.success('Restauración completada') }
    else toast.error(r.error ?? 'Error al restaurar')
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-5 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black mb-1">💾 Respaldo del restaurante</h1>
      <p className="text-sm text-muted-foreground mb-6">Exporta tu configuración y datos, o restaura el catálogo desde un respaldo.</p>

      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <h2 className="font-bold mb-1">Descargar respaldo</h2>
        <p className="text-xs text-muted-foreground mb-3">Incluye menú, mesas, fidelización, info/banners y el histórico de pedidos/pagos (solo lectura).</p>
        <button onClick={download} disabled={downloading} className="rounded-lg bg-foreground text-background font-semibold px-4 py-2.5 disabled:opacity-60">
          {downloading ? 'Generando…' : '⬇️ Descargar respaldo (.json)'}
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
        <h2 className="font-bold mb-1">Restaurar</h2>
        <p className="text-xs text-muted-foreground mb-1">Solo restaura <b>catálogo y configuración</b> (menú, mesas, fidelización, info/banners) como <b>upsert</b> aditivo.</p>
        <p className="text-xs text-red-400 mb-4">Pedidos, pagos y transacciones <b>no se modifican</b>. Acción sobre datos reales: revisa la vista previa antes de confirmar.</p>

        <input type="file" accept="application/json,.json" onChange={onFile} className="block text-sm mb-3" />
        {fileName && <p className="text-xs text-muted-foreground mb-3">Archivo: {fileName}</p>}

        {backup && !preview && (
          <button onClick={doPreview} disabled={working} className="rounded-lg border border-border font-semibold px-4 py-2.5 disabled:opacity-60">
            {working ? 'Analizando…' : '🔍 Ver vista previa'}
          </button>
        )}

        {preview && (
          <div className="mt-4">
            <p className="font-semibold text-sm mb-2">Se actualizarán (upsert):</p>
            <div className="rounded-xl border border-border overflow-hidden text-sm mb-4">
              {Object.entries(preview).map(([t, n]) => (
                <div key={t} className="flex justify-between px-3 py-1.5 border-t border-border first:border-t-0">
                  <span>{t}</span><span className="font-semibold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
            {!result ? (
              <>
                <label className="block text-sm font-semibold mb-1">Escribe <span className="text-red-400">RESTAURAR</span> para confirmar</label>
                <div className="flex gap-2">
                  <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="RESTAURAR"
                    className="flex-1 rounded-lg bg-background border border-border px-3 py-2.5 text-sm" />
                  <button onClick={doRestore} disabled={working || confirmText !== 'RESTAURAR'}
                    className="rounded-lg bg-red-600 text-white font-semibold px-4 py-2.5 disabled:opacity-40">
                    {working ? 'Restaurando…' : 'Restaurar'}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-3 text-sm">
                <p className="font-semibold mb-1">✅ Restauración completada</p>
                {Object.entries(result).map(([t, v]: any) => (
                  <p key={t} className="text-xs text-muted-foreground">{t}: {v.ok} ok{v.failed ? `, ${v.failed} con error` : ''}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
