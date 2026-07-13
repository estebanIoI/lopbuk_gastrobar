import { notFound } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

async function fetchRecipePage(storeSlug: string, recipeId: string) {
  const res = await fetch(`${API_URL}/recipe-pages/public?store=${storeSlug}`, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  if (!json.success || !json.data?.recipes) return null
  return json.data.recipes.find((r: any) => r.id === recipeId) || null
}

export default async function RecipeDetailPage({ params }: { params: { store: string; recipeId: string } }) {
  const recipe = await fetchRecipePage(params.store, params.recipeId)
  if (!recipe) notFound()

  return (
    <div className="min-h-screen bg-[#F6F5F2]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <a href={`/s/${params.store}`} className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-block">
          ← Volver a la tienda
        </a>

        {/* Recipe image */}
        {recipe.imageUrl && (
          <div className="w-full h-64 rounded-xl overflow-hidden mb-6">
            <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Title + meta */}
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2">{recipe.title}</h1>
        <div className="flex gap-4 text-sm text-gray-500 mb-6">
          {recipe.prepTimeMinutes && <span>{recipe.prepTimeMinutes} min</span>}
          {recipe.difficulty && <span className="capitalize">{recipe.difficulty}</span>}
          {recipe.servings && <span>{recipe.servings} porciones</span>}
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-gray-700 mb-8 leading-relaxed">{recipe.description}</p>
        )}

        {/* Steps */}
        {recipe.steps && Array.isArray(recipe.steps) && recipe.steps.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Preparación</h2>
            <div className="space-y-4">
              {recipe.steps.map((s: any, i: number) => (
                <div key={i} className="flex gap-4 p-4 bg-white rounded-lg border">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-white font-bold text-sm">
                    {s.step || i + 1}
                  </span>
                  <p className="text-gray-700">{s.instruction}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Ingredientes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recipe.ingredients.map((ing: any) => (
                <div key={ing.id} className="flex justify-between p-3 bg-white rounded-lg border">
                  <span>{ing.productName || ing.name}</span>
                  <span className="text-gray-500">{ing.quantity} {ing.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {recipe.tips && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-amber-800 mb-2">Tips</h3>
            <p className="text-amber-700">{recipe.tips}</p>
          </div>
        )}

        {/* Tags */}
        {recipe.tags && (
          <div className="flex gap-2 flex-wrap">
            {recipe.tags.split(',').map((tag: string) => (
              <span key={tag.trim()} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
