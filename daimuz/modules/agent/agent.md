# 🤖 Módulo: Agent IA (Asesor y Cerrador de Ventas)

## Qué hace
Agente conversacional multicanal con RAG dinámico y function calling.
Responde preguntas del negocio, crea reservas, registra leads, sugiere productos
y **cierra pedidos con validación real de stock, variantes, envío y consentimiento**.
Funciona en **chat web**, **WhatsApp** y (próximamente) **voz telefónica**.

## 🆕 [2026-07-02] Upgrade "Chat Vendedor" (6 capacidades)

1. **Variantes con disponibilidad real**: la búsqueda RAG adjunta tallas/colores con
   `stock - reserved_stock` (incluye productos con stock=0 en el padre pero variantes vivas).
   El prompt muestra opciones y marca "(agotada)" / "(¡quedan N!)" con datos reales.
2. **`registrar_pedido` blindado**: match de producto con recorte progresivo del texto
   ("Body Siso GRIS JASPEADO" → resuelve producto + variante), pide la opción si es ambigua,
   valida stock (simple) y **reserva atómica** de variantes (`reserveForPublicOrder`, con
   release si el pedido falla), envío real (`cart_delivery_fee`/`cart_min_purchase` → gratis
   sobre el mínimo), cupón validado server-side (`resolveCouponDiscount`) y **consentimiento
   Ley 1581** (`consent_records` + `consent_id` en la orden).
3. **Palancas de cierre en el prompt**: ofertas activas (`is_on_offer`), cupones vigentes
   (`discount_coupons`), umbral de envío gratis y **upsell** con el order bump del comercio
   (UN complemento tras la decisión, una sola vez). Sección de **objeciones** con datos
   (contra entrega = riesgo cero, urgencia solo con stock real).
4. **Cliente recurrente**: si la sesión tiene teléfono, ve nombre + resumen de su última compra
   → saluda por nombre y ofrece "¿misma dirección?" (la dirección se resuelve server-side con
   `direccion: "misma"`; nunca va al LLM — privacidad).
5. **Quick replies**: el modelo emite `[[opciones: A|B|C]]`; el pipeline lo extrae y lo devuelve
   como `suggestedReplies` (chips en el widget; en WhatsApp el marcador se elimina).
6. **Panel de conversaciones + takeover** (`chatbot-conversations.tsx` en el tab Chatbot):
   el comerciante lee las conversaciones, activa "Atender yo" (silencia el bot) y responde
   manual — al widget web por polling (`/chatbot/session-updates`) y a WhatsApp por Evolution.

## Archivos

```
backend/src/modules/agent/
  ├── agent.service.ts     — Pipeline central (channel-agnostic): RAG + Gemini + tools
  ├── agent.rag.ts         — Contexto dinámico desde BD: horario, categorías, servicios
  └── agent.tools.ts       — Function declarations + ejecutores de herramientas
```

## APIs del agente
```
POST /api/chatbot/message          → Mensaje web (público, por slug)
GET  /api/chatbot/status/:slug     → Estado del chatbot (público)
GET  /api/chatbot/config           → [auth] Ver config
PUT  /api/chatbot/config           → [auth] Guardar config
GET  /api/chatbot/notifications    → [auth] Notificaciones del comerciante

POST /api/whatsapp/webhook/:slug   → Webhook Evolution API (público)
GET  /api/whatsapp/status          → [auth] Estado conexión WA
POST /api/whatsapp/connect         → [auth] Conectar instancia + QR
DELETE /api/whatsapp/disconnect    → [auth] Desconectar
GET  /api/whatsapp/qr              → [auth] Refrescar QR
```

## Herramientas del agente (Function Calling — Gemini)

| Herramienta | Qué hace | Habilitada cuando |
|---|---|---|
| `verificar_disponibilidad_reserva` | Slots libres en `rb_reservations` | `reservations_enabled = 1` |
| `crear_reserva` | INSERT en `rb_reservations` + notifica al comerciante | `reservations_enabled = 1` |
| `registrar_interes_cliente` | Guarda nombre/tel en sesión + notifica | Siempre |

## Flujo del pipeline

```
mensaje (web / WA / voz)
  ↓
getOrCreateSession()          → chatbot_sessions
  ↓
isHumanTakeover?              → si true, no responde
  ↓
processAgentMessage()
  ├── isProductQuery(msg)?    → solo busca productos si hay intención de compra
  ├── buildDynamicContext()   → store_info, categories, services, reservations config
  ├── buildEnrichedSystemPrompt()
  └── callGeminiWithTools()
        ├── Gemini devuelve texto → reply directo
        └── Gemini hace function call → executeAgentTool() → 2da llamada Gemini
  ↓
saveMessage()                 → chatbot_messages
  ↓
respuesta al canal (HTTP / Evolution API)
```

## Tablas de BD

| Tabla | Uso |
|---|---|
| `chatbot_config` | Config por tenant: bot_name, system_prompt, faqs, agent_tools, whatsapp_enabled, evolution_instance |
| `chatbot_sessions` | Sesión por cliente: channel (web/whatsapp/voice), human_takeover, customer_phone |
| `chatbot_messages` | Historial de conversación (últimos 10 mensajes usados como contexto) |
| `agent_actions` | Log de cada tool call: tool_name, tool_input, tool_output, success |
| `merchant_notifications` | Notificaciones al comerciante (nueva reserva, nuevo lead) |

## Estado de fases

| Fase | Estado |
|---|---|
| Fase 1 — RAG + Function Calling (reservas, leads) | ✅ Completo |
| Fase 2 — WhatsApp con Evolution API | ✅ Completo |
| Fase 3 — Voz IA (Vapi) | ⬜ Pendiente |
| Fase 4 — Panel de administración del agente | ⬜ Pendiente |
| Fase 5 — n8n automatizaciones | ⬜ Pendiente |
| Fase 6 — Gemini Live + Qdrant (escalado) | ⬜ Futuro |

## Plan Fase 3 — Voz IA (Vapi)

**Archivos a crear:**
```
backend/src/modules/voice/
  ├── vapi.routes.ts    — POST /api/voice/vapi/call + end + GET/PUT /api/voice/config
  └── vapi.service.ts   — CRUD assistants/phone numbers con API de Vapi
```

**Lógica webhook `/call`:**
```
body.call.to (número llamado) → buscar tenant
→ getOrCreateSession(callId, tenantId, { channel: 'voice' })
→ processAgentMessage() con system prompt corto (máx 2 oraciones)
→ res.json({ response: { message: reply } })
```

**Migración SQL:**
```sql
ALTER TABLE chatbot_config
  ADD COLUMN IF NOT EXISTS voice_enabled     TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vapi_phone_id     VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS voice_language    VARCHAR(20) NOT NULL DEFAULT 'es-CO';
```

**Variables de entorno a agregar:**
```
VAPI_API_KEY=sk-vapi-...
VAPI_WEBHOOK_SECRET=...
```

**Config en Vapi Dashboard:**
```
1. Crear Assistant → Model: Gemini 2.5 Flash, Voice: Google Journey (es-US)
   Server URL: https://api.tudominio.com/api/voice/vapi/call
   End call URL: https://api.tudominio.com/api/voice/vapi/end
2. Comprar número de teléfono en Vapi
3. Asignar número al assistant
4. Guardar vapi_assistant_id y vapi_phone_id en chatbot_config del tenant
```

**Estimación:** 3-4 días

## Plan Fase 4 — Panel Admin del Agente

**Páginas a crear:**
```
frontend/app/agente/page.tsx          — Hub con tabs
frontend/components/agent/
  ├── AgentConfig.tsx     — Configuración por canal (web / WhatsApp / voz)
  ├── AgentConversations.tsx  — Sesiones activas, botón "Tomar control"
  ├── AgentActions.tsx    — Historial de tool calls (agent_actions)
  └── AgentAnalytics.tsx  — KPIs: reservas creadas, leads, tasa escalación
```

**Endpoints nuevos en backend:**
```
GET  /api/agent/conversations         — sesiones paginadas
GET  /api/agent/conversations/:id     — historial completo
POST /api/agent/conversations/:id/takeover — marcar human_takeover=1
GET  /api/agent/actions               — agent_actions paginado
GET  /api/agent/analytics             — KPIs 30 días
```

**Estimación:** 1 semana

## Fix aplicado — mayo 2026
- `suggestedProducts` ya NO se envía en cada respuesta
- Se agregó `isProductQuery()` en `agent.service.ts`: solo busca productos
  cuando el mensaje contiene palabras de intención de compra
  (`precio`, `cuánto`, `menú`, `tienen`, `carta`, etc.)

## Dependencias
- [[modules/gastrobar-ops/gastrobar-ops]] — reservas rb_reservations
- [[modules/storefront/storefront]] — productos publicados
- [[modules/whatsapp/whatsapp]] — canal WhatsApp

---
← [[DAIMUZ]]
