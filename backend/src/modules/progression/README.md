# Progression Engine (V1)

Núcleo **determinístico** de progresión de cargas. Sin IA generativa, sin
dependencias externas, sin acceso a DB/HTTP/sockets. Misma entrada → misma
decisión, siempre.

> **V1:** objetivo `hypertrophy` + estrategia `double_progression` (rango 8-12).
> `strength` / `endurance` y `linear` / `rir_based` lanzan a propósito (no se
> inventan reglas). Persistencia, endpoints y analytics son **Fase 5** (no aquí).

## Uso

```ts
import { progressionService } from '@modules/progression';

const decision = progressionService.computeFromRaw({
  goal: 'hypertrophy',
  currentWeight: 22.5,
  targetReps: 12,            // tope del rango de hipertrofia
  reps: [12, 12, 12, 12],    // reps por serie realizadas
  movementPattern: 'upper',  // upper → +2.5kg · lower → +5kg
});

// → { action: 'increase', nextWeight: 25, confidence: 1, reasons: [...], metrics: {...} }
```

### Decisión

| Condición (rango 8-12) | Acción | Próximo peso |
|---|---|---|
| Todas las series al tope (completion rate ≥ 1.0) | `increase` | `+ incremento` |
| Dentro del rango, sin tope (rate ≥ 0.8 y avg ≥ min) | `maintain` | igual |
| Promedio bajo el mínimo, o rate < 0.8 | `decrease` | `- incremento` |

Incremento: `upper` 2.5kg · `lower` 5kg · o `increment` explícito (prioritario).

## Arquitectura

```
shared/        enums · constants · schema (contratos, validación pura estilo zod)
domain/
  entities/    tipos puros (ExercisePerformance, ProgressionDecision, GoalRules)
  rules/       RuleEngine + GOAL_RULES  ← ÚNICA fuente de reglas fitness
  calculators/ volume · completion-rate · estimated-1rm (matemática pura)
  evaluators/  performance.evaluator (interpreta, no decide carga)
  strategies/  ProgressionStrategy + DoubleProgression + factory
application/
  services/    ProgressionService (orquesta: valida → reglas → estrategia)
  events/      progression-computed (contrato del evento de dominio)
__tests__/     suite con node:test (19 casos)
```

## Reglas de oro (anti-alucinación)

- **Toda regla fitness sale del `RuleEngine`.** Prohibido `if (goal === 'hypertrophy')` fuera de `domain/rules`.
- El `ProgressionService` **no** contiene lógica fitness: solo orquesta.
- Para añadir un objetivo/estrategia (fuerza, lineal…): registrar reglas en `GOAL_RULES` y una nueva clase en la factory. **No se toca** lo existente.
- Todo lo que entra al motor pasa por `ProgressionInputSchema.parse()`.

## Migrar la validación a Zod

`shared/schema.ts` expone la misma API que zod (`.parse()` / `.safeParse()`).
Cuando se instale `zod`, se reemplaza ese archivo por schemas zod equivalentes
sin tocar el resto del motor.

## Tests

No hay runner configurado en el backend (no se tocó `package.json`). Para correr
la suite de forma aislada:

```bash
# desde backend/
node_modules/.bin/tsc -p <tsconfig-temporal>   # emite a un outDir
node --test <outDir>/__tests__/                  # 19 tests, runner nativo de Node 22
```

(O, cuando se adopte un runner del proyecto —vitest/jest—, los `*.test.ts`
funcionan tal cual.)
