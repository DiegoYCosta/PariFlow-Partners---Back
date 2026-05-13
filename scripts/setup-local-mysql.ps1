$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$mysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.0\bin'
$confDir = Join-Path $root '.local\mysql\conf'
$config = Join-Path $root '.local\mysql\conf\my.ini'
$initFile = Join-Path $root '.local\mysql\conf\init-dev.sql'
$dataDir = Join-Path $root '.local\mysql\data'
$logDir = Join-Path $root '.local\mysql\logs'
$runDir = Join-Path $root '.local\mysql\run'
$errorLog = Join-Path $root '.local\mysql\logs\mysql-error.log'
$pidFile = Join-Path $root '.local\mysql\run\mysql.pid'
$password = 'PariFlowLocal!2026'
$database = 'pariflow_partners'
$appUser = 'pariflow_app'

function Resolve-MySqlTool {
  param([string]$Name)

  $candidateDirectories = @(
    $mysqlBin,
    'D:\Program Files\MySQL\MySQL Server 8.0\bin',
    'C:\Program Files\MySQL\MySQL Server 8.0\bin'
  )

  foreach ($directory in $candidateDirectories) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
      continue
    }

    $candidate = Join-Path $directory $Name
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return $candidate
    }
  }

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "$Name nao encontrado. Instale MySQL Server 8.0 ou adicione o binario ao PATH."
}

$mysqld = Resolve-MySqlTool -Name 'mysqld.exe'
$mysql = Resolve-MySqlTool -Name 'mysql.exe'

New-Item -ItemType Directory -Force -Path $confDir, $dataDir, $logDir, $runDir | Out-Null

if (-not (Test-Path $config)) {
  $mysqlDataDir = $dataDir.Replace('\', '/')
  $mysqlErrorLog = $errorLog.Replace('\', '/')
  $mysqlPidFile = $pidFile.Replace('\', '/')

  @"
[mysqld]
port=3308
bind-address=127.0.0.1
datadir=$mysqlDataDir
log-error=$mysqlErrorLog
pid-file=$mysqlPidFile
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
sql_mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION

[client]
default-character-set=utf8mb4
"@ | Set-Content -Path $config -Encoding ascii
}

$escapedPassword = $password.Replace("'", "''")
$quotedDatabase = "``$database``"
@"
CREATE DATABASE IF NOT EXISTS $quotedDatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$appUser'@'127.0.0.1' IDENTIFIED BY '$escapedPassword';
CREATE USER IF NOT EXISTS '$appUser'@'localhost' IDENTIFIED BY '$escapedPassword';
ALTER USER '$appUser'@'127.0.0.1' IDENTIFIED BY '$escapedPassword';
ALTER USER '$appUser'@'localhost' IDENTIFIED BY '$escapedPassword';
GRANT ALL PRIVILEGES ON $quotedDatabase.* TO '$appUser'@'127.0.0.1';
GRANT ALL PRIVILEGES ON $quotedDatabase.* TO '$appUser'@'localhost';
FLUSH PRIVILEGES;
"@ | Set-Content -Path $initFile -Encoding ascii

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
$previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
$env:MYSQL_PWD = $password
$PSNativeCommandUseErrorActionPreference = $false

try {
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
      & $mysql --protocol=TCP -h 127.0.0.1 -P 3308 -u $appUser -e "SELECT 1" $database 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
      }
    } catch {
      # MySQL can refuse TCP connections for a few seconds while the local
      # instance is starting. Keep polling until the readiness window expires.
    }
  }
} finally {
  $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
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
