$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/assertions.ps1"
Set-Location (Split-Path -Parent $PSScriptRoot)

$auth = 'https://localhost:3001'
$stego = 'http://localhost:3002'
$tls = @('--ssl-no-revoke', '--cacert', 'secrets/tls/ca.crt')

function Invoke-AuthJson([string]$Method, [string]$Path, [string]$Bearer, $Body) {
  $arguments = @('-fsS', '--max-time', '10', '-X', $Method)
  if ($Bearer) { $arguments += @('-H', "Authorization: Bearer $Bearer") }
  if ($null -ne $Body) {
    $arguments += @('-H', 'Content-Type: application/json', '--data-raw', ($Body | ConvertTo-Json -Compress))
  }
  $result = curl.exe @tls @arguments "$auth$Path"
  if ($LASTEXITCODE) { throw "Falló $Method $Path" }
  $result | ConvertFrom-Json
}

$admin = (Invoke-AuthJson 'POST' '/api/auth/login' '' @{
  identity = 'admin'; password = 'ChangeMe-Admin-2026!'
}).access_token
$analyst = (Invoke-AuthJson 'POST' '/api/auth/login' '' @{
  identity = 'analyst'; password = 'Analyst-Pass-2026!'
}).access_token

$roles = Invoke-AuthJson 'GET' '/api/roles' $admin $null
$role = $roles | Where-Object rol -eq 'ANALYST'
if (!$role.id) { throw 'GET /api/roles no devolvió ANALYST' }
Write-Output 'PASS GET /api/roles con ADMIN'
$rolePath = "/api/roles/$($role.id)"
$description = "Verificación $([guid]::NewGuid().ToString('N'))"
try {
  $updated = Invoke-AuthJson 'PATCH' $rolePath $admin @{ description = $description }
  Assert-Equal $updated.description $description 'PATCH /api/roles/{id} aplica descripción'
  $saved = Invoke-AuthJson 'GET' '/api/roles' $admin $null | Where-Object id -eq $role.id
  Assert-Equal $saved.description $description 'GET /api/roles confirma cambio persistido'
} finally {
  $restored = Invoke-AuthJson 'PATCH' $rolePath $admin @{ description = $role.description }
  Assert-Equal $restored.description $role.description 'Descripción original restaurada'
}

$body = @{ subject_token = $analyst; action = 'steganography.analyze' } | ConvertTo-Json -Compress
$oldCode = curl.exe @tls -sS --max-time 10 -o NUL -w '%{http_code}' -H 'Content-Type: application/json' -H 'x-service-token: local-stego-service-token-change-2026' --data-raw $body "$auth/internal/authorization/check"
Assert-Equal $oldCode 401 'Credencial histórica rechazada'

$analysis = curl.exe -fsS --max-time 10 -H "Authorization: Bearer $analyst" -F 'file=@samples/stego/lsb-random-payload.png;type=image/png' "$stego/api/steganography/analyze" | ConvertFrom-Json
if ($LASTEXITCODE -or !$analysis.id) { throw 'No se pudo crear el análisis de persistencia' }
$serviceToken = (Get-Content -Raw -LiteralPath 'secrets/service.env').Trim().Split('=', 2)[1]
$lookup = @{
  subject_token = $analyst
  action = 'steganography.result.read'
  resource_id = $analysis.id
  resource_owner_id = $analysis.user_id
}
foreach ($scenario in @('own', 'foreign', 'missing')) {
  $expected = switch ($scenario) {
    'own' { 'active_role_grants_permission' }
    'foreign' { $lookup.resource_owner_id = [guid]::NewGuid().ToString(); 'resource_not_owned' }
    'missing' { $lookup.resource_id = [guid]::NewGuid().ToString(); $lookup.resource_owner_id = $null; 'resource_not_found' }
  }
  $payload = $lookup | ConvertTo-Json -Compress
  $decision = curl.exe @tls -fsS --max-time 10 -H 'Content-Type: application/json' -H "x-service-token: $serviceToken" --data-raw $payload "$auth/internal/authorization/check" | ConvertFrom-Json
  if ($LASTEXITCODE) { throw 'Falló la decisión directa de AUTH' }
  Assert-Equal $decision.resource_id $lookup.resource_id "AUTH vincula la decisión al recurso ($scenario)"
  Assert-Equal $decision.reason $expected "AUTH comprueba propietario y existencia ($scenario)"
  Assert-Equal $decision.allowed ($scenario -eq 'own') "AUTH allowed ($scenario)"
}

$containerBefore = docker compose ps -q stego
if ($LASTEXITCODE -or !$containerBefore) { throw 'No se identificó el contenedor de STEGO' }
docker compose up -d --no-deps --force-recreate --wait stego
if ($LASTEXITCODE) { throw 'Falló la recreación de STEGO' }
$containerAfter = docker compose ps -q stego
if ($LASTEXITCODE -or !$containerAfter -or $containerBefore -eq $containerAfter) { throw 'STEGO conservó el contenedor anterior' }
Write-Output 'PASS STEGO ejecuta un contenedor nuevo'
$result = $null
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  $health = curl.exe -s --max-time 2 -o NUL -w '%{http_code}' "$stego/api/health"
  if ($health -eq '200') {
    $result = curl.exe -fsS --max-time 8 -H "Authorization: Bearer $analyst" "$stego/api/steganography/results/$($analysis.id)" | ConvertFrom-Json
    break
  }
  Start-Sleep -Seconds 1
}
if (!$result) { throw 'No se recuperó el registro después de recrear STEGO' }
Assert-Equal $result.id $analysis.id 'Persistencia del identificador'
Assert-Equal $result.sha256 $analysis.sha256 'Persistencia de SHA-256'
Assert-Equal $result.status $analysis.status 'Persistencia de clasificación'
Write-Output 'PASS comprobaciones de entrega'
