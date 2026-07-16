'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: any[]
}

const SUGGESTIONS = [
  '¿Por qué bajaron mis ventas?',
  '¿Qué clientes están en riesgo de abandono?',
  'Crea una campaña para reactivar clientes inactivos',
  '¿Cuál es mi mejor canal de ventas?',
  'Recomiéndame una estrategia para aumentar visitas',
  '¿Qué nivel de fidelización tiene más clientes?',
]

export function AICopilot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de negocio. Puedo analizar tus ventas, clientes, campañas y darte recomendaciones. ¿Qué quieres saber?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const r = await api.engagementCopilotChat(msg, history)
      if (r.success && r.data) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: r.data.reply,
          actions: r.data.actions,
        }
        setMessages(prev => [...prev, assistantMsg])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'No pude procesar tu pregunta. Intenta de nuevo.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Verifica que la IA esté configurada.' }])
    }
    setLoading(false)
  }

  const executeAction = async (action: any) => {
    switch (action.type) {
      case 'create_campaign': {
        const r = await api.createEngagementCampaign(action.data)
        if (r.success) toast.success('¡Campaña creada!')
        else toast.error(r.error ?? 'Error')
        break
      }
      case 'create_segment': {
        const r = await api.createEngagementSegment(action.data)
        if (r.success) toast.success('¡Segmento creado!')
        else toast.error(r.error ?? 'Error')
        break
      }
      case 'create_automation': {
        const r = await api.createEngagementAutomation(action.data)
        if (r.success) toast.success('¡Automatización creada!')
        else toast.error(r.error ?? 'Error')
        break
      }
      default:
        toast.info('Acción no reconocida')
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-sm">🤖</div>
        <div>
          <p className="font-bold text-sm">AI Copilot</p>
          <p className="text-[10px] text-muted-foreground">Analiza tu negocio y te da recomendaciones</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'user'
                ? 'bg-amber-500 text-black rounded-br-md'
                : 'bg-accent border border-border rounded-bl-md'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {msg.actions.map((action, j) => (
                    <button key={j} onClick={() => executeAction(action)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-500 transition">
                      {action.type === 'create_campaign' && '📢 Crear campaña'}
                      {action.type === 'create_segment' && '🏷️ Crear segmento'}
                      {action.type === 'create_automation' && '🔁 Crear automatización'}
                      {!['create_campaign', 'create_segment', 'create_automation'].includes(action.type) && `⚡ ${action.type}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-accent border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)}
              className="px-3 py-1.5 rounded-full border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-amber-500/50 transition">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Pregúntale a tu negocio..."
          disabled={loading}
          className="flex-1 rounded-xl bg-background border border-border px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition disabled:opacity-50"
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2.5 transition disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        </button>
      </div>
    </div>
  )
}
