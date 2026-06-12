'use client'

import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { useTourStore } from '@/lib/tour-store'
import { stepIndexById } from '@/lib/tour-catalog'
import { api } from '@/lib/api'
import { MessageCircleQuestion, X, Send, Sparkles } from 'lucide-react'

// ── Intents (reglas) — mapean la pregunta a una respuesta corta + el paso de la guía ──
// tourKey por defecto 'main'; algunas preguntas abren una sub-guía detallada (ej. 'pos').
type Intent = { keys: string[]; answer: string; tour: string; section?: string; tourKey?: string }

const INTENTS: Intent[] = [
  { keys: ['vender', 'venta', 'vendo', 'cobrar', 'cobro', 'factura', 'facturar', 'pos', 'punto de venta'], answer: 'Para vender: busca el producto, agrégalo al carrito y toca COBRAR. Te lo muestro paso a paso en el Punto de Venta.', tourKey: 'pos', tour: 'pos-search', section: 'pos' },
  { keys: ['mesa', 'mesero', 'comanda', 'salon', 'cocina', 'bar', 'gastrobar', 'restbar', 'orden de mesa', 'kds'], answer: 'En Gastrobar manejas el salón: abres mesas, tomas comandas con sus modificadores y las envías a cocina o barra. Te lo muestro.', tourKey: 'gastrobar', tour: 'gastro-intro', section: 'restbar' },
  { keys: ['merma', 'desperdicio', 'perdida', 'baja de producto'], answer: 'En Merma registras desperdicios para que el inventario y los costos reflejen la realidad de la cocina. Te llevo.', tourKey: 'gastrobar', tour: 'gastro-merma', section: 'merma' },
  { keys: ['caja', 'cierre', 'arqueo', 'cuadre', 'abrir caja', 'cerrar caja'], answer: 'La caja maneja la apertura con tu base, los ingresos/retiros del día y el cierre con cuadre. Te lo muestro.', tourKey: 'cash', tour: 'caja-open', section: 'cash-register' },
  { keys: ['producto', 'agregar producto', 'crear producto', 'inventario', 'stock', 'existencias', 'variante', 'presentacion', 'receta', 'bom'], answer: 'En Inventario creas y gestionas tus productos (con variantes o recetas BOM y su propio stock). Te lo muestro paso a paso.', tourKey: 'inventory', tour: 'inv-new', section: 'inventory' },
  { keys: ['pedido', 'orden', 'despacho', 'entrega', 'domicilio'], answer: 'Los pedidos de tu tienda online llegan a Pedidos: ahí los buscas, filtras por estado y avanzas su despacho hasta entregar. Te lo muestro.', tourKey: 'orders', tour: 'ped-search', section: 'pedidos' },
  { keys: ['tienda', 'cupon', 'cupones', 'resena', 'reseña', 'catalogo online', 'publicar producto', 'personalizar'], answer: 'En Tienda eliges qué productos publicar, personalizas el aspecto y manejas cupones y reseñas. Te lo muestro.', tourKey: 'store', tour: 'tnd-customize', section: 'tienda' },
  { keys: ['cliente', 'fiado', 'credito', 'deuda', 'abono'], answer: 'En Clientes guardas a tus compradores, ves sus saldos pendientes (fiados) y su historial. Te lo muestro paso a paso.', tourKey: 'customers', tour: 'cli-new', section: 'customers' },
  { keys: ['empleado', 'vendedor', 'usuario', 'rol', 'permiso'], answer: 'A tu equipo lo administras en Empleados (dentro de Clientes), con sus permisos. Te llevo.', tour: 'clientes', section: 'vendedores' },
  { keys: ['reporte', 'analisis', 'estadistica', 'ventas del mes', 'ganancia', 'grafico', 'grafica', 'margen', 'rentabilidad', 'finanzas', 'dian'], answer: 'En Reportes ves tus indicadores (margen, ROI, ticket promedio), gráficos del negocio y tus finanzas. Te llevo.', tourKey: 'reports', tour: 'rep-tabs', section: 'analytics' },
  { keys: ['configurar', 'configuracion', 'ajuste', 'negocio', 'logo', 'impresora', 'imprimir'], answer: 'En Configuración ajustas tu negocio, logo e impresoras. Te muestro dónde está.', tour: 'config', section: 'settings' },
  { keys: ['buscar', 'busqueda', 'encontrar'], answer: 'Puedes buscar productos, facturas o clientes desde la barra de búsqueda de arriba. Te la señalo.', tour: 'search' },
]

const FALLBACK: Intent = { keys: [], answer: 'No estoy seguro, pero te muestro un recorrido rápido por todo el panel para que lo ubiques 👇', tour: 'welcome' }

const SUGGESTIONS = [
  '¿Cómo registro una venta?',
  '¿Cómo abro una mesa?',
  '¿Cómo agrego un producto?',
  '¿Dónde veo mis reportes?',
]

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(DIACRITICS, '')

function matchIntent(text: string): Intent {
  const t = normalize(text)
  for (const intent of INTENTS) {
    if (intent.keys.some(k => t.includes(normalize(k)))) return intent
  }
  return FALLBACK
}

type Msg = { role: 'bot' | 'user'; text: string; typing?: boolean; action?: { tour: string; section?: string; tourKey?: string } }

function replaceTyping(arr: Msg[], msg: Msg): Msg[] {
  const i = arr.findIndex(m => m.typing)
  if (i === -1) return [...arr, msg]
  const copy = arr.slice()
  copy[i] = msg
  return copy
}

export function PanelAssistant() {
  const setActiveSection = useStore(s => s.setActiveSection)
  const startTour = useTourStore(s => s.start)

  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [botName, setBotName] = useState('Asistente')
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'bot', text: '¡Hola! 👋 Soy tu asistente. Dime qué necesitas hacer y te muestro cómo, paso a paso.' },
  ])
  const endRef = useRef<HTMLDivElement>(null)

  // Visible si el comercio tiene el chatbot activado O el asistente de plataforma está habilitado.
  useEffect(() => {
    let alive = true
    api.getChatbotConfig().then(r => {
      if (!alive) return
      const d: any = r?.data
      if (r?.success && d && (d.is_enabled === true || d.is_enabled === 1)) {
        setEnabled(true)
        if (d.bot_name) setBotName(d.bot_name)
      }
    }).catch(() => {})
    api.getPlatformAssistant().then(r => {
      if (!alive) return
      if (r?.success && r.data?.enabled) setEnabled(true)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, open])

  if (!enabled) return null

  const launch = (tour: string, section?: string, tourKey = 'main') => {
    if (section) setActiveSection(section)
    setOpen(false)
    // pequeño retardo para que la sección/layout se asiente antes de medir
    setTimeout(() => startTour(tourKey, stepIndexById(tour, tourKey)), 420)
  }

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text) return
    setInput('')
    // Intent local: da SIEMPRE una acción de guía, aunque la IA responda con texto.
    const matched = matchIntent(text)
    const guideAction = { tour: matched.tour, section: matched.section, tourKey: matched.tourKey }
    // Historial para la IA (antes de añadir el placeholder "escribiendo")
    const history = msgs
      .filter(m => !m.typing && m.text)
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }))
    setMsgs(prev => [...prev, { role: 'user', text }, { role: 'bot', text: '', typing: true }])
    try {
      const r = await api.sendAssistantMessage([...history, { role: 'user', content: text }])
      if (r?.success && r.data?.reply) {
        // La IA da el texto; la guía (acción) viene del intent local para que el botón
        // "Mostrarme cómo →" siempre lleve al usuario al lugar correcto.
        const action = r.data.action
          ? { tour: r.data.action.stepId, section: r.data.action.section, tourKey: r.data.action.tourKey }
          : guideAction
        setMsgs(prev => replaceTyping(prev, { role: 'bot', text: r.data!.reply, action }))
        return
      }
      throw new Error('sin respuesta')
    } catch {
      // Respaldo por reglas: siempre resuelve y ofrece abrir la guía
      setMsgs(prev => replaceTyping(prev, {
        role: 'bot',
        text: matched.answer,
        action: guideAction,
      }))
    }
  }

  return (
    <>
      <style>{ASSISTANT_CSS}</style>

      {/* Botón flotante */}
      {!open && (
        <button className="pa-fab" onClick={() => setOpen(true)} aria-label="Abrir asistente">
          <MessageCircleQuestion size={22} />
          <span className="pa-fab-label">¿Cómo se hace?</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="pa-panel" role="dialog" aria-label="Asistente de uso">
          <div className="pa-head">
            <div className="pa-head-title">
              <Sparkles size={16} />
              <div>
                <div className="pa-bot-name">{botName}</div>
                <div className="pa-bot-sub">Te guío dentro del panel</div>
              </div>
            </div>
            <button className="pa-close" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={16} /></button>
          </div>

          <div className="pa-body">
            {msgs.map((m, i) => (
              <div key={i} className={`pa-msg ${m.role}`}>
                <div className="pa-bubble">
                  {m.typing ? (
                    <span className="pa-typing"><span></span><span></span><span></span></span>
                  ) : (
                    <>
                      {m.text}
                      {m.action && (
                        <button className="pa-show-btn" onClick={() => launch(m.action!.tour, m.action!.section, m.action!.tourKey)}>
                          Mostrarme cómo →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Sugerencias */}
          <div className="pa-chips">
            {SUGGESTIONS.map(s => (
              <button key={s} className="pa-chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>

          {/* Input */}
          <div className="pa-input-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(input) }}
              placeholder="Escribe tu pregunta…"
              aria-label="Tu pregunta"
            />
            <button className="pa-send" onClick={() => send(input)} aria-label="Enviar"><Send size={16} /></button>
          </div>
        </div>
      )}
    </>
  )
}

const ASSISTANT_CSS = `
.pa-fab{position:fixed;bottom:20px;right:20px;z-index:1000;display:flex;align-items:center;gap:8px;background:#00833E;color:#fff;border:none;border-radius:30px;padding:12px 16px;box-shadow:0 8px 24px rgba(0,131,62,0.35);cursor:pointer;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;font-weight:600;transition:transform .15s,background .15s;}
.pa-fab:hover{background:#00692f;transform:translateY(-2px);}
.pa-fab-label{white-space:nowrap;}
@media (max-width:520px){.pa-fab-label{display:none;}.pa-fab{padding:13px;border-radius:50%;}}

.pa-panel{position:fixed;bottom:20px;right:20px;z-index:1000;width:350px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 40px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.28);display:flex;flex-direction:column;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;}
.pa-head{background:linear-gradient(135deg,#00833E 0%,#00a04c 100%);color:#fff;padding:13px 15px;display:flex;align-items:center;justify-content:space-between;}
.pa-head-title{display:flex;align-items:center;gap:9px;}
.pa-bot-name{font-size:14px;font-weight:700;line-height:1.1;}
.pa-bot-sub{font-size:11px;opacity:.85;}
.pa-close{background:rgba(255,255,255,.18);border:none;color:#fff;width:26px;height:26px;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.pa-close:hover{background:rgba(255,255,255,.3);}
.pa-body{flex:1;overflow-y:auto;padding:14px;background:#F6F8F6;display:flex;flex-direction:column;gap:10px;}
.pa-msg{display:flex;}
.pa-msg.user{justify-content:flex-end;}
.pa-bubble{max-width:85%;font-size:13px;line-height:1.5;padding:9px 12px;border-radius:12px;color:#1A1A1A;}
.pa-msg.bot .pa-bubble{background:#fff;border:1px solid #E2E5E0;border-bottom-left-radius:4px;}
.pa-msg.user .pa-bubble{background:#00833E;color:#fff;border-bottom-right-radius:4px;}
.pa-typing{display:inline-flex;gap:4px;align-items:center;padding:2px 0;}
.pa-typing span{width:6px;height:6px;border-radius:50%;background:#9BB5A6;display:inline-block;animation:paBlink 1.2s infinite ease-in-out;}
.pa-typing span:nth-child(2){animation-delay:.2s;}
.pa-typing span:nth-child(3){animation-delay:.4s;}
@keyframes paBlink{0%,80%,100%{opacity:.3;transform:translateY(0);}40%{opacity:1;transform:translateY(-2px);}}
.pa-show-btn{display:block;margin-top:9px;background:#E6F4ED;color:#00692f;border:none;font-size:12.5px;font-weight:700;padding:7px 12px;border-radius:8px;cursor:pointer;width:100%;}
.pa-show-btn:hover{background:#00833E;color:#fff;}
.pa-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;background:#fff;border-top:1px solid #EEF1EE;scrollbar-width:none;}
.pa-chips::-webkit-scrollbar{display:none;}
.pa-chip{flex-shrink:0;background:#F0F4F1;border:1px solid #DDE6E0;color:#2A4A38;font-size:11.5px;padding:6px 10px;border-radius:14px;cursor:pointer;white-space:nowrap;}
.pa-chip:hover{background:#E6F4ED;border-color:#00833E;}
.pa-input-row{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #EEF1EE;background:#fff;}
.pa-input-row input{flex:1;border:1px solid #DDE6E0;border-radius:20px;padding:9px 14px;font-size:13px;outline:none;color:#1A1A1A;}
.pa-input-row input:focus{border-color:#00833E;}
.pa-send{background:#00833E;border:none;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
.pa-send:hover{background:#00692f;}
`
