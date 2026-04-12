import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const errorHtml = (msg: string) =>
  `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#888"><p>${msg}</p></body></html>`

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ storeSlug: string; sectionSlug: string }> }
) {
  const { storeSlug, sectionSlug } = await context.params

  try {
    const res = await fetch(
      `${API_URL}/storefront/custom-sections/public/${storeSlug}/${sectionSlug}`,
      { cache: 'no-store' }
    )

    if (!res.ok) {
      return new NextResponse(errorHtml('Sección no encontrada'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const json = await res.json()

    if (!json.success || !json.data) {
      return new NextResponse(errorHtml('Sección no encontrada'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const html: string = json.data.htmlContent || ''

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[section-route] error:', err)
    return new NextResponse(errorHtml('Error al cargar la sección'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
