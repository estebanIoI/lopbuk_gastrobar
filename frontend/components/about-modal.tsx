'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Info,
  Code2,
  BarChart3,
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  Github,
  Linkedin,
  Mail,
  Calculator,
  ScanLine,
  Upload,
  LayoutDashboard,
  Crown,
  Store,
  Truck,
  Star,
  Globe,
} from 'lucide-react'

const tech = ['Next.js', 'React 19', 'TypeScript', 'Node.js', 'Express', 'MySQL', 'Tailwind', 'Socket.IO', 'Zustand']

const modules = [
  { icon: LayoutDashboard, name: 'Dashboard' },
  { icon: ShoppingCart,    name: 'Punto de Venta' },
  { icon: Package,         name: 'Inventario' },
  { icon: CreditCard,      name: 'Fiados' },
  { icon: Calculator,      name: 'Caja' },
  { icon: BarChart3,       name: 'Analítica' },
  { icon: ScanLine,        name: 'Escáner' },
  { icon: Users,           name: 'Multi-usuario' },
  { icon: Upload,          name: 'CSV Import' },
  { icon: Store,           name: 'Tienda Online' },
  { icon: Truck,           name: 'Domicilios' },
  { icon: Star,            name: 'Reseñas' },
  { icon: Globe,           name: 'Multi-tienda' },
]

export function AboutModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary text-xs px-2">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Acerca de</span>
          <span className="sm:hidden">Info</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 bg-transparent shadow-none [&>button]:text-white/50 [&>button]:hover:text-white [&>button]:z-50">
        <div className="relative bg-[#0a0a0a] border border-white/[0.08] overflow-hidden">

          {/* Thin top accent line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* ——— HEADER ——— */}
          <div className="px-7 pt-8 pb-6">
            <DialogHeader>
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/image/lopbukicon.png"
                  alt="Lopbuk"
                  width={44}
                  height={44}
                  className="rounded-lg ring-1 ring-white/10 shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-light text-white tracking-tight">
                    Lopbuk
                  </DialogTitle>
                  <DialogDescription className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-light mt-0.5">
                    GastroBar & Tiendas — v2.1
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <p className="text-white/45 text-[13px] leading-relaxed mt-5 font-light">
              Plataforma integral para gestión de inventario, ventas, domicilios, caja, analítica y tienda online — todo desde un solo lugar.
            </p>
            <p className="text-white/35 text-[12px] leading-relaxed mt-3 font-light">
              <span className="text-white/55 font-normal">Novedades v2.1:</span>{' '}
              Tienda online multi-tienda, domicilios con tracking, reseñas de productos, escáner remoto, importación CSV y reportes analíticos avanzados.
            </p>
          </div>

          <div className="mx-7 h-px bg-white/[0.06]" />

          {/* ——— MODULES ——— */}
          <div className="px-7 py-5">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/25 font-light mb-4">
              {modules.length} módulos
            </p>
            <div className="grid grid-cols-3 gap-px bg-white/[0.04]">
              {modules.map((mod) => (
                <div
                  key={mod.name}
                  className="flex items-center gap-2 px-3 py-2.5 bg-[#0a0a0a] hover:bg-white/[0.03] transition-colors"
                >
                  <mod.icon className="w-3 h-3 text-white/20 shrink-0" />
                  <span className="text-[10px] text-white/45 font-light truncate">{mod.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-7 h-px bg-white/[0.06]" />

          {/* ——— DEVELOPER ——— */}
          <div className="px-7 py-5">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/25 font-light mb-4">Desarrollador</p>
            <div className="flex items-center gap-4 p-4 border border-white/[0.07] bg-white/[0.02]">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="absolute -inset-[2px] bg-gradient-to-br from-white/20 to-white/5" />
                <div className="relative w-12 h-12 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/image/jhonjosa.png"
                    alt="Developer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                  <Crown className="w-2.5 h-2.5 text-white/50" />
                </div>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-light text-white/90 leading-tight">Jhon Esteban Josa Q.</p>
                <p className="text-[10px] text-white/35 font-light uppercase tracking-widest mt-0.5">Full Stack Developer</p>
                <div className="flex items-center gap-3 mt-2.5">
                  <a href="https://github.com/estebanIoI" target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/60 transition-colors">
                    <Github className="w-3.5 h-3.5" />
                  </a>
                  <a href="#" className="text-white/20 hover:text-white/60 transition-colors">
                    <Linkedin className="w-3.5 h-3.5" />
                  </a>
                  <a href="mailto:estebanjosa81@gmail.com" className="text-white/20 hover:text-white/60 transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Status */}
              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                <span className="flex items-center gap-1.5 text-[9px] text-white/30 font-light">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                  online
                </span>
                <span className="text-[9px] text-white/15 font-light">2024–2026</span>
                <span className="mt-1 flex items-center gap-1 text-[8px] text-white/25 border border-white/10 px-1.5 py-0.5 uppercase tracking-wider font-light">
                  <Code2 className="w-2 h-2" />
                  building
                </span>
              </div>
            </div>
          </div>

          <div className="mx-7 h-px bg-white/[0.06]" />

          {/* ——— TECH STACK ——— */}
          <div className="px-7 py-5">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/25 font-light mb-3">Stack</p>
            <div className="flex flex-wrap gap-1.5">
              {tech.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 text-[10px] font-light text-white/35 border border-white/[0.08] bg-white/[0.02]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* ——— FOOTER ——— */}
          <div className="px-7 py-3.5 border-t border-white/[0.06]">
            <p className="text-center text-[9px] text-white/15 font-light uppercase tracking-widest">
              DAIMUZ · © 2026 Lopbuk
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
