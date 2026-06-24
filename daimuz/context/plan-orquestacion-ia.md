# Plan — Orquestación de IA (OpenCode Go como cerebro de texto + Visión que transcribe)

> Estado: propuesta (2026-06). Objetivo: que **OpenCode Go** (modelos abiertos baratos de
> texto/código) sea el **orquestador** de todo el contenido de texto (chatbots, Q&A, agente,
> rutina, generación), y que los **modelos de visión** se usen SOLO para convertir imágenes
> a texto y alimentar a los modelos de texto. Así se optimiza el consumo (la visión es cara;
> se hace una vez para extraer texto y el resto corre en modelos baratos).

---

## 0. Hechos que mandan en el diseño
- **OpenCode Go = solo texto/código.** Modelos: GLM-5.2/5.1, Kimi K2.7/K2.6, DeepSeek V4 Pro/Flash, MiMo V2.5/Pro, MiniMax M3/M2.7, Qwen3.7/3.6. **Ninguno ve imágenes.**
- Endpoints Go: `https://opencode.ai/zen/go/v1/chat/completions` (OpenAI-compat: GLM/Kimi/DeepSeek/MiMo) y `.../v1/messages` (Anthropic-compat: MiniMax/Qwen). Hoy el código usa el primero.
- Formato de id en config: `opencode-go/<model-id>` (ej. `opencode-go/deepseek-v4-flash`).
- **Visión** debe venir de OTRO proveedor multimodal: Gemini Flash (el más barato, ya cableado), OpenAI gpt-4o, o Groq Llama-4-Scout.
- Modelos Go **baratos** (ideales como `small_model`): DeepSeek V4 Flash y MiMo V2.5 ($0.14/$0.28 por 1M; ~150k req/mes). **Fuertes** (chat/agente complejo): GLM-5.2 / Kimi K2.7.
- Límites Go: $12/5h · $30/semana · $60/mes. Al toparse → caer a modelos gratuitos o a saldo Zen.
- Go cachea mucho contexto (52k–86k tokens en lectura barata): conviene **prefijo de system prompt estable** para maximizar cache-hits.

## 1. Estado actual (review)
- `getAIKeys()` (en `agent.service`): 4 proveedores (gemini/openai/groq/opencode_go) + `opencodeGoModel` + `defaultProvider` único con auto-fallback. Llaves en `platform_settings` (`ai_*_key`), cifradas (crypto AES-256).
- **Texto disperso:** `assistant.service`, `agent.service`, `daimuz-chat.routes`, `rutina.assistant`, `chatbot.routes` — cada uno repite el `if provider === ...` y arma su propia llamada.
- **Visión aislada:** `invoice-ocr.service` (Gemini/OpenAI/Groq vision). No hay un pipeline reutilizable "imagen→texto" para el chat/agente; solo OCR de facturas.
- No hay separación explícita **proveedor de texto vs proveedor de visión** (la visión reusa el `defaultProvider`, que si es `opencode_go` no ve imágenes → depende de fallback frágil).

## 2. Arquitectura objetivo — capa `ai-orchestrator`
Un único módulo `modules/ai/orchestrator.service.ts` con **roles** claros:

```
            ┌────────────── ai-orchestrator ──────────────┐
  texto  →  │  textLLM()   → OpenCode Go (default)         │
  imagen →  │  visionToText() → Gemini Flash (default)     │ → devuelve TEXTO
            │  run({text, images}) =  visión(imgs)→texto   │
            │     + textLLM(text + transcripción)          │
            └──────────────────────────────────────────────┘
```

- **`textLLM(messages, {tier})`** — llama a OpenCode Go (`/zen/go/v1/chat/completions`). `tier: 'small'|'main'` elige modelo (small=DeepSeek Flash/MiMo, main=GLM/Kimi). Fallback chain: Go → Groq → Gemini → OpenAI si falla o se topa el límite.
- **`visionToText(image)`** — manda la imagen al proveedor de visión y devuelve **texto** (descripción/OCR/estructura JSON). Cachea por hash de la imagen (no re-OCR la misma).
- **`run({ system, messages, images?, tier })`** — si hay imágenes: primero `visionToText` de cada una, inyecta `[IMAGEN: <transcripción>]` en el mensaje, y luego `textLLM`. Si no hay imágenes, va directo a `textLLM`. **Este es el corazón de la optimización.**

## 3. Configuración (separar texto y visión)
Nuevas claves en `platform_settings` (panel superadmin → IA):
- `ai_text_provider` (default `opencode_go`) · `ai_text_model_main` (`opencode-go/glm-5.2`) · `ai_text_model_small` (`opencode-go/deepseek-v4-flash`).
- `ai_vision_provider` (default `gemini`) · `ai_vision_model` (`gemini-flash-latest`).
- Mantener `ai_*_key` actuales. `getAIKeys()` se extiende para devolver el bloque de visión por separado.
- Regla: **visión NUNCA usa un modelo de Go** (validación al guardar).

## 4. Optimización de consumo (lo que pide el usuario)
1. **Imagen→texto una sola vez** + cache por hash → el resto del razonamiento corre en Go barato.
2. **Tiering**: tareas livianas (títulos, intención, clasificación, respuestas cortas de chatbot) → `small` (DeepSeek Flash/MiMo, casi gratis). Conversación/agente con tools → `main` (GLM/Kimi).
3. **Prefijo de system prompt estable** (catálogo, reglas, persona) para pegarle al cache de Go (lectura cacheada $0.0028–$0.26 vs entrada full).
4. **Compactación de historial**: resumir conversaciones largas con `small` antes de mandar a `main`.
5. **Guardas de límite**: contador de uso (5h/sem/mes); al acercarse → degradar `main`→`small` o caer a Groq gratis; avisar en superadmin.

## 5. Roadmap (slices)
- **IA1 · Orchestrator core**: ✅ `modules/ai/orchestrator.service.ts` con `textLLM(req)` (cadena de respaldo default→Groq→Gemini→OpenAI, honra maxTokens/temperature) + helper `textReply(system, message, history, opts)`. Migrado `runPublicAssistant` (asistente del portafolio) a `textReply` — se borró su switch de proveedor duplicado. Los call sites con tools (`runAssistant`/`runWithOpenAICompat`) siguen intactos (entran en IA4).
- **IA2 · Visión como rol**: ✅ `visionToText(img)` (imagen→texto; provider gemini→openai→groq; **cache por hash** en tabla `ai_vision_cache`, no re-OCR la misma imagen; defensivo, devuelve '' si falla) + `run({ system, message, images })` que hace **imagen→texto→Go** (transcribe cada imagen y razona todo con el modelo de texto barato). El `invoice-ocr` se queda como OCR especializado (JSON estructurado); la visión genérica vive en el orchestrator. **Pendiente:** cablear `run()` en call sites reales (chat con foto, AI Coach analizando progreso) → IA4.
- **IA3 · Config separada**: ✅ `getAIKeys()` ahora devuelve `visionProvider`/`visionModel` (lee `ai_vision_provider`/`ai_vision_model`; valida que **nunca sea Go** → cae a gemini). `visionToText` honra ese proveedor (orden: configurado → fallback por key; el modelo configurado solo aplica al proveedor elegido). Persistencia en `chatbot.routes` GET/PUT `superadmin/integrations`. UI: tarjeta **"Visión — Imagen a texto"** en IntegrationsTab (selector gemini/openai/groq + modelo + estado de key), `useIntegrations` y `api.ts` extendidos. **Pendiente futuro:** tier main/small de texto (entra en IA5).
- **IA4 · Migrar el resto**: ✅ Centralizada la selección de proveedor OpenAI-compat en `resolveTextProvider(keys)` (orchestrator). `daimuz-chat.llmCall` ya la usa (borrado su if-chain duplicado; Gemini sigue por su rama propia con function-calling). `agent.processAgentMessage`: rama no-Gemini → `textLLM` (import dinámico para evitar ciclo; Gemini conserva sus tools). **Pendiente:** `assistant.runAssistant`/`runWithOpenAICompat` (tool-calling) y `rutina.assistant` siguen sin migrar — requieren soporte de tools en el orchestrator (se evalúa en IA5/IA6).
- **IA5 · Tiering + cache prompt**: ✅ `getAIKeys()` devuelve `opencodeGoModelMain`/`opencodeGoModelSmall` (settings `ai_text_model_main`/`ai_text_model_small`; default main=modelo Go configurado, small=`deepseek-v4-flash`). `goModelFor(keys, {tier})` elige el modelo Go; `textLLM`/`textReply`/`run`/`resolveTextProvider` aceptan `tier`. Call sites marcados: `runPublicAssistant`=**small** (Q&A corto), chatbot de tienda y `daimuz-chat`=**main**. UI: campos main/small bajo OpenCode Go en IntegrationsTab (+ api.ts/useIntegrations/GET-PUT). **Cache de prompt:** el `system` ya va siempre como bloque líder estable (primer mensaje), que es lo que aprovecha el cache de Go; queda como guía mantener catálogo/persona al inicio del system. **Pendiente futuro:** compactar historial largo con `small` antes de `main`.
- **IA7 · Tools provider-agnóstico (agente)**: ✅ `agentLoop(req)` en el orchestrator: function-calling que funciona con **cualquier proveedor configurado** (OpenCode Go / OpenAI / Groq con formato OpenAI `tools`, y Gemini con `functionDeclarations`). El call site define sus tools en JSON-schema (tipos minúscula) + un `execute(name,args)` que ejecuta la acción real y devuelve texto; el orchestrator traduce el formato, corre el loop multi-ronda, aplica telemetría/tier/guardas y respaldo entre proveedores (sin doble ejecución: si ya se ejecutó una tool no cambia de proveedor). **AI Coach migrado** (`rutina.assistant`) y **asistente operador migrado** (`assistant.runPlatformAssistant`: Agente Maestro superadmin + asistente del comerciante): ninguno depende ya de Gemini; corren con la IA que el admin elija. `daimuz-chat` (operador del comercio) ya operaba con Go desde IA4. **Todos los agentes con function-calling pasan por el orchestrator unificado.**

- **IA6 · Guardas de límite + telemetría**: ✅ Tabla `ai_usage_log` (tenant, provider, model, tier, tokens, `est_cost`, ok). El orchestrator captura `usage` de cada proveedor (OpenAI-compat `usage`, Gemini `usageMetadata`), estima costo con tabla de tarifas y registra cada llamada (`logUsage`, best-effort). `getUsageStats()` calcula gasto en ventanas 5h/semana/mes (cache 60s). **Guarda** `limitGuard`: a ≥80% del tope degrada `main`→`small`; a ≥100% evita Go y cae a Groq/Gemini. Endpoint `GET /chatbot/superadmin/ai-usage` + tarjeta **"Consumo de IA"** en IntegrationsTab (barras por ventana + desglose por modelo). Telemetría también para visión (tier `'vision'`). **Plan IA completo.**

## 6. Riesgos / notas
- Go cambia su lista de modelos; leer `https://opencode.ai/zen/go/v1/models` para validar ids al guardar config.
- MiniMax/Qwen usan endpoint Anthropic-compat (`/messages`), distinto formato → si se quieren, el orchestrator necesita una rama `@ai-sdk/anthropic`. Por ahora quedarse en los OpenAI-compat (GLM/Kimi/DeepSeek/MiMo) simplifica.
- Visión: Gemini Flash es la opción más barata y ya está integrada; mantenerla como default de visión.
- Privacidad: Go es retención-cero (US/EU/Singapur). No mandar PII innecesaria; la transcripción de imagen debe omitir datos sensibles si no se requieren.

## 7. Por dónde empezar
**IA1 + IA2**: el orchestrator con `run({text, images})` que hace visión→texto→Go. Es el 80% del valor (centraliza + habilita el pipeline barato). El resto (config UI, migrar call sites, telemetría) entra después.
