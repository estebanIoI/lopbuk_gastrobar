'use client'

// Modo Chat Daimuz — el chat ocupa todo el panel (estilo ChatGPT). El comerciante
// solo escribe: el agente da estadísticas/análisis del negocio y opera los módulos
// (hoy Restbar). Las acciones de escritura se confirman antes de ejecutarse.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

type Msg = { role: 'user' | 'assistant'; content: string }
type Pending = { tool: string; args: any; label: string }

const A = '#6366f1'

const SUGGESTIONS = [
  { icon: '📊', text: '¿Cómo van mis ventas hoy y este mes?' },
  { icon: '📦', text: '¿Qué productos están por agotarse?' },
  { icon: '🧾', text: '¿Tengo pedidos pendientes?' },
  { icon: '🍽️', text: '¿Qué mesas están ocupadas?' },
  { icon: '➕', text: 'Abre la mesa 5' },
  { icon: '🧠', text: 'Dame un resumen del negocio con recomendaciones' },
]

export default function ModoChatDaimuz() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [refreshTarget, setRefreshTarget] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const MODULE_LABEL: Record<string, string> = { restbar: 'Mesas / Restbar', inventory: 'Inventario', sales: 'Ventas / POS' }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, pending, busy])

  const ask = async (text: string) => {
    if (!text.trim() || busy) return
    setInput(''); setPending(null)
    const history = messages.slice(-8)
    setMessages(m => [...m, { role: 'user', content: text }])
    setBusy(true)
    try {
      const r = await api.daimuzChatRestbar(text, history)
      if (r.success && r.data) {
        setMessages(m => [...m, { role: 'assistant', content: r.data!.reply }])
        if (r.data.pendingAction) setPending(r.data.pendingAction)
      } else {
        setMessages(m => [...m, { role: 'assistant', content: r.error || 'No pude responder.' }])
      }
    } finally { setBusy(false) }
  }

  const confirm = async () => {
    if (!pending || busy) return
    setBusy(true)
    const action = pending
    setPending(null)
    try {
      const r = await api.daimuzChatExecute(action.tool, action.args)
      setMessages(m => [...m, { role: 'assistant', content: r.success ? `✅ ${r.data?.message || 'Hecho.'}` : `⚠️ ${r.error || 'No se pudo ejecutar.'}` }])
      if (r.success && r.data?.refresh) setRefreshTarget(r.data.refresh)
    } finally { setBusy(false) }
  }

  const empty = messages.length === 0

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <span className="grid place-items-center w-8 h-8 rounded-lg text-white" style={{ background: A }}>💬</span>
        <div>
          <h1 className="font-black leading-none">Chat Daimuz</h1>
          <p className="text-[11px] text-muted-foreground">Tu negocio, por conversación</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 w-full">
        <div className="max-w-2xl mx-auto w-full">
          {empty ? (
            <div className="mt-6 text-center">
              <div className="text-5xl mb-3">💬</div>
              <h2 className="text-xl font-black mb-1">¿Qué necesitas de tu negocio?</h2>
              <p className="text-sm text-muted-foreground mb-6">Pídeme estadísticas, análisis o que opere tus mesas. Solo escribe.</p>
              <div className="grid sm:grid-cols-2 gap-2 text-left">
                {SUGGESTIONS.map(s => (
                  <button key={s.text} onClick={() => ask(s.text)}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm hover:border-foreground/30 transition-colors">
                    <span>{s.icon}</span><span>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'text-white' : 'bg-card border border-border'}`}
                    style={m.role === 'user' ? { background: A } : undefined}>
                    {m.content}
                  </div>
                </div>
              ))}

              {pending && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl border-2 p-4" style={{ borderColor: A }}>
                    <p className="text-sm font-semibold mb-1">Confirmar acción</p>
                    <p className="text-sm text-muted-foreground mb-3">{pending.label}</p>
                    <div className="flex gap-2">
                      <button onClick={confirm} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: A }}>
                        {busy ? 'Ejecutando…' : 'Confirmar'}
                      </button>
                      <button onClick={() => setPending(null)} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold border border-border">Cancelar</button>
                    </div>
                  </div>
                </div>
              )}

              {busy && !pending && <div className="text-xs text-muted-foreground px-1">Pensando…</div>}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {refreshTarget && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-2">
          <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
            <span>✅ {MODULE_LABEL[refreshTarget] || refreshTarget} actualizado</span>
            <button onClick={() => { setRefreshTarget(null); router.push('/') }} className="text-xs font-semibold underline">Abrir panel ↗</button>
          </div>
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(input)}
            placeholder="Escribe lo que quieres hacer o saber…"
            className="flex-1 rounded-xl bg-card border border-border px-4 py-3 text-sm outline-none"
          />
          <button onClick={() => ask(input)} disabled={busy || !input.trim()} className="rounded-xl px-5 font-semibold text-white disabled:opacity-50" style={{ background: A }}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
