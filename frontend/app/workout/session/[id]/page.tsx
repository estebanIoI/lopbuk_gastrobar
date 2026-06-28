'use client'

import dynamic from 'next/dynamic'
import { use } from 'react'
import { FullPageLoader } from '@/components/box-loader'

// Modo entrenamiento: pesado y solo para el cliente. Carga en cliente (auth por
// cookie httpOnly), sin SSR.
const WorkoutSessionScreen = dynamic(() => import('@/components/workout/WorkoutSessionScreen'), {
  ssr: false,
  loading: () => <FullPageLoader />,
})

export default function WorkoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <WorkoutSessionScreen sessionId={id} />
}
