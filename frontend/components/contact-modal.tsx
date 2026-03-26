'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Instagram,
  Globe,
  Headphones
} from 'lucide-react'

const contactChannels = [
  {
    icon: Mail,
    title: 'Correo Electrónico',
    value: 'estebanjosa81@gmail.com',
    link: 'mailto:estebanjosa81@gmail.com',
    desc: 'Respuesta en menos de 24 horas',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Phone,
    title: 'WhatsApp',
    value: 'Chatea con nosotros',
    link: 'https://wa.me/message/56AISNOZMVW5N1',
    desc: 'Lunes a sábado, 8am - 6pm',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Instagram,
    title: 'Instagram',
    value: '@esteban_20011',
    link: 'https://www.instagram.com/esteban_20011/',
    desc: 'Síguenos para novedades',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
  {
    icon: Send,
    title: 'Telegram',
    value: 'Únete al grupo',
    link: 'https://t.me/+JpTiU8BhnpM3MTZh',
    desc: 'Comunidad y soporte',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
]

const supportFeatures = [
  {
    icon: Headphones,
    title: 'Soporte Técnico',
    desc: 'Nuestro equipo te ayuda con cualquier problema técnico o configuración de tu cuenta.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Clock,
    title: 'Tiempo de Respuesta',
    desc: 'Nos comprometemos a responder todas las consultas en un plazo máximo de 24 horas hábiles.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: MapPin,
    title: 'Ubicación',
    desc: 'Colombia — Atendemos negocios en todo el territorio nacional.',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
]

export function ContactModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary text-xs px-2">
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Contacto</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-8 pb-12">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-6 right-10 w-28 h-28 border border-white/30 rounded-full" />
            <div className="absolute bottom-2 left-8 w-40 h-40 border border-white/20 rounded-full" />
            <div className="absolute top-10 left-1/3 w-16 h-16 border border-white/20 rounded-full" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Send className="w-8 h-8 text-white" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black text-white tracking-tight">
                  Contáctanos
                </DialogTitle>
                <DialogDescription className="text-emerald-100 text-base">
                  Estamos aquí para ayudarte
                </DialogDescription>
              </div>
            </div>
            <p className="text-white/80 text-sm leading-relaxed max-w-xl">
              ¿Tienes dudas, sugerencias o necesitas ayuda? Comunícate con nosotros
              por cualquiera de nuestros canales. Estaremos encantados de atenderte.
            </p>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Contact Channels */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              Canales de Contacto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contactChannels.map((channel) => (
                <a
                  key={channel.title}
                  href={channel.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 p-4 rounded-xl border border-border/50 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-200"
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${channel.bg} shrink-0`}>
                    <channel.icon className={`w-5 h-5 ${channel.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{channel.title}</p>
                    <p className={`text-sm font-medium ${channel.color} group-hover:underline`}>{channel.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{channel.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Support Features */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-cyan-500" />
              Nuestro Compromiso
            </h3>
            <div className="space-y-3">
              {supportFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50"
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${feature.bg} shrink-0`}>
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-xl p-4 text-center">
            <p className="text-sm font-medium text-foreground">
              💬 ¿Necesitas ayuda urgente?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Escríbenos por WhatsApp y te responderemos lo antes posible.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
