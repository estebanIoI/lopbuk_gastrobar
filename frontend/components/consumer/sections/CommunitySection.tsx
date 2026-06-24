'use client'

/**
 * CommunitySection — Community Layer (F5.1–F5.4). Pestañas:
 *   Retos (unirse + progreso) · Ranking (Community Score, gateado) ·
 *   Guilds (equipos) · Feed (social, auto-posts + manual + likes).
 */
import { useEffect, useState } from 'react'
import { Loader2, Trophy, Flame, Target, Users, Crown, Medal, Shield, Heart, Send, Plus, LogOut, Image as ImageIcon, MessageCircle, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import AccessGate from '../AccessGate'
import XpWidget from '../widgets/XpWidget'

const METRIC_META: Record<string, { label: string; emoji: string }> = {
  streak: { label: 'días activos', emoji: '🔥' },
  drops: { label: 'drops', emoji: '⚡' },
  achievements: { label: 'logros', emoji: '🏅' },
}
const fmtLeft = (end?: string) => {
  if (!end) return ''
  const ms = new Date(end).getTime() - Date.now()
  if (ms <= 0) return 'cerrado'
  const d = Math.floor(ms / 86400000)
  return d >= 1 ? `${d}d` : `${Math.floor(ms / 3600000)}h`
}
const ago = (d?: string) => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

type Tab = 'liga' | 'retos' | 'ranking' | 'guilds' | 'feed'

export default function CommunitySection() {
  const [tab, setTab] = useState<Tab>('liga')
  const TABS: { k: Tab; label: string; icon: any }[] = [
    { k: 'liga', label: 'Liga', icon: Zap },
    { k: 'retos', label: 'Retos', icon: Target },
    { k: 'ranking', label: 'Ranking', icon: Trophy },
    { k: 'guilds', label: 'Guilds', icon: Shield },
    { k: 'feed', label: 'Feed', icon: Heart },
  ]
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-neutral-50 p-3 sm:p-4">
      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${tab === t.k ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 border border-neutral-200'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'liga' && <LeagueTab />}
      {tab === 'retos' && <Challenges />}
      {tab === 'ranking' && <AccessGate requires="leaderboard" teaserTitle="🏆 Leaderboard" teaserText="El ranking social de DAIMUZ. Consigue su Vault Key para verlo."><Leaderboard /></AccessGate>}
      {tab === 'guilds' && <Guilds />}
      {tab === 'feed' && <Feed />}
    </div>
  )
}

// ── Liga (XP semanal) ──
function LeagueTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.getLeagueBoard(20).then(r => { if (r.success) setData(r.data) }).finally(() => setLoading(false)) }, [])
  const top: any[] = data?.top || []
  const me = data?.me
  return (
    <div className="space-y-4">
      <XpWidget />
      <div>
        <h3 className="text-sm font-bold text-neutral-800 mb-2 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> Liga de esta semana</h3>
        {loading ? <Spin /> : top.length === 0 ? <Empty text="Suma XP entrenando para entrar a la liga. ⚡" /> : (
          <div className="space-y-1.5">
            {top.map(r => (
              <div key={r.rank} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.isMe ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-black/[0.05]'}`}>
                <span className={`w-6 text-center font-extrabold ${r.rank === 1 ? 'text-amber-500' : r.rank <= 3 ? 'text-neutral-600' : 'text-neutral-300'}`}>
                  {r.rank === 1 ? <Crown className="w-4 h-4 mx-auto text-amber-500" /> : r.rank <= 3 ? <Medal className="w-4 h-4 mx-auto" /> : r.rank}
                </span>
                <span className="flex-1 font-medium text-neutral-800 truncate">{r.name}{r.isMe ? ' (tú)' : ''}</span>
                <span className="text-[11px] text-neutral-400">{r.league}</span>
                <span className="text-sm font-bold text-neutral-900 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" />{r.xp}</span>
              </div>
            ))}
            {me && !top.some((r: any) => r.isMe) && (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-amber-50 border border-amber-200 mt-1">
                <span className="w-6 text-center font-extrabold text-neutral-400">{me.rank}</span>
                <span className="flex-1 font-medium text-neutral-800">Tú</span>
                <span className="text-sm font-bold text-neutral-900 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" />{me.xp}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Retos ──
function Challenges() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const load = async () => { const r = await api.getChallenges(); if (r.success) setItems(r.data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  const join = async (id: string) => { setJoining(id); await api.joinChallenge(id); setJoining(null); load() }

  if (loading) return <Spin />
  if (items.length === 0) return <Empty text="No hay retos activos ahora. 👀" />
  return (
    <div className="space-y-3">
      {items.map(c => {
        const m = METRIC_META[c.metric] || METRIC_META.streak
        const pct = c.goalValue ? Math.min(100, Math.round((c.progress / c.goalValue) * 100)) : 0
        const done = c.progress >= c.goalValue
        return (
          <div key={c.id} className="rounded-2xl border border-black/[0.07] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-neutral-900">{m.emoji} {c.title}</p>
              <span className="text-[11px] text-neutral-400 flex items-center gap-1"><Users className="w-3 h-3" />{c.participants} · {fmtLeft(c.endsAt)}</span>
            </div>
            {c.description && <p className="text-sm text-neutral-500 mt-0.5">{c.description}</p>}
            <p className="text-[11px] text-neutral-500 mt-1">Meta: {c.goalValue} {m.label}{c.reward ? ` · 🎁 ${c.reward}` : ''}</p>
            {c.joined ? (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className={done ? 'text-emerald-600 font-bold' : 'text-neutral-500'}>{done ? '¡Completado!' : `${c.progress}/${c.goalValue}`}</span>
                  <span className="text-neutral-400">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 overflow-hidden"><div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} /></div>
              </div>
            ) : (
              <button onClick={() => join(c.id)} disabled={joining === c.id} className="mt-2 w-full rounded-xl bg-neutral-900 text-white text-sm font-semibold py-2 hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2">
                {joining === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Flame className="w-4 h-4" /> Unirme al reto</>}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Leaderboard global ──
function Leaderboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.getCommunityLeaderboard(20).then(r => { if (r.success) setData(r.data) }).finally(() => setLoading(false)) }, [])
  if (loading) return <Spin />
  const top: any[] = data?.top || []
  const me = data?.me
  if (top.length === 0) return <Empty text="Sé el primero en el ranking. Mantén tu racha. 🔥" />
  return (
    <div className="space-y-1.5">
      {top.map(r => <Row key={r.rank} rank={r.rank} name={`${r.name}${r.isMe ? ' (tú)' : ''}`} score={r.score} me={r.isMe} />)}
      {me && !top.some((r: any) => r.isMe) && <Row rank={me.rank} name={`${me.name} (tú)`} score={me.score} me />}
    </div>
  )
}
function Row({ rank, name, score, me }: { rank: number; name: string; score: number; me?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${me ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-black/[0.05]'}`}>
      <span className={`w-6 text-center font-extrabold ${rank === 1 ? 'text-amber-500' : rank <= 3 ? 'text-neutral-600' : 'text-neutral-300'}`}>
        {rank === 1 ? <Crown className="w-4 h-4 mx-auto text-amber-500" /> : rank <= 3 ? <Medal className="w-4 h-4 mx-auto" /> : rank}
      </span>
      <span className="flex-1 font-medium text-neutral-800 truncate">{name}</span>
      <span className="text-sm font-bold text-neutral-900 flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-500" />{score}</span>
    </div>
  )
}

// ── Guilds ──
function Guilds() {
  const [mine, setMine] = useState<any>(null)
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState(''); const [emoji, setEmoji] = useState('🛡️'); const [tagline, setTagline] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')

  const load = async () => {
    const [g, l] = await Promise.all([api.getMyGuild(), api.getGuilds(15)])
    if (g.success) setMine(g.data)
    if (l.success) setList(l.data?.guilds || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (name.trim().length < 3) { setErr('Mínimo 3 caracteres.'); return }
    setBusy(true); setErr('')
    const r = await api.createGuild({ name: name.trim(), emoji, tagline: tagline.trim() || undefined })
    setBusy(false)
    if (!r.success) { setErr(r.error || 'No se pudo crear'); return }
    setCreating(false); setName(''); setTagline(''); load()
  }
  const join = async (id: string) => { await api.joinGuild(id); load() }
  const leave = async () => { await api.leaveGuild(); load() }

  if (loading) return <Spin />

  return (
    <div className="space-y-4">
      {mine ? (
        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-2xl">{mine.emoji}</span><div><p className="font-bold">{mine.name}</p>{mine.tagline && <p className="text-[11px] text-white/60">{mine.tagline}</p>}</div></div>
            <button onClick={leave} className="text-white/50 hover:text-white text-xs flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> Salir</button>
          </div>
          <p className="text-[11px] text-white/60 mt-2">Score del guild: <b className="text-white">{mine.totalScore}</b> · {mine.members.length} miembros</p>
          <div className="mt-2 space-y-1">
            {mine.members.slice(0, 5).map((mm: any) => (
              <div key={mm.rank} className="flex items-center justify-between text-sm">
                <span className="text-white/80">{mm.rank}. {mm.name}{mm.isMe ? ' (tú)' : ''}</span>
                <span className="text-white/60 flex items-center gap-1"><Flame className="w-3 h-3 text-orange-300" />{mm.score}</span>
              </div>
            ))}
          </div>
        </div>
      ) : creating ? (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-4 space-y-2">
          <p className="font-bold text-neutral-900 text-sm">Crear guild</p>
          <div className="flex gap-2">
            <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 2))} className="w-12 text-center rounded-xl border border-neutral-200 px-2 py-2.5 text-lg" />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del guild" className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Lema (opcional)" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="flex-1 rounded-xl border border-neutral-200 text-sm font-medium py-2 hover:bg-neutral-50">Cancelar</button>
            <button onClick={create} disabled={busy} className="flex-1 rounded-xl bg-neutral-900 text-white text-sm font-semibold py-2 disabled:opacity-50 flex items-center justify-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="w-full rounded-xl border border-dashed border-neutral-300 bg-white py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Crear mi guild</button>
      )}

      <div>
        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Top guilds</h4>
        {list.length === 0 ? <Empty text="Aún no hay guilds. ¡Crea el primero!" /> : (
          <div className="space-y-1.5">
            {list.map(g => (
              <div key={g.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${g.isMine ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-black/[0.05]'}`}>
                <span className={`w-5 text-center font-extrabold ${g.rank === 1 ? 'text-amber-500' : 'text-neutral-300'}`}>{g.rank}</span>
                <span className="text-lg">{g.emoji}</span>
                <span className="flex-1 min-w-0"><span className="font-medium text-neutral-800 block truncate">{g.name}</span><span className="text-[11px] text-neutral-400">{g.members} miembros</span></span>
                <span className="text-sm font-bold text-neutral-900 flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-500" />{g.score}</span>
                {!g.isMine && !mine && <button onClick={() => join(g.id)} className="text-[11px] font-semibold text-indigo-600 hover:underline">Unirme</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Feed social ──
function Feed() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState('')
  const [showPhoto, setShowPhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = async () => { const r = await api.getArenaFeed(40); if (r.success) setItems(r.data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  const post = async () => {
    const body = text.trim(); if ((!body && !photo.trim()) || busy) return
    setBusy(true); setText(''); const ph = photo.trim(); setPhoto(''); setShowPhoto(false)
    await api.postArenaFeed({ body: body || undefined, photoUrl: ph || undefined }); setBusy(false); load()
  }
  const like = async (id: string) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p))
    await api.likeArenaFeed(id)
  }
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && post()} placeholder="Comparte tu progreso…" className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          <button onClick={() => setShowPhoto(v => !v)} title="Agregar foto" className={`rounded-xl border px-3 ${showPhoto ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-500'}`}><ImageIcon className="w-4 h-4" /></button>
          <button onClick={post} disabled={busy || (!text.trim() && !photo.trim())} className="rounded-xl bg-neutral-900 text-white px-4 disabled:opacity-50 flex items-center justify-center"><Send className="w-4 h-4" /></button>
        </div>
        {showPhoto && <input value={photo} onChange={e => setPhoto(e.target.value)} placeholder="URL de la foto" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />}
      </div>
      {loading ? <Spin /> : items.length === 0 ? <Empty text="Sé el primero en publicar. 💪" /> : (
        <div className="space-y-2">
          {items.map(f => <FeedPost key={f.id} f={f} onLike={() => like(f.id)} />)}
        </div>
      )}
    </div>
  )
}

function FeedPost({ f, onLike }: { f: any; onLike: () => void }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [text, setText] = useState('')
  const [count, setCount] = useState(f.commentsCount || 0)
  const [loaded, setLoaded] = useState(false)

  const toggle = async () => {
    const next = !open; setOpen(next)
    if (next && !loaded) { const r = await api.getFeedComments(f.id); if (r.success) setComments(r.data || []); setLoaded(true) }
  }
  const send = async () => {
    const body = text.trim(); if (!body) return
    setText('')
    setComments(c => [...c, { id: `tmp-${Date.now()}`, author: 'Tú', isMe: true, body }])
    setCount((n: number) => n + 1)
    await api.addFeedComment(f.id, body)
  }

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-[11px] font-bold text-neutral-600">{(f.author || 'A')[0]}</div>
        <span className="text-sm font-semibold text-neutral-800">{f.author}{f.isMe ? ' (tú)' : ''}</span>
        {f.kind !== 'post' && <span className="text-[10px] uppercase tracking-wide text-violet-500 font-bold">{f.kind === 'achievement' ? 'logro' : f.kind === 'challenge' ? 'reto' : f.kind}</span>}
        <span className="text-[11px] text-neutral-400 ml-auto">{ago(f.createdAt)}</span>
      </div>
      {f.body && <p className="text-sm text-neutral-700 mt-1.5">{f.body}</p>}
      {f.photoUrl && <img src={f.photoUrl} alt="" className="mt-2 rounded-xl w-full object-cover max-h-60" />}
      <div className="mt-2 flex items-center gap-4">
        <button onClick={onLike} className={`flex items-center gap-1.5 text-xs font-medium ${f.liked ? 'text-red-500' : 'text-neutral-400 hover:text-neutral-600'}`}>
          <Heart className={`w-3.5 h-3.5 ${f.liked ? 'fill-red-500' : ''}`} /> {f.likes}
        </button>
        <button onClick={toggle} className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-600">
          <MessageCircle className="w-3.5 h-3.5" /> {count}
        </button>
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-black/[0.05] space-y-2">
          {comments.map(c => (
            <p key={c.id} className="text-xs text-neutral-600"><span className="font-semibold text-neutral-800">{c.author}{c.isMe ? ' (tú)' : ''}:</span> {c.body}</p>
          ))}
          <div className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Comenta…" className="flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
            <button onClick={send} disabled={!text.trim()} className="rounded-lg bg-neutral-900 text-white px-3 text-xs disabled:opacity-50">Enviar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Spin() { return <div className="flex justify-center py-6 text-neutral-300"><Loader2 className="w-6 h-6 animate-spin" /></div> }
function Empty({ text }: { text: string }) { return <p className="text-sm text-neutral-400 text-center py-6">{text}</p> }
