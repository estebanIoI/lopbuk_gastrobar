'use client'

/**
 * Preview interactiva del checkout con restyle ML (Finalizar Compra → Pedido
 * Completado). Ruta: /preview/checkout-ml — datos mock, handlers no-op.
 */
import { useState } from 'react'
import { CheckoutWizardML } from '@/components/theme-ml/checkout-wizard-ml'
import type { ProductoCarrito, PedidoForm, PedidoConfirmado } from '@/types'

const img = (seed: string) => `https://picsum.photos/seed/${seed}/200/200`

const EMPTY_FORM: PedidoForm = {
  nombre: '', telefono: '', email: '', cedula: '',
  departamento: '', municipio: '', direccion: '', barrio: '', notas: '',
}

export default function PreviewCheckoutMLPage() {
  const [carrito] = useState<ProductoCarrito[]>([
    { id: 1, nombre: 'Extractor De Jugos Mertec MT-041S Gris', precio: 143900, precioOriginal: 239900, descuentoPorcentaje: 40, cantidad: 1, imagen: img('p1'), colorSeleccionado: 'Gris' },
    { id: 2, nombre: 'Set de Vasos de Vidrio x6', precio: 71950, cantidad: 2, imagen: img('p2') },
  ])
  const [formData, setFormData] = useState<PedidoForm>(EMPTY_FORM)
  const [confirmado, setConfirmado] = useState<PedidoConfirmado | null>(null)
  const [exito, setExito] = useState(false)

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const onConfirmar = () => {
    setConfirmado({
      numeroPedido: 'LB-2026-0418',
      email: formData.email || 'cliente@correo.com',
      productos: carrito,
      total,
      fecha: new Date().toLocaleString('es-CO'),
    })
    setExito(true)
  }

  return (
    <CheckoutWizardML
      carrito={carrito}
      totalCarrito={total}
      formData={formData}
      enviandoEmail={false}
      mostrarModalExito={exito}
      pedidoConfirmado={confirmado}
      onInputChange={onInputChange}
      onConfirmar={onConfirmar}
      onCerrarModal={() => setExito(false)}
      onVolver={() => history.back()}
      allowContraentrega
      freeDeliveryMin={200000}
      deliveryFee={0}
      accentColor="#3483fa"
      storeName="Mertec"
    />
  )
}
