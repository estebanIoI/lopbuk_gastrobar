'use client'

import { useEffect, useState } from 'react'
import { Bot, Check, Eye, EyeOff, ImageIcon, RefreshCw, Rocket, Save, Sparkles, Brain, Cpu, Gauge, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useIntegrations } from '../hooks/useIntegrations'

const PROVIDERS = [
  { value: 'opencode_go', label: 'OpenCode Go', icon: Rocket },
  { value: 'openai', label: 'OpenAI', icon: Brain },
  { value: 'gemini', label: 'Gemini', icon: Sparkles },
  { value: 'groq', label: 'Groq', icon: Cpu },
] as const

// Visión: solo proveedores multimodales (OpenCode Go no ve imágenes).
const VISION_PROVIDERS = [
  { value: 'gemini', label: 'Gemini', icon: Sparkles },
  { value: 'openai', label: 'OpenAI', icon: Brain },
  { value: 'groq', label: 'Groq', icon: Cpu },
] as const

const usd = (n: number) => `$${(Number(n) || 0).toFixed(2)}`

// Consumo de IA (IA6): gasto estimado de OpenCode Go en ventanas móviles + desglose.
function AiUsageCard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await api.getSuperadminAiUsage()
    if (r.success) setData(r.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const win = (label: string, spend: number, limit: number) => {
    const pct = limit > 0 ? Math.min(100, (spend / limit) * 100) : 0
    const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono">{usd(spend)} <span className="text-muted-foreground">/ {usd(limit)}</span></span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            Consumo de IA (OpenCode Go)
          </CardTitle>
          <CardDescription>
            Gasto estimado por ventana. Al llegar al 80% el sistema degrada automáticamente las tareas a modelo barato; al 100% cae a otro proveedor.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data ? (
          <p className="text-sm text-muted-foreground text-center py-4">{loading ? 'Cargando…' : 'Sin datos de consumo todavía'}</p>
        ) : (
          <>
            <div className="space-y-3">
              {win('Últimas 5 horas', data.spend5h, data.limit5h)}
              {win('Últimos 7 días', data.spendWeek, data.limitWeek)}
              {win('Últimos 30 días', data.spendMonth, data.limitMonth)}
            </div>
            <p className="text-[11px] text-muted-foreground">{data.calls30d || 0} llamadas en 30 días. Costos estimados con tarifas aproximadas.</p>
            {Array.isArray(data.breakdown) && data.breakdown.length > 0 && (
              <div className="border-t border-border pt-3 space-y-1.5">
                {data.breakdown.slice(0, 8).map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate mr-2">{b.provider}<span className="text-muted-foreground"> · {b.model || '—'}</span></span>
                    <span className="flex-shrink-0 text-muted-foreground">{b.calls} · {(b.tokens / 1000).toFixed(0)}k tok · <span className="text-foreground font-medium">{usd(b.cost)}</span></span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function IntegrationsTab() {
  const {
    integrations, setIntegrations, revealKey,
    showGeminiKey, setShowGeminiKey,
    showOpenAIKey, setShowOpenAIKey,
    showGroqKey, setShowGroqKey,
    showOpenCodeGoKey, setShowOpenCodeGoKey,
    showUploadPreset, setShowUploadPreset,
    isSavingIntegrations, integrationsMsg, handleSaveIntegrations,
    platformAssistant, togglingAssistant, toggleAssistant,
    chatbotTenants, isLoadingChatbotTenants, togglingTenantId,
    fetchChatbotTenants, handleToggleChatbot,
  } = useIntegrations()

  const set = (field: string, value: string) =>
    setIntegrations(p => ({ ...p, [field]: value }))

  return (
    <div className="space-y-6">

      {/* Cloudinary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            Cloudinary — Subida de Imágenes
          </CardTitle>
          <CardDescription>
            Credenciales globales para todos los comercios. Configurado aquí, funciona en toda la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs space-y-1">
            <p className="font-medium text-blue-600 dark:text-blue-400">¿Cómo obtener las credenciales?</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              <li>Crea cuenta en <strong>cloudinary.com</strong> y copia tu <strong>Cloud Name</strong> del dashboard</li>
              <li>Ve a <strong>Settings → Upload → Upload presets</strong> y crea uno con <strong>Signing Mode: Unsigned</strong></li>
            </ol>
          </div>

          {integrationsMsg && (
            <div className={`rounded-lg p-3 text-sm ${integrationsMsg.type === 'ok' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
              {integrationsMsg.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cloud Name</Label>
              <Input
                placeholder="ej: dxy123abc"
                value={integrations.cloudinaryCloudName}
                onChange={e => set('cloudinaryCloudName', e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Upload Preset (Unsigned)</Label>
              <div className="relative">
                <Input
                  type={showUploadPreset ? 'text' : 'password'}
                  placeholder="ej: perfumeria_uploads"
                  value={integrations.cloudinaryUploadPreset}
                  onChange={e => set('cloudinaryUploadPreset', e.target.value)}
                  className="font-mono text-sm pr-10"
                />
                <button type="button" onClick={() => setShowUploadPreset(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showUploadPreset ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>API Key <span className="text-xs text-muted-foreground ml-1">(para importar desde Cloudinary)</span></Label>
              <Input
                placeholder={integrations.cloudinaryApiKeySet ? integrations.cloudinaryApiKey : 'ej: 123456789012345'}
                value={integrations.cloudinaryApiKeyInput ?? ''}
                onChange={e => set('cloudinaryApiKeyInput', e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Secret <span className="text-xs text-muted-foreground ml-1">(nunca se muestra)</span></Label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder={integrations.cloudinaryApiSecretSet ? '••••••••••••••••' : 'ej: AbCdEfGhIjKlMnOp...'}
                  value={integrations.cloudinaryApiSecretInput ?? ''}
                  onChange={e => set('cloudinaryApiSecretInput', e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              {integrations.cloudinaryApiSecretSet && (
                <p className="text-xs text-green-600 dark:text-green-400">✓ Configurado — deja vacío para mantener el actual</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${integrations.cloudinaryCloudName && integrations.cloudinaryUploadPreset ? 'bg-green-500' : 'bg-amber-400'}`} />
            <span className="text-muted-foreground text-xs">
              {integrations.cloudinaryCloudName && integrations.cloudinaryUploadPreset
                ? `Activo — Cloud: ${integrations.cloudinaryCloudName}${integrations.cloudinaryApiSecretSet ? ' · Admin API configurado ✓' : ' · Admin API no configurado'}`
                : 'Sin configurar'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* AI Providers */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            Proveedores de IA — Chatbot y Agentes
          </CardTitle>
          <CardDescription>
            Pega la API Key de cualquier proveedor y el agente la usa automáticamente. Si configuras
            varios, manda el que elijas como default. Las claves se almacenan cifradas (AES-256-CBC).
            OpenCode Go funciona con una sola clave para todo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider selector */}
          <div className="space-y-2">
            <Label>Proveedor default (el que usará el agente)</Label>
            <div className="flex gap-2">
              {PROVIDERS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('defaultAiProvider', value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    integrations.defaultAiProvider === value
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            {/* Gemini */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                Google Gemini
                {integrations.geminiApiKey && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-normal">Configurado</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="AIzaSy... (Gemini)"
                  value={integrations.geminiApiKey}
                  onChange={e => set('geminiApiKey', e.target.value)}
                  className="font-mono text-sm pr-10"
                />
                <button type="button" onClick={() => { if (!showGeminiKey && integrations.geminiApiKey.includes('•')) revealKey('gemini'); setShowGeminiKey(v => !v) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* OpenAI */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-emerald-500" />
                OpenAI
                {integrations.openaiApiKey && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-normal">Configurado</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showOpenAIKey ? 'text' : 'password'}
                  placeholder="sk-... (OpenAI)"
                  value={integrations.openaiApiKey}
                  onChange={e => set('openaiApiKey', e.target.value)}
                  className="font-mono text-sm pr-10"
                />
                <button type="button" onClick={() => { if (!showOpenAIKey && integrations.openaiApiKey.includes('•')) revealKey('openai'); setShowOpenAIKey(v => !v) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* OpenAI avanzado: base URL + modelo (OpenCode Go / compatibles) */}
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Base URL (opcional · por defecto OpenCode)</Label>
                <Input list="dz-base-urls" value={integrations.openaiBaseUrl} onChange={e => set('openaiBaseUrl', e.target.value)} placeholder="https://opencode.ai/zen/v1" className="font-mono text-sm" />
                <datalist id="dz-base-urls">
                  <option value="https://opencode.ai/zen/v1" />
                  <option value="https://api.openai.com/v1" />
                  <option value="https://api.groq.com/openai/v1" />
                  <option value="https://openrouter.ai/api/v1" />
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modelo (opcional · por defecto deepseek-v4-flash)</Label>
                <Input list="dz-models" value={integrations.openaiModel} onChange={e => set('openaiModel', e.target.value)} placeholder="deepseek-v4-flash" className="font-mono text-sm" />
                <datalist id="dz-models">
                  <option value="deepseek-v4-flash" />
                  <option value="deepseek-v4-flash-free" />
                  <option value="deepseek-v3.1" />
                  <option value="qwen3-coder" />
                  <option value="gpt-4o-mini" />
                  <option value="gpt-4o" />
                  <option value="claude-3-5-haiku" />
                </datalist>
                <p className="text-[11px] text-muted-foreground">Con tu clave de OpenCode <b>basta</b>: deja Base URL y Modelo vacíos y usamos OpenCode (<code>deepseek-v4-flash</code>) por defecto. Para otro proveedor/modelo, escríbelos.</p>
              </div>
            </div>

            {/* Groq */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-purple-500" />
                Groq (Llama)
                {integrations.groqApiKey && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-normal">Configurado</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showGroqKey ? 'text' : 'password'}
                  placeholder="gsk_... (Groq)"
                  value={integrations.groqApiKey}
                  onChange={e => set('groqApiKey', e.target.value)}
                  className="font-mono text-sm pr-10"
                />
                <button type="button" onClick={() => { if (!showGroqKey && integrations.groqApiKey.includes('•')) revealKey('groq'); setShowGroqKey(v => !v) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showGroqKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* OpenCode Go */}
            <div className="border-t border-border pt-4 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Rocket className="h-4 w-4 text-indigo-500" />
                OpenCode Go (recomendado)
              </Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Una sola clave para todos los módulos IA. Endpoint: <code className="text-[11px] bg-secondary px-1 rounded">https://opencode.ai/zen/go/v1</code>
              </p>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  API Key
                  {integrations.opencodeGoApiKey && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-normal">Configurado</span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type={showOpenCodeGoKey ? 'text' : 'password'}
                    placeholder="sk-... (OpenCode Go)"
                    value={integrations.opencodeGoApiKey}
                    onChange={e => set('opencodeGoApiKey', e.target.value)}
                    className="font-mono text-sm pr-10"
                  />
                  <button type="button" onClick={() => { if (!showOpenCodeGoKey && integrations.opencodeGoApiKey.includes('•')) revealKey('opencode_go'); setShowOpenCodeGoKey(v => !v) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showOpenCodeGoKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modelo (por defecto deepseek-v4-flash)</Label>
                <Input list="dz-go-models" value={integrations.opencodeGoModel} onChange={e => set('opencodeGoModel', e.target.value)} placeholder="opencode-go/deepseek-v4-flash" className="font-mono text-sm" />
                <datalist id="dz-go-models">
                  <option value="opencode-go/deepseek-v4-flash" />
                  <option value="opencode-go/deepseek-v4-flash-free" />
                  <option value="opencode-go/deepseek-v3.1" />
                  <option value="opencode-go/qwen3-coder" />
                </datalist>
                <p className="text-[11px] text-muted-foreground">Deja el modelo por defecto o elige otro del plan Go. El endpoint se configura automáticamente.</p>
              </div>

              {/* Tiering (IA5): main vs small para optimizar consumo */}
              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Tiers de consumo (opcional).</strong> El sistema usa <b>main</b> para chat/agente complejo y <b>small</b> para
                  tareas livianas (respuestas cortas, clasificación). Déjalos vacíos para usar el modelo de arriba en todo.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Modelo main (chat/agente)</Label>
                    <Input list="dz-go-models-main" value={integrations.textModelMain} onChange={e => set('textModelMain', e.target.value)} placeholder="opencode-go/glm-5.2" className="font-mono text-sm" />
                    <datalist id="dz-go-models-main">
                      <option value="opencode-go/glm-5.2" />
                      <option value="opencode-go/kimi-k2.7" />
                      <option value="opencode-go/deepseek-v4-flash" />
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Modelo small (tareas baratas)</Label>
                    <Input list="dz-go-models-small" value={integrations.textModelSmall} onChange={e => set('textModelSmall', e.target.value)} placeholder="opencode-go/deepseek-v4-flash" className="font-mono text-sm" />
                    <datalist id="dz-go-models-small">
                      <option value="opencode-go/deepseek-v4-flash" />
                      <option value="opencode-go/deepseek-v4-flash-free" />
                      <option value="opencode-go/mimo-v2.5" />
                    </datalist>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              integrations.geminiApiKey || integrations.openaiApiKey || integrations.groqApiKey || integrations.opencodeGoApiKey
                ? 'bg-green-500' : 'bg-amber-400'
            }`} />
            <span className="text-muted-foreground text-xs">
              {integrations.geminiApiKey || integrations.openaiApiKey || integrations.groqApiKey || integrations.opencodeGoApiKey
                ? `Al menos un proveedor configurado — default: ${integrations.defaultAiProvider}`
                : 'Sin configurar — el chatbot no funcionará'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Visión (IA3): proveedor que convierte imagen→texto. Nunca es OpenCode Go. */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            Visión — Imagen a texto
          </CardTitle>
          <CardDescription>
            Los modelos de OpenCode Go no ven imágenes. Aquí eliges quién <strong>transcribe las imágenes a texto</strong> (una
            sola vez, con caché por imagen); ese texto se lo pasa luego al modelo de texto barato. Usa la API Key del proveedor de arriba.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Proveedor de visión</Label>
            <div className="flex gap-2">
              {VISION_PROVIDERS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('visionProvider', value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    integrations.visionProvider === value
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Modelo (opcional · por defecto el recomendado del proveedor)</Label>
            <Input
              list="dz-vision-models"
              value={integrations.visionModel}
              onChange={e => set('visionModel', e.target.value)}
              placeholder={integrations.visionProvider === 'gemini' ? 'gemini-flash-latest' : integrations.visionProvider === 'openai' ? 'gpt-4o' : 'meta-llama/llama-4-scout-17b-16e-instruct'}
              className="font-mono text-sm"
            />
            <datalist id="dz-vision-models">
              <option value="gemini-flash-latest" />
              <option value="gemini-2.0-flash" />
              <option value="gpt-4o" />
              <option value="gpt-4o-mini" />
              <option value="meta-llama/llama-4-scout-17b-16e-instruct" />
            </datalist>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              (integrations.visionProvider === 'gemini' && integrations.geminiApiKey)
              || (integrations.visionProvider === 'openai' && integrations.openaiApiKey)
              || (integrations.visionProvider === 'groq' && integrations.groqApiKey)
                ? 'bg-green-500' : 'bg-amber-400'
            }`} />
            <span className="text-muted-foreground text-xs">
              {(integrations.visionProvider === 'gemini' && integrations.geminiApiKey)
              || (integrations.visionProvider === 'openai' && integrations.openaiApiKey)
              || (integrations.visionProvider === 'groq' && integrations.groqApiKey)
                ? `Visión activa con ${integrations.visionProvider}`
                : `Falta la API Key de ${integrations.visionProvider} arriba para que la visión funcione`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Google Wallet — pases de fidelización */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Google Wallet
            {integrations.googleWalletSet && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-500">Configurada</span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Permite emitir las tarjetas de fidelización en Google Wallet. Sin esto, el Wallet Designer
            de los comercios solo funciona como vista previa: no se crea ningún pase.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.googleWalletSet && (
            <div className="text-xs text-muted-foreground">
              Issuer ID actual: <span className="font-mono text-foreground">{integrations.googleWalletIssuerId || '—'}</span>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              JSON del service account {integrations.googleWalletSet && <span className="text-muted-foreground font-normal">(pega uno nuevo solo si quieres reemplazarlo)</span>}
            </label>
            <textarea
              value={integrations.googleWalletCredentialsInput}
              onChange={e => set('googleWalletCredentialsInput', e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={'{\n  "issuerId": "3388000000012345678",\n  "client_email": "xxx@proyecto.iam.gserviceaccount.com",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"\n}'}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs resize-y"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Descarga el JSON del service account en Google Cloud y <b>agrégale el campo <code>issuerId</code></b> que
              obtienes en Google Pay &amp; Wallet Console. Se guarda cifrado y no vuelve a mostrarse.
            </p>
          </div>
          {integrations.googleWalletSet && (
            <button
              type="button"
              onClick={() => set('googleWalletCredentialsInput', '__CLEAR__')}
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Quitar credenciales (se aplica al guardar)
            </button>
          )}
          {integrations.googleWalletCredentialsInput === '__CLEAR__' && (
            <p className="text-xs text-red-400">Se eliminarán las credenciales al guardar. Los comercios dejarán de emitir pases.</p>
          )}
        </CardContent>
      </Card>

      {/* Consumo de IA (IA6) */}
      <AiUsageCard />

      <Button onClick={handleSaveIntegrations} disabled={isSavingIntegrations} className="gap-2">
        {isSavingIntegrations ? <RefreshCw className="h-4 w-4 animate-spin" /> : integrationsMsg?.type === 'ok' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        Guardar Integraciones
      </Button>

      {/* Asistente de plataforma */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              Asistente de Plataforma
            </CardTitle>
            <CardDescription>
              Actívalo en toda la infraestructura. El usuario verá un asistente de ayuda. Requiere la API Key de IA configurada arriba.
            </CardDescription>
          </div>
          <button
            onClick={toggleAssistant}
            disabled={togglingAssistant}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${platformAssistant ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${platformAssistant ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${platformAssistant ? 'bg-green-500' : 'bg-amber-400'}`} />
            <span className="text-muted-foreground text-xs">
              {platformAssistant ? 'Activo — el asistente aparece para los usuarios de la plataforma' : 'Desactivado — los usuarios no ven el asistente'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Chatbot por comercio */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              Chatbot IA por Comercio
            </CardTitle>
            <CardDescription>Activa o desactiva el chatbot para cada comercio. El comerciante configura su base de conocimiento.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchChatbotTenants} disabled={isLoadingChatbotTenants}>
            <RefreshCw className={`h-4 w-4 ${isLoadingChatbotTenants ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingChatbotTenants ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : chatbotTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay comercios activos</p>
          ) : (
            <div className="space-y-2">
              {chatbotTenants.map(tenant => (
                <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">/{tenant.slug}</p>
                    {tenant.chatbotEnabled && tenant.botName && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Bot: {tenant.botName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${tenant.chatbotEnabled ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                      {tenant.chatbotEnabled ? 'Activo' : 'Inactivo'}
                    </span>
                    <button
                      type="button"
                      disabled={togglingTenantId === tenant.id}
                      onClick={() => handleToggleChatbot(tenant.id, !!tenant.chatbotEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${tenant.chatbotEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tenant.chatbotEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
