# CLAUDE.md — Lopbuk

> Archivo cargado automáticamente por Claude Code al inicio de cada sesión.  
> El cerebro completo del proyecto vive en **`daimuz/`**.

---

## 🧠 Primer paso siempre

```
1. Lee daimuz/DAIMUZ.md          → índice maestro del proyecto
2. Lee el módulo específico       → daimuz/modules/[modulo]/[modulo].md
3. Lee el archivo a modificar
4. Lee el flujo si aplica         → daimuz/flows/
```

---

## ⚡ Stack (resumen)

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind · shadcn/ui · Zustand 5 |
| Backend | Node.js · Express 4 · TypeScript · MySQL2 · Socket.io · JWT |
| Auth | JWT + httpOnly cookie + Google OAuth |
| Multi-tenant | `tenant_id` en todas las tablas de negocio |

---

## 📐 Reglas que nunca se rompen

1. **Lógica solo en `*.service.ts`** — nunca en controllers ni routes
2. **Siempre filtrar por `tenant_id`** en queries — `WHERE tenant_id = ?`
3. **`tenant_id` viene de `req.user.tenantId`** (JWT) — nunca del body
4. **Soft delete** — `is_active = 0`, nunca `DELETE` físico en datos de negocio
5. **Respuestas API** — `{ success: true, data }` / `{ success: false, error }`
6. **Errores** — `throw new AppError('mensaje', httpCode)` en services
7. **No tocar sin preguntar:** schema DB · auth middleware · config files

---

## 🧩 Dónde está cada cosa

| Necesito saber... | Leo... |
|---|---|
| Estado del proyecto hoy | `daimuz/memory/current-state.md` |
| Resumen rápido de un módulo | `daimuz/modules/[modulo]/compressed.md` |
| Detalles de un módulo | `daimuz/modules/[modulo]/[modulo].md` |
| Qué módulos existen | `daimuz/indexes/modules-index.md` |
| Todos los endpoints API | `daimuz/indexes/endpoints-index.md` |
| Todas las tablas DB | `daimuz/indexes/db-tables-index.md` |
| Archivos críticos del código | `daimuz/indexes/files-index.md` |
| Impacto al cambiar un módulo | `daimuz/synapses/ops-chain.md` (o gastrobar/delivery/saas) |
| Qué ES una entidad (Sale, Order...) | `daimuz/ontology/entities.md` |
| Reglas que nunca se rompen | `daimuz/governance/universal-constraints.md` |
| Cómo es la arquitectura | `daimuz/architecture/overview.md` |
| Sprint y trabajo activo | `daimuz/context/current-sprint.md` |
| Backlog | `daimuz/context/pending.md` |
| Reglas de negocio por módulo | `daimuz/vault/business-rules.md` |

---

## 💾 Sistema de memoria

**Toda la memoria vive en `daimuz/`** — no en `~/.claude/projects/.../memory/`.

| Qué guardar | Dónde |
|---|---|
| Cambios de hoy | `daimuz/memory/current-state.md` + `daimuz/memory/changelog.md` |
| Feature terminado | `daimuz/memory/completed-features.md` |
| Bug resuelto | `daimuz/memory/important-fixes.md` |
| Lección / feedback | `daimuz/memory/lessons-learned.md` |
| Sprint activo | `daimuz/context/current-sprint.md` |

---

## 🔚 Último paso siempre (cierre de sesión)

Al terminar cualquier sesión de trabajo significativa, ejecutar este prompt:

```
Actualiza los archivos DAIMUZ relevantes basándote en lo que hicimos hoy:
- memory/current-state.md   → qué cambió, qué funciona ahora
- memory/changelog.md       → entrada con fecha de hoy
- context/current-sprint.md → qué hice, qué falta
- memory/lessons-learned.md → si aprendimos algo nuevo
- memory/completed-features.md → si terminamos un feature
```

> **Por qué:** La memoria de DAIMUZ solo vale si se actualiza. Este prompt convierte el mantenimiento en 1 acción, no en disciplina manual.
