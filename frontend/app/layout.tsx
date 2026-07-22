import React from "react"
import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { GoogleOAuthWrapper } from '@/components/google-oauth-wrapper'
import { DynamicFavicon } from '@/components/dynamic-favicon'
import { PlatformThemeLoader } from '@/components/platform-theme-loader'
import { PwaManager } from '@/components/pwa-manager'
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

// Imagen social dedicada 1200×630 (colócala en /public/og-image.png). Si aún no existe,
// el preview cae al icono cuadrado; para tarjeta grande se recomienda la 1200×630.
const OG_IMAGE = '/og-image.png'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DAIMUZ — Tu ecosistema digital con IA',
    template: '%s · DAIMUZ',
  },
  description: 'Ingresa a DAIMUZ: compra en tus comercios favoritos, haz pedidos y entra a tu OS. ¿Tienes un negocio? Véndelo y gestiónalo con un asistente de IA 24/7.',
  applicationName: 'DAIMUZ',
  manifest: '/manifest.json',
  keywords: ['marketplace', 'comercios locales', 'domicilios', 'tienda online', 'IA para negocios', 'DAIMUZ', 'Colombia'],
  authors: [{ name: 'DAIMUZ' }],
  creator: 'DAIMUZ',
  publisher: 'DAIMUZ',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: BRAND_FAVICON,
    shortcut: BRAND_FAVICON,
    apple: BRAND_ICON,
  },
  openGraph: {
    title: 'DAIMUZ — Bienvenido a tu ecosistema digital',
    description: 'Descubre comercios locales, compra y haz pedidos en un solo lugar. Y para negocios, un asistente de IA que atiende, vende y gestiona 24/7.',
    type: 'website',
    locale: 'es_CO',
    url: SITE_URL,
    siteName: 'DAIMUZ',
    images: [
      { url: OG_IMAGE, width: 1200, height: 630, alt: 'DAIMUZ — Marketplace de comercios locales' },
      { url: BRAND_ICON, width: 512, height: 512, alt: 'DAIMUZ' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DAIMUZ — Tu ecosistema digital con IA',
    description: 'Descubre comercios, compra y haz pedidos. Y si tienes negocio, vende y gestiona con IA 24/7.',
    images: [OG_IMAGE],
  },
  formatDetection: { telephone: false },
}

export const viewport = {
  themeColor: '#00833E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

// ── Datos estructurados (JSON-LD) — server-rendered en el <head>.
// Organization + WebSite con SearchAction (sitelinks searchbox en Google).
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'DAIMUZ',
      url: SITE_URL,
      logo: `${SITE_URL}${BRAND_ICON}`,
      description: 'Marketplace de comercios locales con asistente de IA para negocios.',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'DAIMUZ',
      inLanguage: 'es-CO',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Datos estructurados (JSON-LD) — se emiten en el HTML del servidor */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-TNB4R59C" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());`,
          }}
        />
      </head>
      <body className={`${montserrat.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <DynamicFavicon />
          <PlatformThemeLoader />
          <GoogleOAuthWrapper>
            {children}
          </GoogleOAuthWrapper>
          <Toaster
            richColors
            position="top-center"
            toastOptions={{
              className: 'glass-strong',
              style: {
                background: 'var(--glass-bg-strong)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--glass-border-strong)',
                boxShadow: 'var(--glass-shadow)',
              },
            }}
          />
          <PwaManager />
        </ThemeProvider>
      </body>
    </html>
  )
}
