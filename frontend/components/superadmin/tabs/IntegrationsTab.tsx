'use client'

import { Bot, Check, Eye, EyeOff, ImageIcon, RefreshCw, Save, Sparkles, Brain, Cpu } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIntegrations } from '../hooks/useIntegrations'

const PROVIDERS = [
  { value: 'gemini', label: 'Gemini', icon: Sparkles },
  { value: 'openai', label: 'OpenAI', icon: Brain },
  { value: 'groq', label: 'Groq', icon: Cpu },
] as const

export function IntegrationsTab() {
  const {
    integrations, setIntegrations, revealKey,
    showGeminiKey, setShowGeminiKey,
    showOpenAIKey, setShowOpenAIKey,
    showGroqKey, setShowGroqKey,
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
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${integrations.cloudinaryCloudName && integrations.cloudinaryUploadPreset ? 'bg-green-500' : 'bg-amber-400'}`} />
            <span className="text-muted-foreground text-xs">
              {integrations.cloudinaryCloudName && integrations.cloudinaryUploadPreset
                ? `Activo — Cloud: ${integrations.cloudinaryCloudName}`
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
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              integrations.geminiApiKey || integrations.openaiApiKey || integrations.groqApiKey
                ? 'bg-green-500' : 'bg-amber-400'
            }`} />
            <span className="text-muted-foreground text-xs">
              {integrations.geminiApiKey || integrations.openaiApiKey || integrations.groqApiKey
                ? `Al menos un proveedor configurado — default: ${integrations.defaultAiProvider}`
                : 'Sin configurar — el chatbot no funcionará'}
            </span>
          </div>
        </CardContent>
      </Card>

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
