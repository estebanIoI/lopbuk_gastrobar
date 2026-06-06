# 📍 Sprint / Foco Actual

> Actualiza este archivo al inicio de cada sesión de trabajo.

## Sprint activo: Mayo–Junio 2026

### Objetivo del sprint
Completar el ecosistema del agente IA multicanal (Fases 3 y 4).

### Estado de fases IA

| Fase | Estado | Próximo paso |
|---|---|---|
| Fase 1 — RAG + Function Calling | ✅ Completo | — |
| Fase 2 — WhatsApp (Evolution API) | ✅ Completo | Conectar servidor Dokploy |
| Fase 3 — Voz IA (Vapi) | ⬜ Pendiente | Crear `voice/vapi.routes.ts` |
| Fase 4 — Panel Admin del Agente | ⬜ Pendiente | Crear `app/agente/page.tsx` |
| Fase 5 — n8n automatizaciones | ⬜ Pendiente | Después de Fase 4 |
| Fase 6 — Gemini Live + Qdrant | ⬜ Futuro | — |

### Sesión [2026-06-06]
- ✅ **Build TypeScript verde** — corregidos 68 errores (`tsc --noEmit`): 53 frontend (8 archivos) + 15 backend (4 archivos). Ver changelog `[2026-06-06]`.
- ✅ Nuevo stub `backend/src/modules/alegra/alegra.service.ts` (desbloquea import dinámico en `orders.routes.ts`).
- ⏳ Pendiente: implementar `POST /customers/bulk` (backend) e integración real de Alegra.
- ⚠️ Limpiar 2 archivos vacíos generados al verificar: `frontend/.fe_check.log` y `backend/.be_check.log`.

### Sesión [2026-05-28]
- ✅ **SQL v3.8 sincronizado** — Migración agrega `categories.is_active/color/sort_order` + `rb_gastos/rb_ingresos_diarios/rb_gastos_fijos`
- ✅ **DAIMUZ auditado** — files-index, modules-index, endpoints-index, db-tables-index completos al 100%; neurona `restbar-finanzas`; lib/ completada; integrations.md corregida; ontology roles corregidos; pending actualizado

### Sesión [2026-05-27]
- ✅ **Tracker Financiero Gastrobar** — tab "Finanzas" (admin-only): gastos variables, ingresos diarios, gastos fijos, resumen quincenal P&L
- ✅ **Categorías CRUD completo** — PUT /:id + PATCH /:id/visibility, color picker, sort_order
- ✅ **División igualitaria de cuenta** — `cajero-panel.tsx`: N personas, monto automático, grid 2–10
- ✅ READMEs actualizados, `README copy.md` eliminado
- ✅ `CLAUDE.md` creado — Claude usa `daimuz/` como memoria
- ✅ **DAIMUZ v3** — governance, 22 compressed.md, synapses, ontology, indexes

### Sesión anterior (agente IA)
- ✅ `agent.service.ts` — `isProductQuery()`: productos solo se sugieren cuando el mensaje lo pide explícitamente
- ✅ `whatsapp.service.ts` — `setWebhook` corregido al formato plano de Evolution API v2
- ✅ `.env` — documentación de variables Evolution API

### Infraestructura pendiente de configurar
- [ ] Desplegar Evolution API en Dokploy (Compose → repo devalexcode/shell-evolution-api)
- [ ] Completar `.env` backend: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `API_BASE_URL`
- [ ] Agregar `VAPI_API_KEY` cuando se active Fase 3

### Archivos activos
- `backend/src/modules/agent/agent.service.ts`
- `backend/src/modules/agent/agent.rag.ts`
- `backend/src/modules/agent/agent.tools.ts`
- `backend/src/modules/whatsapp/whatsapp.routes.ts`
- `backend/src/modules/whatsapp/whatsapp.service.ts`
- `backend/src/modules/chatbot/chatbot.routes.ts`

---

## Template para nueva sesión

```markdown
## [YYYY-MM-DD]

### Objetivo de hoy
[qué quiero lograr]

### Archivos que voy a tocar
- [archivo 1]
- [archivo 2]

### Resultado
[qué logré al final]
```

---

← [[context/pending]] | [[DAIMUZ]] | → [[context/environment]]
