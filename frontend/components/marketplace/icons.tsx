import { type ReactNode } from 'react'
import {
  UtensilsCrossed, Zap, Shirt, ShoppingBag, Pill, Apple, Wrench, Scissors,
  Dog, Wine, Croissant, Coffee, Gem, Flower2, Sparkles, Store,
} from 'lucide-react'

// ── Iconos por rubro ────────────────────────────────────────────────────────────
export const RUBRO_ICONS: Record<string, ReactNode> = {
  restaurante: <UtensilsCrossed className="w-full h-full" />,
  comida: <UtensilsCrossed className="w-full h-full" />,
  gastrobar: <UtensilsCrossed className="w-full h-full" />,
  tecnologia: <Zap className="w-full h-full" />,
  'tecnología': <Zap className="w-full h-full" />,
  ropa: <Shirt className="w-full h-full" />,
  moda: <Shirt className="w-full h-full" />,
  calzado: <ShoppingBag className="w-full h-full" />,
  drogueria: <Pill className="w-full h-full" />,
  'droguería': <Pill className="w-full h-full" />,
  farmacia: <Pill className="w-full h-full" />,
  fruver: <Apple className="w-full h-full" />,
  supermercado: <ShoppingBag className="w-full h-full" />,
  ferreteria: <Wrench className="w-full h-full" />,
  'ferretería': <Wrench className="w-full h-full" />,
  tapiceria: <Wrench className="w-full h-full" />,
  'tapicería': <Wrench className="w-full h-full" />,
  belleza: <Scissors className="w-full h-full" />,
  peluqueria: <Scissors className="w-full h-full" />,
  mascotas: <Dog className="w-full h-full" />,
  licores: <Wine className="w-full h-full" />,
  panaderia: <Croissant className="w-full h-full" />,
  'panadería': <Croissant className="w-full h-full" />,
  cafe: <Coffee className="w-full h-full" />,
  'café': <Coffee className="w-full h-full" />,
  joyeria: <Gem className="w-full h-full" />,
  'joyería': <Gem className="w-full h-full" />,
  flores: <Flower2 className="w-full h-full" />,
  perfumeria: <Sparkles className="w-full h-full" />,
  'perfumería': <Sparkles className="w-full h-full" />,
}

export const rubroIcon = (type: string): ReactNode =>
  RUBRO_ICONS[type.toLowerCase()] ?? <Store className="w-full h-full" />
