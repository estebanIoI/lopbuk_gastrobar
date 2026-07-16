'use client'

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MessageCircle, Mail, MapPin, Clock, ArrowRight, Headphones } from 'lucide-react'

// ── Inline SVG icons for brands not in Lucide ────────────────────────────────
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

// ── Channel data ──────────────────────────────────────────────────────────────
const channels = [
  {
    Icon: Mail,
    title: 'Correo Electrónico',
    value: 'estebanjosa81@gmail.com',
    desc: 'Respuesta en menos de 24 h',
    href: 'mailto:estebanjosa81@gmail.com',
    gradient: 'from-blue-500/20 to-indigo-500/10',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    accent: '#3b82f6',
  },
  {
    Icon: WhatsAppIcon,
    title: 'WhatsApp',
    value: 'Chatea con nosotros',
    desc: 'Lunes a sábado · 8 am – 6 pm',
    href: 'https://wa.me/message/56AISNOZMVW5N1',
    gradient: 'from-emerald-500/20 to-green-500/10',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    accent: '#10b981',
  },
  {
    Icon: InstagramIcon,
    title: 'Instagram',
    value: '@esteban_20011',
    desc: 'Síguenos para novedades',
    href: 'https://www.instagram.com/esteban_20011/',
    gradient: 'from-pink-500/20 to-rose-500/10',
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-400',
    accent: '#ec4899',
  },
  {
    Icon: TelegramIcon,
    title: 'Telegram',
    value: 'Únete al grupo',
    desc: 'Comunidad y soporte',
    href: 'https://t.me/+JpTiU8BhnpM3MTZh',
    gradient: 'from-sky-500/20 to-cyan-500/10',
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
    accent: '#0ea5e9',
  },
]

// ── Commitment pills ──────────────────────────────────────────────────────────
const commitments = [
  { Icon: Clock,      text: 'Respuesta en < 24 h',          color: 'text-amber-400' },
  { Icon: Headphones, text: 'Pedidos · App · Funcionalidades', color: 'text-cyan-400' },
  { Icon: MapPin,     text: 'Colombia · todo el país',       color: 'text-rose-400' },
]

// ── Component ─────────────────────────────────────────────────────────────────
export function ContactModal({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-1.5 text-muted-foreground hover:text-primary text-xs px-2', className)}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Contacto</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto scrollbar-none p-0 gap-0 rounded-2xl glass-strong" style={{ scrollbarWidth: 'none' }}>
        <DialogTitle className="sr-only">Contáctanos</DialogTitle>
        <DialogDescription className="sr-only">Canales de contacto disponibles</DialogDescription>

        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-6 py-8">
          {/* decorative rings */}
          <span className="absolute -top-8 -right-8 w-40 h-40 rounded-full border border-white/15 pointer-events-none" />
          <span className="absolute -bottom-12 -left-6 w-52 h-52 rounded-full border border-white/10 pointer-events-none" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg shrink-0">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-white/20 text-white/90 px-2 py-0.5 rounded-full">
                  Equipo DAIMUZ
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight leading-none">
                Contáctanos
              </h2>
              <p className="text-emerald-100/80 text-sm mt-1">
                Aplicativo de gestión <span className="font-semibold text-white">Daimuz</span>
              </p>
            </div>
          </div>

          <p className="relative z-10 mt-4 text-white/75 text-sm leading-relaxed">
            Somos el equipo <span className="text-white font-semibold">DAIMUZ</span>, creadores del aplicativo <span className="text-white font-semibold">Daimuz</span>. No somos el comercio — resolvemos cualquier situación: pedidos, funcionalidades del aplicativo y todo lo que necesites sacar el máximo provecho de la plataforma.
          </p>
        </div>

        {/* ── Body ── */}
        <div className="p-5 space-y-5">

          {/* Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {channels.map(({ Icon, title, value, desc, href, gradient, iconBg, iconColor }) => (
              <a
                key={title}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br ${gradient} border border-white/5 hover:border-white/15 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
              >
                <div className={`${iconBg} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm font-semibold leading-tight">{title}</p>
                  <p className={`text-xs font-medium mt-0.5 truncate ${iconColor}`}>{value}</p>
                  <p className="text-white/40 text-[11px] mt-0.5 leading-tight">{desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all shrink-0" />
              </a>
            ))}
          </div>

          {/* Commitment strip */}
          <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-3 flex flex-wrap gap-x-5 gap-y-2 justify-center">
            {commitments.map(({ Icon, text, color }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                <span className="text-white/55 text-[11px]">{text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href="https://wa.me/message/56AISNOZMVW5N1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/20"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Escribir por WhatsApp
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
