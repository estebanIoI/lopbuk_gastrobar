# ============================================================
#  dev.ps1 — Arranque del entorno de desarrollo (modo liviano)
#  BD en Docker · backend y frontend NATIVOS (recarga instantánea, poca RAM)
#  Uso:  .\dev.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host "1/3  Levantando la BD (MySQL en Docker)..." -ForegroundColor Cyan
docker compose -f "$root\docker-compose.db.yml" up -d | Out-Null

# Espera a que la BD esté healthy (máx ~60s)
for ($i = 0; $i -lt 12; $i++) {
  $st = docker inspect lopbuk_db --format '{{.State.Health.Status}}' 2>$null
  if ($st -eq 'healthy') { break }
  Start-Sleep -Seconds 5
}
Write-Host "     BD lista (lopbuk @ localhost:3307)." -ForegroundColor DarkGray

Write-Host "2/3  Backend nativo  → http://localhost:3001/api" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm run dev"

Write-Host "3/3  Frontend nativo → http://localhost:3000" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Listo. Se abrieron 2 ventanas (backend y frontend) con hot-reload." -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000   API: http://localhost:3001/api" -ForegroundColor Green
Write-Host "  Editas un archivo → recarga al instante en su ventana." -ForegroundColor DarkGray
Write-Host "  Apagar apps: Ctrl+C en cada ventana.  Apagar BD: docker compose -f docker-compose.db.yml down" -ForegroundColor DarkGray
