'use client'

import React from "react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Sidebar } from './sidebar'
import { Header } from './header'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed } = useStore()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "md:pl-[90px]" : "md:pl-[252px]"
      )}>
        <Header />
        <main className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1920px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
