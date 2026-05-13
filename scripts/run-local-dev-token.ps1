[CmdletBinding()]
param(
  [ValidateSet('127.0.0.1', 'localhost', '::1')]
  [string]$ListenHost = '127.0.0.1',
  [ValidateRange(1, 65535)]
  [int]$Port = 3000,
  [string]$DatabaseUrl = 'mysql://pariflow_app:PariFlowLocal%212026@127.0.0.1:3308/pariflow_partners',
  [switch]$SkipDatabaseSetup,
  [switch]$SkipMigrations,
  [switch]$EnableNotificationWorker
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$env:NODE_ENV = 'development'
$env:HOST = $ListenHost
$env:PORT = [string]$Port
$env:DATABASE_URL = $DatabaseUrl
$env:DEV_AUTH_BYPASS = 'true'
$env:PREVIEW_AUTH_BYPASS = 'false'
$env:NOTIFICATION_OUTBOX_WORKER_ENABLED = if ($EnableNotificationWorker) { 'true' } else { 'false' }

$portInUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($portInUse) {
  throw "A porta $Port ja esta em uso. Encerre o back local antigo ou informe outro -Port."
}

if (-not $SkipDatabaseSetup) {
  & (Join-Path $PSScriptRoot 'setup-local-mysql.ps1')
}

if (-not $SkipMigrations) {
  npm.cmd run prisma:migrate:deploy
}

Write-Host "PariFlow back local: http://$ListenHost`:$Port"
Write-Host 'Banco local do projeto: 127.0.0.1:3308/pariflow_partners'
Write-Host 'DEV_AUTH_BYPASS=true somente neste processo local.'
Write-Host "NOTIFICATION_OUTBOX_WORKER_ENABLED=$($env:NOTIFICATION_OUTBOX_WORKER_ENABLED)"

npm.cmd run dev
