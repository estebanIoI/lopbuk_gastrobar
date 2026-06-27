import React from "react"
import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { GoogleOAuthWrapper } from '@/components/google-oauth-wrapper'
import { DynamicFavicon } from '@/components/dynamic-favicon'
import { PlatformThemeLoader } from '@/components/platform-theme-loader'
import './globals.css'

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

const BRAND_ISOTIPO = '/daimuz-isotipo.png'
const BRAND_ICON = '/daimuz-icon.png'
// Favicon de la pestaña: icono DAIMUZ oficial.
const BRAND_FAVICON = '/daimuz-icon.png'

// Base absoluta para que og:image / twitter:image se emitan con URL completa
// (WhatsApp, Twitter, etc. NO resuelven rutas relativas en los previews).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://daimuz.alexsters.works'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'DAIMUZ — Tu ecosistema digital con IA',
  description: 'Ingresa a DAIMUZ: compra en tus comercios favoritos, haz pedidos y entra a tu OS. ¿Tienes un negocio? Véndelo y gestiónalo con un asistente de IA 24/7.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  applicationName: 'DAIMUZ',
  icons: {
    icon: BRAND_FAVICON,
    shortcut: BRAND_FAVICON,
    apple: BRAND_ICON,
  },
  openGraph: {
    title: 'DAIMUZ — Bienvenido a tu ecosistema digital',
    description: 'Entra al OS de DAIMUZ: descubre comercios, compra y haz pedidos. Y para negocios, un asistente de IA que atiende, vende y gestiona 24/7.',
    type: 'website',
    url: SITE_URL,
    siteName: 'DAIMUZ',
    images: [{ url: BRAND_ICON, width: 512, height: 512, alt: 'DAIMUZ' }],
  },
  twitter: {
    card: 'summary',
    title: 'DAIMUZ — Tu ecosistema digital con IA',
    description: 'Entra a tu OS: compra, pide y vive DAIMUZ. Y si tienes negocio, vende y gestiona con IA 24/7.',
    images: [BRAND_ICON],
  },
}

export const viewport = {
  themeColor: '#00833E',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${montserrat.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <DynamicFavicon />
          <PlatformThemeLoader />
          <GoogleOAuthWrapper>
            {children}
          </GoogleOAuthWrapper>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
