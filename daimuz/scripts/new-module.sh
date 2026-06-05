#!/bin/bash
# ============================================================
# DAIMUZ — Scaffolding inteligente de módulo
# Uso: bash daimuz/scripts/new-module.sh
# ============================================================
# Crea solo la documentación necesaria según el tamaño del módulo.
# Anti-patrón: no fuerza full-docs donde no se necesita.
#
# Niveles:
#   micro  → solo compressed.md      (utilidades, configs, wrappers pequeños)
#   standard → compressed + module.md (módulo con 1-3 entidades)
#   full   → todo                     (módulo con flujos, reglas complejas, múltiples entidades)
# ============================================================

set -e

# ─── Colores ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}⬡ DAIMUZ — Nuevo Módulo${NC}"
echo "─────────────────────────────────────"

# ─── Nombre del módulo ──────────────────────────────────────
read -p "$(echo -e ${BOLD})Nombre del módulo (ej: payments, reports): $(echo -e ${NC})" MODULE_NAME

if [ -z "$MODULE_NAME" ]; then
  echo -e "${RED}✗ El nombre no puede estar vacío.${NC}"
  exit 1
fi

MODULE_DIR="daimuz/modules/${MODULE_NAME}"

if [ -d "$MODULE_DIR" ]; then
  echo -e "${YELLOW}⚠ Ya existe daimuz/modules/${MODULE_NAME}/${NC}"
  read -p "¿Continuar de todas formas? (s/N): " CONFIRM
  [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ] && exit 0
fi

# ─── Elegir nivel ───────────────────────────────────────────
echo ""
echo -e "${BOLD}¿Qué tan grande/complejo es este módulo?${NC}"
echo ""
echo -e "  ${CYAN}1) micro${NC}    — Wrapper, utility, config pequeña"
echo -e "             Solo necesita: compressed.md"
echo ""
echo -e "  ${CYAN}2) standard${NC} — Módulo con 1-3 entidades y endpoints claros"
echo -e "             Crea: compressed.md + ${MODULE_NAME}.md"
echo ""
echo -e "  ${CYAN}3) full${NC}     — Módulo complejo: flujos, reglas de negocio, múltiples entidades"
echo -e "             Crea: compressed.md + ${MODULE_NAME}.md + flujo en flows/"
echo ""
read -p "Nivel [1/2/3]: " LEVEL

case "$LEVEL" in
  1) TIER="micro" ;;
  2) TIER="standard" ;;
  3) TIER="full" ;;
  *) echo -e "${RED}✗ Opción inválida.${NC}"; exit 1 ;;
esac

# ─── Crear carpeta ──────────────────────────────────────────
mkdir -p "$MODULE_DIR"

TODAY=$(date +%Y-%m-%d)

# ─── compressed.md (siempre) ────────────────────────────────
cat > "${MODULE_DIR}/compressed.md" << EOF
# ${MODULE_NAME} — Compressed

> Última actualización: ${TODAY}

**Qué hace:** [1 línea que explica todo el módulo]
**Tablas:** \`tabla1\` · \`tabla2\`
**Endpoints clave:** \`GET /api/${MODULE_NAME}\` · \`POST /api/${MODULE_NAME}\`
**Archivos:**
- BE: \`backend/src/modules/${MODULE_NAME}/${MODULE_NAME}.service.ts\`
- FE: \`frontend/src/components/${MODULE_NAME}/\`
**⚠️ Regla crítica:** [la cosa más importante que NO debes olvidar]
EOF

echo -e "${GREEN}✓ ${MODULE_DIR}/compressed.md${NC}"

# ─── module.md (standard + full) ────────────────────────────
if [ "$TIER" = "standard" ] || [ "$TIER" = "full" ]; then

cat > "${MODULE_DIR}/${MODULE_NAME}.md" << EOF
# ${MODULE_NAME^} — Módulo Completo

> Módulo: \`${MODULE_NAME}\`
> Última actualización: ${TODAY}

---

## ¿Qué hace?

[Descripción completa del módulo en 2-3 párrafos]

---

## Entidades

### [Entidad principal]

| Campo | Tipo | Descripción |
|---|---|---|
| id | INT | PK autoincrement |
| tenant_id | INT | FK → tenants · obligatorio |
| [campo] | [tipo] | [descripción] |
| is_active | TINYINT | Soft delete: 1=activo, 0=inactivo |

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/${MODULE_NAME} | Listar todos |
| GET | /api/${MODULE_NAME}/:id | Obtener uno |
| POST | /api/${MODULE_NAME} | Crear |
| PUT | /api/${MODULE_NAME}/:id | Actualizar |
| DELETE | /api/${MODULE_NAME}/:id | Soft delete |

---

## Reglas de Negocio

1. **[Regla 1]** — [explicación]
2. **[Regla 2]** — [explicación]

---

## Dependencias

**Depende de:** [módulos que este módulo consume]
**Lo usan:** [módulos que consumen este módulo]

---

## Archivos clave

\`\`\`
backend/src/modules/${MODULE_NAME}/
├── ${MODULE_NAME}.routes.ts
├── ${MODULE_NAME}.controller.ts
└── ${MODULE_NAME}.service.ts

frontend/src/components/${MODULE_NAME}/
└── [componentes principales]
\`\`\`

← [[../compressed]] | [[../../DAIMUZ]]
EOF

  echo -e "${GREEN}✓ ${MODULE_DIR}/${MODULE_NAME}.md${NC}"
fi

# ─── flow (solo full) ────────────────────────────────────────
if [ "$TIER" = "full" ]; then

cat > "daimuz/flows/${MODULE_NAME}-flow.md" << EOF
# Flujo: ${MODULE_NAME^}

> Última actualización: ${TODAY}

---

## Paso a paso

\`\`\`
1. [Usuario hace X]
   → [Sistema responde con Y]

2. [Sistema valida Z]
   → [Si ok: continúa]
   → [Si error: lanza AppError]

3. [Resultado final]
\`\`\`

---

## Estados posibles

| Estado | Significado |
|---|---|
| pending | [descripción] |
| active | [descripción] |
| completed | [descripción] |

---

## Edge cases y errores comunes

- **[Error 1]:** [cuándo ocurre] → [cómo se maneja]
- **[Error 2]:** [cuándo ocurre] → [cómo se maneja]

← [[../modules/${MODULE_NAME}/compressed]] | [[../DAIMUZ]]
EOF

  echo -e "${GREEN}✓ daimuz/flows/${MODULE_NAME}-flow.md${NC}"
fi

# ─── Resumen ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}────────────────────────────────────────${NC}"
echo -e "${GREEN}${BOLD}✅ Módulo '${MODULE_NAME}' creado (tier: ${TIER})${NC}"
echo ""
echo -e "${YELLOW}${BOLD}Próximos pasos:${NC}"
echo -e "  1. Rellena ${MODULE_DIR}/compressed.md con los datos reales"
if [ "$TIER" != "micro" ]; then
  echo -e "  2. Documenta endpoints en ${MODULE_DIR}/${MODULE_NAME}.md"
fi
echo -e "  3. Agrega '${MODULE_NAME}' a daimuz/indexes/modules-index.md"
echo -e "  4. Actualiza daimuz/DAIMUZ.md si el módulo es visible en el índice maestro"
echo ""
echo -e "${CYAN}Recuerda al terminar la sesión:${NC}"
echo -e "  \"Actualiza los archivos DAIMUZ relevantes basándote en lo que hicimos hoy\""
echo ""
