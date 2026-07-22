# 🎯 Modelo de Amenazas 2026 — DAIMUZ

> El panorama cambió: los atacantes usan IA para automatizar phishing, generar deepfakes,
> descubrir vulnerabilidades en horas y moverse lateralmente. Hoy los objetivos principales
> son **identidad, APIs, nube, IA y cadena de suministro**. Este documento aterriza esas
> amenazas a la superficie real de DAIMUZ.

---

## 🧱 Superficie de ataque de DAIMUZ

```
                          Internet
                             │
                     ┌───────▼────────┐
                     │  Cloudflare/DNS │  ← DDoS, DNS hijack, cache poisoning
                     └───────┬────────┘
                     ┌───────▼────────┐
                     │  Traefik (VPS)  │  ← TLS, routing, headers, puertos expuestos
                     └───────┬────────┘
          ┌──────────────────┼──────────────────┐
   ┌──────▼──────┐    ┌──────▼──────┐    ┌───────▼───────┐
   │ Next.js SSR │    │ Express API │    │ Storefront/POS│  ← XSS, CSRF, IDOR, SQLi
   │  (frontend) │    │  (monolito) │    │  público/menú │
   └─────────────┘    └──────┬──────┘    └───────────────┘
                             │
        ┌────────────┬───────┼────────┬────────────┐
   ┌────▼───┐   ┌────▼───┐ ┌─▼────┐ ┌─▼──────┐ ┌───▼────────┐
   │ MySQL  │   │ Redis  │ │Agent │ │Webhooks│ │ Cloudinary │
   │(tenant)│   │(cache) │ │IA RAG│ │ pagos  │ │  (media)   │
   └────────┘   └────────┘ └──┬───┘ └────────┘ └────────────┘
                              │
                   ┌──────────┴──────────┐
              ┌────▼────┐          ┌──────▼──────┐
              │ Gemini/ │          │ Evolution   │  ← WhatsApp self-hosted
              │ OpenAI  │          │ API (WA)    │
              └─────────┘          └─────────────┘
```

**Activos críticos (joyas de la corona):** base MySQL multi-tenant · secretos (JWT secret,
keys de Gemini/OpenAI/SMTP/OAuth/Wompi) · `auth.middleware.ts` · el agente IA con function
calling · webhooks de pasarela · backups.

---

## 🚨 Los 10 riesgos prioritarios 2026 → mapeados a DAIMUZ

### 1. Robo de credenciales e identidad
- **Vector DAIMUZ:** credential stuffing / password spraying contra `/auth/login`; robo de JWT si se filtra por XSS o log; sesión de superadmin.
- **Controles:** JWT en cookie httpOnly (mitiga XSS-theft), rate limit + lockout en login, 2FA/passkeys (**gap actual**), rotación y revocación de refresh tokens, detección de login anómalo (UEBA). Ver [[security/audit-plan#fase-3]].

### 2. Phishing y deepfakes generados por IA
- **Vector DAIMUZ:** BEC/CEO fraud contra el dueño del negocio para autorizar cambios de precio masivos o pagos; deepfake de voz para soporte; smishing con el nombre de la tienda.
- **Controles:** aprobación humana para acciones sensibles ([[governance/approval-policy]]), verificación fuera de banda, simulacros a empleados. Ver [[security/audit-plan#fase-14]].

### 3. Ransomware automatizado
- **Vector DAIMUZ:** cifrado de MySQL/volúmenes Docker en el VPS; borrado de backups accesibles.
- **Controles:** backups **inmutables + offline**, snapshots cifrados, segmentación, pruebas reales de restore, RPO/RTO medidos. Ver [[security/audit-plan#fase-13]].

### 4. Compromiso de APIs
- **Vector DAIMUZ:** IDOR / BOLA en endpoints REST (leer datos de otro tenant), Shadow APIs sin documentar, WebSocket sin authz por sala, webhooks sin verificación de firma.
- **Controles:** authz por objeto + tenant en cada endpoint, rate limit, validación de entrada, inventario de APIs, verificación de firma de webhooks. Ver [[security/audit-plan#fase-6]].

### 5. Vulnerabilidades en la cadena de suministro
- **Vector DAIMUZ:** dependencia npm comprometida (typosquatting), imagen Docker base con CVE, acción de GitHub maliciosa.
- **Controles:** SBOM, Dependabot, `npm audit`, pin de versiones, escaneo de imágenes (Trivy), firma de artefactos. Ver [[security/audit-plan#fase-10]].

### 6. Errores de configuración en la nube
- **Vector DAIMUZ:** bucket/Cloudinary público, puertos de MySQL/Redis expuestos, Traefik dashboard abierto, `.env` accesible.
- **Controles:** revisión IaC, escaneo de config, puertos cerrados por defecto, secretos fuera del repo. Ver [[security/audit-plan#fase-9]] y [[security/audit-plan#fase-11]].

### 7. Exposición de secretos y claves API
- **Vector DAIMUZ:** JWT secret, keys de Gemini/OpenAI/SMTP/OAuth/Wompi filtradas en git, logs o el frontend bundle.
- **Controles:** GitLeaks en el pipeline, `.env` en `.gitignore`, rotación tras exposición, gestor de secretos (Vault). Ver [[security/audit-plan#fase-10]] y [[security/audit-plan#fase-12]].

### 8. Ataques contra aplicaciones de IA
- **Vector DAIMUZ:** prompt injection directo e indirecto (vía datos del catálogo, mensajes de WhatsApp o RAG), function calling abuse para ejecutar tools fuera del tenant, RAG/memory poisoning, fuga de datos sensibles al proveedor del LLM.
- **Controles:** guard en `agent.rag.ts` (nunca PII al contexto), toda tool valida tenant + permisos + aprobación, sandbox de function calling, saneo de fuentes RAG. Ver [[security/audit-plan#fase-7]]. **La auditoría más importante de 2026.**

### 9. Explotación acelerada de vulnerabilidades críticas
- **Vector DAIMUZ:** un CVE crítico en Express, Traefik, MySQL o una dependencia se explota en horas.
- **Controles:** auditoría continua, parcheo rápido, WAF, monitoreo de CVEs, ventana descubrimiento→mitigación mínima. Ver [[security/audit-plan#nivel-de-madurez]].

### 10. Amenazas internas y abuso de privilegios
- **Vector DAIMUZ:** empleado con rol elevado que exporta PII, superadmin comprometido, escalamiento vertical/horizontal.
- **Controles:** mínimo privilegio, auditoría de acciones (`audit_log`, `ChatAction`), separación de funciones, UEBA. Ver [[security/audit-plan#fase-4]].

---

## 🗺️ Mapeo MITRE ATT&CK → DAIMUZ

> Táctica → técnica representativa → dónde aplica en DAIMUZ → detección.

| Táctica | Técnica (ATT&CK) | En DAIMUZ | Detección |
|---|---|---|---|
| Initial Access | Valid Accounts (T1078) | Login con credenciales robadas | Login anómalo, geo/IP nueva |
| Initial Access | Exploit Public-Facing App (T1190) | Express/Traefik/storefront | WAF, logs 5xx, IDS (Suricata/Zeek) |
| Execution | LLM Prompt Injection (Atlas) | Agente IA / RAG | Filtros de prompt, logs del agente |
| Persistence | Account Manipulation (T1098) | Alta de usuario/rol oculto | Diff de roles, `audit_log` |
| Privilege Escalation | Exploitation for Priv Esc (T1068) | Escalamiento vertical vía IDOR | Chequeo authz por objeto |
| Defense Evasion | Impair Defenses (T1562) | Apagar logs/monitoreo | Alertas de integridad de logs |
| Credential Access | Brute Force (T1110) | `/auth/login` | Rate limit, lockout, alertas |
| Credential Access | Unsecured Credentials (T1552) | Secretos en git/logs/env | GitLeaks, escaneo de secretos |
| Discovery | Cloud/API Discovery (T1526/T1580) | Enumeración de endpoints | Rate limit, patrones de enumeración |
| Lateral Movement | Internal services (T1021) | Docker → MySQL/Redis | Segmentación de red, Falco |
| Collection | Data from Repos (T1213) | Export masivo de PII | Umbrales en `audit_log`, DLP |
| Exfiltration | Exfil over Web (T1041) | Salida hacia LLM/externos | Egress monitoring, net requests |
| Impact | Data Encrypted for Impact (T1486) | Ransomware sobre volúmenes | Backups inmutables, EDR |

> El **Red Team** ([[security/audit-plan#fase-16]]) ejecuta estas técnicas; el **Blue Team**
> ([[security/incident-response]]) las detecta y responde; el **SIEM** ([[security/audit-plan#fase-15]])
> mapea cada alerta a su técnica ATT&CK.

---

← [[security/README]] | → [[security/asset-inventory]]
