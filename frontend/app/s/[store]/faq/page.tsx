const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

async function fetchFaq(storeSlug: string) {
  const res = await fetch(`${API_URL}/faq/public?store=${storeSlug}`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json()
  return json.success ? json.data : []
}

export default async function FaqPage({ params }: { params: { store: string } }) {
  const data = await fetchFaq(params.store)
  const categories = data || []

  return (
    <div className="min-h-screen bg-[#F6F5F2] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <a href={`/s/${params.store}`} className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-block">
          ← Volver a la tienda
        </a>
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-8">Preguntas Frecuentes</h1>
        
        {categories.length === 0 ? (
          <p className="text-gray-500">No hay preguntas frecuentes disponibles.</p>
        ) : (
          <div className="space-y-8">
            {categories.map((cat: any) => (
              <div key={cat.id}>
                <h2 className="text-xl font-bold text-[#1A1A1A] mb-4">{cat.name}</h2>
                <div className="space-y-3">
                  {cat.items?.map((item: any) => (
                    <details key={item.id} className="bg-white rounded-xl border p-4 group">
                      <summary className="font-medium cursor-pointer text-gray-800 group-open:text-red-600">
                        {item.question}
                      </summary>
                      <p className="mt-3 text-gray-600 text-sm leading-relaxed">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
