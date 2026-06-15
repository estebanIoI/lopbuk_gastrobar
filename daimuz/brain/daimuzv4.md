🧠 DAIMUZ v4 — Sistema de Memoria, Contexto y Arnés de Agentes para Proyectos de Software

«Guía para instalar DAIMUZ en cualquier proyecto y convertirlo en un cerebro operativo para Claude Code, Cursor, Windsurf, OpenCode, agentes MCP o flujos multiagente.
Objetivo: reducir exploración innecesaria, mejorar continuidad entre sesiones y permitir trabajo autónomo supervisado sobre repositorios grandes.»

---

1. ¿Qué es DAIMUZ?

DAIMUZ es un sistema de memoria cognitiva para proyectos de software.

No es solo documentación. Es un arnés de contexto que le permite a un agente de IA entender rápidamente:

- qué es el proyecto,
- cómo está organizado,
- qué reglas no debe romper,
- qué módulos existen,
- qué archivos debe tocar,
- qué decisiones arquitectónicas ya se tomaron,
- qué tareas están activas,
- qué bugs ya fueron resueltos,
- qué flujos afectan a otros módulos,
- y cómo debe actuar dentro del repositorio.

DAIMUZ vive dentro de una carpeta llamada:

daimuz/

Y se activa mediante un archivo obligatorio en la raíz:

CLAUDE.md

La idea central es simple:

Sin DAIMUZ:
El agente explora 8-12 archivos para orientarse.
Pierde tiempo leyendo estructura, rutas, convenciones y reglas.

Con DAIMUZ:
El agente lee 3-5 archivos clave.
Entiende el contexto, localiza el módulo y actúa con menos riesgo.

DAIMUZ convierte el proyecto en un sistema navegable por contexto, no en un conjunto desordenado de archivos.

---

2. Principio base

«El agente no debe descubrir el proyecto desde cero en cada sesión.
Debe cargar un mapa mínimo, consultar contexto bajo demanda y actuar dentro de reglas verificables.»

DAIMUZ se basa en 7 principios:

1. Contexto mínimo inicial
   El agente solo debe leer lo necesario para empezar.

2. Carga bajo demanda
   La documentación extensa se abre solo cuando el módulo o tarea lo requiere.

3. Memoria viva
   Lo aprendido en una sesión se guarda para la siguiente.

4. Reglas explícitas
   Las restricciones críticas no deben quedar ocultas en el código.

5. Navegación O(1)
   El agente debe saber qué archivo tocar sin recorrer todo el proyecto.

6. Trazabilidad de decisiones
   Las decisiones importantes deben quedar registradas como ADRs.

7. Autonomía supervisada
   El agente puede avanzar solo en tareas seguras, pero debe pedir aprobación para acciones críticas.

---

3. DAIMUZ no reemplaza al README

El "README.md" explica el proyecto para humanos.

DAIMUZ explica el proyecto para agentes.

Archivo| Público objetivo| Propósito
"README.md"| Humanos| Instalar, ejecutar y entender el proyecto
"CLAUDE.md"| Agente IA| Reglas iniciales y ruta de lectura
"daimuz/DAIMUZ.md"| Agente IA| Índice maestro del cerebro del proyecto
"daimuz/modules/*"| Agente IA| Contexto operativo por módulo
"daimuz/memory/*"| Agente IA + equipo| Estado vivo del proyecto
"daimuz/governance/*"| Agente IA + equipo| Reglas que no se deben romper

---

4. Estructura recomendada

PROYECTO_ROOT/
│
├── CLAUDE.md
│
├── .claude/
│   ├── skills/
│   │   ├── new-feature/
│   │   │   └── SKILL.md
│   │   ├── bug-fix/
│   │   │   └── SKILL.md
│   │   ├── code-review/
│   │   │   └── SKILL.md
│   │   └── update-daimuz/
│   │       └── SKILL.md
│   │
│   ├── hooks/
│   │   ├── session-start.sh
│   │   ├── pre-tool-use.sh
│   │   ├── post-tool-use.sh
│   │   └── session-end.sh
│   │
│   └── rules/
│       ├── frontend.md
│       ├── backend.md
│       ├── database.md
│       └── security.md
│
└── daimuz/
    ├── DAIMUZ.md
    │
    ├── indexes/
    │   ├── modules-index.md
    │   ├── endpoints-index.md
    │   ├── db-tables-index.md
    │   ├── files-index.md
    │   └── tasks-index.md
    │
    ├── modules/
    │   └── [modulo]/
    │       ├── compressed.md
    │       ├── [modulo].md
    │       ├── specs.md
    │       └── tests.md
    │
    ├── tasks/
    │   ├── active/
    │   │   └── TASK-[id].md
    │   ├── completed/
    │   │   └── TASK-[id].md
    │   ├── blocked/
    │   │   └── TASK-[id].md
    │   └── task-template.md
    │
    ├── agents/
    │   ├── architect.md
    │   ├── frontend-agent.md
    │   ├── backend-agent.md
    │   ├── database-agent.md
    │   ├── devops-agent.md
    │   ├── tester-agent.md
    │   └── reviewer-agent.md
    │
    ├── memory/
    │   ├── current-state.md
    │   ├── changelog.md
    │   ├── completed-features.md
    │   ├── lessons-learned.md
    │   ├── important-fixes.md
    │   └── bugs-history.md
    │
    ├── governance/
    │   ├── universal-constraints.md
    │   ├── why-decisions.md
    │   ├── update-protocol.md
    │   ├── api-standards.md
    │   ├── security-policy.md
    │   └── approval-policy.md
    │
    ├── synapses/
    │   └── [cadena]-chain.md
    │
    ├── graph/
    │   ├── knowledge-graph.md
    │   ├── entities.md
    │   ├── relations.md
    │   └── impact-map.md
    │
    ├── ontology/
    │   └── entities.md
    │
    ├── architecture/
    │   ├── overview.md
    │   ├── frontend.md
    │   ├── backend.md
    │   ├── database.md
    │   ├── deployment.md
    │   └── observability.md
    │
    ├── context/
    │   ├── current-sprint.md
    │   ├── pending.md
    │   ├── environment.md
    │   └── roles/
    │       └── roles-map.md
    │
    ├── brain/
    │   ├── identity.md
    │   ├── philosophy.md
    │   ├── coding-standards.md
    │   ├── ai-behavior.md
    │   ├── naming-conventions.md
    │   ├── daimuz-replication.md
    │   └── patterns/
    │       ├── module-pattern.md
    │       ├── service-pattern.md
    │       ├── controller-pattern.md
    │       └── repository-pattern.md
    │
    ├── flows/
    │   └── [nombre]-flow.md
    │
    ├── decisions/
    │   └── ADR-[numero]-[decision].md
    │
    ├── prompts/
    │   ├── new-feature.md
    │   ├── new-module.md
    │   ├── bug-fix.md
    │   ├── code-review.md
    │   └── update-memory.md
    │
    └── vault/
        ├── api-routes.md
        ├── business-rules.md
        ├── glossary.md
        ├── integrations.md
        ├── external-resources.md
        └── stack/
            └── tech-stack.md

---

5. El archivo obligatorio: "CLAUDE.md"

Este archivo va en la raíz del proyecto.

Debe ser corto, directo y obligatorio.

# CLAUDE.md

## 🧠 Primer paso siempre

Antes de modificar código:

1. Leer daimuz/DAIMUZ.md
2. Leer daimuz/memory/current-state.md
3. Leer daimuz/indexes/modules-index.md
4. Identificar el módulo afectado
5. Leer daimuz/modules/[modulo]/compressed.md
6. Leer el archivo real del código
7. Si la tarea afecta varios módulos, revisar daimuz/synapses/ y daimuz/graph/impact-map.md

## ⚡ Stack rápido

| Capa | Tecnología |
|---|---|
| Frontend | [Next.js / React / Vue / Angular] |
| Backend | [NestJS / FastAPI / Laravel / Express] |
| Base de datos | [PostgreSQL / MySQL / MongoDB] |
| Infraestructura | [Docker / Nginx / VPS / Kubernetes] |

## 📐 Reglas que nunca se rompen

1. No modificar autenticación, permisos o tenant isolation sin revisar governance/security-policy.md.
2. No cambiar estructura de base de datos sin crear ADR.
3. No tocar producción sin aprobación humana.
4. No eliminar archivos sin confirmar impacto.
5. No implementar lógica fuera del módulo correspondiente.

## 🧩 Sistema de memoria

Toda la memoria del proyecto vive en daimuz/.

No guardar reglas críticas únicamente en el chat.

## 🛑 Acciones que requieren aprobación humana

- Deploy a producción
- Migraciones destructivas
- Eliminación de archivos
- Cambios en autenticación
- Cambios en permisos
- Cambios en facturación o pagos
- Cambios en datos reales de usuarios

---

6. Índice maestro: "daimuz/DAIMUZ.md"

Este es el primer archivo que el agente debe leer después de "CLAUDE.md".

# DAIMUZ — Índice Maestro del Proyecto

> Este archivo es el mapa principal del cerebro del proyecto.

## Identidad

- Proyecto: [nombre]
- Tipo: [SaaS / plataforma educativa / ecommerce / sistema interno]
- Usuarios principales: [usuarios]
- Objetivo principal: [objetivo]

## Lectura obligatoria por tipo de tarea

| Tipo de tarea | Leer primero |
|---|---|
| Nueva funcionalidad | tasks/task-template.md, indexes/modules-index.md, módulo relacionado |
| Bug fix | memory/bugs-history.md, memory/important-fixes.md, módulo relacionado |
| Cambio en API | governance/api-standards.md, indexes/endpoints-index.md |
| Cambio en BD | architecture/database.md, indexes/db-tables-index.md |
| Cambio visual | architecture/frontend.md, módulo frontend |
| Deploy | architecture/deployment.md, governance/approval-policy.md |
| Refactor | synapses/, graph/impact-map.md, ADRs relacionados |

## Archivos críticos

- CLAUDE.md
- daimuz/governance/universal-constraints.md
- daimuz/governance/security-policy.md
- daimuz/memory/current-state.md
- daimuz/indexes/modules-index.md
- daimuz/graph/impact-map.md

## Regla central

Antes de tocar código, entender:
1. módulo,
2. regla crítica,
3. archivos afectados,
4. flujo relacionado,
5. impacto en otros módulos.

---

7. El archivo más importante por módulo: "compressed.md"

Cada módulo debe tener un archivo "compressed.md".

Este archivo debe permitir que el agente entienda el módulo en menos de 30 segundos.

# [Módulo] — Compressed

*Qué hace:* [explicación en 1 línea]

*Responsabilidad principal:* [qué problema resuelve]

*Tablas:* tabla1 · tabla2

*Endpoints clave:*  
- GET /ruta
- POST /ruta
- PATCH /ruta/:id
- DELETE /ruta/:id

*Archivos principales:*  
- Backend: backend/src/modules/[modulo]/[modulo].service.ts
- Controller: backend/src/modules/[modulo]/[modulo].controller.ts
- Frontend: frontend/src/app/[ruta]/page.tsx
- Componentes: frontend/src/components/[modulo]/

*Depende de:*  
- [modulo A]
- [modulo B]

*Afecta a:*  
- [modulo C]
- [modulo D]

*Tests:*  
- backend/test/[modulo].spec.ts
- frontend/tests/[modulo].test.tsx

*⚠️ Regla crítica:*  
[La cosa más importante que el agente nunca debe olvidar.]

*Antes de modificar:*  
1. Revisar este archivo.
2. Revisar specs.md si existe.
3. Revisar synapses/ si afecta otros módulos.
4. Ejecutar pruebas relacionadas.

---

8. Capa de Tasks

DAIMUZ v4 agrega una capa de tareas para que el agente no trabaje de forma desordenada.

Cada tarea debe tener un archivo propio.

daimuz/tasks/active/TASK-001-mejorar-login.md

Template:

# TASK-[id] — [Nombre de la tarea]

## Estado

- Estado: active
- Prioridad: alta / media / baja
- Fecha de creación: [fecha]
- Responsable: humano / agente / mixto
- Módulo principal: [módulo]

## Objetivo

[Qué se debe lograr]

## Contexto

[Por qué se necesita esta tarea]

## Archivos probablemente afectados

- [ruta]
- [ruta]

## Reglas relevantes

- governance/universal-constraints.md
- governance/security-policy.md
- modules/[modulo]/compressed.md

## Plan

- [ ] Analizar módulo
- [ ] Revisar flujo afectado
- [ ] Modificar archivos
- [ ] Ejecutar pruebas
- [ ] Actualizar DAIMUZ
- [ ] Generar resumen final

## Criterios de aceptación

- [ ] Compila sin errores
- [ ] Tests pasan
- [ ] No rompe reglas del módulo
- [ ] Documentación actualizada
- [ ] Se registró en changelog

## Resultado final

[Se completa al cerrar la tarea]

---

9. Capa de Agents

DAIMUZ puede trabajar con un solo agente o con varios agentes especializados.

La capa "agents/" define cómo debe comportarse cada especialista.

daimuz/agents/
├── architect.md
├── frontend-agent.md
├── backend-agent.md
├── database-agent.md
├── devops-agent.md
├── tester-agent.md
└── reviewer-agent.md

Ejemplo:

# Agent: Backend

## Rol

Especialista en lógica de negocio, APIs, servicios, validaciones y persistencia.

## Debe leer antes de actuar

1. CLAUDE.md
2. daimuz/DAIMUZ.md
3. daimuz/governance/api-standards.md
4. daimuz/modules/[modulo]/compressed.md
5. daimuz/architecture/backend.md

## Puede modificar

- backend/src/modules/
- backend/src/common/
- backend/src/shared/

## No puede modificar sin aprobación

- Auth global
- Middleware de tenant
- Migraciones destructivas
- Configuración de producción

## Verificación obligatoria

- Ejecutar build
- Ejecutar tests del módulo
- Validar formato de respuesta API
- Confirmar que no rompe permisos

---

10. Capa de Knowledge Graph

La carpeta "graph/" sirve para representar relaciones explícitas entre entidades, módulos, tablas y flujos.

Esto evita que el agente haga cambios aislados sin entender impacto.

daimuz/graph/
├── knowledge-graph.md
├── entities.md
├── relations.md
└── impact-map.md

Ejemplo:

# Knowledge Graph — Proyecto

## Entidades principales

- User
- Tenant
- Commerce
- Order
- Product
- Payment
- Delivery

## Relaciones

text
Tenant -> tiene muchos -> Commerce
Commerce -> tiene muchos -> Product
User -> pertenece a -> Tenant
Order -> pertenece a -> Commerce
Order -> tiene muchos -> OrderItem
Order -> puede tener -> Delivery
Payment -> pertenece a -> Order

Reglas de impacto

Si cambia User:
- revisar auth
- revisar roles
- revisar tenant isolation
- revisar auditoría

Si cambia Order:
- revisar inventory
- revisar payments
- revisar delivery
- revisar reports


---

## 11. Synapses: mapas de impacto

Los `synapses` describen cadenas de impacto entre módulos.

Ejemplo:

markdown
# order-payment-delivery-chain

## Cadena

text
Order
  ↓
Payment
  ↓
Inventory
  ↓
Delivery
  ↓
Reports

Si cambia Order

Revisar:

- creación de pago,
- descuento de inventario,
- asignación de domiciliario,
- reportes de venta,
- notificaciones.

Archivos críticos

- "orders.service.ts"
- "payments.service.ts"
- "inventory.service.ts"
- "delivery.service.ts"
- "reports.service.ts"

Riesgo

Alto. Un cambio en Order puede romper flujo de compra completo.


---

## 12. Skills

Las instrucciones largas no deben vivir todas en `CLAUDE.md`.

Cuando una instrucción se vuelve un procedimiento repetible, debe convertirse en Skill.

Ejemplos:

text
.claude/skills/new-feature/SKILL.md
.claude/skills/bug-fix/SKILL.md
.claude/skills/code-review/SKILL.md
.claude/skills/update-daimuz/SKILL.md

Ejemplo de Skill:

# Skill: update-daimuz

## Cuándo usar

Usar al finalizar una sesión, feature, bug fix o refactor.

## Pasos

1. Revisar cambios realizados.
2. Actualizar memory/current-state.md.
3. Actualizar memory/changelog.md.
4. Si se resolvió bug, actualizar memory/important-fixes.md.
5. Si se completó feature, actualizar memory/completed-features.md.
6. Si se aprendió una regla nueva, actualizar memory/lessons-learned.md.
7. Si hubo cambio arquitectónico, crear ADR.
8. Si hubo cambio de impacto entre módulos, actualizar synapses/ o graph/impact-map.md.

## Salida esperada

Resumen de archivos DAIMUZ actualizados.

---

13. Hooks recomendados

Los hooks permiten automatizar validaciones y mantenimiento.

"SessionStart"

Objetivo: recordar al agente leer DAIMUZ.

Al iniciar sesión:
- verificar existencia de CLAUDE.md
- verificar existencia de daimuz/DAIMUZ.md
- mostrar recordatorio de lectura

"PreToolUse"

Objetivo: bloquear acciones peligrosas.

Antes de usar herramientas:
- bloquear eliminación de archivos críticos
- bloquear cambios en producción
- bloquear migraciones destructivas sin aprobación

"PostToolUse"

Objetivo: registrar cambios.

Después de modificar archivos:
- registrar archivo modificado
- sugerir actualización de tarea activa
- sugerir prueba relacionada

"SessionEnd"

Objetivo: cerrar memoria.

Al cerrar sesión:
- actualizar current-state
- actualizar changelog
- cerrar tareas completadas
- registrar pendientes

---

14. Governance: reglas que nunca se rompen

Archivo:

daimuz/governance/universal-constraints.md

Template:

# Reglas que Nunca se Rompen

## 1. Regla de arquitectura

La lógica de negocio vive en servicios o casos de uso.  
No debe vivir en controladores, componentes visuales o rutas.

## 2. Regla de seguridad

Todo acceso a datos debe respetar autenticación, autorización y tenant isolation.

## 3. Regla de datos

No se eliminan datos críticos sin soft delete o confirmación explícita.

## 4. Regla de API

Todas las respuestas deben seguir el formato estándar del proyecto.

## 5. Regla de errores

Los errores deben ser claros, trazables y no exponer información sensible.

## 6. Regla de producción

No se despliega a producción sin aprobación humana.

## 7. Regla de documentación

Todo cambio relevante debe actualizar DAIMUZ.

## ⛔ Nunca tocar sin preguntar

- Auth middleware
- Tenant middleware
- Variables de producción
- Migraciones destructivas
- Configuración de pagos
- Configuración de correo
- Configuración de deploy

---

15. Protocolo de lectura del agente

Orden recomendado:

CLAUDE.md
    ↓
daimuz/DAIMUZ.md
    ↓
daimuz/memory/current-state.md
    ↓
daimuz/tasks/active/
    ↓
daimuz/indexes/modules-index.md
    ↓
daimuz/modules/[modulo]/compressed.md
    ↓
daimuz/graph/impact-map.md si hay impacto cruzado
    ↓
archivo real del código

Regla:

No leer todo el vault.
Leer solo lo necesario para la tarea.

---

16. Mínimo viable

Para instalar DAIMUZ en un proyecto nuevo no necesitas toda la estructura.

Empieza con esto:

CLAUDE.md

daimuz/
├── DAIMUZ.md
├── indexes/
│   └── modules-index.md
├── memory/
│   └── current-state.md
├── governance/
│   └── universal-constraints.md
├── context/
│   └── current-sprint.md
└── modules/
    └── [primer-modulo]/
        └── compressed.md

Luego agregas:

tasks/
agents/
graph/
synapses/
skills/
hooks/
ADRs/

---

17. Script de instalación

#!/bin/bash

mkdir -p daimuz/{indexes,modules,memory,governance,synapses,ontology,architecture,context/roles,brain/patterns,flows,decisions,prompts,vault/stack,tasks/{active,completed,blocked},agents,graph}

mkdir -p .claude/{skills,hooks,rules}

touch CLAUDE.md
touch daimuz/DAIMUZ.md
touch daimuz/indexes/modules-index.md
touch daimuz/indexes/endpoints-index.md
touch daimuz/indexes/db-tables-index.md
touch daimuz/indexes/files-index.md
touch daimuz/indexes/tasks-index.md

touch daimuz/memory/current-state.md
touch daimuz/memory/changelog.md
touch daimuz/memory/completed-features.md
touch daimuz/memory/lessons-learned.md
touch daimuz/memory/important-fixes.md
touch daimuz/memory/bugs-history.md

touch daimuz/governance/universal-constraints.md
touch daimuz/governance/security-policy.md
touch daimuz/governance/approval-policy.md
touch daimuz/governance/api-standards.md
touch daimuz/governance/update-protocol.md

touch daimuz/context/current-sprint.md
touch daimuz/context/pending.md
touch daimuz/context/environment.md

touch daimuz/graph/knowledge-graph.md
touch daimuz/graph/entities.md
touch daimuz/graph/relations.md
touch daimuz/graph/impact-map.md

touch daimuz/tasks/task-template.md

touch daimuz/agents/architect.md
touch daimuz/agents/frontend-agent.md
touch daimuz/agents/backend-agent.md
touch daimuz/agents/database-agent.md
touch daimuz/agents/devops-agent.md
touch daimuz/agents/tester-agent.md
touch daimuz/agents/reviewer-agent.md

echo "DAIMUZ instalado correctamente."

---

18. Script para crear un módulo

Archivo sugerido:

daimuz/scripts/new-module.sh

#!/bin/bash

read -p "Nombre del módulo: " MODULE
read -p "Tier del módulo (micro/standard/full): " TIER

mkdir -p "daimuz/modules/$MODULE"

cat > "daimuz/modules/$MODULE/compressed.md" <<EOF
# $MODULE — Compressed

*Qué hace:* [explicar en 1 línea]

*Responsabilidad principal:* [responsabilidad]

*Tablas:* \tabla1\ · \tabla2\

*Endpoints clave:*
- \GET /$MODULE\
- \POST /$MODULE\

*Archivos principales:*
- Backend: \backend/src/modules/$MODULE/\
- Frontend: \frontend/src/components/$MODULE/\

*Depende de:*
- [módulo]

*Afecta a:*
- [módulo]

*⚠️ Regla crítica:*
[regla crítica]

*Antes de modificar:*
1. Revisar este archivo.
2. Revisar specs si existe.
3. Ejecutar pruebas relacionadas.
EOF

if [ "$TIER" = "standard" ] || [ "$TIER" = "full" ]; then
  touch "daimuz/modules/$MODULE/$MODULE.md"
  touch "daimuz/modules/$MODULE/specs.md"
fi

if [ "$TIER" = "full" ]; then
  touch "daimuz/modules/$MODULE/tests.md"
  touch "daimuz/flows/$MODULE-flow.md"
fi

echo "- $MODULE — [descripción breve] — daimuz/modules/$MODULE/compressed.md" >> daimuz/indexes/modules-index.md

echo "Módulo $MODULE creado con tier $TIER."

---

19. Tiers de documentación

No todos los módulos necesitan el mismo nivel de documentación.

Tier| Para qué sirve| Archivos
Micro| Módulos simples| "compressed.md"
Standard| Módulos con lógica media| "compressed.md", "[modulo].md", "specs.md"
Full| Módulos críticos| "compressed.md", "[modulo].md", "specs.md", "tests.md", flujo, synapse

Ejemplos:

Módulo| Tier recomendado
media-library| micro
coupons| standard
reviews| standard
auth| full
orders| full
inventory| full
delivery| full
payments| full
reports| full

---

20. Protocolo de mantenimiento

Momento| Qué actualizar
Al terminar una sesión| "current-state.md", "changelog.md", "current-sprint.md"
Al terminar un feature| "completed-features.md", tarea completada
Al resolver un bug| "important-fixes.md", "bugs-history.md"
Al crear un módulo| "compressed.md", "modules-index.md"
Al cambiar arquitectura| Crear ADR
Al cambiar flujo entre módulos| Actualizar "synapses/"
Al cambiar entidades| Actualizar "graph/entities.md" y "graph/relations.md"
Al aprender una regla nueva| "lessons-learned.md"
Al cambiar API| "endpoints-index.md", "api-routes.md"
Al cambiar BD| "db-tables-index.md", "architecture/database.md"

Regla de oro:

Si el agente necesitará saberlo en la próxima sesión, debe quedar en DAIMUZ.

---

21. Prompt de cierre de sesión

Usar al final de cada sesión:

Actualiza DAIMUZ con base en lo realizado hoy.

Debes revisar y actualizar, si aplica:

- daimuz/memory/current-state.md
- daimuz/memory/changelog.md
- daimuz/context/current-sprint.md
- daimuz/tasks/active/
- daimuz/tasks/completed/
- daimuz/memory/important-fixes.md
- daimuz/memory/bugs-history.md
- daimuz/memory/lessons-learned.md
- daimuz/indexes/modules-index.md
- daimuz/graph/impact-map.md
- daimuz/synapses/

No inventes información. Solo registra hechos verificables de esta sesión.

---

22. Métricas internas

Ejemplo basado en Lopbuk:

Métrica| Sin DAIMUZ| Con DAIMUZ
Tiempo total por feature| ~45 min| ~18 min
Archivos leídos para orientarse| 8-12| 3-5
Backtracking| Frecuente| Bajo
Bugs detectados antes de runtime| Raro| Más probable
Continuidad entre sesiones| Baja| Alta

Resultado observado:

Ahorro aproximado: 60% del tiempo de implementación por sesión.

Nota: estas métricas deben considerarse internas del proyecto. Para validarlas formalmente, medir al menos 10 sesiones con y sin DAIMUZ.

---

23. Nivel de madurez

DAIMUZ v3 era principalmente un sistema de memoria documental.

DAIMUZ v4 agrega:

- Tasks
- Agents
- Knowledge Graph
- Skills
- Hooks
- Guardrails
- ADRs
- Specs
- Impact maps
- Carga bajo demanda

Con estas capas, DAIMUZ deja de ser solo una “memoria para Claude” y se convierte en un sistema operativo de contexto para agentes de programación.

Escala sugerida:

Nivel| Descripción
1-3| Documentación básica
4-5| README + reglas sueltas
6-7| Memoria por módulos
8| DAIMUZ con índices, memoria y governance
9| DAIMUZ con tasks, agents, graph, hooks y skills
10| DAIMUZ conectado a runtime autónomo con métricas, permisos, trazas y evaluación continua

DAIMUZ v4 apunta al nivel 9.

Para llegar al nivel 10 necesita:

- ejecución en sandbox,
- permisos por herramienta,
- trazabilidad de cada acción,
- evaluadores automáticos,
- recuperación ante fallos,
- integración MCP,
- y tablero de observabilidad.

---

24. Roadmap

Fase 1 — Memoria mínima

- Crear "CLAUDE.md"
- Crear "DAIMUZ.md"
- Crear "modules-index.md"
- Crear primer "compressed.md"
- Crear "current-state.md"
- Crear "universal-constraints.md"

Fase 2 — Memoria operativa

- Crear "changelog.md"
- Crear "completed-features.md"
- Crear "bugs-history.md"
- Crear "lessons-learned.md"
- Crear protocolo de cierre de sesión

Fase 3 — Navegación avanzada

- Crear "endpoints-index.md"
- Crear "db-tables-index.md"
- Crear "files-index.md"
- Crear "flows/"
- Crear "synapses/"

Fase 4 — Arnés de agentes

- Crear "tasks/"
- Crear "agents/"
- Crear "approval-policy.md"
- Crear "security-policy.md"
- Crear "graph/impact-map.md"

Fase 5 — Automatización

- Crear Skills
- Crear Hooks
- Crear scripts de módulo
- Crear script de cierre de sesión
- Crear validadores

Fase 6 — Runtime independiente

- Conectar MCP
- Ejecutar tareas en sandbox
- Guardar checkpoints
- Medir costos y tiempos
- Agregar aprobaciones humanas
- Crear panel de observabilidad

---

25. Resumen final

DAIMUZ debe entenderse como tres capas:

1. Memoria
   Qué sabe el agente del proyecto.

2. Navegación
   Cómo encuentra rápido lo que debe tocar.

3. Arnés
   Qué puede hacer, qué no puede hacer y cómo se verifica.

La versión anterior ayudaba a Claude a recordar.

La versión mejorada permite que un agente trabaje con mayor independencia, porque ahora tiene:

- contexto inicial,
- reglas,
- tareas,
- agentes,
- grafo de impacto,
- memoria histórica,
- procedimientos reutilizables,
- y puntos de control.

La frase central de DAIMUZ v4:

«No se trata de escribir más documentación.
Se trata de construir un cerebro operativo que reduzca incertidumbre, evite errores repetidos y permita que los agentes trabajen con autonomía supervisada.»