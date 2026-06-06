'use client'

/**
 * platform-assistant.tsx
 * Asistente personal flotante para COMERCIANTE y SUPERADMIN.
 * Reutiliza la estructura de chat. Consciente del rol vía backend (/api/assistant):
 *  - superadmin → Agente Maestro (red completa)
 *  - comerciante → asistente de su negocio
 * Solo se muestra si la plataforma tiene el asistente habilitado.
 */
import { useState, useEffect, useRef } from 'react'
import { Sparkles, X, Send, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

export function PlatformAssistant() {
  const { user } = useAuthStore() as any
  const role = user?.role
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const eligible = role === 'superadmin' || role === 'comerciante' || role === 'administrador_rb'

  useEffect(() => {
    if (!eligible) return
    api.getPlatformAssistant().then(r => { if (r.success && r.data?.enabled) setEnabled(true) })
  }, [eligible])

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ role: 'assistant', content: role === 'superadmin'
        ? 'Soy tu Agente Maestro. Pregúntame por la red: "¿top 10 comercios por ventas?", "¿pedidos pendientes?", "¿stock crítico?", "¿comercios inactivos?".'
        : 'Soy el asistente de tu negocio. Pregúntame: "¿ventas de hoy?", "¿pedidos pendientes?", "¿qué productos están por agotarse?", "¿mis próximas citas?".' }])
    }
  }, [open, role, msgs.length])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  if (!eligible || !enabled) return null

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput(''); setSending(true)
    const history = msgs.map(m => ({ role: m.role, content: m.content }))
    setMsgs(m => [...m, { role: 'user', content: text }])
    const r = await api.platformAssistantSend(text, history)
    setSending(false)
    setMsgs(m => [...m, { role: 'assistant', content: r.success ? r.data.reply : (r.error || 'No pude procesar eso.') }])
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[90] w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
          title="Asistente">
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-2.5rem)] bg-white rounded-2xl shadow-2xl border border-black/10 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 h-13 py-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white flex-shrink-0">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" />
              <span className="font-semibold text-sm">{role === 'superadmin' ? 'Agente Maestro' : 'Asistente del negocio'}</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-full"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-neutral-50">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-orange-500 text-white' : 'bg-white border border-black/5 shadow-sm text-neutral-800'}`}>{m.content}</div>
              </div>
            ))}
            {sending && <div className="flex justify-start"><div className="bg-white border border-black/5 rounded-2xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-orange-500" /></div></div>}
            <div ref={endRef} />
          </div>

          <div className="p-2.5 border-t border-black/10 flex gap-2 flex-shrink-0">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Pregúntame…" className="flex-1 bg-neutral-100 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-orange-400" />
            <button onClick={send} disabled={sending} className="bg-orange-500 text-white rounded-xl px-3 disabled:opacity-50"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  )
}

export default PlatformAssistant
