'use client'

// Pantalla de éxito del pedido (Tema 2): animación holográfica "en camino" +
// tarjeta de ticket con el resumen. CSS scoped a .t2-success / keyframes t2s-*
// para no afectar el resto de la app.
import { X, MessageCircle } from 'lucide-react'

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export interface OrderSuccessData {
  orderNumber?: string
  total: number
  items: { name: string; qty: number; lineTotal: number }[]
  mode: 'domicilio' | 'recoger'
  customerName: string
  sedeName?: string | null
  /** URL de WhatsApp con el resumen (opcional): se ofrece como botón, no redirige solo. */
  whatsappUrl?: string
}

export function Theme2OrderSuccess({
  data, brand, onClose, onNewOrder,
}: { data: OrderSuccessData; brand?: string; onClose: () => void; onNewOrder: () => void }) {
  const enCamino = data.mode === 'domicilio'
  const headline = enCamino ? 'Tu pedido está en camino' : '¡Pedido recibido!'
  const sub = enCamino
    ? 'Lo estamos preparando. Te contactaremos por WhatsApp para coordinar la entrega.'
    : 'Lo estamos preparando. Te avisaremos por WhatsApp cuando puedas pasar a recogerlo.'

  return (
    <div className="t2-success fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="t2s-backdrop" />
      <div className="t2s-card" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="t2s-close" aria-label="Cerrar"><X className="w-5 h-5" /></button>

        {/* ── Escena holográfica ── */}
        <div className="t2s-holo">
          <span className="t2s-ring t2s-ring1" />
          <span className="t2s-ring t2s-ring2" />
          <span className="t2s-ring t2s-ring3" />
          <span className="t2s-scan" />
          <span className="t2s-emoji">{enCamino ? '🛵' : '🛍️'}</span>
          {enCamino && <span className="t2s-trail" />}
        </div>

        <h2 className="t2s-title">{headline}</h2>
        <p className="t2s-sub">{sub}</p>

        {/* ── Ticket ── */}
        <div className="t2s-ticket">
          <div className="t2s-ticket-top">
            <span className="t2s-ticket-brand">{brand || 'Pedido'}</span>
            {data.orderNumber && <span className="t2s-ticket-num">#{data.orderNumber}</span>}
          </div>
          <div className="t2s-perf" />
          <div className="t2s-ticket-body">
            {data.items.map((it, i) => (
              <div key={i} className="t2s-line">
                <span className="t2s-line-name">{it.qty}× {it.name}</span>
                <span className="t2s-line-val">{COP(it.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="t2s-perf t2s-perf-dashed" />
          <div className="t2s-ticket-foot">
            <div className="t2s-meta">
              <span>{data.customerName}</span>
              <span>{enCamino ? '🛵 Domicilio' : '🏪 Recoger'}{data.sedeName ? ` · ${data.sedeName}` : ''}</span>
            </div>
            <div className="t2s-total">
              <span>Total</span>
              <span className="t2s-total-val">{COP(data.total)}</span>
            </div>
          </div>
          <span className="t2s-notch t2s-notch-l" />
          <span className="t2s-notch t2s-notch-r" />
        </div>

        {/* WhatsApp opcional: "¿Olvidaste algo?" — NO se abre solo, el cliente decide. */}
        {data.whatsappUrl && (
          <button onClick={() => window.open(data.whatsappUrl!, '_blank')} className="t2s-wa">
            <MessageCircle className="w-4 h-4" />
            ¿Olvidaste algo? Confírmalo por WhatsApp
          </button>
        )}

        <div className="t2s-actions">
          <button onClick={onNewOrder} className="t2s-btn-ghost">Seguir comprando</button>
          <button onClick={onClose} className="t2s-btn">Listo</button>
        </div>
      </div>

      <style jsx>{`
        .t2-success { animation: t2s-fade .25s ease; }
        .t2s-backdrop {
          position: absolute; inset: 0;
          background: radial-gradient(1200px 600px at 50% -10%, rgba(34,211,238,.12), transparent 60%), rgba(0,0,0,.82);
          backdrop-filter: blur(6px);
        }
        .t2s-card {
          position: relative; z-index: 1; width: 100%; max-width: 24rem;
          max-height: 92vh; overflow-y: auto;
          background: #101213; border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px; padding: 22px 20px 20px; text-align: center;
          box-shadow: 0 30px 80px rgba(0,0,0,.6);
          animation: t2s-pop .4s cubic-bezier(.2,.9,.3,1.2);
        }
        .t2s-close {
          position: absolute; top: 12px; right: 12px; color: rgba(255,255,255,.4);
          background: transparent; border: 0; cursor: pointer; transition: color .2s;
        }
        .t2s-close:hover { color: #fff; }

        /* Holograma */
        .t2s-holo {
          position: relative; width: 140px; height: 140px; margin: 6px auto 4px;
          display: grid; place-items: center;
        }
        .t2s-ring {
          position: absolute; border-radius: 50%; border: 2px solid rgba(34,211,238,.5);
          box-shadow: 0 0 18px rgba(34,211,238,.35) inset, 0 0 18px rgba(34,211,238,.25);
        }
        .t2s-ring1 { width: 132px; height: 132px; animation: t2s-spin 4.5s linear infinite; border-style: dashed; }
        .t2s-ring2 { width: 100px; height: 100px; border-color: rgba(45,212,191,.55); animation: t2s-spin 3s linear infinite reverse; }
        .t2s-ring3 { width: 70px; height: 70px; border-color: rgba(34,211,238,.7); animation: t2s-pulse 1.8s ease-in-out infinite; }
        .t2s-scan {
          position: absolute; width: 132px; height: 132px; border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0 78%, rgba(34,211,238,.35) 92%, transparent 100%);
          animation: t2s-spin 2.2s linear infinite;
        }
        .t2s-emoji { font-size: 40px; filter: drop-shadow(0 4px 10px rgba(34,211,238,.5)); animation: t2s-bob 1.6s ease-in-out infinite; }
        .t2s-trail {
          position: absolute; bottom: 30px; left: 50%; width: 60px; height: 3px; transform: translateX(-50%);
          background: linear-gradient(90deg, transparent, rgba(34,211,238,.8), transparent);
          border-radius: 3px; animation: t2s-trail 1.1s ease-in-out infinite;
        }

        .t2s-title { font-size: 1.25rem; font-weight: 800; color: #fff; margin: 6px 0 2px; }
        .t2s-sub { font-size: .8rem; color: rgba(255,255,255,.55); line-height: 1.45; margin: 0 4px 16px; }

        /* Ticket */
        .t2s-ticket {
          position: relative; text-align: left; background: #17191b;
          border: 1px solid rgba(255,255,255,.07); border-radius: 16px; overflow: hidden;
        }
        .t2s-ticket-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; }
        .t2s-ticket-brand { font-weight: 800; color: #fff; font-size: .9rem; }
        .t2s-ticket-num { font-size: .72rem; font-weight: 700; color: #22d3ee; letter-spacing: .05em; }
        .t2s-perf { height: 0; border-top: 2px dotted rgba(255,255,255,.12); margin: 0 12px; }
        .t2s-perf-dashed { border-top-style: dashed; }
        .t2s-ticket-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; max-height: 28vh; overflow-y: auto; }
        .t2s-line { display: flex; justify-content: space-between; gap: 10px; font-size: .8rem; }
        .t2s-line-name { color: rgba(255,255,255,.8); }
        .t2s-line-val { color: rgba(255,255,255,.55); white-space: nowrap; }
        .t2s-ticket-foot { padding: 12px 16px 16px; }
        .t2s-meta { display: flex; flex-direction: column; gap: 2px; font-size: .72rem; color: rgba(255,255,255,.45); margin-bottom: 10px; }
        .t2s-total { display: flex; align-items: center; justify-content: space-between; font-weight: 800; color: #fff; }
        .t2s-total-val { color: #22d3ee; font-size: 1.1rem; }
        .t2s-notch { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #101213; top: 50%; transform: translateY(-50%); }
        .t2s-notch-l { left: -9px; }
        .t2s-notch-r { right: -9px; }

        .t2s-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
        .t2s-btn {
          border: 0; border-radius: 12px; padding: 12px; font-weight: 700; cursor: pointer;
          background: linear-gradient(90deg, #06b6d4, #14b8a6); color: #04201f;
        }
        .t2s-btn-ghost {
          border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 12px;
          font-weight: 600; cursor: pointer; background: transparent; color: rgba(255,255,255,.75);
        }
        .t2s-btn-ghost:hover { background: rgba(255,255,255,.05); }
        .t2s-wa {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; margin-top: 14px; border: 1px solid rgba(37,211,102,.4);
          border-radius: 12px; padding: 11px; font-weight: 700; cursor: pointer;
          background: rgba(37,211,102,.12); color: #25d366; font-size: .85rem; transition: background .2s;
        }
        .t2s-wa:hover { background: rgba(37,211,102,.2); }

        @keyframes t2s-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes t2s-pop { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes t2s-spin { to { transform: rotate(360deg); } }
        @keyframes t2s-pulse { 0%,100% { opacity: .5; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.06); } }
        @keyframes t2s-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes t2s-trail { 0%,100% { opacity: .2; width: 30px; } 50% { opacity: 1; width: 64px; } }

        @media (prefers-reduced-motion: reduce) {
          .t2s-ring, .t2s-scan, .t2s-emoji, .t2s-trail, .t2s-card, .t2-success { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
