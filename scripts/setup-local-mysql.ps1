$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$mysqlBin = 'D:\Program Files\MySQL\MySQL Server 8.0\bin'
$mysqld = Join-Path $mysqlBin 'mysqld.exe'
$mysql = Join-Path $mysqlBin 'mysql.exe'
$config = Join-Path $root '.local\mysql\conf\my.ini'
$initFile = Join-Path $root '.local\mysql\conf\init-dev.sql'
$dataDir = Join-Path $root '.local\mysql\data'
$errorLog = Join-Path $root '.local\mysql\logs\mysql-error.log'
$password = 'PariFlowLocal!2026'
$database = 'pariflow_partners'
$appUser = 'pariflow_app'

if (-not (Test-Path $mysqld)) {
  throw "mysqld.exe nao encontrado em $mysqld"
}

$systemTables = Join-Path $dataDir 'mysql'

if (-not (Test-Path $systemTables)) {
  & $mysqld "--defaults-file=$config" --initialize-insecure
}

$listening = Get-NetTCPConnection -LocalPort 3308 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if (-not $listening) {
  $command = "& '$mysqld' '--defaults-file=$config' '--init-file=$initFile' --console"
  Start-Process -FilePath powershell -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    $command
  ) -WorkingDirectory $root -WindowStyle Hidden | Out-Null
}

$ready = $false
$previousMysqlPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $password

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  & $mysql --protocol=TCP -h 127.0.0.1 -P 3308 -u $appUser -e "SELECT 1" $database 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
}

if ($null -eq $previousMysqlPwd) {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
} else {
  $env:MYSQL_PWD = $previousMysqlPwd
}

if (-not $ready) {
  if (Test-Path $errorLog) {
    Get-Content $errorLog -Tail 80
  }

  throw 'Instancia MySQL local nao respondeu na porta 3308.'
}

Write-Host 'MySQL local pronto em 127.0.0.1:3308'
Write-Host "Database: $database"
Write-Host "User: $appUser"
