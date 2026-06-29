'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { Send, X, MessageCircle, Loader2, Check, CheckCheck } from 'lucide-react'
import { io as socketIO, Socket } from 'socket.io-client'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'

interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderRole: string
  message: string
  messageType: string
  readAt: string | null
  createdAt: string
}

interface DeliveryChatProps {
  orderId: string
  orderNumber?: string
  onClose?: () => void
  currentUserId: string
  currentUserName: string
}

const QUICK_REPLIES = [
  'Ya llegué al local 🏪',
  'Voy en camino 🛵',
  'No encuentro la dirección 📍',
  'Ya llegué a tu puerta 🚪',
  'Entregado con éxito ✅',
]

const ROLE_COLORS: Record<string, string> = {
  repartidor: 'bg-indigo-600',
  comercio: 'bg-emerald-600',
  cliente: 'bg-blue-600',
  system: 'bg-gray-400',
}

function timeLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function msgDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = api.getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API}/delivery-chat${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as any) },
    credentials: 'include',
  })
  return res.json()
}

export function DeliveryChat({ orderId, orderNumber, onClose, currentUserId, currentUserName }: DeliveryChatProps) {
  const [roomId, setRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [showQuick, setShowQuick] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  // Init: get/create room + load messages
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setLoading(true)
      try {
        const roomRes = await apiFetch(`/room/${orderId}`)
        if (cancelled || !roomRes.success) return
        const rid = roomRes.data.room.id
        setRoomId(rid)

        const msgRes = await apiFetch(`/room/${rid}/messages`)
        if (!cancelled && msgRes.success) {
          setMessages(msgRes.data || [])
          scrollToBottom()
        }

        // Mark as read
        apiFetch(`/room/${rid}/read`, { method: 'POST' }).catch(() => {})
      } catch {}
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [orderId, scrollToBottom])

  // Socket.IO
  useEffect(() => {
    if (!roomId) return

    const socket = socketIO(WS, { withCredentials: true, transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-delivery-chat', { roomId })
    })

    socket.on('delivery-message', (msg: ChatMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      scrollToBottom()
      apiFetch(`/room/${roomId}/read`, { method: 'POST' }).catch(() => {})
    })

    socket.on('delivery-typing', ({ senderName, isTyping }: { senderName: string; isTyping: boolean }) => {
      setTypingUser(isTyping ? senderName : null)
    })

    return () => {
      socket.emit('leave-delivery-chat', { roomId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomId, scrollToBottom])

  const emitTyping = useCallback((isTyping: boolean) => {
    socketRef.current?.emit('delivery-typing', { roomId, senderName: currentUserName, isTyping })
  }, [roomId, currentUserName])

  const handleInput = (v: string) => {
    setInput(v)
    emitTyping(true)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => emitTyping(false), 1500)
  }

  const sendMessage = async (text: string, type = 'text') => {
    if (!roomId || (!text.trim() && type === 'text')) return
    setSending(true)
    setInput('')
    setShowQuick(false)
    emitTyping(false)
    try {
      await apiFetch(`/room/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: text.trim(), messageType: type }),
      })
    } catch {}
    setSending(false)
    scrollToBottom()
  }

  const handleSend = () => sendMessage(input)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Group messages by date
  const grouped: { date: string; messages: ChatMessage[] }[] = []
  for (const msg of messages) {
    const d = msgDate(msg.createdAt)
    if (!grouped.length || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, messages: [msg] })
    } else {
      grouped[grouped.length - 1].messages.push(msg)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0e1117] text-white rounded-xl overflow-hidden border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1f2e] border-b border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Chat de entrega</p>
          <p className="text-xs text-white/50 truncate">Pedido #{orderNumber || orderId.slice(-6)}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff20 transparent' }}>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12 text-white/30">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Sin mensajes aún</p>
            <p className="text-xs mt-1">Inicia la conversación</p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-white/30 px-2">{group.date}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            {group.messages.map(msg => {
              const isMe = msg.senderId === currentUserId
              const isSystem = msg.senderRole === 'system' || msg.messageType === 'system'

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="text-[10px] bg-white/10 text-white/50 rounded-full px-3 py-1">{msg.message}</span>
                  </div>
                )
              }

              return (
                <div key={msg.id} className={`flex gap-2 mb-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <div className={`w-6 h-6 rounded-full shrink-0 mt-auto flex items-center justify-center text-[10px] font-bold ${ROLE_COLORS[msg.senderRole] || 'bg-gray-600'}`}>
                      {msg.senderName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isMe && (
                      <span className="text-[10px] text-white/40 mb-0.5 ml-1">{msg.senderName}</span>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-[#1e2535] text-white/90 rounded-bl-sm'
                      }`}
                    >
                      {msg.message}
                    </div>
                    <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[9px] text-white/30">{timeLabel(msg.createdAt)}</span>
                      {isMe && (
                        msg.readAt
                          ? <CheckCheck className="h-3 w-3 text-indigo-400" />
                          : <Check className="h-3 w-3 text-white/30" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {typingUser && (
          <div className="flex items-center gap-2 pb-1">
            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-[10px]">
              {typingUser.charAt(0)}
            </div>
            <div className="bg-[#1e2535] rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
              {[0, 0.2, 0.4].map(delay => (
                <div key={delay} className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQuick && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {QUICK_REPLIES.map(qr => (
            <button
              key={qr}
              onClick={() => sendMessage(qr, 'quick_reply')}
              className="text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-full px-3 py-1 hover:bg-indigo-600/40 transition-colors"
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-white/10 shrink-0 flex gap-2 items-end">
        <button
          onClick={() => setShowQuick(v => !v)}
          className={`p-2 rounded-xl transition-colors shrink-0 ${showQuick ? 'bg-indigo-600/30 text-indigo-300' : 'bg-white/5 text-white/40 hover:text-white/70'}`}
          title="Respuestas rápidas"
        >
          <span className="text-base">⚡</span>
        </button>
        <textarea
          value={input}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="flex-1 bg-[#1e2535] text-white text-sm rounded-xl px-3 py-2.5 resize-none outline-none border border-white/10 focus:border-indigo-500/50 placeholder-white/25 transition-colors"
          style={{ maxHeight: 96, overflowY: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="p-2.5 bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
