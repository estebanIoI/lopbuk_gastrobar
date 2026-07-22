# 🧰 Herramientas de Seguridad

> Qué usar y **dónde encaja** en el ciclo de DAIMUZ. Preferir open-source y lo que se integre
> al pipeline (Fase 10). No hay que tener todo: adoptar por olas ([[context/plan-auditoria-seguridad-2026]]).

---

## Por etapa del pipeline

| Etapa | Herramienta | Para qué en DAIMUZ |
|---|---|---|
| **SAST** (código) | SonarQube · Semgrep | Analizar el backend Express/TS y el frontend en CI |
| **DAST** (app viva) | OWASP ZAP · Burp Suite Pro | Probar API/storefront ya desplegados |
| **Secretos** | GitLeaks | Bloquear JWT/keys de Gemini/OpenAI/Wompi en cada push |
| **Dependencias / SBOM** | Snyk · Dependabot · `npm audit` | CVEs en dependencias npm, generar SBOM |
| **Contenedores / imágenes** | Trivy | CVEs en imágenes Docker base y del build |
| **Red / puertos** | Nmap | Confirmar que solo 80/443 están expuestos en el VPS |
| **Vuln scanning** | Nessus · OpenVAS | Escaneo de vulnerabilidades del host/servicios |
| **Runtime / contenedores** | Falco | Detectar comportamiento anómalo en contenedores |
| **SIEM / detección** | Wazuh · Elastic SIEM · Splunk | Centralizar logs de app/Traefik/MySQL/Docker |
| **IDS / red** | Suricata · Zeek · Wireshark | Inspección de tráfico, detección de intrusiones |
| **EDR** | Microsoft Defender for Cloud · CrowdStrike | Protección de endpoint/host (anti-ransomware) |
| **Secret management** | HashiCorp Vault | Centralizar y rotar secretos (objetivo) |

---

## Mínimo viable para empezar (Ola 1)

Sin costo y de alto impacto, integrables ya:

1. **GitLeaks** — evita el peor error (secreto en git). Barato, inmediato.
2. **`npm audit` + Dependabot** — visibilidad de la cadena de suministro.
3. **Trivy** — escanear imágenes Docker antes de deploy.
4. **Nmap** — confirmar superficie de red del VPS (MySQL/Redis cerrados).
5. **OWASP ZAP** — primer DAST contra la API/storefront.
6. **Wazuh** — SIEM open-source para arrancar el monitoreo (Fase 15).

> Estas seis cubren buena parte de los riesgos 2026 #5 (supply chain), #6 (misconfig),
> #7 (secretos) y dan base para #4 (APIs) y #9 (explotación rápida).

---

## Específicas para IA (Fase 7)

Para el agente (`agent.rag.ts`, `agent.tools.ts`): baterías de **prompt injection** (jailbreaks,
inyección indirecta), pruebas de **function calling abuse** y de **RAG poisoning**. Guías de referencia:
OWASP Top 10 for LLM Applications y MITRE ATLAS. Complementar con límites de gasto y rate limit propios.

---

← [[security/kpis]] | [[security/README]] | → [[security/incident-response]]
