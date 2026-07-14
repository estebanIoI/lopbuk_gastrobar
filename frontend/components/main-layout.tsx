'use client'

import React from "react"
import { Sidebar } from './sidebar'
import { Header } from './header'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Ambiente orgánico botánico (fijo) — da profundidad al glass, coherente con el Tema 2 */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(1100px 620px at 8% -8%, rgba(63,183,122,0.13), transparent 60%),' +
            'radial-gradient(900px 560px at 100% 4%, rgba(240,165,0,0.10), transparent 55%),' +
            'radial-gradient(1000px 780px at 60% 120%, rgba(0,131,62,0.11), transparent 60%)',
        }}
      />
      <Sidebar />
      <div className="md:pl-[90px]">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1920px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
