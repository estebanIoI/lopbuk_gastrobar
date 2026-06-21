# Plan — Ecosistema de Gamificación, Escasez y Exclusividad

> Estado: propuesta (2026-06-20). Construye SOBRE el módulo Afiliados (Sprints 1–4 hechos)
> y el motor `qty-promo`. No reemplaza nada: añade 4 pilares encima de lo existente.
> Lectura previa: `roadmap-afiliados.md`, `vault/business-rules.md`.

---

## 0. Idea en una frase

Convertir la tienda de "catálogo abierto + descuento plano" a un **juego de acceso**:
el promotor cura y reparte *llaves*, el cliente *desbloquea* interfaces/productos ocultos
dentro de una **ventana de escasez**, y gana **rangos** que lo retienen. Cada interacción
deja **datos zero-party** (el cliente los entrega a cambio del acceso).

---

## 1. Los 4 pilares y su anclaje en lo que YA existe

| Pilar | Qué es | Reusa | Es nuevo |
|---|---|---|---|
| **P1 · Promotor-curador** | Ranking + comisión dinámica por desempeño | `affiliates.tier`, `affiliate_commissions`, `/leaderboard`, `TIER_RULES` | Comisión que escala con tier en tiempo real; "curaduría" (qué productos puede desbloquear su llave) |
| **P2 · Llave de acceso VIP** | Código de un uso / ventana corta que **desbloquea** un catálogo o interfaz oculta y captura datos zero-party | campo `code` de `affiliate_campaigns`, `attributeSaleByCode` | Tabla de **tokens**, máquina de estados (emitido→canjeado→expirado), gate de UI, captura de datos |
| **P3 · Pop-Up Digital / Preventa** | Venta por ventana de tiempo + escasez psicológica ("Solo quedan 15 cupos") | columnas `is_preorder`, `preorder_window_end`, stock por producto | **Drops** programados (inicio/fin), contador de cupos, indicador de urgencia, cola |
| **P4 · Cliente con rango** | Logros y niveles que retienen ("Cliente Fundador", "Acceso Nivel 2") | `customers`/órdenes existentes | Tabla de logros, reglas de desbloqueo, badge en checkout/perfil |

**Conclusión clave:** P1 está ~80% en la base de datos. Lo verdaderamente nuevo y
diferenciador es **P2 (llaves)**, que además es el motor que alimenta P3 y P4.

---

## 2. Modelo de datos nuevo (mínimo, encima del schema actual)

```
access_keys                         drops (pop-up / preventa)
─────────────────────────           ─────────────────────────
id (uuid)                           id
tenant_id        ── FK tenants      tenant_id
campaign_id      ── FK affiliate_campaigns (nullable)   title
code (único, indexado)              starts_at / ends_at
key_type  enum(one_use|window|multi)  total_slots / slots_taken
unlocks   json  (product_ids | section_id | view)        is_active
max_redemptions / redemptions       created_by_affiliate_id (nullable)
expires_at
status    enum(active|spent|expired)
created_by_affiliate_id ── FK affiliates (nullable)
created_at

key_redemptions                     customer_achievements
─────────────────────────           ─────────────────────────
id                                  id
access_key_id ── FK access_keys     tenant_id
customer_ref  (phone|email|user)    customer_ref
zero_party_data json (lo que entregó)  achievement_code (founder|level_2|...)
order_id      (nullable)            unlocked_at
redeemed_at                         source (key|drop|spend)
```

`access_keys.unlocks` (JSON) es el corazón: define **qué** abre la llave
(lista de productos, una sección oculta, o un tema/vista). El gate de frontend
lee ese JSON tras validar el token.

---

## 3. Lógica de generación dinámica de llaves (P2 — el núcleo)

1. **Emisión:** `POST /api/access-keys` (promotor o comercio). Genera `code`
   (formato legible, p.ej. `VIP-7F3K`), define `key_type`, `unlocks`, `expires_at`,
   `max_redemptions`. Hereda `campaign_id` para atribuir comisión vía el motor actual.
2. **Validación (gate):** `POST /api/access-keys/redeem` → verifica `status=active`,
   no expirada, redenciones < max, `tenant_id` correcto. Devuelve el `unlocks` y
   marca `key_redemptions` (capturando los datos zero-party que pida el formulario).
3. **Atribución:** al cerrar pedido con esa llave, se reusa `attributeSaleByCode`
   (ya existe) → comisión al promotor según su `tier`.
4. **Estados:** `active → spent` (one_use al primer canje) | `active → expired` (cron de P3c).

> Por qué es seguro: el token NO lleva precio ni lógica de negocio; solo abre una vista.
> El precio final lo sigue calculando el backend (igual que `qty-promo`). El `tenant_id`
> viene del token + del JWT, nunca del body.

---

## 4. Orden de construcción recomendado (sprints)

- **G1 · Schema llaves + drops** — migración inline idempotente (patrón afiliados).
- **G2 · API llaves** — emitir / validar / redimir / capturar zero-party. Reusa atribución.
- **G3 · Gate de UI** — componente `<AccessGate>` que oculta sección/productos hasta canjear
  la llave; "interfaz desbloqueada" en Tema 2.
- **G4 · Drops + escasez** — programador de ventana, contador de cupos en vivo (Socket.io ya está),
  indicador "Solo quedan N", auto-expiración.
- **G5 · Tier engine (Sprint 5 afiliados)** — comisión dinámica por rango + reset mensual.
- **G6 · Logros de cliente** — reglas de desbloqueo + badges (Fundador / Nivel 2).
- **G7 · Portales** — promotor (generador de llaves + leaderboard) y superadmin (drops, métricas).

---

## 5. Riesgos y guardas
- **Fraude de llaves:** rate-limit en `/redeem`, `code` aleatorio ≥6 chars, un canje por `customer_ref` en one_use.
- **Escasez real vs psicológica:** `slots_taken` debe ser transaccional (lock) para que el contador no mienta.
- **Privacidad zero-party:** guardar solo lo que el cliente entrega voluntariamente; nunca cruzar tenants.
- **Multi-tenant:** toda tabla nueva lleva `tenant_id` y se filtra por JWT.

---

## 6. Respuesta a tu pregunta: ¿por dónde empezar?

**Empieza por la lógica de las llaves de acceso (P2), no por el diagrama de rangos/comisiones.**

Razón: el sistema de **rangos y comisiones ya está ~80% en la base de datos** del módulo
Afiliados (`affiliates.tier`, `affiliate_commissions`, `TIER_RULES`, `/leaderboard`); ese
"diagrama" es más bien *consolidar y visualizar* algo que ya existe (Sprint 5, ~1 sesión).
En cambio, las **llaves de acceso son lo realmente nuevo y diferenciador**: son el mecanismo
que crea la exclusividad, dispara la escasez (P3) y la retención por rango (P4), y genera
los datos zero-party. Diseñarlas primero **de-riesga** todo el ecosistema y desbloquea los
demás pilares.

**Primer paso concreto:** sprint **G1 (schema `access_keys` + `key_redemptions` + `drops`)**
como migración idempotente, e inmediatamente **G2** reusando `attributeSaleByCode`. El tier
engine (G5) entra después, cuando las llaves ya generen conversiones que alimenten la comisión.
