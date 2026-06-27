'use client'

// ════════════════════════════════════════════════════════════════════════════
//  Landing del aplicativo Lopbuk  ·  ruta /lopbuk
//  Estilo: verde lima vibrante (referencia simplest.guru).
//  - i18n con autodetección por región (locale del navegador) + selector manual.
//  - Slots de medios (imagen / gif / video) por sección, con fallback a mockup
//    CSS. La forma de CONTENT/MEDIA es la que el panel superadmin debe poblar
//    (ver daimuz/decisions/lopbuk-landing-superadmin-plan.md).
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'

const LOGIN_URL = '/login'
const WHATSAPP = 'https://wa.me/573000000000'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── Idiomas disponibles ─────────────────────────────────────────────────────
const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
]
type Lang = 'es' | 'en'

// ── SLOTS DE MEDIOS (defaults; el superadmin los reemplaza) ──────────────────
// null => se usa el mockup CSS / gradiente como fallback.
const MEDIA: {
  heroImage: string | null   // imagen verde "limpia" de fondo del hero
  heroGif: string | null     // gif/imagen dentro del recuadro del computador
  offerImage: string | null
  steps: { image: string | null; video: string | null }[]
} = {
  heroImage: null,
  heroGif: null,
  offerImage: null,
  steps: [
    { image: null, video: null },
    { image: null, video: null },
    { image: null, video: null },
  ],
}

// ── Diccionario i18n ────────────────────────────────────────────────────────
const DICT: Record<Lang, any> = {
  es: {
    nav: ['Inicio', 'Solución', 'Beneficios', 'Resultados', 'Contacto'],
    cta: 'Empezar ahora', enter: 'Entrar',
    heroTitle: 'Lleva tu negocio al siguiente nivel, de forma más simple',
    heroLead: 'Lopbuk centraliza inventario, ventas, caja, finanzas, operación y presencia digital para retail, gastrobar, restaurantes, servicios y ecommerce. Un solo flujo que acelera tu operación y aumenta tu rentabilidad.',
    heroBtn1: 'Empezar gratis', heroBtn2: 'Ver solución',
    band: '¡Sorpréndete con resultados reales!',
    stepsEyebrow: 'Cómo funciona', stepsTitle: 'Automatiza tu operación en tres pasos simples',
    steps: [
      ['Centraliza', 'Carga tu inventario, sucursales, catálogo y roles en minutos con importación asistida y plantillas listas para retail, gastrobar o servicios.'],
      ['Opera y vende', 'POS, caja por turnos, comandas, tienda online y delivery en un solo flujo. Cada venta actualiza stock y finanzas en tiempo real, sin errores manuales.'],
      ['Analiza y crece', 'Reportes de costos, merma y rentabilidad para decidir mejor. Suma sedes, módulos y negocios sin migraciones ni interrupciones.'],
    ],
    offerEyebrow: 'Un solo sistema', offerTitleA: '¿Qué le ofrece Lopbuk ', offerTitleB: 'a tu negocio?',
    offerLead: 'Una plataforma que impulsa la eficiencia operativa para un crecimiento exponencial, con todo lo que tu negocio necesita en un mismo lugar.',
    offer: [
      'Versatilidad para adaptarse a las necesidades únicas de tu operación y sector.',
      'Flexibilidad: una solución escalable que crece al ritmo de tu empresa.',
      'Tecnología que evoluciona: paneles e información del negocio siempre al día.',
      'Compatibilidad con múltiples proveedores y procesos de negocio existentes.',
      'Facturación electrónica nativa, sin impresión ni procesos manuales.',
      'Seguridad y trazabilidad en cada operación, minimizando el riesgo del negocio.',
    ],
    modsEyebrow: 'Módulos', modsTitleA: 'Todo tu negocio, ', modsTitleB: 'en un solo panel',
    modules: ['Inventario', 'POS y Caja', 'Gastrobar', 'Delivery', 'Finanzas', 'Compras', 'Tienda online', 'Multi-sucursal', 'Reportes'],
    benEyebrow: 'Eficiencia operativa', benTitleA: 'Maximiza la eficiencia de ', benTitleB: 'todas tus operaciones',
    benefits: [
      ['Ahorra tiempo', 'Elimina el procesamiento manual de inventario, ventas y caja en tu día a día.'],
      ['Gestiona recursos', 'Enfoca a tu equipo en lo estratégico mientras la plataforma hace lo repetitivo.'],
      ['Más seguridad', 'Procesamiento digital y flujos cerrados de caja que reducen el riesgo y las fugas.'],
      ['Decisiones con datos', 'Información actualizada del negocio para decidir con claridad y rapidez.'],
      ['Reduce operaciones', 'Acorta ciclos y elimina tareas repetitivas entre cada actividad.'],
      ['Minimiza pérdidas', 'Menos merma y demoras: menos dinero perdido en backlogs y descuadres.'],
    ],
    resEyebrow: 'Resultados comprobados', resTitleA: 'Optimización exponencial que ', resTitleB: 'impulsa tu rentabilidad',
    metrics: [
      ['Menos tiempo', 'Elimina el procesamiento manual de información y multiplica la velocidad operativa.'],
      ['Más eficiencia', 'Reduce el margen de error y el esfuerzo de procesar y dar seguimiento a registros.'],
      ['Precisión de datos', 'Verificación en tiempo real durante la captura, con mínimo impacto en el rendimiento.'],
      ['Menos costos', 'Ahorro que permite redirigir recursos a actividades de mayor valor estratégico.'],
    ],
    stores: ['Restaurante', 'Tienda retail', 'Gastrobar', 'Minimarket'],
    chartTitle: 'Items procesados por tienda',
    chartDesc: 'Lopbuk procesa en una semana lo que un equipo haría en un mes, y el ahorro crece con el volumen de operación de cada sede.',
    chartBtn: 'Reservar demo',
    casesEyebrow: 'Casos de éxito', casesTitleA: 'Transformación digital ', casesTitleB: 'efectiva',
    testi: [
      '"Unificamos POS, inventario y delivery en Lopbuk. Cerramos caja en minutos y por fin sabemos qué producto deja margen y cuál no."',
      '"La trazabilidad nos cortó las fugas de caja. La merma bajó y el equipo trabaja con un solo panel para todas las sedes."',
      '"Las comandas y el menú QR cambiaron el servicio. Más mesas atendidas, menos errores de cocina y clientes que vuelven."',
    ],
    finalTitle: 'Aprovecha la oportunidad de dar el salto a la automatización',
    finalDesc: 'Contáctanos hoy y únete a la era de la operación inteligente. Nuestro equipo te muestra cómo transformar tu negocio con Lopbuk.',
    finalBtn1: 'Empezar ahora', finalBtn2: 'Hablar por WhatsApp',
    footerDesc: 'Plataforma integral para operar negocios de retail, gastrobar, restaurantes, servicios y ecommerce. Inventario, ventas, finanzas y presencia digital en un solo flujo.',
    footNav: 'Navegación', footLegal: 'Legal', footContact: 'Contacto',
    legal: ['Política de privacidad', 'Términos y condiciones', 'Acuerdo de usuario'],
    copy: 'Todos los derechos reservados.', rent: 'Rentabilidad',
  },
  en: {
    nav: ['Home', 'Solution', 'Benefits', 'Results', 'Contact'],
    cta: 'Get started', enter: 'Sign in',
    heroTitle: 'Take your business to the next level, in a simpler way',
    heroLead: 'Lopbuk centralizes inventory, sales, cash, finance, operations and digital presence for retail, gastrobar, restaurants, services and ecommerce. One flow that speeds up your operation and boosts profitability.',
    heroBtn1: 'Start free', heroBtn2: 'See solution',
    band: 'Be amazed with proven results!',
    stepsEyebrow: 'How it works', stepsTitle: 'Automate your operation in three simple steps',
    steps: [
      ['Centralize', 'Load your inventory, branches, catalog and roles in minutes with assisted import and ready-made templates for retail, gastrobar or services.'],
      ['Operate & sell', 'POS, shift cash, kitchen tickets, online store and delivery in a single flow. Every sale updates stock and finance in real time, no manual errors.'],
      ['Analyze & grow', 'Reports on cost, waste and profitability to decide better. Add branches, modules and businesses with no migrations or downtime.'],
    ],
    offerEyebrow: 'One system', offerTitleA: 'What does Lopbuk offer ', offerTitleB: 'your business?',
    offerLead: 'A platform that boosts operational efficiency for exponential growth, with everything your business needs in one place.',
    offer: [
      'Versatility to adapt to the unique needs of your operation and sector.',
      'Flexibility: a scalable solution that grows with your company.',
      'Evolving technology: business panels and data always up to date.',
      'Compatibility with multiple suppliers and existing business processes.',
      'Native e-invoicing, with no printing or manual processes.',
      'Security and traceability in every operation, minimizing business risk.',
    ],
    modsEyebrow: 'Modules', modsTitleA: 'Your whole business, ', modsTitleB: 'in a single panel',
    modules: ['Inventory', 'POS & Cash', 'Gastrobar', 'Delivery', 'Finance', 'Purchasing', 'Online store', 'Multi-branch', 'Reports'],
    benEyebrow: 'Operational efficiency', benTitleA: 'Maximize the efficiency of ', benTitleB: 'all your operations',
    benefits: [
      ['Save time', 'Eliminate manual processing of inventory, sales and cash in your daily work.'],
      ['Manage resources', 'Focus your team on strategy while the platform handles the repetitive work.'],
      ['More security', 'Digital processing and closed cash flows that reduce risk and leakage.'],
      ['Data-driven decisions', 'Up-to-date business data to decide with clarity and speed.'],
      ['Reduce operations', 'Shorten cycles and remove repetitive tasks between activities.'],
      ['Minimize losses', 'Less waste and delays: less money lost to backlogs and mismatches.'],
    ],
    resEyebrow: 'Proven results', resTitleA: 'Exponential optimization that ', resTitleB: 'boosts your profitability',
    metrics: [
      ['Less time', 'Eliminate manual data processing and multiply your operational speed.'],
      ['More efficiency', 'Reduce error margin and the effort of processing and tracking records.'],
      ['Data accuracy', 'Real-time verification during capture, with minimal performance impact.'],
      ['Lower costs', 'Savings that let you redirect resources to higher-value activities.'],
    ],
    stores: ['Restaurant', 'Retail store', 'Gastrobar', 'Minimarket'],
    chartTitle: 'Items processed per store',
    chartDesc: 'Lopbuk processes in a week what a team would do in a month, and savings grow with each location operation volume.',
    chartBtn: 'Book a demo',
    casesEyebrow: 'Success stories', casesTitleA: 'Effective digital ', casesTitleB: 'transformation',
    testi: [
      '"We unified POS, inventory and delivery in Lopbuk. We close cash in minutes and finally know which product is profitable and which is not."',
      '"Traceability stopped our cash leaks. Waste dropped and the team works from a single panel for every branch."',
      '"Tickets and the QR menu changed our service. More tables served, fewer kitchen errors and customers who come back."',
    ],
    finalTitle: 'Take the opportunity to leap into automation',
    finalDesc: 'Contact us today and join the era of intelligent operations. Our team shows you how to transform your business with Lopbuk.',
    finalBtn1: 'Get started', finalBtn2: 'Chat on WhatsApp',
    footerDesc: 'All-in-one platform to run retail, gastrobar, restaurant, service and ecommerce businesses. Inventory, sales, finance and digital presence in one flow.',
    footNav: 'Navigation', footLegal: 'Legal', footContact: 'Contact',
    legal: ['Privacy policy', 'Terms and conditions', 'End-user agreement'],
    copy: 'All rights reserved.', rent: 'Profitability',
  },
}

const NAV_HREFS = ['#inicio', '#solucion', '#beneficios', '#resultados', '#contacto']
const MOD_ICONS = ['ti-box', 'ti-cash-register', 'ti-tools-kitchen-2', 'ti-motorbike', 'ti-wallet', 'ti-shopping-cart', 'ti-building-store', 'ti-building-skyscraper', 'ti-chart-bar']
const BEN_ICONS = ['ti-clock-bolt', 'ti-adjustments-check', 'ti-shield-lock', 'ti-chart-dots-3', 'ti-rotate-clockwise', 'ti-coin']
const METRIC_NUMS = [['8', 'x'], ['9', 'x'], ['95', '%'], ['47', '%']]
const STORE_VALS = [92, 78, 95, 64]
const TESTI_META = [['ALFA', 'Carlos Méndez', 'Tienda Deportiva · Medellín'], ['ANMARG', 'Ana Rodríguez', 'Retail · Bogotá'], ['BARDXICK', 'Laura Jiménez', 'Gastrobar · Cali']]

const SQUARES = [
  { t: '8%', l: '3%', s: 120, c: 'o', r: 12 }, { t: '60%', l: '1%', s: 90, c: 'b', r: -8 },
  { t: '14%', l: '40%', s: 60, c: '', r: 18 }, { t: '72%', l: '34%', s: 70, c: 'o', r: 6 },
  { t: '5%', l: '88%', s: 130, c: 'b', r: -12 }, { t: '78%', l: '92%', s: 80, c: '', r: 14 },
]

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css');

.lpk { --g-lime:#8cc63f; --g:#4caf3a; --g-deep:#2e9e3a; --g-dark:#1f7a24; --g-ink:#176e1c;
  --ink:#23302a; --muted:#5f6b63; --bg:#ffffff; --bg-soft:#f1f4f1; --line:#e6ebe6;
  --r:14px; --r-lg:26px; --r-xl:34px; --shadow:0 18px 50px rgba(35,60,40,.12);
  --fh:'Baloo 2',sans-serif; --fb:'Inter',sans-serif;
  font-family:var(--fb); color:var(--ink); line-height:1.6; background:var(--bg); position:relative; overflow-x:hidden; }
.lpk *,.lpk *::before,.lpk *::after { box-sizing:border-box; }
.lpk a { text-decoration:none; color:inherit; }
.lpk img,.lpk video { max-width:100%; display:block; }
.lpk ::selection { background:rgba(140,198,63,.35); }
.lpk h1,.lpk h2,.lpk h3 { font-family:var(--fh); margin:0; line-height:1.05; }

.lpk nav { position:fixed; top:0; left:0; right:0; z-index:100; display:flex; align-items:center; justify-content:space-between;
  padding:0 5%; height:74px; background:rgba(255,255,255,.92); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  border-bottom:1px solid var(--line); transition:box-shadow .3s; }
.lpk nav.scrolled { box-shadow:0 6px 22px rgba(35,60,40,.08); }
.lpk .nav-logo { display:flex; align-items:center; gap:10px; font-family:var(--fh); font-weight:800; font-size:1.5rem; color:var(--ink); letter-spacing:-.5px; }
.lpk .nav-badge { width:38px; height:38px; border-radius:11px; background:linear-gradient(135deg,var(--g-lime),var(--g-deep)); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:1rem; box-shadow:0 5px 14px rgba(76,175,58,.4); }
.lpk .nav-right { display:flex; align-items:center; gap:1.4rem; }
.lpk .nav-links { display:flex; gap:2rem; list-style:none; margin:0; padding:0; }
.lpk .nav-links a { font-size:.95rem; font-weight:600; color:#465049; transition:color .2s; }
.lpk .nav-links a:hover { color:var(--g-deep); }
.lpk .nav-cta { padding:10px 22px; background:linear-gradient(135deg,var(--g-lime),var(--g-deep)); color:#fff; border-radius:100px; font-size:.9rem; font-weight:700; box-shadow:0 6px 18px rgba(76,175,58,.35); transition:transform .15s; }
.lpk .nav-cta:hover { transform:translateY(-1px); }

/* language selector */
.lpk .lang { position:relative; }
.lpk .lang-btn { display:flex; align-items:center; gap:7px; background:#fff; border:1px solid var(--line); border-radius:100px; padding:6px 12px; cursor:pointer; font-size:.9rem; font-weight:600; color:#465049; }
.lpk .lang-btn .fl { font-size:1.1rem; line-height:1; }
.lpk .lang-menu { position:absolute; right:0; top:calc(100% + 8px); background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); padding:6px; min-width:120px; display:none; }
.lpk .lang-menu.open { display:block; }
.lpk .lang-menu button { display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; padding:9px 11px; border-radius:8px; cursor:pointer; font-size:.9rem; font-weight:600; color:#465049; text-align:left; }
.lpk .lang-menu button:hover { background:var(--bg-soft); }
.lpk .lang-menu button.sel { color:var(--g-deep); }

.lpk .hamburger { display:none; flex-direction:column; gap:5px; cursor:pointer; }
.lpk .hamburger span { width:24px; height:2px; background:var(--ink); border-radius:2px; }
.lpk .mobile-nav { position:fixed; top:84px; left:10px; right:10px; z-index:99; background:#fff; border:1px solid var(--line); border-radius:18px; padding:.4rem 1.2rem; box-shadow:var(--shadow); transform:translateY(-130%); opacity:0; transition:transform .35s, opacity .35s; }
.lpk .mobile-nav.open { transform:translateY(0); opacity:1; }
.lpk .mobile-nav a { display:block; padding:13px 0; font-size:1rem; font-weight:600; color:#465049; border-bottom:1px solid var(--line); }
.lpk .mobile-nav a:last-child { border-bottom:none; }

.lpk .inner { max-width:1180px; margin:0 auto; padding:0 5%; position:relative; z-index:2; }

.lpk .btn-primary { display:inline-flex; align-items:center; gap:8px; padding:15px 32px; background:linear-gradient(135deg,var(--g-lime),var(--g-deep)); color:#fff; border-radius:100px; font-weight:700; font-size:.96rem; box-shadow:0 8px 24px rgba(76,175,58,.4); transition:transform .2s; }
.lpk .btn-primary:hover { transform:translateY(-2px); }
.lpk .btn-ghost { display:inline-flex; align-items:center; gap:8px; padding:15px 32px; border:2px solid #fff; color:#fff; border-radius:100px; font-weight:700; font-size:.96rem; background:rgba(255,255,255,.12); transition:background .2s; }
.lpk .btn-ghost:hover { background:rgba(255,255,255,.22); }

.lpk .reveal,.lpk .reveal-r { opacity:0; transition:opacity .7s ease, transform .7s ease; }
.lpk .reveal { transform:translateY(38px); } .lpk .reveal-r { transform:translateX(40px); }
.lpk .reveal.vis,.lpk .reveal-r.vis { opacity:1; transform:none; }

.lpk .hero { position:relative; padding:140px 5% 90px; overflow:hidden; background:linear-gradient(120deg,#9fd84a 0%,#5cbb3c 45%,#2e9e3a 100%); }
.lpk .hero-bgimg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0; }
.lpk .hero-squares { position:absolute; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.lpk .sq { position:absolute; border-radius:20px; background:rgba(255,255,255,.12); }
.lpk .sq.b { background:rgba(255,255,255,.08); } .lpk .sq.o { background:rgba(255,255,255,.16); }
.lpk .hero-in { position:relative; z-index:2; max-width:1180px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:3.5rem; align-items:center; }
.lpk .hero-badge { display:inline-flex; align-items:center; gap:14px; margin-bottom:1.4rem; }
.lpk .hero-badge .b { width:78px; height:78px; border-radius:20px; background:#fff; display:flex; align-items:center; justify-content:center; font-family:var(--fh); font-weight:800; font-size:1.5rem; color:var(--g-deep); box-shadow:0 10px 28px rgba(0,0,0,.18); }
.lpk .hero-badge .w { font-family:var(--fh); font-weight:800; font-size:clamp(2.4rem,4.4vw,3.6rem); color:#fff; letter-spacing:-1px; }
.lpk .hero h1 { font-size:clamp(2.1rem,4vw,3.4rem); font-weight:800; color:#fff; letter-spacing:-.5px; margin-bottom:1.3rem; text-shadow:0 2px 18px rgba(0,0,0,.12); }
.lpk .hero p.lead { font-size:1.05rem; color:rgba(255,255,255,.94); line-height:1.7; max-width:520px; margin-bottom:2.2rem; }
.lpk .hero-actions { display:flex; gap:1rem; flex-wrap:wrap; }

.lpk .device { position:relative; z-index:2; }
.lpk .laptop { background:#1c2733; border-radius:16px 16px 6px 6px; padding:12px 12px 0; box-shadow:0 30px 70px rgba(0,0,0,.3); }
.lpk .laptop-screen { background:#fff; border-radius:8px; overflow:hidden; aspect-ratio:16/10; display:flex; }
.lpk .laptop-screen .media-fill { width:100%; height:100%; object-fit:cover; }
.lpk .lp-side { width:30%; background:#f6f8f6; border-right:1px solid var(--line); padding:14px 10px; display:flex; flex-direction:column; gap:9px; }
.lpk .lp-brand { display:flex; align-items:center; gap:6px; font-family:var(--fh); font-weight:800; font-size:.8rem; color:var(--g-deep); margin-bottom:6px; }
.lpk .lp-brand .d { width:18px; height:18px; border-radius:6px; background:linear-gradient(135deg,var(--g-lime),var(--g-deep)); }
.lpk .lp-row { height:8px; border-radius:4px; background:#e7ece7; }
.lpk .lp-row.on { background:rgba(76,175,58,.25); }
.lpk .lp-main { flex:1; padding:16px; display:flex; flex-direction:column; gap:12px; }
.lpk .lp-head { display:flex; align-items:center; justify-content:space-between; }
.lpk .lp-title { font-family:var(--fh); font-weight:700; font-size:.85rem; }
.lpk .lp-pill { background:var(--g-deep); color:#fff; font-size:.6rem; font-weight:700; padding:3px 9px; border-radius:100px; }
.lpk .lp-cards { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.lpk .lp-kpi { background:#f6f8f6; border:1px solid var(--line); border-radius:8px; padding:8px 9px; }
.lpk .lp-kpi b { font-family:var(--fh); font-size:.95rem; color:var(--g-ink); display:block; }
.lpk .lp-kpi span { font-size:.55rem; color:var(--muted); }
.lpk .lp-bars { display:flex; align-items:flex-end; gap:7px; height:54px; margin-top:auto; }
.lpk .lp-bars i { flex:1; border-radius:4px 4px 0 0; background:linear-gradient(180deg,var(--g-lime),var(--g-deep)); }
.lpk .laptop-foot { height:12px; background:#cfd6cf; border-radius:0 0 14px 14px; margin:0 -12px; }
.lpk .laptop-foot::after { content:''; display:block; width:24%; height:4px; background:#aab2aa; border-radius:0 0 6px 6px; margin:0 auto; }
.lpk .dfloat { position:absolute; right:-12px; bottom:18px; background:#fff; border-radius:14px; padding:10px 16px; box-shadow:0 14px 34px rgba(0,0,0,.18); z-index:3; }
.lpk .dfloat b { font-family:var(--fh); font-size:1.4rem; color:var(--g-deep); display:block; line-height:1; }
.lpk .dfloat span { font-size:.68rem; color:var(--muted); }

.lpk .band { background:var(--bg-soft); padding:64px 5% 10px; text-align:center; }
.lpk .band h2 { font-size:clamp(1.8rem,3.4vw,2.8rem); font-weight:800; color:var(--g-deep); }

.lpk .steps { background:var(--bg-soft); padding:30px 0 110px; }
.lpk .step-head { text-align:center; max-width:640px; margin:0 auto 3rem; }
.lpk .step-head h2 { font-size:clamp(1.6rem,3vw,2.4rem); font-weight:800; }
.lpk .step-card { display:grid; grid-template-columns:1fr 1fr; border-radius:var(--r-xl); overflow:hidden; box-shadow:var(--shadow); margin-bottom:2.2rem; background:linear-gradient(120deg,#2e9e3a,#5cbb3c); position:relative; min-height:330px; }
.lpk .step-card.rev .step-scene { order:2; }
.lpk .step-scene { position:relative; display:flex; align-items:center; justify-content:center; padding:2.4rem; background:linear-gradient(140deg, rgba(31,122,36,.35), rgba(46,158,58,.15)); overflow:hidden; }
.lpk .step-scene .media-cover { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.lpk .step-scene .monitor { width:100%; max-width:330px; background:#1c2733; border-radius:12px; padding:10px; box-shadow:0 20px 44px rgba(0,0,0,.32); position:relative; z-index:1; }
.lpk .step-scene .monitor .scr { background:#fff; border-radius:7px; overflow:hidden; aspect-ratio:16/10; display:flex; }
.lpk .step-play { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:64px; height:64px; border-radius:50%; background:rgba(255,255,255,.85); display:flex; align-items:center; justify-content:center; color:var(--g-deep); font-size:1.5rem; box-shadow:0 10px 26px rgba(0,0,0,.2); z-index:2; }
.lpk .step-body { padding:2.6rem; display:flex; flex-direction:column; justify-content:center; color:#fff; }
.lpk .step-no { display:inline-flex; align-items:center; gap:12px; margin-bottom:.6rem; }
.lpk .step-no .n { width:48px; height:48px; border-radius:50%; background:#fff; color:var(--g-deep); display:flex; align-items:center; justify-content:center; font-family:var(--fh); font-weight:800; font-size:1.5rem; }
.lpk .step-no h3 { font-size:clamp(1.8rem,3vw,2.6rem); font-weight:800; color:#fff; }
.lpk .step-body p { color:rgba(255,255,255,.92); font-size:1rem; line-height:1.7; max-width:430px; }

.lpk .pad { padding:100px 0; }
.lpk .offer { display:grid; grid-template-columns:1.05fr .95fr; gap:4rem; align-items:center; }
.lpk .eyebrow { display:inline-block; font-family:var(--fh); font-size:.8rem; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--g-deep); margin-bottom:.8rem; }
.lpk .h-sec { font-size:clamp(1.7rem,3vw,2.5rem); font-weight:800; margin-bottom:1rem; }
.lpk .h-sec .a { color:var(--g-deep); }
.lpk .p-sec { color:var(--muted); font-size:1rem; line-height:1.7; max-width:560px; }
.lpk .offer-list { list-style:none; padding:0; margin:1.6rem 0 0; display:flex; flex-direction:column; gap:1rem; }
.lpk .offer-list li { display:flex; gap:12px; align-items:flex-start; font-size:.96rem; color:#3a463e; }
.lpk .offer-list li i { color:var(--g-deep); font-size:1.2rem; margin-top:2px; flex-shrink:0; }
.lpk .offer-visual { aspect-ratio:4/3; border-radius:var(--r-xl); background:linear-gradient(135deg,#9fd84a,#2e9e3a); position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; box-shadow:var(--shadow); }
.lpk .offer-visual .media-cover { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

.lpk .mods { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-top:2.4rem; }
.lpk .mod { display:flex; align-items:center; gap:12px; background:#fff; border:1px solid var(--line); border-radius:var(--r); padding:1rem 1.2rem; transition:transform .25s, box-shadow .25s, border-color .25s; }
.lpk .mod:hover { transform:translateY(-3px); box-shadow:var(--shadow); border-color:rgba(76,175,58,.4); }
.lpk .mod i { width:42px; height:42px; border-radius:11px; background:rgba(76,175,58,.12); color:var(--g-deep); display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; }
.lpk .mod span { font-weight:700; font-size:.95rem; }

.lpk .benefits { background:var(--bg-soft); }
.lpk .head-c { text-align:center; max-width:640px; margin:0 auto 3.4rem; }
.lpk .grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; }
.lpk .bcard { background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:2rem; transition:transform .3s, box-shadow .3s; }
.lpk .bcard:hover { transform:translateY(-5px); box-shadow:var(--shadow); }
.lpk .bicon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,rgba(140,198,63,.18),rgba(46,158,58,.14)); color:var(--g-deep); display:flex; align-items:center; justify-content:center; font-size:1.4rem; margin-bottom:1.1rem; }
.lpk .bcard h3 { font-size:1.1rem; font-weight:700; margin-bottom:.5rem; }
.lpk .bcard p { font-size:.92rem; color:var(--muted); line-height:1.6; }

.lpk .metrics-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1.5rem; margin-bottom:3.5rem; }
.lpk .metric { background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:2rem; text-align:center; transition:transform .3s, box-shadow .3s; }
.lpk .metric:hover { transform:translateY(-5px); box-shadow:var(--shadow); }
.lpk .metric .num { font-family:var(--fh); font-size:clamp(2.6rem,4vw,3.4rem); font-weight:800; color:var(--g-deep); line-height:1; margin-bottom:.4rem; }
.lpk .metric .lab { font-weight:700; font-size:.98rem; margin-bottom:.4rem; }
.lpk .metric .des { font-size:.84rem; color:var(--muted); line-height:1.5; }
.lpk .chart-row { display:flex; gap:3rem; align-items:center; background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:2.5rem; }
.lpk .chart { flex:1; display:flex; flex-direction:column; gap:1rem; }
.lpk .crow { display:flex; align-items:center; gap:12px; }
.lpk .crow .cl { font-size:.85rem; color:var(--muted); min-width:108px; text-align:right; }
.lpk .cwrap { flex:1; height:30px; background:#eef2ee; border-radius:7px; overflow:hidden; }
.lpk .cbar { height:100%; border-radius:7px; background:linear-gradient(90deg,var(--g-lime),var(--g-deep)); display:flex; align-items:center; justify-content:flex-end; padding-right:11px; font-size:.74rem; font-weight:700; color:#fff; width:0; transition:width 1.4s cubic-bezier(.4,0,.2,1); }
.lpk .chart-text { flex:0 0 300px; }
.lpk .chart-text h3 { font-size:1.4rem; font-weight:800; margin-bottom:1rem; }
.lpk .chart-text p { color:var(--muted); font-size:.92rem; margin-bottom:1.5rem; line-height:1.6; }

.lpk .testi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; }
.lpk .tcard { background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:2rem; transition:transform .3s, box-shadow .3s; }
.lpk .tcard:hover { transform:translateY(-5px); box-shadow:var(--shadow); }
.lpk .tlogo { display:inline-block; background:rgba(76,175,58,.1); color:var(--g-ink); border-radius:10px; padding:8px 14px; font-family:var(--fh); font-weight:800; font-size:.92rem; margin-bottom:1.2rem; }
.lpk .tq { font-size:.92rem; color:#3a463e; line-height:1.7; margin-bottom:1.3rem; }
.lpk .ta { font-weight:700; font-size:.9rem; } .lpk .tl { font-size:.8rem; color:var(--muted); }

.lpk .final { padding:120px 5%; text-align:center; position:relative; overflow:hidden; background:linear-gradient(120deg,#9fd84a 0%,#4caf3a 50%,#2e9e3a 100%); }
.lpk .final-c { position:relative; z-index:2; max-width:720px; margin:0 auto; }
.lpk .final h2 { font-size:clamp(2rem,4vw,3rem); font-weight:800; color:#fff; margin-bottom:1rem; text-shadow:0 2px 16px rgba(0,0,0,.12); }
.lpk .final p { color:rgba(255,255,255,.94); font-size:1.06rem; line-height:1.6; margin-bottom:2.2rem; }
.lpk .final-a { display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; }

.lpk footer { background:#10231a; color:#cfdacf; padding:64px 5% 30px; }
.lpk .foot { max-width:1180px; margin:0 auto; }
.lpk .foot-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1.4fr; gap:3rem; margin-bottom:3rem; }
.lpk .foot-logo { display:flex; align-items:center; gap:10px; font-family:var(--fh); font-weight:800; font-size:1.4rem; color:#fff; margin-bottom:1rem; }
.lpk .foot-d { font-size:.88rem; color:#9fb0a2; line-height:1.6; margin-bottom:1.2rem; }
.lpk .foot-ct { font-family:var(--fh); font-weight:700; font-size:.92rem; color:#fff; margin-bottom:1rem; }
.lpk .foot-links { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.55rem; }
.lpk .foot-links a { font-size:.85rem; color:#9fb0a2; transition:color .2s; }
.lpk .foot-links a:hover { color:var(--g-lime); }
.lpk .social { display:flex; gap:.6rem; margin-top:1.2rem; }
.lpk .social a { width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,.08); display:flex; align-items:center; justify-content:center; color:#cfdacf; transition:background .2s, color .2s; }
.lpk .social a:hover { background:var(--g-deep); color:#fff; }
.lpk .foot-bottom { border-top:1px solid rgba(255,255,255,.08); padding-top:1.4rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; }
.lpk .foot-copy { font-size:.8rem; color:#7d8e80; }
.lpk .foot-legal { display:flex; gap:1.4rem; }
.lpk .foot-legal a { font-size:.8rem; color:#7d8e80; }
.lpk .foot-legal a:hover { color:#9fb0a2; }

@media (max-width:900px) {
  .lpk nav { height:64px; }
  .lpk .hero-in,.lpk .offer,.lpk .chart-row,.lpk .step-card { grid-template-columns:1fr; gap:2.5rem; }
  .lpk .device,.lpk .step-card.rev .step-scene { order:0; }
  .lpk .grid-3,.lpk .metrics-grid,.lpk .mods,.lpk .testi-grid,.lpk .foot-grid { grid-template-columns:1fr 1fr; }
  .lpk .chart-text { flex:unset; }
  .lpk .nav-links { display:none; } .lpk .hamburger { display:flex; }
  .lpk .pad { padding:74px 0; }
}
@media (max-width:600px) {
  .lpk .grid-3,.lpk .metrics-grid,.lpk .mods,.lpk .testi-grid,.lpk .foot-grid { grid-template-columns:1fr; }
  .lpk .step-body,.lpk .step-scene { padding:2rem 1.6rem; }
}
`

const MiniScreen = () => (
  <div className="scr">
    <div className="lp-side">
      <div className="lp-brand"><span className="d" /> Lopbuk</div>
      <div className="lp-row on" /><div className="lp-row" /><div className="lp-row" /><div className="lp-row" />
    </div>
    <div className="lp-main">
      <div className="lp-head"><span className="lp-title">Panel</span><span className="lp-pill">LIVE</span></div>
      <div className="lp-cards">
        <div className="lp-kpi"><b>$48.7k</b><span>Ventas</span></div>
        <div className="lp-kpi"><b>326</b><span>Tickets</span></div>
      </div>
      <div className="lp-bars"><i style={{ height: '60%' }} /><i style={{ height: '85%' }} /><i style={{ height: '45%' }} /><i style={{ height: '95%' }} /><i style={{ height: '70%' }} /></div>
    </div>
  </div>
)

export default function LopbukLanding() {
  const [lang, setLang] = useState<Lang>('es')
  const [langOpen, setLangOpen] = useState(false)
  const [remote, setRemote] = useState<any>(null)
  // Config remota (superadmin) fusionada sobre los defaults locales (fallback).
  const t = remote?.i18n?.[lang] ? { ...DICT[lang], ...remote.i18n[lang] } : DICT[lang]
  const media = remote?.media
    ? { ...MEDIA, ...remote.media, steps: Array.isArray(remote.media.steps) ? remote.media.steps : MEDIA.steps }
    : MEDIA

  // Autodetección por región (locale del navegador) + persistencia.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lopbuk_lang') as Lang | null
      if (saved && (saved === 'es' || saved === 'en')) { setLang(saved); return }
      const region = (navigator.language || 'es').slice(0, 2).toLowerCase()
      setLang(region === 'en' ? 'en' : 'es')
    } catch { /* noop */ }
  }, [])

  // Carga la config editable desde superadmin (GET público). Si falla, se
  // mantienen los defaults locales.
  useEffect(() => {
    let alive = true
    fetch(`${API_URL}/lopbuk-landing`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!alive || !j || !j.success || !j.data) return
        setRemote(j.data)
        try {
          const saved = localStorage.getItem('lopbuk_lang')
          if (!saved && (j.data.defaultLang === 'es' || j.data.defaultLang === 'en')) setLang(j.data.defaultLang)
        } catch { /* noop */ }
      })
      .catch(() => { /* offline / sin backend: usa defaults */ })
    return () => { alive = false }
  }, [])

  const pickLang = (code: Lang) => {
    setLang(code); setLangOpen(false)
    try { localStorage.setItem('lopbuk_lang', code) } catch { /* noop */ }
  }

  useEffect(() => {
    const root = document.getElementById('lpk-root')
    if (!root) return

    const nav = root.querySelector<HTMLElement>('#lpk-nav')
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 30)
    window.addEventListener('scroll', onScroll); onScroll()

    const ham = root.querySelector<HTMLElement>('#lpk-ham')
    const mnav = root.querySelector<HTMLElement>('#lpk-mnav')
    const onHam = () => mnav?.classList.toggle('open')
    ham?.addEventListener('click', onHam)
    mnav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mnav.classList.remove('open')))

    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' })
    root.querySelectorAll('.reveal, .reveal-r').forEach(el => io.observe(el))

    const cio = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { const el = e.target as HTMLElement; el.style.width = (el.dataset.w || '0') + '%'; cio.unobserve(el) } })
    }, { threshold: 0.4 })
    root.querySelectorAll<HTMLElement>('.cbar').forEach(b => cio.observe(b))

    const animate = (el: HTMLElement, target: number, suffix: string) => {
      let start = 0; const dur = 1700
      const step = (ts: number) => {
        if (!start) start = ts
        const p = Math.min((ts - start) / dur, 1)
        el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target) + suffix
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const nio = new IntersectionObserver((es) => {
      es.forEach(e => {
        if (!e.isIntersecting) return
        const el = e.target as HTMLElement
        const m = (el.textContent || '').trim().match(/^(\d+)(.*)$/)
        if (m) animate(el, parseInt(m[1]), m[2])
        nio.unobserve(el)
      })
    }, { threshold: 0.5 })
    root.querySelectorAll<HTMLElement>('.metric .num').forEach(el => nio.observe(el))

    return () => {
      window.removeEventListener('scroll', onScroll)
      ham?.removeEventListener('click', onHam)
      io.disconnect(); cio.disconnect(); nio.disconnect()
    }
  }, [lang])

  const cur = LANGS.find(l => l.code === lang) || LANGS[0]

  return (
    <div className="lpk" id="lpk-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="mobile-nav" id="lpk-mnav">
        {t.nav.map((l: string, i: number) => <a key={i} href={NAV_HREFS[i]}>{l}</a>)}
        <a href={LOGIN_URL}>{t.enter}</a>
      </div>

      <nav id="lpk-nav">
        <div className="nav-logo"><span className="nav-badge">LB</span> Lopbuk</div>
        <div className="nav-right">
          <ul className="nav-links">{t.nav.map((l: string, i: number) => <li key={i}><a href={NAV_HREFS[i]}>{l}</a></li>)}</ul>
          <div className="lang">
            <button className="lang-btn" onClick={() => setLangOpen(o => !o)} aria-label="Language">
              <span className="fl">{cur.flag}</span> {cur.label} <i className="ti ti-chevron-down" />
            </button>
            <div className={`lang-menu ${langOpen ? 'open' : ''}`}>
              {LANGS.map(l => (
                <button key={l.code} className={l.code === lang ? 'sel' : ''} onClick={() => pickLang(l.code)}>
                  <span className="fl">{l.flag}</span> {l.code === 'es' ? 'Español' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <a href={LOGIN_URL} className="nav-cta">{t.cta}</a>
        </div>
        <div className="hamburger" id="lpk-ham"><span /><span /><span /></div>
      </nav>

      <section className="hero" id="inicio">
        {media.heroImage && <img className="hero-bgimg" src={media.heroImage} alt="" />}
        <div className="hero-squares">
          {SQUARES.map((q, i) => (
            <div key={i} className={`sq ${q.c}`} style={{ top: q.t, left: q.l, width: q.s, height: q.s, transform: `rotate(${q.r}deg)` }} />
          ))}
        </div>
        <div className="hero-in">
          <div>
            <div className="hero-badge"><span className="b">LB</span><span className="w">Lopbuk</span></div>
            <h1>{t.heroTitle}</h1>
            <p className="lead">{t.heroLead}</p>
            <div className="hero-actions">
              <a href={LOGIN_URL} className="btn-ghost">{t.heroBtn1} <i className="ti ti-arrow-right" /></a>
              <a href="#solucion" className="btn-ghost">{t.heroBtn2}</a>
            </div>
          </div>
          <div className="device reveal-r">
            <div className="laptop">
              <div className="laptop-screen">
                {media.heroGif ? <img className="media-fill" src={media.heroGif} alt="" /> : <MiniScreen />}
              </div>
              <div className="laptop-foot" />
            </div>
            <div className="dfloat"><b>+45%</b><span>{t.rent}</span></div>
          </div>
        </div>
      </section>

      <section className="band"><h2 className="reveal">{t.band}</h2></section>

      <section className="steps" id="solucion">
        <div className="inner">
          <div className="step-head reveal">
            <span className="eyebrow">{t.stepsEyebrow}</span>
            <h2>{t.stepsTitle}</h2>
          </div>
          {t.steps.map(([st, sd]: [string, string], i: number) => {
            const m = media.steps[i] || { image: null, video: null }
            return (
              <div className={`step-card reveal ${i % 2 === 1 ? 'rev' : ''}`} key={i}>
                <div className="step-scene">
                  {m.video ? (
                    <video className="media-cover" src={m.video} autoPlay muted loop playsInline preload="metadata" />
                  ) : m.image ? (
                    <img className="media-cover" src={m.image} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="monitor"><MiniScreen /></div>
                  )}
                  <div className="step-play"><i className="ti ti-player-play" /></div>
                </div>
                <div className="step-body">
                  <div className="step-no"><span className="n">{i + 1}</span><h3>{st}</h3></div>
                  <p>{sd}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="pad">
        <div className="inner offer">
          <div className="reveal">
            <span className="eyebrow">{t.offerEyebrow}</span>
            <h2 className="h-sec">{t.offerTitleA}<span className="a">{t.offerTitleB}</span></h2>
            <p className="p-sec">{t.offerLead}</p>
            <ul className="offer-list">{t.offer.map((o: string) => <li key={o}><i className="ti ti-circle-check-filled" />{o}</li>)}</ul>
          </div>
          <div className="offer-visual reveal-r">
            {media.offerImage ? (
              <img className="media-cover" src={media.offerImage} alt="" loading="lazy" decoding="async" />
            ) : (
              <div className="laptop" style={{ maxWidth: 360, width: '82%' }}>
                <div className="laptop-screen"><MiniScreen /></div>
                <div className="laptop-foot" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="pad" style={{ paddingTop: 0 }}>
        <div className="inner">
          <div className="head-c reveal">
            <span className="eyebrow">{t.modsEyebrow}</span>
            <h2 className="h-sec">{t.modsTitleA}<span className="a">{t.modsTitleB}</span></h2>
          </div>
          <div className="mods">
            {t.modules.map((label: string, i: number) => (
              <div className="mod reveal" key={i} style={{ transitionDelay: `${(i % 3) * 0.06}s` }}>
                <i className={`ti ${MOD_ICONS[i]}`} /><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="benefits pad" id="beneficios">
        <div className="inner">
          <div className="head-c reveal">
            <span className="eyebrow">{t.benEyebrow}</span>
            <h2 className="h-sec">{t.benTitleA}<span className="a">{t.benTitleB}</span></h2>
          </div>
          <div className="grid-3">
            {t.benefits.map(([bt, bd]: [string, string], i: number) => (
              <div className="bcard reveal" key={i} style={{ transitionDelay: `${(i % 3) * 0.08}s` }}>
                <div className="bicon"><i className={`ti ${BEN_ICONS[i]}`} /></div>
                <h3>{bt}</h3><p>{bd}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pad" id="resultados">
        <div className="inner">
          <div className="head-c reveal">
            <span className="eyebrow">{t.resEyebrow}</span>
            <h2 className="h-sec">{t.resTitleA}<span className="a">{t.resTitleB}</span></h2>
          </div>
          <div className="metrics-grid">
            {t.metrics.map(([lab, des]: [string, string], i: number) => (
              <div className="metric reveal" key={i} style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="num">{METRIC_NUMS[i][0]}{METRIC_NUMS[i][1]}</div>
                <div className="lab">{lab}</div><p className="des">{des}</p>
              </div>
            ))}
          </div>
          <div className="chart-row reveal">
            <div className="chart">
              {t.stores.map((l: string, i: number) => (
                <div className="crow" key={i}>
                  <span className="cl">{l}</span>
                  <div className="cwrap"><div className="cbar" data-w={STORE_VALS[i]}>{STORE_VALS[i]}%</div></div>
                </div>
              ))}
            </div>
            <div className="chart-text">
              <h3>{t.chartTitle}</h3>
              <p>{t.chartDesc}</p>
              <a href={LOGIN_URL} className="btn-primary">{t.chartBtn} <i className="ti ti-arrow-right" /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="pad" style={{ paddingTop: 0 }}>
        <div className="inner">
          <div className="head-c reveal">
            <span className="eyebrow">{t.casesEyebrow}</span>
            <h2 className="h-sec">{t.casesTitleA}<span className="a">{t.casesTitleB}</span></h2>
          </div>
          <div className="testi-grid">
            {t.testi.map((q: string, i: number) => (
              <div className="tcard reveal" key={i} style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="tlogo">{TESTI_META[i][0]}</div>
                <p className="tq">{q}</p>
                <div className="ta">{TESTI_META[i][1]}</div><div className="tl">{TESTI_META[i][2]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final" id="contacto">
        <div className="final-c">
          <h2>{t.finalTitle}</h2>
          <p>{t.finalDesc}</p>
          <div className="final-a">
            <a href={LOGIN_URL} className="btn-ghost">{t.finalBtn1} <i className="ti ti-arrow-right" /></a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-ghost">{t.finalBtn2}</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="foot">
          <div className="foot-grid">
            <div>
              <div className="foot-logo"><span className="nav-badge">LB</span> Lopbuk</div>
              <p className="foot-d">{t.footerDesc}</p>
              <div className="social">
                <a href="#" aria-label="LinkedIn"><i className="ti ti-brand-linkedin" /></a>
                <a href="#" aria-label="Facebook"><i className="ti ti-brand-facebook" /></a>
                <a href="#" aria-label="Instagram"><i className="ti ti-brand-instagram" /></a>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><i className="ti ti-brand-whatsapp" /></a>
              </div>
            </div>
            <div>
              <div className="foot-ct">{t.footNav}</div>
              <ul className="foot-links">{t.nav.map((l: string, i: number) => <li key={i}><a href={NAV_HREFS[i]}>{l}</a></li>)}</ul>
            </div>
            <div>
              <div className="foot-ct">{t.footLegal}</div>
              <ul className="foot-links">{t.legal.map((l: string) => <li key={l}><a href="#">{l}</a></li>)}</ul>
            </div>
            <div>
              <div className="foot-ct">{t.footContact}</div>
              <ul className="foot-links">
                <li><a href="mailto:hola@lopbuk.com">hola@lopbuk.com</a></li>
                <li><a href="mailto:ventas@lopbuk.com">ventas@lopbuk.com</a></li>
                <li><a href="mailto:soporte@lopbuk.com">soporte@lopbuk.com</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span className="foot-copy">© {new Date().getFullYear()} Lopbuk. {t.copy}</span>
            <div className="foot-legal"><a href="#">{t.legal[0]}</a><a href="#">{t.legal[1]}</a></div>
          </div>
        </div>
      </footer>
    </div>
  )
}
