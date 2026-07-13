/**
 * DAIMUZ — Agente de Impresión local.
 *
 * Corre en un PC del local (misma red LAN que las impresoras Ethernet). Recibe los tickets
 * de cocina/bar desde la nube y los envía por TCP a la impresora (que el servidor en la nube
 * no puede alcanzar por estar en una red privada).
 *
 * Primer arranque: pide el CÓDIGO DE VINCULACIÓN que el comerciante ve en su panel
 * (Administración → Impresoras → Programa de impresión). Lo canjea por un token durable,
 * lo guarda, y se registra para arrancar solo con Windows. Luego queda escuchando.
 *
 * Empaquetado a .exe con `pkg` (ver package.json). Sin dependencias externas: solo Node.
 */
'use strict';

const https = require('https');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execFile } = require('child_process');
const { URL } = require('url');

// Base del API público. Se puede sobreescribir con la variable de entorno DAIMUZ_API.
const API_BASE = process.env.DAIMUZ_API || 'https://daimuz.alexsters.works/api';
const APP_NAME = 'DAIMUZ-Impresion';
const HEARTBEAT_MS = 5000;

// Carpeta de configuración del usuario (Windows: %APPDATA%\DAIMUZ-Impresion).
const CONFIG_DIR = path.join(process.env.APPDATA || os.homedir(), APP_NAME);
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function log(...args) {
  const ts = new Date().toLocaleTimeString('es-CO');
  console.log(`[${ts}]`, ...args);
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// ── HTTP helper (JSON) sobre http/https nativo ──
function apiRequest(method, urlPath, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + urlPath);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['x-agent-token'] = token;

    const req = lib.request(
      { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers, timeout: 15000 },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = {};
          try { json = JSON.parse(data); } catch { /* respuesta no-JSON */ }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Enviar bytes ESC/POS a la impresora por TCP (LAN) ──
function sendToPrinter(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port || 9100, ip, () => {
      socket.write(buffer, () => socket.end());
    });
    socket.setTimeout(8000);
    socket.on('error', reject);
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`timeout ${ip}:${port}`)); });
    socket.on('close', () => resolve());
  });
}

// Script PowerShell que envía bytes RAW al spooler de Windows (impresoras USB/instaladas).
const PS_RAWPRINT = `param([string]$PrinterName, [string]$FilePath)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class DaimuzRaw {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool StartDocPrinter(IntPtr h, int level, ref DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);
  public static void Send(string printer, byte[] bytes) {
    IntPtr h;
    if(!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("No se pudo abrir la impresora: " + printer);
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "DAIMUZ Ticket"; di.pDataType = "RAW";
      if(!StartDocPrinter(h, 1, ref di)) throw new Exception("StartDocPrinter fallo");
      StartPagePrinter(h);
      int written; WritePrinter(h, bytes, bytes.Length, out written);
      EndPagePrinter(h); EndDocPrinter(h);
    } finally { ClosePrinter(h); }
  }
}
"@
[DaimuzRaw]::Send($PrinterName, [System.IO.File]::ReadAllBytes($FilePath))
Write-Output "OK"`;

// ── Imprimir por el spooler de Windows (impresora USB por nombre) ──
function printRawWindows(printerName, buffer) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return reject(new Error('La impresión USB solo funciona en Windows'));
    if (!printerName) return reject(new Error('Falta el nombre de la impresora en Windows'));
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2);
    const tmpData = path.join(os.tmpdir(), `daimuz-${stamp}.bin`);
    const tmpPs = path.join(os.tmpdir(), `daimuz-${stamp}.ps1`);
    try { fs.writeFileSync(tmpData, buffer); fs.writeFileSync(tmpPs, PS_RAWPRINT); }
    catch (e) { return reject(e); }
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpPs, '-PrinterName', printerName, '-FilePath', tmpData],
      { timeout: 15000 }, (err, stdout, stderr) => {
        try { fs.unlinkSync(tmpData); fs.unlinkSync(tmpPs); } catch { /* ignore */ }
        if (err) return reject(new Error((String(stderr) || err.message || 'error al imprimir por Windows').trim()));
        if (String(stdout).includes('OK')) resolve();
        else reject(new Error(String(stdout || stderr || 'sin respuesta').trim()));
      });
  });
}

// ── Registrar auto-inicio con Windows (clave Run de HKCU) ──
function registerAutoStart() {
  if (process.platform !== 'win32') return;
  const exePath = process.execPath; // ruta del .exe empaquetado
  execFile('reg', [
    'add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    '/v', APP_NAME, '/t', 'REG_SZ', '/d', `"${exePath}"`, '/f',
  ], (err) => {
    if (err) log('No se pudo registrar el auto-inicio (continúa igual):', err.message);
    else log('Auto-inicio con Windows activado.');
  });
}

// ── Vinculación en el primer arranque ──
function askCode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('\nPega el CÓDIGO DE VINCULACIÓN de tu panel y presiona Enter:\n> ', (ans) => {
      rl.close();
      resolve(String(ans || '').trim().toUpperCase());
    });
  });
}

async function pair() {
  const name = os.hostname();
  for (;;) {
    const code = await askCode();
    if (!code) { console.log('Código vacío, intenta de nuevo.'); continue; }
    try {
      const { status, json } = await apiRequest('POST', '/print-agent/pair', { body: { code, name } });
      if (status === 200 && json.success && json.data?.token) {
        log(`Vinculado con: ${json.data.tenantName}`);
        return json.data.token;
      }
      console.log('❌', json.error || `No se pudo vincular (HTTP ${status}). Verifica el código.`);
    } catch (e) {
      console.log('❌ Error de conexión:', e.message, '- reintenta.');
    }
  }
}

// ── Procesar un trabajo de impresión ──
async function processJob(job, token) {
  try {
    const buffer = Buffer.from(job.dataBase64, 'base64');
    if (job.connectionType === 'usb') {
      await printRawWindows(job.printerName, buffer);
      log(`Impreso ${job.area || ''} (job ${job.id}) en USB "${job.printerName}"`);
    } else {
      await sendToPrinter(job.ip, job.port, buffer);
      log(`Impreso ${job.area || ''} (job ${job.id}) en ${job.ip}:${job.port}`);
    }
    await apiRequest('POST', `/print-agent/jobs/${job.id}/done`, { token });
  } catch (e) {
    log(`Falló impresión job ${job.id}:`, e.message);
    await apiRequest('POST', `/print-agent/jobs/${job.id}/failed`, { token, body: { error: e.message } }).catch(() => {});
  }
}

// ── Bucle principal: heartbeat + recoger trabajos ──
async function loop(token) {
  for (;;) {
    try {
      const { status, json } = await apiRequest('POST', '/print-agent/heartbeat', { token });
      if (status === 401) {
        log('El token dejó de ser válido. Elimina la config y vuelve a vincular.');
        return;
      }
      const jobs = (json && json.data && json.data.jobs) || [];
      for (const job of jobs) await processJob(job, token);
    } catch (e) {
      // Sin conexión: reintenta en el próximo ciclo (no rompe).
    }
    await new Promise((r) => setTimeout(r, HEARTBEAT_MS));
  }
}

async function main() {
  console.log('════════════════════════════════════════');
  console.log('   DAIMUZ — Agente de Impresión');
  console.log('════════════════════════════════════════');
  log('Servidor:', API_BASE);

  const cfg = loadConfig();
  let token = cfg.token;

  if (!token) {
    token = await pair();
    saveConfig({ token, pairedAt: new Date().toISOString() });
    registerAutoStart();
  } else {
    log('Ya vinculado. Escuchando trabajos de impresión…');
  }

  console.log('\n✅ Listo. Puedes minimizar esta ventana. Imprimirá automáticamente.\n');
  await loop(token);
}

main().catch((e) => { console.error('Error fatal:', e); process.exit(1); });
