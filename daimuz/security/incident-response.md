# 🚑 Fase 17 — Blue Team e Incident Response

> Qué hacer cuando algo pasa. El Red Team ([[security/audit-plan#fase-16]]) ataca; el Blue Team
> detecta y responde. El objetivo: **bajar MTTD y MTTR** ([[security/kpis]]).

---

## Ciclo de respuesta (NIST)

```
Detección → Contención → Erradicación → Recuperación → Lecciones aprendidas
    │            │             │              │                 │
   SIEM      aislar el     quitar la     restaurar de      actualizar
  /alertas   componente    persistencia  backup limpio     playbooks + DAIMUZ
```

1. **Detección** — el SIEM (Fase 15) alerta; se confirma que es un incidente real y su alcance.
2. **Contención** — aislar el contenedor/servicio/cuenta afectada; revocar tokens; cortar egress.
3. **Erradicación** — eliminar acceso del atacante, cerrar la vulnerabilidad, rotar secretos.
4. **Recuperación** — restaurar desde backup **inmutable** probado (Fase 13); validar integridad; volver a operar.
5. **Lecciones aprendidas** — post-mortem sin culpa; actualizar [[memory/lessons-learned]] y los playbooks.

---

## Playbooks (escenarios DAIMUZ)

### 🔓 Fuga cross-tenant / IDOR confirmado
Contener: parchear el endpoint, revisar `audit_log` por accesos indebidos. Erradicar: auditar todos los
endpoints con el mismo patrón. Notificar si hubo exposición de PII (obligación Ley 1581).

### 🔑 Secreto expuesto (JWT/keys de Gemini/OpenAI/Wompi/SMTP)
Rotar el secreto **de inmediato**, revocar sesiones si es el JWT secret, revisar uso indebido en logs de
la API/proveedor, purgar del historial de git.

### 🤖 Agente IA comprometido (prompt injection / function calling abuse)
Deshabilitar las tools afectadas, revisar `ChatAction` por acciones ejecutadas, confirmar que no hubo
cruce de tenant ni fuga de PII al LLM, endurecer guards (`agent.rag.ts`).

### 🧨 Ransomware
Aislar el VPS/segmento, NO pagar, restaurar desde backup offline/inmutable, medir RPO/RTO reales,
investigar vector de entrada (phishing/CVE/credencial).

### 🎣 Cuenta comprometida (credential stuffing / phishing)
Forzar logout + reset, revisar acciones del atacante, activar 2FA, revisar login anómalo de otras cuentas.

---

## SOAR (automatización — Nivel 5)

Objetivo a futuro: respuestas automáticas ante señales claras — bloquear IP tras N fallos de login,
revocar token ante uso desde geo imposible, aislar contenedor ante alerta de Falco, abrir tarea de
incidente automáticamente. Empezar manual (runbooks), automatizar lo repetible.

---

## Roles y comunicación

- **Quién decide** contener/apagar (puede afectar disponibilidad del negocio).
- **A quién se notifica**: dueño del negocio, y — si hay PII — a los titulares y la autoridad según Ley 1581.
- **Registro**: cada incidente queda documentado (línea de tiempo, impacto, acciones) y enlazado a [[memory/important-fixes]].

---

← [[security/tools]] | [[security/README]] | → [[security/kpis]]
