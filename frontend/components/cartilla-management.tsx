'use client'

/**
 * cartilla-management.tsx — Panel del COMERCIO para publicar cartillas/libros/
 * cursos en el área global Cartilla Inga. Permite crear contenido, fijar precio
 * (o dejarlo gratis), publicar, gestionar módulos + una actividad por módulo, y
 * ver las ventas/desbloqueos.
 *
 * Usa los endpoints staff: /api/cartillas/admin/*
 */
import React, { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { getCloudinaryConfig } from '@/components/ui/cloudinary-upload'
import {
  BookOpen, Plus, Trash2, Pencil, Eye, EyeOff, DollarSign, Gift,
  Layers, X, Loader2, ShoppingBag, ChevronRight, Save, ExternalLink,
  Upload, FileText, Download, Paperclip,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

async function req<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = api.getToken?.()
  const res = await fetch(`${API_URL}/cartillas${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.success === false) throw new Error(body?.error || body?.message || 'Error')
  return (body?.data ?? body) as T
}

// Sube un archivo (PDF/Excel/ZIP/TXT/MD…) a Cloudinary. `auto/upload` detecta el tipo
// (no-imágenes → raw), reutilizando el mismo preset que las imágenes.
async function uploadRawFile(file: File): Promise<{ url: string; bytes: number }> {
  const { cloudName, uploadPreset } = await getCloudinaryConfig()
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: fd })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.secure_url) throw new Error(j?.error?.message || 'No se pudo subir el archivo')
  return { url: j.secure_url, bytes: Number(j.bytes) || 0 }
}

const COLORS = ['emerald', 'green', 'amber', 'purple', 'pink']
const TIPOS = [
  { v: 'cartilla', l: 'Cartilla' },
  { v: 'libro', l: 'Libro' },
  { v: 'curso', l: 'Curso' },
]
const fmt = (n: number, m = 'COP') => {
  try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: m, maximumFractionDigits: 0 }).format(n) }
  catch { return `${m} ${n}` }
}

interface Cartilla {
  id: string; slug: string; titulo: string; tipo: string; descripcion: string | null
  autor: string | null; color: string; esGratis: boolean; precio: number; moneda: string
  publicado: boolean; destacado: boolean; totalModulos?: number; ventas?: number
}

const empty = (): Partial<Cartilla> => ({
  titulo: '', tipo: 'cartilla', descripcion: '', autor: '', color: 'emerald',
  esGratis: true, precio: 0, moneda: 'COP', publicado: false,
})

export function CartillaManagement() {
  const [tab, setTab] = useState<'cartillas' | 'ventas'>('cartillas')
  const [items, setItems] = useState<Cartilla[]>([])
  const [ventas, setVentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Cartilla> | null>(null)
  const [managing, setManaging] = useState<Cartilla | null>(null)
  const [archivosFor, setArchivosFor] = useState<Cartilla | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await req<Cartilla[]>('/admin/cartillas')) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const cargarVentas = useCallback(async () => {
    try { setVentas(await req<any[]>('/admin/ventas')) } catch { /* */ }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (tab === 'ventas') cargarVentas() }, [tab, cargarVentas])

  const guardar = async (data: Partial<Cartilla>) => {
    const payload = { ...data, precio: Number(data.precio || 0), esGratis: !!data.esGratis }
    if (data.id) await req(`/admin/cartillas/${data.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    else await req('/admin/cartillas', { method: 'POST', body: JSON.stringify(payload) })
    setEditing(null); cargar()
  }
  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta cartilla?')) return
    await req(`/admin/cartillas/${id}`, { method: 'DELETE' }); cargar()
  }
  const togglePublicar = async (c: Cartilla) => {
    await req(`/admin/cartillas/${c.id}`, { method: 'PUT', body: JSON.stringify({ publicado: !c.publicado }) }); cargar()
  }

  if (managing) return <ModulosManager cartilla={managing} onBack={() => { setManaging(null); cargar() }} />
  if (archivosFor) return <ArchivosManager cartilla={archivosFor} onBack={() => { setArchivosFor(null); cargar() }} />

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-emerald-600" /> Cartilla Digital</h1>
          <p className="text-gray-500 text-sm">Publica cartillas, libros y cursos. Gratis o con precio.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/productos-digitales" target="_blank" className="text-sm text-emerald-700 inline-flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-emerald-50">
            Ver catálogo <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={() => setEditing(empty())} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {(['cartillas', 'ventas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500'}`}>
            {t === 'cartillas' ? 'Mis cartillas' : 'Ventas'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {tab === 'cartillas' && (
        loading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600" /> :
        items.length === 0 ? <Empty /> :
        <div className="grid gap-3">
          {items.map(c => (
            <div key={c.id} className="bg-white border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg bg-${c.color}-100 text-${c.color}-700 flex items-center justify-center shrink-0`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{c.titulo}</h3>
                  <span className="text-[11px] uppercase tracking-wide text-gray-400">{c.tipo}</span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                  <span className="inline-flex items-center gap-1">{c.esGratis ? <><Gift className="w-3 h-3" />Gratis</> : <><DollarSign className="w-3 h-3" />{fmt(c.precio, c.moneda)}</>}</span>
                  <span>{c.totalModulos ?? 0} módulos</span>
                  <span>{c.ventas ?? 0} ventas</span>
                  <span className={c.publicado ? 'text-emerald-600' : 'text-gray-400'}>{c.publicado ? 'Publicada' : 'Borrador'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button title="Módulos" onClick={() => setManaging(c)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><Layers className="w-4 h-4" /></button>
                <button title="Archivos descargables" onClick={() => setArchivosFor(c)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><Paperclip className="w-4 h-4" /></button>
                <button title={c.publicado ? 'Despublicar' : 'Publicar'} onClick={() => togglePublicar(c)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">{c.publicado ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                <button title="Editar" onClick={() => setEditing(c)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><Pencil className="w-4 h-4" /></button>
                <button title="Eliminar" onClick={() => eliminar(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'ventas' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {ventas.length === 0 ? <p className="p-6 text-gray-500 text-sm">Aún no hay ventas.</p> :
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left"><tr>
              <th className="p-3">Cartilla</th><th className="p-3">Usuario</th><th className="p-3">Precio</th><th className="p-3">Estado</th><th className="p-3">Fecha</th>
            </tr></thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.id} className="border-t">
                  <td className="p-3 font-medium">{v.cartilla}</td>
                  <td className="p-3">{v.usuario}</td>
                  <td className="p-3">{fmt(Number(v.precio), v.moneda)}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${v.estado === 'pagado' || v.estado === 'gratis' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{v.estado}</span></td>
                  <td className="p-3 text-gray-500">{new Date(v.created_at).toLocaleDateString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      )}

      {editing && <CartillaForm value={editing} onClose={() => setEditing(null)} onSave={guardar} />}
    </div>
  )
}

function Empty() {
  return (
    <div className="text-center py-16 text-gray-500 bg-white border rounded-xl">
      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
      Aún no has creado cartillas. Crea la primera con el botón “Nueva”.
    </div>
  )
}

function CartillaForm({ value, onClose, onSave }: { value: Partial<Cartilla>; onClose: () => void; onSave: (d: Partial<Cartilla>) => Promise<void> }) {
  const [d, setD] = useState<Partial<Cartilla>>(value)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Cartilla, v: any) => setD(p => ({ ...p, [k]: v }))
  const submit = async () => {
    if (!d.titulo?.trim()) return
    setSaving(true)
    try { await onSave(d) } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{d.id ? 'Editar cartilla' : 'Nueva cartilla'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Título"><input value={d.titulo || ''} onChange={e => set('titulo', e.target.value)} className="inp" placeholder="Ej. Cartilla Digital Inga" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={d.tipo} onChange={e => set('tipo', e.target.value)} className="inp">
                {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="Autor"><input value={d.autor || ''} onChange={e => set('autor', e.target.value)} className="inp" /></Field>
          </div>
          <Field label="Descripción"><textarea value={d.descripcion || ''} onChange={e => set('descripcion', e.target.value)} className="inp h-20" /></Field>
          <Field label="Color">
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => set('color', c)} className={`w-8 h-8 rounded-full bg-${c}-500 ${d.color === c ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`} />
              ))}
            </div>
          </Field>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!d.esGratis} onChange={e => set('esGratis', e.target.checked)} /> Gratis
            </label>
            {!d.esGratis && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Precio</span>
                <input type="number" min={0} value={d.precio || 0} onChange={e => set('precio', e.target.value)} className="inp w-32" />
                <input value={d.moneda || 'COP'} onChange={e => set('moneda', e.target.value)} className="inp w-20" />
              </div>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!d.publicado} onChange={e => set('publicado', e.target.checked)} /> Publicar en el catálogo
          </label>
        </div>
        <div className="p-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium inline-flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
      <style jsx>{`.inp{width:100%;border:1px solid #e5e7eb;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;outline:none}.inp:focus{border-color:#10b981}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}

// ── Gestor de módulos + actividad de una cartilla ─────────────────────────────
interface Modulo { id: string; clave: string; titulo: string; descripcion: string; video_url: string }

function ModulosManager({ cartilla, onBack }: { cartilla: Cartilla; onBack: () => void }) {
  const [mods, setMods] = useState<Modulo[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<{ titulo: string; descripcion: string; video_url: string } | null>(null)
  const [actFor, setActFor] = useState<Modulo | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setMods(await req<Modulo[]>(`/${cartilla.slug}/modulos`)) } catch { /* */ } finally { setLoading(false) }
  }, [cartilla.slug])
  useEffect(() => { cargar() }, [cargar])

  const crear = async () => {
    if (!form?.titulo?.trim()) return
    await req(`/admin/cartillas/${cartilla.id}/modulos`, { method: 'POST', body: JSON.stringify({ titulo: form.titulo, descripcion: form.descripcion, videoUrl: form.video_url }) })
    setForm(null); cargar()
  }
  const eliminar = async (m: Modulo) => {
    if (!confirm('¿Eliminar módulo?')) return
    await req(`/admin/modulos/${m.id}`, { method: 'DELETE' }); cargar()
  }

  if (actFor) return <ActividadEditor cartilla={cartilla} modulo={actFor} onBack={() => setActFor(null)} />

  return (
    <div className="p-6 space-y-4">
      <button onClick={onBack} className="text-sm text-emerald-700">← Volver a cartillas</button>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">{cartilla.titulo} · Módulos</h1>
        <button onClick={() => setForm({ titulo: '', descripcion: '', video_url: '' })} className="bg-emerald-600 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Módulo</button>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600" /> :
        mods.length === 0 ? <p className="text-gray-500 text-sm">Sin módulos. Crea el primero.</p> :
        <div className="grid gap-2">
          {mods.map(m => (
            <div key={m.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{m.titulo}</h3>
                <p className="text-xs text-gray-500 truncate">{m.descripcion}</p>
              </div>
              <button onClick={() => setActFor(m)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 inline-flex items-center gap-1">Actividad <ChevronRight className="w-3 h-3" /></button>
              <button onClick={() => eliminar(m)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Nuevo módulo</h2><button onClick={() => setForm(null)}><X className="w-5 h-5" /></button></div>
            <input placeholder="Título" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <textarea placeholder="Descripción" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm h-20" />
            <input placeholder="URL de video (embed)" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2"><button onClick={() => setForm(null)} className="px-4 py-2 text-gray-600">Cancelar</button><button onClick={crear} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Crear</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Editor de una actividad (completar | emparejar) ───────────────────────────
function ActividadEditor({ cartilla, modulo, onBack }: { cartilla: Cartilla; modulo: Modulo; onBack: () => void }) {
  const [tipo, setTipo] = useState<'completar' | 'emparejar'>('completar')
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [opciones, setOpciones] = useState<string[]>(['', '', ''])
  const [pares, setPares] = useState<{ inga: string; espanol: string }[]>([{ inga: '', espanol: '' }, { inga: '', espanol: '' }])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const guardar = async () => {
    setSaving(true); setMsg(null)
    try {
      const payload: any = { tipo, pregunta }
      if (tipo === 'completar') {
        payload.respuesta_correcta = respuesta
        payload.opciones = opciones.filter(Boolean).map(t => ({ texto: t }))
      } else {
        payload.pares = pares.filter(p => p.inga && p.espanol)
      }
      await req(`/admin/modulos/${modulo.id}/actividades`, { method: 'POST', body: JSON.stringify(payload) })
      setMsg('Actividad guardada ✓')
    } catch (e: any) { setMsg(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <button onClick={onBack} className="text-sm text-emerald-700">← Volver a módulos</button>
      <h1 className="text-xl font-bold">{modulo.titulo} · Actividad</h1>

      <div className="flex gap-2">
        {(['completar', 'emparejar'] as const).map(t => (
          <button key={t} onClick={() => setTipo(t)} className={`px-3 py-1.5 rounded-lg text-sm ${tipo === t ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>{t}</button>
        ))}
      </div>

      <input placeholder="Pregunta / instrucción" value={pregunta} onChange={e => setPregunta(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />

      {tipo === 'completar' ? (
        <div className="space-y-2">
          <input placeholder="Respuesta correcta" value={respuesta} onChange={e => setRespuesta(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-500">Opciones</p>
          {opciones.map((o, i) => (
            <input key={i} placeholder={`Opción ${i + 1}`} value={o} onChange={e => setOpciones(opciones.map((x, j) => j === i ? e.target.value : x))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          ))}
          <button onClick={() => setOpciones([...opciones, ''])} className="text-xs text-emerald-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> opción</button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Pares (Inga ↔ Español)</p>
          {pares.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="Inga" value={p.inga} onChange={e => setPares(pares.map((x, j) => j === i ? { ...x, inga: e.target.value } : x))} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Español" value={p.espanol} onChange={e => setPares(pares.map((x, j) => j === i ? { ...x, espanol: e.target.value } : x))} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <button onClick={() => setPares([...pares, { inga: '', espanol: '' }])} className="text-xs text-emerald-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> par</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={guardar} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white inline-flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar actividad
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  )
}

// ── Gestor de archivos descargables de una cartilla ──────────────────────────
function ArchivosManager({ cartilla, onBack }: { cartilla: Cartilla; onBack: () => void }) {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setFiles(await req<any[]>(`/admin/cartillas/${cartilla.id}/archivos`)) }
    catch { /* */ } finally { setLoading(false) }
  }, [cartilla.id])
  useEffect(() => { cargar() }, [cargar])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null); setUploading(true)
    try {
      const { url, bytes } = await uploadRawFile(file)
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      await req(`/admin/cartillas/${cartilla.id}/archivos`, {
        method: 'POST',
        body: JSON.stringify({ nombre: file.name, url, tipo: ext, sizeBytes: bytes }),
      })
      cargar()
    } catch (e: any) { setErr(e.message || 'No se pudo subir el archivo') }
    finally { setUploading(false) }
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este archivo?')) return
    await req(`/admin/archivos/${id}`, { method: 'DELETE' }); cargar()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold">{cartilla.titulo} · Archivos</h1>
      </div>
      <p className="text-sm text-gray-500 max-w-xl">
        Adjunta archivos descargables (PDF, Excel, ZIP, TXT, MD, Word, PowerPoint…). Si la cartilla
        es de pago, solo quien la compre podrá descargarlos.
      </p>

      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium w-fit ${uploading ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'} text-white`}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Subiendo…' : 'Subir archivo'}
        <input type="file" className="hidden" onChange={onPick} disabled={uploading}
          accept=".pdf,.xls,.xlsx,.csv,.zip,.txt,.md,.doc,.docx,.ppt,.pptx,.json" />
      </label>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      {loading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600" /> :
        files.length === 0 ? <p className="text-gray-400 text-sm">Sin archivos aún.</p> :
        <div className="grid gap-2 max-w-xl">
          {files.map(f => (
            <div key={f.id} className="bg-white border rounded-lg p-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.nombre}</p>
                <p className="text-[11px] text-gray-400 uppercase">{f.tipo || 'archivo'}{f.sizeBytes ? ` · ${(f.sizeBytes / 1024 / 1024).toFixed(2)} MB` : ''}</p>
              </div>
              <a href={f.url} target="_blank" rel="noopener noreferrer" title="Descargar" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><Download className="w-4 h-4" /></a>
              <button onClick={() => eliminar(f.id)} title="Eliminar" className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>}
    </div>
  )
}

export default CartillaManagement
