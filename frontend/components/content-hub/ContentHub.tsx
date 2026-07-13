'use client'

import { useState } from 'react'
import {
  Eye, Settings2, ArrowLeft, UtensilsCrossed, MessageSquareText,
  FileText, Shield, Mail, Search, Layout
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { PageBuilder } from './PageBuilder'
import { RecipeList } from './RecipeList'
import { FaqManager } from './FaqManager'
import { ContentPageList } from './ContentPageList'
import { NewsletterManager } from './NewsletterManager'
import { PopularSearchesEditor } from './PopularSearchesEditor'
import { TrustBadgesEditor } from './TrustBadgesEditor'

interface ContentHubProps {
  onBack?: () => void
}

const CONTENT_TABS = [
  { id: 'recipes', label: 'Recetas', icon: UtensilsCrossed },
  { id: 'faq', label: 'FAQ', icon: MessageSquareText },
  { id: 'pages', label: 'Páginas', icon: FileText },
  { id: 'trust', label: 'Confianza', icon: Shield },
  { id: 'newsletter', label: 'Newsletter', icon: Mail },
  { id: 'searches', label: 'Búsquedas', icon: Search },
]

export function ContentHub({ onBack }: ContentHubProps) {
  const [mode, setMode] = useState<'visual' | 'content'>('visual')
  const [contentTab, setContentTab] = useState('recipes')

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Página Principal</h1>
          <p className="text-sm text-muted-foreground">Administra el contenido y apariencia de tu tienda</p>
        </div>
      </div>

      {/* Mode tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'visual' | 'content')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="glass">
            <TabsTrigger value="visual">
              <Layout className="h-4 w-4 mr-2" />
              Editor Visual
            </TabsTrigger>
            <TabsTrigger value="content">
              <Settings2 className="h-4 w-4 mr-2" />
              Gestionar Contenido
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Visual Editor */}
        {mode === 'visual' && <PageBuilder />}

        {/* Content Management */}
        {mode === 'content' && (
          <div>
            <Tabs value={contentTab} onValueChange={setContentTab}>
              <TabsList className="glass mb-4 flex-wrap h-auto py-1">
                {CONTENT_TABS.map(tab => {
                  const Icon = tab.icon
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="text-xs gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              <Card variant="glass" className="p-4">
                {contentTab === 'recipes' && <RecipeList />}
                {contentTab === 'faq' && <FaqManager />}
                {contentTab === 'pages' && <ContentPageList />}
                {contentTab === 'newsletter' && <NewsletterManager />}
                {contentTab === 'searches' && <PopularSearchesEditor />}
                {contentTab === 'trust' && <TrustBadgesEditor />}
              </Card>
            </Tabs>
          </div>
        )}
      </Tabs>
    </div>
  )
}
