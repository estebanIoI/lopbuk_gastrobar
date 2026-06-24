'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, Loader2, ShoppingCart, ExternalLink } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SuggestedProduct {
  id: string
  name: string
  salePrice: number
  imageUrl: string | null
  category: string | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  products?: SuggestedProduct[]
}

interface ChatWidgetProps {
  storeSlug: string
  botName: string
  botAvatarUrl?: string | null
  accentColor?: string
  onClose: () => void
  /** Called when the user clicks "Ver" on a suggested product. Widget closes automatically. */
  onProductClick?: (productId: string) => void
}

// ─── Color helper ───────────────────────────────────────────────────────────────

function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '')
  const r = parseInt(color.substring(0, 2), 16)
  const g = parseInt(color.substring(2, 4), 16)
  const b = parseInt(color.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
}

// ─── Product card ───────────────────────────────────────────────────────────────

function ProductCard({
  product,
  accentColor,
  isLight,
  onProductClick,
  onOrderByChat,
}: {
  product: SuggestedProduct
  accentColor: string
  isLight: boolean
  onProductClick?: (id: string) => void
  onOrderByChat?: (product: SuggestedProduct) => void
}) {
  const hasActions = onProductClick || onOrderByChat
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden min-w-0">
      {/* Info row */}
      <div className="flex items-center gap-2.5 p-2.5">
        <div className="relative w-12 h-12 rounded-lg flex-shrink-0 bg-gray-100 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-gray-300" />
          </div>
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="relative w-full h-full object-cover"
              // Si la imagen externa está caída o rota, la ocultamos y queda el ícono.
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{product.name}</p>
          {product.category && (
            <p className="text-[10px] text-gray-400 truncate">{product.category}</p>
          )}
          <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCOP(product.salePrice)}</p>
        </div>
      </div>

      {/* Action buttons */}
      {hasActions && (
        <div className="flex border-t border-gray-100 divide-x divide-gray-100">
          {onProductClick && (
            <button
              onClick={() => onProductClick(product.id)}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-2 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Ver en tienda
            </button>
          )}
          {onOrderByChat && (
            <button
              onClick={() => onOrderByChat(product)}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-2 transition-colors hover:opacity-80"
              style={{ color: accentColor }}
            >
              <ShoppingCart className="w-3 h-3" />
              Pedir por aquí
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main widget ───────────────────────────────────────────────────────────────

export function ChatWidget({ storeSlug, botName, botAvatarUrl, accentColor = '#f59e0b', onClose, onProductClick }: ChatWidgetProps) {
  const isLight = isLightColor(accentColor)
  const textColor = isLight ? 'text-gray-900' : 'text-white'
  const textMutedColor = isLight ? 'text-gray-600' : 'text-white/80'
  const iconColor = isLight ? 'text-gray-900' : 'text-white'

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `¡Hola! Soy ${botName} 👋 Cuéntame qué estás buscando y te ayudo a encontrar justo lo que necesitas.` },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | undefined>()
  // Productos que el cliente ya pidió por aquí: no se vuelven a mostrar como tarjeta.
  const [orderedIds, setOrderedIds] = useState<Set<string>>(new Set())
  const orderedIdsRef = useRef<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionTokenRef = useRef<string | undefined>(undefined)

  useEffect(() => { sessionTokenRef.current = sessionToken }, [sessionToken])

  const markOrdered = (id: string) => {
    const next = new Set(orderedIdsRef.current); next.add(id)
    orderedIdsRef.current = next
    setOrderedIds(next)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessageText = async (text: string) => {
    if (!text || sending) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setSending(true)
    try {
      const res = await fetch(`${API_URL}/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: storeSlug, sessionToken: sessionTokenRef.current, message: text, excludeProductIds: Array.from(orderedIdsRef.current) }),
      })
      const json = await res.json()
      if (json.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: json.data.reply,
          products: json.data.suggestedProducts,
        }])
        if (json.data.sessionToken) setSessionToken(json.data.sessionToken)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, hubo un problema. Por favor intenta nuevamente.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sin conexión. Verifica tu internet e intenta nuevamente.' }])
    }
    setSending(false)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    await sendMessageText(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleProductClick = (productId: string) => {
    if (onProductClick) {
      onClose()
      setTimeout(() => onProductClick(productId), 150)
    }
  }

  const handleOrderByChat = (product: SuggestedProduct) => {
    markOrdered(product.id)   // se marca antes de enviar para excluirlo del backend
    sendMessageText(`Quiero pedir: ${product.name}`)
  }

  return (
    <div className="fixed bottom-36 sm:bottom-24 right-4 sm:right-6 w-[340px] max-w-[calc(100vw-2rem)] z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: accentColor }}>
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {botAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={botAvatarUrl} alt={botName} className="w-full h-full object-cover" />
          ) : (
            <Bot className={`w-5 h-5 ${iconColor}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`${textColor} font-semibold text-sm truncate`}>{botName}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
            <p className={`${textMutedColor} text-xs`}>En línea</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
        >
          <X className={`w-4 h-4 ${iconColor}`} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 max-h-[420px] min-h-[200px] bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 overflow-hidden"
                style={{ background: accentColor }}>
                {botAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={botAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Bot className={`w-3.5 h-3.5 ${iconColor}`} />
                )}
              </div>
            )}
            <div className={`max-w-[80%] flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? `${isLight ? 'text-gray-900 border border-gray-200' : 'text-white'} rounded-tr-sm`
                    : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
                }`}
                style={msg.role === 'user' ? { background: accentColor } : undefined}
              >
                {msg.content}
              </div>

              {/* Tarjetas de producto — se ocultan las de productos ya pedidos por aquí */}
              {msg.role === 'assistant' && msg.products && msg.products.filter(p => !orderedIds.has(p.id)).length > 0 && (
                <div className="w-full space-y-1.5">
                  {msg.products.filter(p => !orderedIds.has(p.id)).map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      accentColor={accentColor}
                      isLight={isLight}
                      onProductClick={onProductClick ? handleProductClick : undefined}
                      onOrderByChat={handleOrderByChat}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: accentColor }}>
              <Bot className={`w-3.5 h-3.5 ${iconColor}`} />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-gray-100 bg-white flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu mensaje..."
          rows={1}
          className="flex-1 resize-none text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-gray-400 max-h-24 leading-relaxed"
          style={{ minHeight: '38px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
          style={{ background: accentColor }}
        >
          {sending ? <Loader2 className={`w-4 h-4 ${iconColor} animate-spin`} /> : <Send className={`w-4 h-4 ${iconColor}`} />}
        </button>
      </div>

      <div className="text-center py-1.5 bg-white border-t border-gray-50">
        <p className="text-[10px] text-gray-300">Asistente IA · Puede cometer errores</p>
      </div>
    </div>
  )
}
