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
      {/* Decorative ambient orbs - glass depth enhancer */}
      <div
        className="fixed -top-40 -right-40 w-96 h-96 rounded-full opacity-[0.04] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }}
      />
      <div
        className="fixed -bottom-20 -left-20 w-80 h-80 rounded-full opacity-[0.04] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }}
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
