import { notFound } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

async function fetchPage(storeSlug: string, pageSlug: string) {
  const res = await fetch(`${API_URL}/content-pages/public/${pageSlug}?store=${storeSlug}`, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  return json.success ? json.data : null
}

export default async function ContentPage({ params }: { params: { store: string; slug: string } }) {
  const page = await fetchPage(params.store, params.slug)
  if (!page) notFound()

  return (
    <div className="min-h-screen bg-[#F6F5F2] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <a href={`/s/${params.store}`} className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-block">
          ← Volver a la tienda
        </a>
        <article>
          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-8">{page.title}</h1>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: page.content || '' }} />
        </article>
      </div>
    </div>
  )
}
