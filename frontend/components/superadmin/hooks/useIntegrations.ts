'use client'

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { clearCloudinaryCache } from '@/components/ui/cloudinary-upload'

export interface IntegrationsState {
  cloudinaryCloudName: string
  cloudinaryUploadPreset: string
  // Campos de solo lectura (vienen del backend enmascarados)
  cloudinaryApiKey: string
  cloudinaryApiKeySet: boolean
  cloudinaryApiSecretSet: boolean
  // Campos de entrada para editar (los campos "Input" son los que el usuario tipea)
  cloudinaryApiKeyInput: string
  cloudinaryApiSecretInput: string
  geminiApiKey: string
  openaiApiKey: string
  groqApiKey: string
  opencodeGoApiKey: string
  opencodeGoModel: string
  textModelMain: string
  textModelSmall: string
  defaultAiProvider: 'gemini' | 'openai' | 'groq' | 'opencode_go'
  openaiBaseUrl: string
  openaiModel: string
  visionProvider: 'gemini' | 'openai' | 'groq'
  visionModel: string
  // Google Wallet: la clave privada nunca vuelve del servidor. Solo se sabe si
  // está configurada (y el issuerId, que no es sensible). El textarea es de
  // entrada: se escribe el JSON del service account y se envía al guardar.
  googleWalletSet: boolean
  googleWalletIssuerId: string
  googleWalletCredentialsInput: string
}

const INITIAL_INTEGRATIONS: IntegrationsState = {
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  cloudinaryApiKey: '',
  cloudinaryApiKeySet: false,
  cloudinaryApiSecretSet: false,
  cloudinaryApiKeyInput: '',
  cloudinaryApiSecretInput: '',
  geminiApiKey: '',
  openaiApiKey: '',
  groqApiKey: '',
  opencodeGoApiKey: '',
  opencodeGoModel: 'opencode-go/deepseek-v4-flash',
  textModelMain: '',
  textModelSmall: '',
  defaultAiProvider: 'opencode_go',
  openaiBaseUrl: '',
  openaiModel: '',
  visionProvider: 'gemini',
  visionModel: '',
  googleWalletSet: false,
  googleWalletIssuerId: '',
  googleWalletCredentialsInput: '',
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationsState>(INITIAL_INTEGRATIONS)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [showOpenCodeGoKey, setShowOpenCodeGoKey] = useState(false)
  const [showUploadPreset, setShowUploadPreset] = useState(false)
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false)
  const [integrationsMsg, setIntegrationsMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Platform assistant
  const [platformAssistant, setPlatformAssistant] = useState(false)
  const [togglingAssistant, setTogglingAssistant] = useState(false)

  // Chatbot per-tenant
  const [chatbotTenants, setChatbotTenants] = useState<any[]>([])
  const [isLoadingChatbotTenants, setIsLoadingChatbotTenants] = useState(false)
  const [togglingTenantId, setTogglingTenantId] = useState<string | null>(null)

  const fetchIntegrations = useCallback(async () => {
    const result = await api.getSuperadminIntegrations()
    if (result.success && result.data) {
      setIntegrations({
        cloudinaryCloudName: result.data.cloudinaryCloudName || '',
        cloudinaryUploadPreset: result.data.cloudinaryUploadPreset || '',
        cloudinaryApiKey: result.data.cloudinaryApiKey || '',
        cloudinaryApiKeySet: !!result.data.cloudinaryApiKeySet,
        cloudinaryApiSecretSet: !!result.data.cloudinaryApiSecretSet,
        cloudinaryApiKeyInput: '',
        cloudinaryApiSecretInput: '',
        geminiApiKey: result.data.geminiApiKey || '',
        openaiApiKey: result.data.openaiApiKey || '',
        groqApiKey: result.data.groqApiKey || '',
        opencodeGoApiKey: result.data.opencodeGoApiKey || '',
        opencodeGoModel: result.data.opencodeGoModel || 'opencode-go/deepseek-v4-flash',
        textModelMain: result.data.textModelMain || '',
        textModelSmall: result.data.textModelSmall || '',
        defaultAiProvider: result.data.defaultAiProvider || 'opencode_go',
        openaiBaseUrl: result.data.openaiBaseUrl || '',
        openaiModel: result.data.openaiModel || '',
        visionProvider: result.data.visionProvider || 'gemini',
        visionModel: result.data.visionModel || '',
        googleWalletSet: !!result.data.googleWalletSet,
        googleWalletIssuerId: result.data.googleWalletIssuerId || '',
        googleWalletCredentialsInput: '', // nunca se precarga: el JSON no vuelve
      })
    }
    const pa = await api.getPlatformAssistant()
    if (pa.success) setPlatformAssistant(!!pa.data?.enabled)
  }, [])

  const fetchChatbotTenants = useCallback(async () => {
    setIsLoadingChatbotTenants(true)
    const result = await api.getSuperadminChatbotTenants()
    if (result.success && result.data) setChatbotTenants(result.data as any[])
    setIsLoadingChatbotTenants(false)
  }, [])

  useEffect(() => {
    fetchIntegrations()
    fetchChatbotTenants()
  }, [fetchIntegrations, fetchChatbotTenants])

  const handleSaveIntegrations = async () => {
    setIsSavingIntegrations(true)
    // Mapear campos "Input" a los nombres que espera el backend
    const payload = {
      ...integrations,
      cloudinaryApiKey: integrations.cloudinaryApiKeyInput || undefined,
      cloudinaryApiSecret: integrations.cloudinaryApiSecretInput || undefined,
      // Solo se manda si el admin pegó algo (si no, no se toca lo guardado)
      googleWalletCredentials: integrations.googleWalletCredentialsInput?.trim() || undefined,
    }
    const result = await api.updateSuperadminIntegrations(payload)
    if (result.success) {
      clearCloudinaryCache()
      // Limpiar el textarea y refrescar el estado "configurada"
      setIntegrations(p => ({ ...p, googleWalletCredentialsInput: '' }))
      fetchIntegrations()
      setIntegrationsMsg({ type: 'ok', text: 'Integraciones guardadas correctamente' })
    } else {
      setIntegrationsMsg({ type: 'error', text: result.error || 'Error al guardar' })
    }
    setIsSavingIntegrations(false)
    setTimeout(() => setIntegrationsMsg(null), 4000)
  }

  const toggleAssistant = async () => {
    setTogglingAssistant(true)
    const next = !platformAssistant
    const r = await api.setPlatformAssistant(next)
    if (r.success) setPlatformAssistant(next)
    setTogglingAssistant(false)
  }

  const handleToggleChatbot = async (tenantId: string, currentEnabled: boolean) => {
    setTogglingTenantId(tenantId)
    const result = await api.toggleChatbotForTenant(tenantId, !currentEnabled)
    if (result.success) {
      setChatbotTenants(prev => prev.map(t => t.id === tenantId ? { ...t, chatbotEnabled: !currentEnabled } : t))
      toast.success(!currentEnabled ? 'Chatbot activado' : 'Chatbot desactivado')
    } else {
      toast.error('Error al actualizar el chatbot')
    }
    setTogglingTenantId(null)
  }

  // Trae la AI key en claro bajo demanda (solo al pulsar "ver") y la pone en el campo.
  const revealKey = async (provider: 'gemini' | 'openai' | 'groq' | 'opencode_go') => {
    const field = provider === 'gemini' ? 'geminiApiKey' : provider === 'openai' ? 'openaiApiKey' : provider === 'groq' ? 'groqApiKey' : 'opencodeGoApiKey'
    const r = await api.revealIntegrationKey(provider)
    if (r.success && r.data) setIntegrations(prev => ({ ...prev, [field]: (r.data as any).key }))
  }

  return {
    integrations, setIntegrations, revealKey,
    showGeminiKey, setShowGeminiKey,
    showOpenAIKey, setShowOpenAIKey,
    showGroqKey, setShowGroqKey,
    showOpenCodeGoKey, setShowOpenCodeGoKey,
    showUploadPreset, setShowUploadPreset,
    isSavingIntegrations, integrationsMsg, handleSaveIntegrations,
    platformAssistant, togglingAssistant, toggleAssistant,
    chatbotTenants, isLoadingChatbotTenants, togglingTenantId,
    fetchChatbotTenants, fetchIntegrations, handleToggleChatbot,
  }
}
