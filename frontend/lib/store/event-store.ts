'use client'
import { create } from 'zustand'

interface EventState {
  selectedEvent: any
  selectedTicketType: any
  quantity: number
  holdToken: string | null
  expiresAt: string | null
  couponCode: string
  couponDiscount: any | null
  customerName: string
  customerEmail: string
  customerPhone: string
  customerDocument: string
  checkoutUrl: string | null
  bookingId: string | null
  step: 'select' | 'checkout' | 'payment' | 'confirmed'

  selectTicketType: (tt: any, qty: number) => void
  setQuantity: (qty: number) => void
  setHold: (token: string, expiresAt: string) => void
  setCustomer: (data: Partial<Pick<EventState, 'customerName' | 'customerEmail' | 'customerPhone' | 'customerDocument'>>) => void
  applyCoupon: (result: any) => void
  setCheckout: (checkoutUrl: string, bookingId: string) => void
  setStep: (step: EventState['step']) => void
  reset: () => void
}

export const useEventStore = create<EventState>()((set) => ({
  selectedEvent: null,
  selectedTicketType: null,
  quantity: 1,
  holdToken: null,
  expiresAt: null,
  couponCode: '',
  couponDiscount: null,
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerDocument: '',
  checkoutUrl: null,
  bookingId: null,
  step: 'select',

  selectTicketType: (tt, qty) => set({ selectedTicketType: tt, quantity: qty, step: 'checkout' }),
  setQuantity: (qty) => set({ quantity: qty }),
  setHold: (token, expiresAt) => set({ holdToken: token, expiresAt }),
  setCustomer: (data) => set(data),
  applyCoupon: (result) => set({ couponDiscount: result }),
  setCheckout: (url, id) => set({ checkoutUrl: url, bookingId: id, step: 'payment' }),
  setStep: (step) => set({ step }),
  reset: () => set({
    holdToken: null, expiresAt: null, couponDiscount: null, couponCode: '',
    checkoutUrl: null, bookingId: null, step: 'select',
  }),
}))
