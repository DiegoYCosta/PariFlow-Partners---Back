[CmdletBinding()]
param(
  [ValidateSet('127.0.0.1', 'localhost', '::1')]
  [string]$ListenHost = '127.0.0.1',
  [ValidateRange(1, 65535)]
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$env:NODE_ENV = 'development'
$env:HOST = $ListenHost
$env:PORT = [string]$Port
$env:DEV_AUTH_BYPASS = 'true'
$env:PREVIEW_AUTH_BYPASS = 'false'

Write-Host "PariFlow back local: http://$ListenHost`:$Port"
Write-Host 'DEV_AUTH_BYPASS=true somente neste processo local.'

npm.cmd run dev
