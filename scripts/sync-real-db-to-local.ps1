[CmdletBinding()]
param(
  [string]$SourceEnvFile = '.env.real.local',
  [string]$MysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.0\bin',
  [switch]$SkipLocalSetup,
  [switch]$NoLocalBackup,
  [switch]$KeepDump,
  [switch]$ReplaceLocalDatabase
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$localHostName = '127.0.0.1'
$localPort = 3308
$localDatabase = 'pariflow_partners'
$localUser = 'pariflow_app'
$localPassword = 'PariFlowLocal!2026'

function Resolve-ToolPath {
  param(
    [string]$Name,
    [string]$PreferredDirectory
  )

  $candidateDirectories = @(
    $PreferredDirectory,
    'D:\Program Files\MySQL\MySQL Server 8.0\bin',
    'C:\Program Files\MySQL\MySQL Server 8.0\bin',
    'C:\Program Files\MySQL\MySQL Workbench 8.0'
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

  throw "$Name nao encontrado. Informe -MysqlBin com o diretorio do MySQL Server 8.0\bin."
}

function Read-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Arquivo $Path nao encontrado. Copie .env.real.example para $Path e preencha as credenciais."
  }

  $values = @{}

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith('#')) {
      return
    }

    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) {
      return
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Require-EnvValue {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  if (-not $Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
    throw "$Name nao configurado em $SourceEnvFile."
  }

  return [string]$Values[$Name]
}

function Read-OptionalEnvValue {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  if (-not $Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
    return $null
  }

  return [string]$Values[$Name]
}

function Convert-DatabaseUrlToSource {
  param([string]$DatabaseUrl)

  try {
    $uri = [System.Uri]$DatabaseUrl
  } catch {
    throw 'DATABASE_URL invalida no arquivo de origem.'
  }

  if ($uri.Scheme -ne 'mysql') {
    throw 'Apenas DATABASE_URL mysql:// e suportada por este script.'
  }

  $userInfo = $uri.UserInfo -split ':', 2
  if ($userInfo.Count -lt 1 -or [string]::IsNullOrWhiteSpace($userInfo[0])) {
    throw 'DATABASE_URL precisa conter usuario.'
  }

  $databaseName = $uri.AbsolutePath.TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($databaseName)) {
    throw 'DATABASE_URL precisa conter nome do banco.'
  }

  $queryValues = @{}
  $uri.Query.TrimStart('?').Split('&') |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object {
      $parts = $_ -split '=', 2
      $key = [System.Uri]::UnescapeDataString($parts[0])
      $value = if ($parts.Count -gt 1) {
        [System.Uri]::UnescapeDataString($parts[1])
      } else {
        ''
      }
      $queryValues[$key.ToLowerInvariant()] = $value
    }

  $sslMode = $queryValues['ssl-mode']
  if ([string]::IsNullOrWhiteSpace($sslMode)) {
    $sslMode = $queryValues['sslmode']
  }

  return @{
    Host = $uri.Host
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 3306 }
    User = [System.Uri]::UnescapeDataString($userInfo[0])
    Password = if ($userInfo.Count -gt 1) {
      [System.Uri]::UnescapeDataString($userInfo[1])
    } else {
      ''
    }
    Database = [System.Uri]::UnescapeDataString($databaseName)
    SslMode = $sslMode
  }
}

function Resolve-SourceDatabase {
  param([hashtable]$Values)

  $databaseUrl = Read-OptionalEnvValue -Values $Values -Name 'DATABASE_URL'
  if ($databaseUrl) {
    return Convert-DatabaseUrlToSource -DatabaseUrl $databaseUrl
  }

  $realHost = Read-OptionalEnvValue -Values $Values -Name 'REAL_DB_HOST'

  if ($realHost) {
    return @{
      Host = $realHost
      Port = [int](Require-EnvValue -Values $Values -Name 'REAL_DB_PORT')
      User = Require-EnvValue -Values $Values -Name 'REAL_DB_USER'
      Password = Require-EnvValue -Values $Values -Name 'REAL_DB_PASSWORD'
      Database = Require-EnvValue -Values $Values -Name 'REAL_DB_NAME'
      SslMode = Read-OptionalEnvValue -Values $Values -Name 'REAL_DB_SSL_MODE'
    }
  }

  throw "Nenhuma origem encontrada em $SourceEnvFile. Configure REAL_DB_* ou DATABASE_URL."
}

function Invoke-NativeChecked {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$ErrorMessage
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw $ErrorMessage
  }
}

function Invoke-NativeWithInputFile {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$InputFile,
    [string]$ErrorMessage
  )

  $stderrFile = Join-Path $repoRoot ".local\tmp\mysql-import-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds()).err"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $stderrFile) | Out-Null

  $process = Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -RedirectStandardInput $InputFile `
    -RedirectStandardError $stderrFile `
    -NoNewWindow `
    -Wait `
    -PassThru

  if ($process.ExitCode -ne 0) {
    if (Test-Path $stderrFile) {
      Get-Content $stderrFile -Tail 80
    }

    throw $ErrorMessage
  }
}

if (-not $ReplaceLocalDatabase) {
  throw 'Este script substitui o banco LOCAL. Rode novamente com -ReplaceLocalDatabase para confirmar.'
}

$source = Read-EnvFile -Path $SourceEnvFile
$mysql = Resolve-ToolPath -Name 'mysql.exe' -PreferredDirectory $MysqlBin
$mysqldump = Resolve-ToolPath -Name 'mysqldump.exe' -PreferredDirectory $MysqlBin

$sourceDatabaseConfig = Resolve-SourceDatabase -Values $source
$sourceHost = $sourceDatabaseConfig.Host
$sourcePort = [int]$sourceDatabaseConfig.Port
$sourceUser = $sourceDatabaseConfig.User
$sourcePassword = $sourceDatabaseConfig.Password
$sourceDatabase = $sourceDatabaseConfig.Database
$sourceSslMode = $sourceDatabaseConfig.SslMode

if (
  @('127.0.0.1', 'localhost', '::1') -contains $sourceHost -and
  $sourcePort -eq $localPort -and
  $sourceDatabase -eq $localDatabase
) {
  throw 'A origem REAL_DB_* aponta para o proprio banco local. Revise .env.real.local.'
}

if (-not $SkipLocalSetup) {
  & (Join-Path $PSScriptRoot 'setup-local-mysql.ps1')
}

$backupDir = Join-Path $repoRoot '.local\backups'
$dumpDir = Join-Path $repoRoot '.local\dumps'
New-Item -ItemType Directory -Force -Path $backupDir, $dumpDir | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$realDumpFile = Join-Path $dumpDir "real-$sourceDatabase-$timestamp.sql"
$localBackupFile = Join-Path $backupDir "before-real-sync-$localDatabase-$timestamp.sql"

$previousMysqlPwd = $env:MYSQL_PWD

try {
  if (-not $NoLocalBackup) {
    Write-Host "Gerando backup do banco local em $localBackupFile"
    $env:MYSQL_PWD = $localPassword
    $localDumpArgs = @(
      '--protocol=TCP',
      '-h', $localHostName,
      '-P', [string]$localPort,
      '-u', $localUser,
      '--single-transaction',
      '--quick',
      '--routines',
      '--triggers',
      '--events',
      '--no-tablespaces',
      '--default-character-set=utf8mb4',
      "--result-file=$localBackupFile",
      $localDatabase
    )
    Invoke-NativeChecked -FilePath $mysqldump -ArgumentList $localDumpArgs -ErrorMessage 'Falha ao gerar backup do banco local.'
  }

  Write-Host "Gerando dump somente leitura da origem $sourceHost`:$sourcePort/$sourceDatabase"
  $env:MYSQL_PWD = $sourcePassword
  $sourceDumpArgs = @(
    '--protocol=TCP',
    '-h', $sourceHost,
    '-P', [string]$sourcePort,
    '-u', $sourceUser,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--events',
    '--no-tablespaces',
    '--default-character-set=utf8mb4',
    '--set-gtid-purged=OFF',
    "--result-file=$realDumpFile",
    $sourceDatabase
  )

  if (-not [string]::IsNullOrWhiteSpace($sourceSslMode)) {
    $sourceDumpArgs = @("--ssl-mode=$sourceSslMode") + $sourceDumpArgs
  }

  Invoke-NativeChecked -FilePath $mysqldump -ArgumentList $sourceDumpArgs -ErrorMessage 'Falha ao gerar dump da origem real.'

  Write-Host "Limpando somente o banco local $localHostName`:$localPort/$localDatabase"
  $env:MYSQL_PWD = $localPassword
  $clearSql = @'
SET SESSION group_concat_max_len = 1000000;
SET FOREIGN_KEY_CHECKS = 0;
SET @tables = (
  SELECT GROUP_CONCAT(CONCAT('`', table_name, '`') SEPARATOR ',')
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
);
SET @drop_statement = IF(@tables IS NULL, 'SELECT 1', CONCAT('DROP TABLE ', @tables));
PREPARE stmt FROM @drop_statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET FOREIGN_KEY_CHECKS = 1;
'@

  $clearArgs = @(
    '--protocol=TCP',
    '-h', $localHostName,
    '-P', [string]$localPort,
    '-u', $localUser,
    $localDatabase,
    "--execute=$clearSql"
  )
  Invoke-NativeChecked -FilePath $mysql -ArgumentList $clearArgs -ErrorMessage 'Falha ao limpar o banco local antes da restauracao.'

  Write-Host "Restaurando dump real no banco local $localHostName`:$localPort/$localDatabase"
  $importArgs = @(
    '--protocol=TCP',
    '-h', $localHostName,
    '-P', [string]$localPort,
    '-u', $localUser,
    '--default-character-set=utf8mb4',
    $localDatabase
  )
  Invoke-NativeWithInputFile -FilePath $mysql -ArgumentList $importArgs -InputFile $realDumpFile -ErrorMessage 'Falha ao restaurar dump no banco local.'

  Write-Host 'Sincronizacao concluida.'
  Write-Host "Backup local anterior: $localBackupFile"

  if ($KeepDump) {
    Write-Host "Dump real mantido em: $realDumpFile"
  } else {
    Remove-Item -LiteralPath $realDumpFile -Force
    Write-Host 'Dump real removido apos restauracao. O backup local anterior foi mantido.'
  }
} finally {
  if ($null -eq $previousMysqlPwd) {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  } else {
    $env:MYSQL_PWD = $previousMysqlPwd
  }
}
