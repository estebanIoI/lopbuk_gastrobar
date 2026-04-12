import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export async function GET(
  _req: NextRequest,
  { params }: { params: { storeSlug: string; sectionSlug: string } }
) {
  const { storeSlug, sectionSlug } = params

  try {
    const res = await fetch(
      `${API_URL}/storefront/custom-sections/public/${storeSlug}/${sectionSlug}`,
      { cache: 'no-store' }
    )
    const json = await res.json()

    if (!json.success || !json.data) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#888">
          <p>Sección no encontrada</p>
        </body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    const html: string = json.data.htmlContent || ''

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#888">
        <p>Error al cargar la sección</p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}
