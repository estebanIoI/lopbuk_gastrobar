# 🛡️ Seguridad — compressed

> 10 líneas. El mínimo que todo agente debe interiorizar. Si necesitas más → [[security/README]].

- **Modelo objetivo:** auditoría continua. Cada deploy pasa SAST + DAST + escaneo de deps + IaC + monitoreo. La ventana entre descubrir y mitigar debe ser mínima.
- **Regla #1 (confidencialidad):** `tenant_id` SIEMPRE del JWT (`req.user.tenantId`), nunca del body/params/query. Toda query filtra por tenant. Romper esto = fuga cross-tenant = incidente crítico.
- **Regla #2 (identidad):** JWT en cookie httpOnly. No tocar `auth.middleware.ts` sin aprobación. Passwords con hash fuerte, tokens con expiración + rotación + revocación.
- **Regla #3 (PII, Ley 1581):** consentimiento antes de capturar; anonimizar para el olvido (no DELETE); `redactPII()` en logs; todo acceso/export/borrado auditado en `audit_log`. **NUNCA** PII de clientes al contexto RAG del LLM (guard en `agent.rag.ts`).
- **Regla #4 (IA):** el agente es superficie de ataque de primera clase → prompt injection, RAG poisoning, function calling abuse. Toda tool del agente valida tenant + permisos + aprobación y audita (`ChatAction`).
- **Top amenazas 2026:** identidad, phishing/deepfake IA, ransomware, APIs, cadena de suministro, misconfig cloud, secretos expuestos, ataques a IA, explotación en horas, insider.
- **Secretos:** nunca en git ni en logs. `.env` fuera del repo, rotación tras exposición. Gemini/OpenAI/SMTP/OAuth/Wompi keys = joyas de la corona.
- **Datos:** cifrado en tránsito (TLS) y en reposo (AES-256 donde aplique), backups **inmutables/offline** probados (RPO/RTO medidos), borrado seguro.
- **Ante incidente:** [[security/incident-response]] → detectar, contener, erradicar, recuperar, aprender. Medir MTTD/MTTR.
- **Región completa:** [[security/README]] · 17 fases en [[security/audit-plan]] · amenazas en [[security/threat-model-2026]].

---

← [[DAIMUZ]] | → [[security/README]]
