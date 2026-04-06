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
