'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { loginHref } from '@/lib/login-path'
import { communityApi, type CommunityPost } from './api'
import { PostCard } from './post-card'
import { CommunitySidebar, AboutCard } from './community-sidebar'

type Filter = { label: string; sort?: string; category?: string }
const FILTERS: Filter[] = [
  { label: 'Reciente', sort: 'recent' },
  { label: 'Populares', sort: 'popular' },
  { label: 'Noticias', category: 'noticia' },
  { label: 'Videos', category: 'video' },
]

export function CommunityFeed() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [active, setActive] = useState(0)
  const [q, setQ] = useState('')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [likeRequiresLogin, setLikeRequiresLogin] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)

  useEffect(() => { communityApi.settings().then(s => setLikeRequiresLogin(!!s.likeRequiresLogin)).catch(() => {}) }, [])

  const pageRef = useRef(1)
  const load = useCallback(async (reset = true) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const f = FILTERS[active]
    const nextPage = reset ? 1 : pageRef.current + 1
    try {
      const res = await communityApi.feed({ sort: f.sort, category: f.category, q: q || undefined, page: nextPage })
      setPosts(prev => reset ? res.data : [...prev, ...res.data])
      setHasMore(res.hasMore)
      pageRef.current = nextPage
      setPage(nextPage)
    } catch { if (reset) setPosts([]) }
    finally { loadingRef.current = false; setLoading(false) }
  }, [active, q]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(true) }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => load(true), 350); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll infinito: carga la siguiente página al acercarse al final.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingRef.current) load(false)
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, load])

  const requireLogin = () => router.push(loginHref('/comunidad'))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-extrabold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-600" /> DAIMUZ <span className="text-cyan-600">Comunidad</span>
            </h1>
            <div className="relative w-40 sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="w-full pl-9 pr-3 py-1.5 rounded-full border text-sm outline-none focus:border-cyan-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {FILTERS.map((f, i) => (
              <button key={f.label} onClick={() => setActive(i)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${active === i ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Feed + sidebar */}
      <main className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex gap-6 items-start">
          {/* Columna central (feed) */}
          <div className="flex-1 min-w-0 max-w-2xl mx-auto lg:mx-0 space-y-5">
            {/* Tarjeta compacta de bienvenida (solo móvil) */}
            <div className="lg:hidden"><AboutCard compact /></div>

            {loading && posts.length === 0 ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-cyan-600" /></div>
            ) : posts.length === 0 ? (
              <p className="text-center text-gray-400 py-16">No hay publicaciones todavía.</p>
            ) : (
              posts.map(p => <PostCard key={p.id} post={p} isAuthed={isAuthenticated} likeRequiresLogin={likeRequiresLogin} onRequireLogin={requireLogin} />)
            )}

            {/* Sentinel para scroll infinito */}
            {hasMore && <div ref={sentinelRef} className="h-1" />}
            {loading && posts.length > 0 && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-cyan-600" /></div>}
            {!hasMore && posts.length > 0 && <p className="text-center text-xs text-gray-400 py-4">Has llegado al final</p>}
          </div>

          {/* Sidebar derecho (escritorio) */}
          <CommunitySidebar />
        </div>
      </main>
    </div>
  )
}

export default CommunityFeed
