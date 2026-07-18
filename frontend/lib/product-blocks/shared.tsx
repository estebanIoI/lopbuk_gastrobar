'use client'

/**
 * Piezas compartidas por los bloques del registry: helpers de render
 * (markdown-lite, embeds de video, formato de precio) y primitivas de
 * formulario para los editores de cada bloque.
 */

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

// ── Render ────────────────────────────────────────────────────────────────────

export const fmtDefault = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

/** Markdown-lite: **negrita**, saltos de línea y viñetas "- " */
export function MdLite({ text, className }: { text: string; className?: string }) {
  const lines = String(text || '').split('\n')
  return (
    <div className={className}>
      {lines.map((line, li) => {
        const isBullet = /^\s*[-•]\s+/.test(line)
        const content = isBullet ? line.replace(/^\s*[-•]\s+/, '') : line
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((chunk, ci) =>
          chunk.startsWith('**') && chunk.endsWith('**')
            ? <strong key={ci}>{chunk.slice(2, -2)}</strong>
            : chunk
        )
        return isBullet
          ? <div key={li} className="flex gap-2 items-start"><span className="mt-0.5">•</span><span>{parts}</span></div>
          : <p key={li} className={line.trim() === '' ? 'h-2' : ''}>{parts}</p>
      })}
    </div>
  )
}

export type MediaKind = 'youtube' | 'tiktok' | 'instagram' | 'gif' | 'mp4' | 'none'

/**
 * Resuelve una URL a su embed. YouTube Shorts se detecta junto con YouTube
 * normal (misma incrustación). Instagram Reels/posts usan /embed. GIF e imágenes
 * se muestran directas. Formato vertical (9/16): tiktok, instagram, shorts.
 */
export function videoEmbed(url: string): { kind: MediaKind; src: string; vertical?: boolean } {
  const u = String(url || '').trim()
  if (!u) return { kind: 'none', src: '' }
  const shorts = /youtube\.com\/shorts\//.test(u)
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}`, vertical: shorts }
  const tk = u.match(/tiktok\.com\/.*\/video\/(\d+)/)
  if (tk) return { kind: 'tiktok', src: `https://www.tiktok.com/embed/v2/${tk[1]}`, vertical: true }
  const ig = u.match(/instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/)
  if (ig) return { kind: 'instagram', src: `https://www.instagram.com/p/${ig[1]}/embed`, vertical: true }
  if (/\.gif(\?|$)/i.test(u)) return { kind: 'gif', src: u }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { kind: 'mp4', src: u }
  return { kind: 'none', src: '' }
}

// ── Primitivas de formulario (editores de bloque) ─────────────────────────────

export function TextField({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block">{label}</label>
      <Input value={value ?? ''} onChange={e => onChange(e.target.value)} className="h-8 text-xs" />
    </div>
  )
}

export function NumberField({ label, value, onChange, min, max, fallback }: {
  label: string; value: any; onChange: (v: number) => void; min?: number; max?: number; fallback: number
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block">{label}</label>
      <Input type="number" min={min} max={max} value={value ?? fallback}
        onChange={e => onChange(Number(e.target.value))} className="h-8 text-xs w-24" />
    </div>
  )
}

export function SelectField({ label, value, onChange, options }: {
  label: string; value: any; onChange: (v: string) => void; options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block">{label}</label>
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value)}
        className="w-full h-8 text-xs border rounded-md bg-background px-2">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-muted-foreground">{children}</p>
}

/** Editor de listas de items (beneficios, FAQs, filas de comparación…) */
export function ListEditor({ items, fields, onChange, addLabel }: {
  items: any[]
  fields: Array<{ key: string; label: string; long?: boolean }>
  onChange: (items: any[]) => void
  addLabel: string
}) {
  const list = Array.isArray(items) ? items : []
  return (
    <div className="space-y-2">
      {list.map((item, i) => (
        <div key={i} className="rounded-lg border p-2 space-y-1.5 relative">
          <button
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {fields.map(f => (
            f.long ? (
              <Textarea key={f.key} rows={2} placeholder={f.label} value={item?.[f.key] || ''}
                onChange={e => onChange(list.map((it, j) => j === i ? { ...it, [f.key]: e.target.value } : it))}
                className="text-xs" />
            ) : (
              <Input key={f.key} placeholder={f.label} value={item?.[f.key] || ''}
                onChange={e => onChange(list.map((it, j) => j === i ? { ...it, [f.key]: e.target.value } : it))}
                className={`text-xs h-8 ${f.key === 'icon' ? 'w-20 inline-block mr-1.5' : ''}`} />
            )
          ))}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange([...list, {}])}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />{addLabel}
      </Button>
    </div>
  )
}
