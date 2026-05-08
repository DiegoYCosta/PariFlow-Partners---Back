param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [string]$FirebaseUid = "",
  [string]$Name = "",
  [string]$RemoteUser = "ec2-user",
  [string]$RemoteHost = "ec2-3-18-213-49.us-east-2.compute.amazonaws.com",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\Yar-C2.pem",
  [string]$RemoteBackDir = "/var/www/pariflow-back"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "Chave SSH nao encontrada: $KeyPath"
}

$Remote = "$RemoteUser@$RemoteHost"
$SshArgs = @(
  "-i", $KeyPath,
  "-o", "ConnectTimeout=30",
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=4",
  "-o", "StrictHostKeyChecking=accept-new"
)

$RemoteScript = @'
set -euo pipefail

back_dir="$1"
email="$2"
firebase_uid="$3"
name="$4"

cd "$back_dir"

args=(run user:grant-admin -- --email "$email")
if [[ -n "$firebase_uid" ]]; then
  args+=(--firebaseUid "$firebase_uid")
fi
if [[ -n "$name" ]]; then
  args+=(--name "$name")
fi

npm "${args[@]}"
'@

$RemoteScript | & ssh.exe @SshArgs $Remote "bash" "-s" "--" $RemoteBackDir $Email $FirebaseUid $Name
if ($LASTEXITCODE -ne 0) {
  throw "Concessao de perfil ADMIN na EC2 falhou com codigo $LASTEXITCODE"
}
