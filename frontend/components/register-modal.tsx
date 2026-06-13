'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Code2,
  Smartphone,
  Globe,
  FileSpreadsheet,
  Megaphone,
  Wrench,
  Bot,
  MessageCircle,
  MousePointerClick,
  PartyPopper,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

const services = [
  {
    icon: Code2,
    title: 'Desarrollo de Software',
    description: 'Aplicaciones web y de escritorio a medida',
    color: 'emerald',
  },
  {
    icon: Smartphone,
    title: 'Apps Móviles (APK)',
    description: 'Aplicaciones nativas para Android',
    color: 'blue',
  },
  {
    icon: Globe,
    title: 'Páginas Web',
    description: 'Sitios de conversión y landing pages',
    color: 'purple',
  },
  {
    icon: FileSpreadsheet,
    title: 'Plantillas Excel',
    description: 'Asesoría y plantillas personalizadas',
    color: 'teal',
  },
  {
    icon: Megaphone,
    title: 'Marketing Digital',
    description: 'Estrategias para hacer crecer tu negocio',
    color: 'amber',
  },
  {
    icon: Wrench,
    title: 'Mantenimiento & Instalación',
    description: 'Componentes, aplicativos y soporte técnico',
    color: 'rose',
  },
  {
    icon: Bot,
    title: 'Automatización con IA',
    description: 'Procesos inteligentes para tu empresa',
    color: 'cyan',
  },
  {
    icon: MessageCircle,
    title: 'Chatbots para Negocios',
    description: 'Atención automática en la era digital',
    color: 'green',
  },
  {
    icon: MousePointerClick,
    title: 'Landing de Ventas',
    description: 'Páginas de conversión y redirección a WhatsApp',
    color: 'orange',
  },
  {
    icon: PartyPopper,
    title: 'Tarjetas Digitales',
    description: 'Invitaciones digitales para tus eventos',
    color: 'pink',
  },
]

const colorMap: Record<string, { icon: string; bg: string; border: string }> = {
  emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  blue: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  purple: { icon: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  teal: { icon: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  amber: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  rose: { icon: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  green: { icon: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  orange: { icon: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  pink: { icon: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
}

interface RegisterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegisterModal({ open, onOpenChange }: RegisterModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 bg-transparent shadow-none [&>button]:text-white/60 [&>button]:hover:text-white [&>button]:z-50">
        <div className="relative group">
          {/* Border glow */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/40 via-emerald-500/10 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Card body */}
          <div className="relative rounded-2xl bg-[#0b1120] overflow-hidden">
            {/* Gradient accent */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.06)_0%,_transparent_50%)] pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />

            {/* Header */}
            <div className="px-7 pt-7 pb-5">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/daimuz-isotipo.png" alt="DAIMUZ" width={48} height={48} className="rounded-xl ring-1 ring-white/10" />
                  <div>
                    <DialogTitle className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                      DAIMUZ
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                    </DialogTitle>
                    <DialogDescription className="text-white/40 text-xs font-medium">
                      Soluciones digitales integrales
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <p className="text-white/50 text-[13px] leading-relaxed mt-4">
                Somos un equipo completo de profesionales listos para impulsar tu negocio.
                Comunícate con nosotros para cualquier asesoría o programa que necesites.
              </p>
            </div>

            <div className="mx-7 h-px bg-white/[0.06]" />

            {/* Services grid */}
            <div className="px-7 py-5">
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-4">Nuestros Servicios</p>
              <div className="grid grid-cols-2 gap-2">
                {services.map((service) => {
                  const colors = colorMap[service.color]
                  return (
                    <div
                      key={service.title}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${colors.border} ${colors.bg} hover:scale-[1.02] transition-transform duration-200`}
                    >
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${colors.bg} shrink-0 mt-0.5`}>
                        <service.icon className={`w-4 h-4 ${colors.icon}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white/80 leading-tight">{service.title}</p>
                        <p className="text-[10px] text-white/35 leading-snug mt-0.5">{service.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mx-7 h-px bg-white/[0.06]" />

            {/* CTA */}
            <div className="px-7 py-5">
              <a
                href="https://api.whatsapp.com/message/56AISNOZMVW5N1?autoload=1&app_absent=0"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20"
              >
                <MessageCircle className="w-5 h-5" />
                Contáctanos por WhatsApp
                <ArrowRight className="w-4 h-4" />
              </a>
              <p className="text-center text-white/25 text-[11px] mt-3">
                Respuesta inmediata. Estamos para ayudarte.
              </p>
            </div>

            {/* Footer */}
            <div className="px-7 py-3.5 border-t border-white/[0.06]">
              <p className="text-center text-[10px] text-white/20">
                <span className="font-medium text-white/30">DAIMUZ</span> · Desarrollo, Asesoría & Innovación
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
