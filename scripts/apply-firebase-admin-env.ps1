param(
  [Parameter(Mandatory = $true)]
  [string]$ServiceAccountJson,

  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ServiceAccountJson)) {
  throw "Service Account JSON nao encontrado: $ServiceAccountJson"
}

$account = Get-Content -Raw -LiteralPath $ServiceAccountJson | ConvertFrom-Json

if (-not $account.project_id -or -not $account.client_email -or -not $account.private_key) {
  throw "JSON invalido: esperado project_id, client_email e private_key."
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Copy-Item -LiteralPath ".env.example" -Destination $EnvFile
}

$privateKey = [string]$account.private_key
$privateKey = $privateKey -replace "`r?`n", "\n"

$updates = [ordered]@{
  FIREBASE_PROJECT_ID = [string]$account.project_id
  FIREBASE_CLIENT_EMAIL = [string]$account.client_email
  FIREBASE_PRIVATE_KEY = $privateKey
}

$lines = Get-Content -LiteralPath $EnvFile
foreach ($key in $updates.Keys) {
  $value = $updates[$key]
  $pattern = "^\s*$([Regex]::Escape($key))="
  $replacement = "$key=$value"
  $found = $false
  $lines = foreach ($line in $lines) {
    if ($line -match $pattern) {
      $found = $true
      $replacement
    } else {
      $line
    }
  }
  if (-not $found) {
    $lines += $replacement
  }
}

$lines | Set-Content -LiteralPath $EnvFile -Encoding UTF8

Write-Host "Firebase Admin aplicado em $EnvFile."
Write-Host "Project ID: $($account.project_id)"
Write-Host "Client email configurado; private key nao exibida."
