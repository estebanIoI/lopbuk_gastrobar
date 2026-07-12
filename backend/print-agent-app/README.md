# DAIMUZ — Agente de Impresión

Programa que corre en un PC del local (misma red LAN que las impresoras Ethernet) y recibe
los tickets de cocina/bar desde la nube para imprimirlos localmente. El backend en la nube
no puede alcanzar las IP privadas `192.168.x.x` de las impresoras; este agente hace de puente.

## Cómo se usa (comerciante)

1. En el panel: **Administración → Impresoras → Programa de impresión → Descargar programa**.
2. Abrir el `.exe` descargado. Windows mostrará SmartScreen (programa sin firmar) → **Más
   información → Ejecutar de todas formas**.
3. Pegar el **código de vinculación** que muestra el panel. Queda vinculado y se registra para
   **arrancar solo con Windows**. Se puede minimizar; imprime automáticamente.

## Build del .exe (desarrollo)

```bash
cd backend/print-agent-app
npm install          # instala pkg (devDependency)
npm run build        # genera ../assets/print-agent.exe
```

> En el despliegue (Docker) el `.exe` se compila automáticamente en el build del backend
> y queda en `/app/assets/print-agent.exe` (ver `backend/Dockerfile`). No hace falta
> compilarlo a mano para producción.

El backend sirve ese binario en `GET /api/print-agent/download`. La ruta se puede cambiar con
la variable de entorno `PRINT_AGENT_BINARY_PATH`.

## Configuración

- API del servidor: variable `DAIMUZ_API` (por defecto `https://daimuz.alexsters.works/api`).
- Config del usuario (token): `%APPDATA%\DAIMUZ-Impresion\config.json`.

## Notas

- Sin dependencias externas (solo módulos nativos de Node) → empaquetado limpio.
- Para quitar el aviso de SmartScreen se requiere un **certificado de firma de código**
  (Authenticode), de pago. Sin firmar funciona, solo pide una confirmación extra la 1ª vez.
- La cola de trabajos (`/print-agent/heartbeat` → jobs, `/jobs/:id/done`) se completa en el
  siguiente paso; hoy el agente ya vincula, hace heartbeat y está listo para recibir jobs.
