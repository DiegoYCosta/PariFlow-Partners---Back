$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$config = Join-Path $root '.local\mysql\conf\my.ini'

$processes = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'mysqld.exe' -and
    $_.CommandLine -like "*$config*"
  }

if (-not $processes) {
  Write-Host 'Nenhuma instancia MySQL local do projeto estava em execucao.'
  exit 0
}

$processes | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force
}

Write-Host 'Instancia MySQL local do projeto encerrada.'
