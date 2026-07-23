'use client'

/**
 * GrowthPlaybook — "Manual de Crecimiento DAIMUZ".
 * Renderiza una guía HTML autocontenida (iframe srcDoc) que explica, de forma
 * organizada y enganchada, los pasos a seguir una vez el comercio ya tiene la
 * infraestructura montada: cómo invertir en anuncios, segmentos/públicos,
 * ángulos de venta, orgánico + pauta y el concepto de venta de la plataforma.
 * Pensado para presentar en reuniones (botones de imprimir / descargar / abrir).
 */
import { useMemo, useRef } from 'react'
import { Printer, Download, ExternalLink, Rocket } from 'lucide-react'

const GUIDE_HTML = String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Manual de Crecimiento · DAIMUZ</title>
<style>
  :root{
    --bg:#0b0f14; --panel:#111823; --panel2:#0e141d; --line:rgba(255,255,255,.08);
    --txt:#e9eef5; --mut:#9fb0c3; --brand:#12b981; --brand2:#0ea5a4; --gold:#f0a500;
    --violet:#8b5cf6; --blue:#3b82f6; --pink:#ec4899;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:var(--bg);color:var(--txt);font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:920px;margin:0 auto;padding:0 20px 80px}
  a{color:var(--brand)}
  h1,h2,h3{line-height:1.15;letter-spacing:-.01em;margin:0}
  .eyebrow{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--mut);font-weight:700}
  .mut{color:var(--mut)}
  /* HERO */
  .hero{position:relative;overflow:hidden;border-radius:0 0 28px 28px;
    background:radial-gradient(1200px 500px at 80% -10%,rgba(18,185,129,.25),transparent 60%),
               linear-gradient(160deg,#0c2a24,#0b0f14 60%);
    padding:64px 20px 52px;border-bottom:1px solid var(--line)}
  .hero .inner{max-width:920px;margin:0 auto}
  .badge{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;background:rgba(255,255,255,.08);border:1px solid var(--line);color:#cfe;border-radius:999px;padding:6px 12px}
  .hero h1{font-size:clamp(30px,5vw,52px);font-weight:900;margin:18px 0 12px}
  .hero p{font-size:clamp(16px,2vw,20px);color:#d7e3ee;max-width:640px}
  .hero .kick{color:var(--brand);font-weight:800}
  /* SECTION */
  section{margin-top:44px}
  .sec-h{display:flex;align-items:baseline;gap:14px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:12px}
  .sec-h .n{font-size:13px;font-weight:900;color:var(--brand);background:rgba(18,185,129,.12);border:1px solid rgba(18,185,129,.3);border-radius:8px;padding:2px 9px}
  .sec-h h2{font-size:clamp(20px,3vw,28px);font-weight:800}
  /* CARDS */
  .card{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin:14px 0}
  .grid{display:grid;gap:14px}
  .g2{grid-template-columns:1fr 1fr}
  .g3{grid-template-columns:repeat(3,1fr)}
  @media(max-width:720px){.g2,.g3{grid-template-columns:1fr}}
  .card h3{font-size:17px;font-weight:800;margin-bottom:6px}
  .card p{margin:6px 0;color:#d7e3ee}
  .pill{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;padding:3px 9px;border-radius:999px;margin-bottom:8px}
  .pill.g{background:rgba(18,185,129,.14);color:#5eead4;border:1px solid rgba(18,185,129,.3)}
  .pill.b{background:rgba(59,130,246,.14);color:#93c5fd;border:1px solid rgba(59,130,246,.3)}
  .pill.v{background:rgba(139,92,246,.14);color:#c4b5fd;border:1px solid rgba(139,92,246,.3)}
  .pill.p{background:rgba(236,72,153,.14);color:#f9a8d4;border:1px solid rgba(236,72,153,.3)}
  .pill.o{background:rgba(240,165,0,.14);color:#fcd34d;border:1px solid rgba(240,165,0,.3)}
  /* QUOTE */
  .quote{border-left:3px solid var(--brand);background:rgba(18,185,129,.06);padding:16px 20px;border-radius:0 14px 14px 0;margin:16px 0;font-size:18px;font-weight:600}
  .quote small{display:block;color:var(--mut);font-weight:600;font-size:12px;margin-top:8px;letter-spacing:.04em}
  /* STEPS */
  .step{display:flex;gap:16px;align-items:flex-start;padding:16px 0;border-bottom:1px dashed var(--line)}
  .step:last-child{border-bottom:0}
  .step .num{flex:0 0 auto;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-weight:900;color:#04120d;background:linear-gradient(135deg,var(--brand),var(--brand2))}
  .step h3{font-size:16px}
  /* TABLE */
  table{width:100%;border-collapse:collapse;font-size:14px;overflow:hidden;border-radius:12px}
  th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
  th{background:rgba(255,255,255,.04);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut)}
  td strong{color:#fff}
  /* CHECK */
  .check{list-style:none;padding:0;margin:8px 0}
  .check li{padding:7px 0 7px 30px;position:relative;color:#d7e3ee}
  .check li:before{content:"✔";position:absolute;left:0;top:7px;color:var(--brand);font-weight:900}
  .kpi{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
  .kpi span{font-size:13px;font-weight:700;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:999px;padding:6px 12px;color:#cfe}
  .callout{background:linear-gradient(135deg,rgba(240,165,0,.12),rgba(240,165,0,.04));border:1px solid rgba(240,165,0,.3);border-radius:14px;padding:16px 18px;margin:14px 0}
  .callout b{color:#fcd34d}
  .foot{margin-top:56px;text-align:center;color:var(--mut);font-size:13px;border-top:1px solid var(--line);padding-top:28px}
  .logo{font-weight:900;letter-spacing:.12em;color:#fff}
  @media print{
    body{background:#fff;color:#111}
    .hero{background:#0b0f14 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .card,.quote,.callout{break-inside:avoid}
  }
</style>
</head>
<body>
  <div class="hero"><div class="inner">
    <span class="badge">◆ Manual de Crecimiento · DAIMUZ</span>
    <h1>Ya tienes la infraestructura.<br/>Ahora hazla <span class="kick">vender sola.</span></h1>
    <p>Una guía práctica para pasar de <b>"tengo la plataforma montada"</b> a <b>"mi negocio crece con anuncios y campañas"</b>. Pensada para entender el valor real de potenciar tu comercio: públicos, ángulos de venta y el matrimonio entre contenido orgánico y pauta.</p>
  </div></div>

  <div class="wrap">

    <section>
      <div class="sec-h"><span class="n">00</span><h2>La regla de oro</h2></div>
      <div class="quote">La publicidad es gasolina, no el fuego. Solo acelera un negocio que ya tiene fundamentos.
        <small>Si el producto/servicio no está validado, la pauta solo hace que más gente vea algo que no convierte — y quiebra más rápido.</small></div>
      <div class="grid g2">
        <div class="card"><span class="pill g">Primero</span><h3>Producto o servicio validado</h3><p>Que la gente lo busque, le guste, lo recomiende y vuelva a comprar (product-market fit). Ese es el "fuego".</p></div>
        <div class="card"><span class="pill b">Segundo</span><h3>Conocer a fondo al cliente</h3><p>La gente compra por razones distintas a las que uno cree. Lee reseñas, quejas y comentarios: ahí están tus <b>ángulos de venta</b>.</p></div>
      </div>
      <div class="callout"><b>El anuncio es solo la mitad del trabajo.</b> La otra mitad es a dónde llevas ese tráfico. El mejor anuncio no sirve si el destino no convierte — y eso es justo lo que DAIMUZ ya te resuelve: tienda, carrito, pagos, reservas, wallet y seguimiento automático.</div>
    </section>

    <section>
      <div class="sec-h"><span class="n">01</span><h2>Los 5 pasos una vez montado</h2></div>
      <div class="card">
        <div class="step"><div class="num">1</div><div><h3>Deja la casa lista para recibir tráfico</h3><p>Productos con buenas fotos y precios, tienda publicada, medios de pago, WhatsApp y fidelización (wallet) activos. El tráfico pago solo rinde si el destino convierte.</p></div></div>
        <div class="step"><div class="num">2</div><div><h3>Valida en orgánico antes de pagar</h3><p>Publica contenido y mira qué ángulo conecta (comentarios, guardados, mensajes). Lo que funciona orgánico es lo que después escalas con pauta.</p></div></div>
        <div class="step"><div class="num">3</div><div><h3>Define el objetivo de ventas y el presupuesto</h3><p>Primero cuánto quieres vender; de ahí sale el presupuesto (ver sección 02). Nunca al revés.</p></div></div>
        <div class="step"><div class="num">4</div><div><h3>Lanza campañas de respuesta directa</h3><p>Ventas / mensajes a WhatsApp / clientes potenciales. Es lo que genera flujo de caja al empezar.</p></div></div>
        <div class="step"><div class="num">5</div><div><h3>Mide, itera y escala</h3><p>Deja aprender al algoritmo (mín. 7 días), mata lo que no rinde, refuerza lo que sí, y recién ahí sube presupuesto y alcanza públicos más masivos.</p></div></div>
      </div>
    </section>

    <section>
      <div class="sec-h"><span class="n">02</span><h2>Cuánto invertir (sin quebrarte)</h2></div>
      <p class="mut">Calcular el presupuesto es como usar Waze: no dices "quiero manejar 1 hora", dices "quiero llegar a este destino". El destino es tu <b>objetivo de ventas</b>.</p>
      <div class="grid g3">
        <div class="card"><span class="pill o">Paso A</span><h3>Objetivo de ventas</h3><p>¿Cuánto quieres vender este mes? Realista para tu negocio.</p></div>
        <div class="card"><span class="pill o">Paso B</span><h3>% del margen a invertir</h3><p>Según tus márgenes, cuánto puedes destinar a adquirir clientes (CPA). Revísalo con tu contador.</p></div>
        <div class="card"><span class="pill o">Paso C</span><h3>Ese % = tu presupuesto</h3><p>Ej.: meta 10M y puedes destinar 15% → 1,5M en pauta. Simple.</p></div>
      </div>
      <div class="card">
        <h3>Referencias rápidas</h3>
        <div class="kpi">
          <span>Mínimo por público: 3–5 USD/día</span>
          <span>Margen agresivo: 15–30%</span>
          <span>Márgenes apretados: 5–15%</span>
          <span>Digital/servicios: hasta 30–50%</span>
        </div>
        <p style="margin-top:12px"><b>ROAS</b> = ventas ÷ inversión. Calcula el ROAS mínimo para ser rentable ANTES de pautar. Vender mucho con margen negativo solo acelera la quiebra.</p>
      </div>
    </section>

    <section>
      <div class="sec-h"><span class="n">03</span><h2>Qué plataforma y para qué</h2></div>
      <table>
        <tr><th>Plataforma</th><th>Su fortaleza</th><th>Cuándo usarla</th></tr>
        <tr><td><strong>Meta</strong><br/><span class="mut">Facebook · Instagram</span></td><td>Generar demanda. Respuesta directa.</td><td>La mayoría de negocios que necesitan mostrarse y explicar su producto. Ideal para empezar.</td></tr>
        <tr><td><strong>Google</strong><br/><span class="mut">Search · Shopping · YouTube</span></td><td>Capturar demanda existente + remarketing y públicos masivos.</td><td>Cuando la gente ya te busca (servicios locales, productos específicos). Shopping para e-commerce.</td></tr>
        <tr><td><strong>TikTok</strong></td><td>Alcance barato y masivo.</td><td>Etapa avanzada, para escalar. Requiere renovar creativos seguido; menor intención de compra.</td></tr>
      </table>
      <div class="callout"><b>Empezando:</b> decide entre Meta y Google según tu modelo. Si aún no tienes web robusta, manda tráfico a <b>WhatsApp</b> o al DM — y desde ahí cierras con tu tienda DAIMUZ.</div>
    </section>

    <section>
      <div class="sec-h"><span class="n">04</span><h2>Orgánico + Pauta: el matrimonio</h2></div>
      <div class="grid g2">
        <div class="card"><span class="pill v">Orgánico</span><h3>Valida qué conecta</h3><p>Es el "alma". Contenido consistente y coherente con tus anuncios construye comunidad y confianza. Sin él, la pauta no se sostiene.</p></div>
        <div class="card"><span class="pill g">Pauta</span><h3>Escala lo que ya funciona</h3><p>Toma lo que rindió orgánico y, unos días después, potáuralo. La pauta multiplica lo que ya está validado.</p></div>
      </div>
      <div class="quote">Una estrategia de anuncios sin contenido orgánico es como un cuerpo sin alma.</div>
    </section>

    <section>
      <div class="sec-h"><span class="n">05</span><h2>Segmentos y ángulos de venta</h2></div>
      <p class="mut">El error más común es el <b>1-1-1</b>: una campaña, un público, un anuncio. Dale material al algoritmo: <b>3 a 6 anuncios por público</b> y varios ángulos.</p>
      <div class="card"><h3>Un mismo producto, distintos ángulos</h3>
        <div class="grid g3" style="margin-top:10px">
          <div><span class="pill p">Dolor</span><p>"¿Cansado de perder ventas por no responder a tiempo?"</p></div>
          <div><span class="pill b">Deseo</span><p>"Tu negocio vendiendo mientras tú descansas."</p></div>
          <div><span class="pill o">Prueba</span><p>"Así un comercio como el tuyo organizó todo en una semana."</p></div>
        </div>
      </div>
      <div class="card"><h3>Un público por tipo de persona</h3>
        <ul class="check">
          <li><b>Por rubro:</b> restaurante, peluquería, gimnasio, tienda, hotel, farmacia… cada uno con su mensaje.</li>
          <li><b>Por intención:</b> quien ya te busca (Google) vs. quien aún no sabe que te necesita (Meta).</li>
          <li><b>Por momento:</b> nuevos, carrito abandonado, clientes que dejaron de comprar (remarketing).</li>
          <li><b>Por valor:</b> mejores clientes → ofertas premium; primerizos → oferta de entrada.</li>
        </ul>
      </div>
    </section>

    <section>
      <div class="sec-h"><span class="n">06</span><h2>Cómo se vende DAIMUZ</h2></div>
      <div class="quote">La gente no compra plataformas. Compra una transformación.
        <small>No vendes software. Vendes tranquilidad, tiempo y crecimiento.</small></div>
      <div class="card">
        <h3>El gancho (primeros 5 segundos)</h3>
        <p>No hables de IA, POS, CRM o Wallet. Habla de su vida: <i>"Todos los días despiertas para trabajar en tu negocio… pero tu negocio no trabaja para ti."</i> Que cualquier comerciante piense <b>"eso es exactamente lo que me pasa"</b>.</p>
        <p class="mut" style="margin-top:10px">Estructura que funciona: <b>problema real → curiosidad → transformación → recién ahí, la solución.</b></p>
      </div>
      <div class="card"><span class="pill g">La metáfora</span><h3>Un equipo que nunca duerme</h3><p>Mientras él atiende a un cliente, la IA responde otros diez. Mientras cobra, analiza métricas. Mientras duerme, sigue trabajando. <b>"No contrataste un software. Contrataste un equipo que nunca duerme."</b></p></div>
      <div class="card"><span class="pill v">La visión (nivel ciudad)</span><h3>Conectar comercios, mover ciudades</h3><p>No vendes una app: vendes una visión. "¿Y si el turismo de una ciudad pudiera moverse desde un solo lugar?" Restaurantes, hoteles, guías, reservas y eventos conectados como una red. <b>Las ciudades crecen cuando sus negocios empiezan a trabajar juntos.</b></p></div>
    </section>

    <section>
      <div class="sec-h"><span class="n">07</span><h2>Inventario y campañas</h2></div>
      <div class="card"><p>Si pautas y te quedas sin stock, pierdes ventas <b>y</b> tienes que pausar campañas — lo que interrumpe la fase de aprendizaje del algoritmo.</p>
        <ul class="check">
          <li>Conoce tus <b>ventas diarias</b> por producto.</li>
          <li>Conoce tu <b>lead time</b> (cuánto tarda en reponerse).</li>
          <li>Pide de nuevo <b>antes</b> de llegar al mínimo, con margen de seguridad.</li>
        </ul>
      </div>
    </section>

    <section>
      <div class="sec-h"><span class="n">08</span><h2>Errores que quiebran</h2></div>
      <div class="grid g2">
        <div class="card"><span class="pill p">✕</span><h3>Pautar sin producto validado</h3><p>La pauta no arregla problemas de producto.</p></div>
        <div class="card"><span class="pill p">✕</span><h3>Pausar campañas cada 2 horas</h3><p>Rompes la fase de aprendizaje. Dale mínimo 7 días.</p></div>
        <div class="card"><span class="pill p">✕</span><h3>1-1-1</h3><p>Una campaña, un público, un anuncio. Falta diversidad creativa.</p></div>
        <div class="card"><span class="pill p">✕</span><h3>Invertir sin conocer tu margen</h3><p>Vender con margen negativo acelera la quiebra.</p></div>
      </div>
    </section>

    <div class="foot">
      <p class="logo">DAIMUZ</p>
      <p>El sistema operativo para hacer crecer cualquier negocio.</p>
      <p class="mut" style="margin-top:6px">Guía interna de crecimiento · para presentar y alinear con tu comercio.</p>
    </div>

  </div>
</body>
</html>`

export function GrowthPlaybook() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const blobUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    try { return URL.createObjectURL(new Blob([GUIDE_HTML], { type: 'text/html' })) } catch { return '' }
  }, [])

  const print = () => { iframeRef.current?.contentWindow?.print() }
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([GUIDE_HTML], { type: 'text/html' }))
    a.download = 'manual-crecimiento-daimuz.html'
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Guía de Crecimiento</h1>
            <p className="text-xs text-muted-foreground">Manual para potenciar tu comercio con anuncios y campañas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={print} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Descargar
          </button>
          {blobUrl && (
            <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors">
              <ExternalLink className="h-4 w-4" /> Abrir
            </a>
          )}
        </div>
      </div>
      <iframe
        ref={iframeRef}
        title="Manual de Crecimiento DAIMUZ"
        srcDoc={GUIDE_HTML}
        className="min-h-0 w-full flex-1"
        style={{ border: 0, background: '#0b0f14' }}
      />
    </div>
  )
}

export default GrowthPlaybook
