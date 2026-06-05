# 🧠 DAIMUZ — Guía de Replicación en Cualquier Proyecto

> Cómo instalar este sistema de memoria cognitiva en un proyecto nuevo.  
> Medido en Lopbuk: reduce el tiempo de implementación de ~45 min → ~18 min por sesión.

---

## ¿Qué es DAIMUZ?

Un **cerebro de proyecto** que vive en `daimuz/` — una carpeta Obsidian vault que Claude lee antes de tocar código. Reemplaza la exploración ciega de archivos con navegación O(1) por contexto.

```
Sin DAIMUZ:  Claude lee 8-12 archivos para orientarse → 15-20 min perdidos
Con DAIMUZ:  Claude lee 3 archivos y ya sabe dónde tocar → directo a implementar
```

---

## Estructura completa

```
PROYECTO_ROOT/
│
├── CLAUDE.md                        ← 🔑 ENTRADA OBLIGATORIA (en el root)
│
└── daimuz/
    ├── DAIMUZ.md                    ← índice maestro, primer archivo que lee Claude
    │
    ├── indexes/                     ← O(1) navigation
    │   ├── modules-index.md         → todos los módulos en 1 línea cada uno
    │   ├── endpoints-index.md       → todos los endpoints REST ultra-compactos
    │   ├── db-tables-index.md       → todas las tablas y columnas clave
    │   └── files-index.md           → archivos críticos y ubicación exacta
    │
    ├── modules/                     ← 1 carpeta por módulo
    │   └── [modulo]/
    │       ├── compressed.md        → 5 líneas de triage rápido ← EL MÁS IMPORTANTE
    │       ├── [modulo].md          → documentación completa
    │       └── [subtema].md         → extra si el módulo es complejo
    │
    ├── memory/                      ← memoria episódica viva
    │   ├── current-state.md         → qué funciona hoy, últimos cambios
    │   ├── changelog.md             → historial de cambios por fecha + métricas
    │   ├── completed-features.md    → qué está 100% terminado
    │   ├── lessons-learned.md       → lecciones + datos medidos de rendimiento
    │   ├── important-fixes.md       → bugs críticos resueltos
    │   └── bugs-history.md          → problemas abiertos o históricos
    │
    ├── governance/                  ← reglas absolutas
    │   ├── universal-constraints.md → las reglas que nunca se rompen
    │   ├── why-decisions.md         → por qué existen esas reglas
    │   ├── update-protocol.md       → cuándo actualizar cada parte de daimuz
    │   └── api-standards.md         → convenciones REST: respuestas, errores, paginación
    │
    ├── synapses/                    ← mapas de impacto entre módulos
    │   └── [cadena]-chain.md        → si cambio A, qué afecta en B, C, D
    │
    ├── ontology/
    │   └── entities.md              ← definición semántica de cada entidad
    │
    ├── architecture/
    │   ├── overview.md
    │   ├── frontend.md
    │   ├── backend.md
    │   ├── database.md
    │   └── deployment.md            → entornos, variables, deploy checklist
    │
    ├── context/                     ← estado vivo del trabajo activo
    │   ├── current-sprint.md        → en qué trabajo esta semana
    │   ├── pending.md               → backlog priorizado
    │   ├── environment.md           → variables, servicios, puertos
    │   └── roles/
    │       └── roles-map.md         → roles del sistema y sus permisos por módulo
    │
    ├── brain/                       ← ADN del proyecto
    │   ├── identity.md              → qué es el proyecto y para quién
    │   ├── philosophy.md            → por qué está construido así
    │   ├── coding-standards.md      → cómo se escribe el código
    │   ├── ai-behavior.md           → cómo hablarle a Claude
    │   ├── naming-conventions.md    → convenciones de nombres
    │   ├── daimuz-replication.md    → este archivo: guía para replicar DAIMUZ
    │   └── patterns/
    │       └── module-pattern.md    → patrón estándar de módulo
    │
    ├── flows/                       ← flujos end-to-end
    │   └── [nombre]-flow.md         → pasos de un proceso completo
    │
    ├── decisions/                   ← ADRs (Architecture Decision Records)
    │   └── [decision].md            → qué, por qué, alternativas descartadas
    │
    ├── prompts/                     ← plantillas de prompts para Claude
    │   ├── new-feature.md
    │   ├── new-module.md
    │   ├── bug-fix.md
    │   └── code-review.md
    │
    └── vault/                       ← conocimiento de referencia
        ├── api-routes.md            → todos los endpoints detallados
        ├── business-rules.md        → reglas de negocio por módulo
        ├── glossary.md              → términos del dominio
        ├── integrations.md          → docs de APIs externas
        ├── external-resources.md    → links y recursos externos del proyecto
        └── stack/
            └── tech-stack.md        → decisiones y versiones del stack tecnológico
```

---

## El gancho — `CLAUDE.md` en el root

**Archivo más importante.** Sin él, Claude no sabe que existe el cerebro.

```markdown
# CLAUDE.md

## 🧠 Primer paso siempre

1. Lee daimuz/DAIMUZ.md          → índice maestro del proyecto
2. Lee el módulo específico       → daimuz/modules/[modulo]/compressed.md
3. Lee el archivo a modificar
4. Lee el flujo si aplica         → daimuz/flows/

## ⚡ Stack (resumen rápido)
| Capa | Tecnología |
|---|---|
| Frontend | [stack] |
| Backend  | [stack] |
| BD       | [stack] |

## 📐 Reglas que nunca se rompen
1. [regla más importante del proyecto]
2. [regla de seguridad]
3. [regla de arquitectura]

## 💾 Sistema de memoria
Toda la memoria vive en daimuz/ — no en ~/.claude/
```

---

## El archivo más importante — `compressed.md`

Cada módulo **debe** tener este archivo. Es el que más ahorra tiempo.

```markdown
# [Módulo] — Compressed

**Qué hace:** [1 línea que explica todo]
**Tablas:** `tabla1` · `tabla2`
**Endpoints clave:** `GET /ruta` · `POST /ruta/:id`
**Archivos:** `backend/src/modules/x/x.service.ts` · `frontend/components/x.tsx`
**⚠️ Regla crítica:** [la cosa más importante que NO debes olvidar]
```

Este archivo hace que Claude llegue al archivo correcto sin leer 5 archivos intermedios.

---

## Orden de lectura de Claude

```
CLAUDE.md (root)
    ↓
daimuz/DAIMUZ.md                 ← mapa del cerebro
    ↓
daimuz/memory/current-state.md   ← ¿dónde estamos hoy?
    ↓
daimuz/indexes/modules-index.md  ← ¿en qué módulo está lo que busco?
    ↓
daimuz/modules/[X]/compressed.md ← ¿qué archivos tocar? ¿qué regla hay?
    ↓
el archivo real del código        ← ahora sí, a implementar
```

---

## Mínimo viable — 6 archivos para empezar

```
daimuz/
├── DAIMUZ.md
├── indexes/modules-index.md
├── memory/current-state.md
├── governance/universal-constraints.md
├── context/current-sprint.md
└── modules/[primer-modulo]/compressed.md

+ CLAUDE.md en el root del proyecto
```

Los demás se van creando **mientras construyes** el proyecto.

---

## Script de replicación — estructura completa en 1 comando

```bash
# Crear toda la estructura de carpetas
mkdir -p daimuz/{indexes,modules,memory,governance,synapses,ontology,architecture,context/roles,brain/patterns,flows,decisions,prompts,vault/stack}

# Crear los 6 archivos MVP
touch daimuz/DAIMUZ.md
touch daimuz/indexes/modules-index.md
touch daimuz/memory/current-state.md
touch daimuz/governance/universal-constraints.md
touch daimuz/context/current-sprint.md
touch CLAUDE.md

# Por cada módulo del proyecto:
# mkdir daimuz/modules/[nombre]
# touch daimuz/modules/[nombre]/compressed.md
```

---

## Templates de los archivos core del MVP

### `memory/current-state.md`

```markdown
# Estado Actual — [Proyecto]

> Última actualización: [fecha]

## ✅ Funcionando al 100%
- [módulo]: [qué hace]

## 🔧 En desarrollo activo
- [módulo]: [qué falta]

## 📋 Cambios recientes
- [[fecha]] [descripción del cambio]
```

### `governance/universal-constraints.md`

```markdown
# Reglas que Nunca se Rompen

1. **[Regla de lógica]** — [dónde va la lógica y dónde NO]
2. **[Regla de seguridad]** — [tenant_id, auth, etc.]
3. **[Regla de datos]** — [soft delete, integridad, etc.]
4. **[Regla de respuestas]** — [formato de API]
5. **[Regla de errores]** — [cómo se lanzan y manejan]

## ⛔ Nunca tocar sin preguntar
- [schema DB / auth middleware / config crítico]
```

### `context/current-sprint.md`

```markdown
# Sprint Activo — [mes/año]

**Objetivo:** [qué se quiere lograr esta semana]

## Tareas activas
- [ ] [tarea 1]
- [ ] [tarea 2]

## Sesión [fecha]
- ✅ [completado]
- ⬜ [pendiente]

## Archivos que se están editando
- `[ruta/al/archivo.ts]`
```

---

## Protocolo de mantenimiento

| Cuándo | Qué hacer |
|---|---|
| Al terminar una sesión | Actualizar `memory/current-state.md` + `memory/changelog.md` |
| Al terminar un feature | Añadir a `memory/completed-features.md` |
| Al resolver un bug | Añadir a `memory/important-fixes.md` y `memory/bugs-history.md` |
| Al crear un módulo | Crear `modules/[modulo]/compressed.md` antes del código |
| Al aprender algo | Añadir a `memory/lessons-learned.md` con datos medidos |

**Regla de oro:** Si en la próxima sesión Claude necesitará saber algo, escríbelo ahora.

### Automatización del cierre de sesión

En vez de actualizar manualmente, usar este prompt al final de cada sesión:

```
Actualiza los archivos DAIMUZ relevantes basándote en lo que hicimos hoy:
memory/current-state.md, memory/changelog.md, context/current-sprint.md,
memory/lessons-learned.md (si aplica), memory/completed-features.md (si aplica).
```

---

## Niveles de módulo — Anti sobre-ingeniería

No todo módulo necesita documentación completa. Elegir el tier según complejidad:

| Tier | Módulos típicos | Archivos a crear |
|---|---|---|
| **micro** | scanner, media-library, sync, printers | `compressed.md` solo |
| **standard** | coupons, reviews, novedades, fleet | `compressed.md` + `[modulo].md` |
| **full** | sales, inventory, auth, orders, delivery | `compressed.md` + `[modulo].md` + flujo |

**Usar el script:** `bash daimuz/scripts/new-module.sh`  
→ Pregunta el tier y crea solo los archivos necesarios, con templates pre-rellenados.

---

## Métricas medidas en Lopbuk (2026-05-27)

Primera sesión completa con DAIMUZ v3 al 100/100:

| Métrica | Sin DAIMUZ | Con DAIMUZ |
|---|---|---|
| Tiempo total por feature | ~45 min | ~18 min |
| Files leídos para orientarse | 8-12 | 3 |
| Backtracking | Frecuente | 0 |
| Bugs detectados antes de runtime | Raro | ✅ 1 detectado en pre-lectura |

**Ahorro: ~60% del tiempo de implementación.**

---

← [[ai-behavior]] | [[DAIMUZ]] | → [[coding-standards]]


pendiente: Si agregas una capa de **Tasks**, una capa de **Agents** y un **Knowledge Graph explícito**, estarías muy cerca de lo que hoy están construyendo los equipos más avanzados que trabajan con Claude Code, Cursor, agentes MCP y flujos multiagente sobre repositorios grandes.
Si comparo DAIMUZ con lo que veo actualmente en:

- Claude Code
- Cursor
- Windsurf
- OpenCode
- comunidades Reddit de Agentic Coding
- repositorios públicos avanzados

tu diseño está aproximadamente en el **top 10-15%** de las arquitecturas de memoria para IA que se están usando hoy.

Sin embargo, si lo optimizas hacia:

- menos índices duplicados,
- más Skills,
- más Specs,
- más ADRs,
- hooks automatizados,
- documentación cargada bajo demanda,

podría convertirse fácilmente en un sistema de nivel **9.5/10**, muy cercano a las arquitecturas que están usando equipos que desarrollan productos grandes con Claude Code y agentes especializados.