'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Printer, PrinterConnectionType, PrinterPaperWidth, PrinterModule } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PrintAgentCard } from '@/components/print-agent-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Printer as PrinterIcon,
  Plus,
  Pencil,
  Trash2,
  Wifi,
  Usb,
  Bluetooth,
  CheckCircle,
  XCircle,
  FlaskConical,
  Loader2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CONNECTION_LABELS: Record<PrinterConnectionType, string> = {
  lan: 'LAN (Red)',
  usb: 'USB',
  bluetooth: 'Bluetooth',
}

const MODULE_LABELS: Record<PrinterModule, string> = {
  caja: 'Caja',
  cocina: 'Cocina',
  bar: 'Bar',
  factura: 'Factura',
}

// ─── Default form state ────────────────────────────────────────────────────────

const defaultForm = {
  name: '',
  connectionType: 'lan' as PrinterConnectionType,
  ip: '',
  port: 9100,
  paperWidth: 80 as PrinterPaperWidth,
  assignedModule: '' as PrinterModule | '',
}

// ─── Connection icon ───────────────────────────────────────────────────────────

function ConnectionIcon({ type }: { type: PrinterConnectionType }) {
  if (type === 'lan')       return <Wifi className="h-4 w-4 text-blue-400" />
  if (type === 'usb')       return <Usb className="h-4 w-4 text-orange-400" />
  if (type === 'bluetooth') return <Bluetooth className="h-4 w-4 text-purple-400" />
  return null
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PrintersConfig() {
  const [printers, setPrinters]     = useState<Printer[]>([])
  const [loading, setLoading]       = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing]       = useState<Printer | null>(null)
  const [form, setForm]             = useState({ ...defaultForm })
  const [saving, setSaving]         = useState(false)
  const [testingId, setTestingId]   = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api.getPrinters()
    if (res.success) setPrinters((res.data as Printer[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Dialog helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm({ ...defaultForm })
    setError(null)
    setDialogOpen(true)
  }

  const openEdit = (p: Printer) => {
    setEditing(p)
    setForm({
      name: p.name,
      connectionType: p.connectionType,
      ip: p.ip ?? '',
      port: p.port,
      paperWidth: p.paperWidth,
      assignedModule: p.assignedModule ?? '',
    })
    setError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (form.connectionType === 'lan' && !form.ip.trim()) { setError('La IP es requerida para conexión LAN'); return }

    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      connectionType: form.connectionType,
      ip: form.ip.trim() || undefined,
      port: form.port,
      paperWidth: form.paperWidth,
      assignedModule: (form.assignedModule || null) as PrinterModule | null,
    }

    const res = editing
      ? await api.updatePrinter(editing.id, payload)
      : await api.createPrinter(payload)

    setSaving(false)

    if (res.success) {
      showToast(editing ? 'Impresora actualizada' : 'Impresora registrada')
      setDialogOpen(false)
      load()
    } else {
      setError(res.error || 'Error al guardar')
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleTest = async (p: Printer) => {
    setTestingId(p.id)
    const res = await api.testPrinter(p.id)
    setTestingId(null)
    showToast(res.success ? (res.message || 'Impresión de prueba enviada') : (res.error || 'Error al imprimir'), res.success)
  }

  const handleToggle = async (p: Printer) => {
    setTogglingId(p.id)
    const res = await api.updatePrinter(p.id, { isActive: !p.isActive })
    setTogglingId(null)
    if (res.success) {
      showToast(p.isActive ? 'Impresora desactivada' : 'Impresora activada')
      load()
    } else {
      showToast(res.error || 'Error', false)
    }
  }

  const handleDelete = async (p: Printer) => {
    if (!confirm(`¿Eliminar impresora "${p.name}"?`)) return
    setDeletingId(p.id)
    const res = await api.deletePrinter(p.id)
    setDeletingId(null)
    if (res.success) {
      showToast('Impresora eliminada')
      load()
    } else {
      showToast(res.error || 'Error al eliminar', false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PrinterIcon className="h-7 w-7 text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">Impresoras POS</h2>
            <p className="text-sm text-gray-400">Configura impresoras térmicas ESC/POS</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Impresora
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
          toast.ok ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Printers table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : printers.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <PrinterIcon className="h-12 w-12 text-gray-600" />
            <p className="text-gray-400">No hay impresoras registradas</p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Registrar primera impresora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Conexión</th>
                    <th className="px-4 py-3 text-left">IP / Puerto</th>
                    <th className="px-4 py-3 text-left">Papel</th>
                    <th className="px-4 py-3 text-left">Módulo</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {printers.map((p) => (
                    <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PrinterIcon className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-white">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <ConnectionIcon type={p.connectionType} />
                          <span className="text-gray-300">{CONNECTION_LABELS[p.connectionType]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                        {p.connectionType === 'lan' ? `${p.ip ?? '—'}:${p.port}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{p.paperWidth}mm</td>
                      <td className="px-4 py-3">
                        {p.assignedModule ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/30">
                            {MODULE_LABELS[p.assignedModule]}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.isActive ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="h-3.5 w-3.5" /> Activa</span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500 text-xs"><XCircle className="h-3.5 w-3.5" /> Inactiva</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Test */}
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleTest(p)}
                            disabled={testingId === p.id || !p.isActive}
                            title="Prueba de impresión"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                          >
                            {testingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                          </Button>
                          {/* Toggle active */}
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleToggle(p)}
                            disabled={togglingId === p.id}
                            title={p.isActive ? 'Desactivar' : 'Activar'}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                          >
                            {togglingId === p.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : p.isActive
                                ? <ToggleRight className="h-3.5 w-3.5 text-green-400" />
                                : <ToggleLeft className="h-3.5 w-3.5" />
                            }
                          </Button>
                          {/* Edit */}
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => openEdit(p)}
                            title="Editar"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {/* Delete */}
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleDelete(p)}
                            disabled={deletingId === p.id}
                            title="Eliminar"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                          >
                            {deletingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Programa de impresión (agente local para impresoras LAN) */}
      <PrintAgentCard />

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-blue-400" /> Conexión LAN
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 space-y-1">
            <p>Recomendada para negocios</p>
            <p className="font-mono text-gray-400">IP: 192.168.x.x</p>
            <p className="font-mono text-gray-400">Puerto: 9100</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <Usb className="h-4 w-4 text-orange-400" /> USB / Bluetooth
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 space-y-1">
            <p>Requiere servicio local</p>
            <p>QZ Tray / PrintNode</p>
            <p>Instalar en el equipo local</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <PrinterIcon className="h-4 w-4 text-green-400" /> ESC/POS
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 space-y-1">
            <p>Protocolo estándar POS</p>
            <p>Papel 58mm y 80mm</p>
            <p>Corte automático</p>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <PrinterIcon className="h-5 w-5 text-blue-400" />
              {editing ? 'Editar Impresora' : 'Nueva Impresora'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <div className="rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm px-3 py-2">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-gray-300">Nombre *</Label>
              <Input
                placeholder="Ej: Impresora Caja"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            {/* Connection type */}
            <div className="space-y-1.5">
              <Label className="text-gray-300">Tipo de conexión *</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['lan', 'usb', 'bluetooth'] as PrinterConnectionType[]).map(ct => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, connectionType: ct }))}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors ${
                      form.connectionType === ct
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <ConnectionIcon type={ct} />
                    {CONNECTION_LABELS[ct]}
                  </button>
                ))}
              </div>
            </div>

            {/* IP + Port (LAN only) */}
            {form.connectionType === 'lan' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-gray-300">IP de la impresora *</Label>
                  <Input
                    placeholder="192.168.1.120"
                    value={form.ip}
                    onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
                    className="bg-gray-800 border-gray-700 text-white font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Puerto</Label>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 9100 }))}
                    className="bg-gray-800 border-gray-700 text-white font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {/* Paper width */}
            <div className="space-y-1.5">
              <Label className="text-gray-300">Ancho de papel</Label>
              <div className="grid grid-cols-2 gap-2">
                {([58, 80] as PrinterPaperWidth[]).map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, paperWidth: w }))}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                      form.paperWidth === w
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Module assignment */}
            <div className="space-y-1.5">
              <Label className="text-gray-300">Asignar a módulo <span className="text-gray-500">(opcional)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, assignedModule: '' }))}
                  className={`rounded-lg border py-2 text-xs transition-colors ${
                    form.assignedModule === ''
                      ? 'border-gray-500 bg-gray-700 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  Sin asignar
                </button>
                {(Object.entries(MODULE_LABELS) as [PrinterModule, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, assignedModule: key }))}
                    className={`rounded-lg border py-2 text-xs transition-colors ${
                      form.assignedModule === key
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}
              className="border-gray-700 text-gray-300">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Registrar impresora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
