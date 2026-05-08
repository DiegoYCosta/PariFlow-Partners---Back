param(
  [Parameter(Mandatory = $true)]
  [string]$ServiceAccountJson,

  [string]$RemoteUser = "ec2-user",
  [string]$RemoteHost = "ec2-3-18-213-49.us-east-2.compute.amazonaws.com",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\Yar-C2.pem",
  [string]$RemoteBackDir = "/var/www/pariflow-back",
  [string]$Pm2AppName = "pariflow-back"
)

$ErrorActionPreference = "Stop"

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Comando falhou ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
  }
}

if (-not (Test-Path -LiteralPath $ServiceAccountJson)) {
  throw "Service Account JSON nao encontrado: $ServiceAccountJson"
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "Chave SSH nao encontrada: $KeyPath"
}

$account = Get-Content -Raw -LiteralPath $ServiceAccountJson | ConvertFrom-Json
if (-not $account.project_id -or -not $account.client_email -or -not $account.private_key) {
  throw "JSON invalido: esperado project_id, client_email e private_key."
}

$privateKey = [string]$account.private_key
$privateKey = $privateKey -replace "`r?`n", "\n"

$Remote = "$RemoteUser@$RemoteHost"
$SshArgs = @(
  "-i", $KeyPath,
  "-o", "ConnectTimeout=30",
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=4",
  "-o", "StrictHostKeyChecking=accept-new"
)

$PatchId = [guid]::NewGuid().ToString("N")
$LocalPatch = Join-Path ([System.IO.Path]::GetTempPath()) "pariflow-firebase-admin-$PatchId.env"
$RemotePatch = "/tmp/pariflow-firebase-admin-$PatchId.env"

try {
  $patchLines = @(
    "FIREBASE_PROJECT_ID=$($account.project_id)"
    "FIREBASE_CLIENT_EMAIL=$($account.client_email)"
    "FIREBASE_PRIVATE_KEY=$privateKey"
  )
  [System.IO.File]::WriteAllLines(
    $LocalPatch,
    $patchLines,
    [System.Text.UTF8Encoding]::new($false)
  )

  Invoke-Native "scp.exe" ($SshArgs + @($LocalPatch, "$Remote`:$RemotePatch"))

  $RemoteScript = @'
set -euo pipefail

back_dir="$1"
patch_file="$2"
pm2_app_name="$3"
env_file="$back_dir/.env"

if [[ ! -f "$env_file" ]]; then
  rm -f "$patch_file"
  echo "Arquivo $env_file nao existe." >&2
  exit 1
fi

chmod 600 "$patch_file"

node - "$env_file" "$patch_file" <<'NODE'
const fs = require('fs');

const [envPath, patchPath] = process.argv.slice(2);
const updates = new Map();
for (const line of fs.readFileSync(patchPath, 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith('#')) {
    continue;
  }
  const separator = line.indexOf('=');
  if (separator <= 0) {
    continue;
  }
  const key = line.slice(0, separator).replace(/^\uFEFF/, '').trim();
  updates.set(key, line.slice(separator + 1));
}

let lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
if (lines.length > 0 && lines[lines.length - 1] === '') {
  lines = lines.slice(0, -1);
}

const seen = new Set();
lines = lines.map((line) => {
  const separator = line.indexOf('=');
  const rawKey = separator >= 0 ? line.slice(0, separator) : '';
  const key = rawKey.replace(/^\uFEFF/, '').trim();
  const value = separator >= 0 ? line.slice(separator + 1) : '';
  if (!updates.has(key)) {
    return rawKey === key ? line : `${key}=${value}`;
  }
  seen.add(key);
  return `${key}=${updates.get(key)}`;
});

for (const [key, value] of updates) {
  if (!seen.has(key)) {
    lines.push(`${key}=${value}`);
  }
}

fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { mode: 0o600 });
NODE

chmod 600 "$env_file"
rm -f "$patch_file"

pm2 restart "$pm2_app_name" --update-env >/dev/null
pm2 save >/dev/null

for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health/live >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" == "30" ]]; then
    echo "Backend nao respondeu health apos reinicio do PM2." >&2
    exit 1
  fi

  sleep 2
done

for key in FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY; do
  value="$(grep -E "^${key}=" "$env_file" | tail -n 1 | cut -d= -f2-)"
  if [[ -n "$value" ]]; then
    echo "$key=set"
  else
    echo "$key=empty"
  fi
done
echo "Firebase Admin aplicado na EC2 e health OK."
'@

  $RemoteScript | & ssh.exe @SshArgs $Remote "bash" "-s" "--" $RemoteBackDir $RemotePatch $Pm2AppName
  if ($LASTEXITCODE -ne 0) {
    throw "Aplicacao remota do Firebase Admin falhou com codigo $LASTEXITCODE"
  }

  Write-Host "Project ID aplicado: $($account.project_id)"
  Write-Host "Client email aplicado; private key nao exibida."
} finally {
  if (Test-Path -LiteralPath $LocalPatch) {
    Remove-Item -LiteralPath $LocalPatch -Force
  }
}
