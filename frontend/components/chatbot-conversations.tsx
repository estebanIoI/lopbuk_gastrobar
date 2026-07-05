'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { MessageCircle, Bot, User, Send, Loader2, RefreshCw, Hand, HandMetal } from 'lucide-react'

interface ChatSession {
  id: string
  sessionToken: string
  customerName: string | null
  customerPhone: string | null
  humanTakeover: boolean
  channel: 'web' | 'whatsapp'
  lastActivity: string
  lastMessage: string | null
  messageCount: number
}

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

const timeAgo = (dateStr: string) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}

/**
 * Panel de conversaciones del chatbot: el comerciante ve lo que preguntan sus
 * clientes, toma el control ("Atender yo") y remata la venta en persona.
 * Las respuestas manuales llegan al widget web (polling) y a WhatsApp (Evolution).
 */
export function ChatbotConversations() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [selected, setSelected] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchSessions = useCallback(async () => {
    const res = await api.getChatSessions()
    if (res.success && Array.isArray(res.data)) setSessions(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // Refresco ligero de la conversación abierta (para ver lo que el cliente responde)
  useEffect(() => {
    if (!selected) return
    const interval = setInterval(async () => {
      const res = await api.getChatSessionMessages(selected.id)
      if (res.success && Array.isArray(res.data)) setMessages(res.data)
    }, 6000)
    return () => clearInterval(interval)
  }, [selected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openSession = async (s: ChatSession) => {
    setSelected(s)
    setLoadingMessages(true)
    const res = await api.getChatSessionMessages(s.id)
    if (res.success && Array.isArray(res.data)) setMessages(res.data)
    setLoadingMessages(false)
  }

  const toggleTakeover = async () => {
    if (!selected) return
    const next = !selected.humanTakeover
    const res = await api.setChatTakeover(selected.id, next)
    if (res.success) {
      setSelected({ ...selected, humanTakeover: next })
      setSessions(prev => prev.map(s => (s.id === selected.id ? { ...s, humanTakeover: next } : s)))
    }
  }

  const sendReply = async () => {
    if (!selected || !reply.trim() || sending) return
    setSending(true)
    const text = reply.trim()
    const res = await api.replyChatSession(selected.id, text)
    if (res.success) {
      setMessages(prev => [...prev, { id: res.data?.messageId || Date.now(), role: 'assistant', content: text, createdAt: new Date().toISOString() }])
      setReply('')
    }
    setSending(false)
  }

  const takeoverCount = sessions.filter(s => s.humanTakeover).length

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row min-h-[420px]">
          {/* Lista de sesiones */}
          <div className="md:w-72 border-b md:border-b-0 md:border-r shrink-0">
            <div className="flex items-center justify-between p-3 border-b">
              <p className="text-sm font-semibold flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Conversaciones
                {takeoverCount > 0 && <Badge variant="destructive">{takeoverCount} en atención</Badge>}
              </p>
              <Button variant="ghost" size="icon" onClick={fetchSessions} title="Actualizar">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-8">Cargando…</p>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-4">
                  Aún no hay conversaciones. Cuando tus clientes escriban al chat de la tienda, aparecerán aquí.
                </p>
              ) : (
                sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => openSession(s)}
                    className={`w-full text-left px-3 py-2.5 border-b transition-colors hover:bg-muted/60 ${selected?.id === s.id ? 'bg-muted' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold truncate">
                        {s.customerName || s.customerPhone || 'Visitante'}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(s.lastActivity)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.lastMessage || '—'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {s.channel === 'whatsapp' ? 'WhatsApp' : 'Web'}
                      </Badge>
                      {s.humanTakeover && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Atendiendo tú</Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detalle de la conversación */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-sm text-muted-foreground text-center">
                  Selecciona una conversación para leerla,<br />tomar el control y cerrar la venta tú mismo.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 p-3 border-b">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {selected.customerName || selected.customerPhone || 'Visitante'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.channel === 'whatsapp' ? `WhatsApp · ${selected.customerPhone || ''}` : 'Chat web'} · {selected.messageCount} mensajes
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={selected.humanTakeover ? 'destructive' : 'default'}
                    onClick={toggleTakeover}
                  >
                    {selected.humanTakeover ? (
                      <><HandMetal className="h-3.5 w-3.5 mr-1.5" />Devolver al bot</>
                    ) : (
                      <><Hand className="h-3.5 w-3.5 mr-1.5" />Atender yo</>
                    )}
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[320px] bg-muted/30">
                  {loadingMessages ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Cargando conversación…</p>
                  ) : (
                    messages.map(m => (
                      <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-muted' : 'bg-primary/10'}`}>
                          {m.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3 text-primary" />}
                        </div>
                        <div className={`max-w-[75%] px-3 py-1.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                          m.role === 'user' ? 'bg-background border' : 'bg-primary/10'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Respuesta manual */}
                <div className="p-3 border-t">
                  {!selected.humanTakeover && (
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Activa <strong>"Atender yo"</strong> para silenciar el bot y responder tú directamente.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                      placeholder={selected.humanTakeover ? 'Escribe tu respuesta al cliente…' : 'Activa "Atender yo" para responder'}
                      disabled={!selected.humanTakeover || sending}
                      rows={1}
                      className="flex-1 resize-none text-sm border rounded-lg px-3 py-2 bg-background disabled:opacity-50"
                    />
                    <Button onClick={sendReply} disabled={!selected.humanTakeover || !reply.trim() || sending} size="icon">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
