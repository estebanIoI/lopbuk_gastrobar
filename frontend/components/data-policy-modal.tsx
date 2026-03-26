'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck,
  Database,
  Lock,
  Server,
  Users,
  Eye,
  FileText,
  MessageCircle,
  Send,
  Headphones,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

const dataPoints = [
  {
    icon: Database,
    title: 'Almacenamiento Seguro',
    desc: 'Tu información se almacena en bases de datos MySQL protegidas con cifrado y respaldos automáticos diarios.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Lock,
    title: 'Autenticación JWT',
    desc: 'Todas las sesiones están protegidas con tokens JWT cifrados. Tu contraseña nunca se almacena en texto plano.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Server,
    title: 'Gestión por Nuestro Equipo',
    desc: 'La base de datos es administrada y mantenida por nuestro equipo técnico especializado, garantizando disponibilidad 24/7.',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Eye,
    title: 'Privacidad Garantizada',
    desc: 'No compartimos, vendemos ni distribuimos tu información a terceros. Tus datos son exclusivamente para tu negocio.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Users,
    title: 'Control de Acceso',
    desc: 'Sistema de roles (admin/vendedor) que asegura que cada usuario acceda únicamente a la información que le corresponde.',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
  {
    icon: FileText,
    title: 'Respaldos Automáticos',
    desc: 'Copias de seguridad periódicas de toda tu información para prevenir pérdida de datos ante cualquier eventualidad.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
]

export function DataPolicyModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary text-xs px-2">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Tratamiento de Datos</span>
          <span className="sm:hidden">Datos</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 p-8 pb-12">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-6 right-10 w-28 h-28 border border-white/30 rounded-full" />
            <div className="absolute bottom-2 left-8 w-40 h-40 border border-white/20 rounded-full" />
            <div className="absolute top-10 left-1/3 w-16 h-16 border border-white/20 rounded-full" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black text-white tracking-tight">
                  Tratamiento de Datos
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-base">
                  Política de privacidad y seguridad de Lopbuk
                </DialogDescription>
              </div>
            </div>
            <p className="text-white/80 text-sm leading-relaxed max-w-xl">
              En Lopbuk nos tomamos muy en serio la seguridad de tu información.
              Conoce cómo manejamos, protegemos y resguardamos los datos de tu negocio.
            </p>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mt-6 relative z-10">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Cifrado End-to-End
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Base de Datos Administrada
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Datos Protegidos
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Main notice */}
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20">
            <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10">
              <Database className="w-6 h-6 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-foreground">Tu base de datos está en buenas manos</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                La base de datos de Lopbuk es gestionada y administrada por nuestro equipo técnico 
                especializado. Nos encargamos del mantenimiento, optimización, seguridad y respaldos 
                para que tú solo te preocupes por hacer crecer tu negocio. Toda tu información está 
                protegida bajo los más altos estándares de seguridad.
              </p>
            </div>
          </div>

          {/* Data handling grid */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              ¿Cómo protegemos tu información?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cada aspecto de tus datos está cubierto por múltiples capas de seguridad.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dataPoints.map((point) => (
                <div key={point.title} className="group flex gap-3 p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-lg ${point.bg}`}>
                    <point.icon className={`w-5 h-5 ${point.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{point.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{point.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Important notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Importante</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Ante cualquier inconveniente con tu cuenta, datos o funcionamiento del sistema, 
                no dudes en contactar a nuestro equipo de soporte. Estamos disponibles para ayudarte 
                en todo momento.
              </p>
            </div>
          </div>

          {/* Support contact */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              <Headphones className="w-5 h-5 inline-block mr-2 text-emerald-500" />
              Contacta a Soporte
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              ¿Tienes algún problema o pregunta? Estamos a un mensaje de distancia.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WhatsApp */}
              <a
                href="https://wa.me/message/56AISNOZMVW5N1"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-emerald-500/40 hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <MessageCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Chatea con nosotros</p>
                  <p className="text-xs text-emerald-500 font-medium mt-1">Abrir chat →</p>
                </div>
              </a>

              {/* Telegram */}
              <a
                href="https://t.me/+JpTiU8BhnpM3MTZh"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-blue-500/40 hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Send className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Telegram</p>
                  <p className="text-xs text-muted-foreground">Escríbenos por Telegram</p>
                  <p className="text-xs text-blue-500 font-medium mt-1">Abrir chat →</p>
                </div>
              </a>
            </div>
          </div>

          {/* Commitment */}
          <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-sm text-foreground font-medium">
              Nos comprometemos a proteger tus datos y brindarte el mejor servicio posible.
            </p>
          </div>

          {/* Footer */}
          <div className="text-center pt-2 pb-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Lopbuk — Política de Tratamiento de Datos © 2026
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
