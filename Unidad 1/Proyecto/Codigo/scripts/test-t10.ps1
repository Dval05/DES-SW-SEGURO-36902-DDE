. "$PSScriptRoot/assertions.ps1"
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot;Set-Location $root;Push-Location stego;node .\scripts\generate-t10-fixtures.mjs;Pop-Location
$login=curl.exe -s --ssl-no-revoke --cacert .\secrets\tls\ca.crt -H 'Content-Type: application/json' -d '{"identity":"analyst","password":"Analyst-Pass-2026!"}' https://localhost:3001/api/auth/login|ConvertFrom-Json
if(!$login.access_token){throw 'No se obtuvo JWT ANALYST'};$header="Authorization: Bearer $($login.access_token)"
function Get-SuccessfulAnalysisCount {
  $count = docker compose exec -T stego node -e "const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('/app/data/stego.db').prepare('select count(*) n from analyses WHERE status != char(101,114,114,111,114)').get().n)"
  if ($LASTEXITCODE -ne 0 -or $count -notmatch '^\d+$') { throw 'No se pudo contar los análisis sin error' }
  return [int]$count
}

$before = Get-SuccessfulAnalysisCount
$cases=@(@('oversized.png','image/png'),@('corrupt.png','image/png'),@('excessive-pixels.png','image/png'),@('unsupported.gif','image/gif'),@('jpeg-named-png.png','image/png'));$results=@()
foreach ($case in $cases) {
  $filename, $mime = $case
  $path = "tmp/t10/$filename"
  $response = curl.exe --max-time 15 -sS -w '\n%{http_code}' -H $header -F "file=@$path;type=$mime" http://localhost:3002/api/steganography/analyze
  if ($LASTEXITCODE -ne 0) { throw "Falló la solicitud para $filename" }
  $code = $response[-1]
  $expected = switch ($filename) {
    'oversized.png' { 413 }
    'corrupt.png' { 422 }
    'excessive-pixels.png' { 422 }
    default { 415 }
  }
  Assert-Equal $code $expected "T10 $filename"
  $results += "$filename=$code"
  if ($expected -ne 422) { continue }

  $body = ($response[0..($response.Count - 2)] -join [Environment]::NewLine) | ConvertFrom-Json
  $id = $body.error.analysis_id
  if (!$id) { throw "T10 $filename no devolvió analysis_id" }
  $record = curl.exe --max-time 8 -fsS -H $header "http://localhost:3002/api/steganography/results/$id" | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "T10 no pudo recuperar el registro $id" }
  Assert-Equal $record.id $id "T10 registro recuperado de $filename"
  Assert-Equal $record.status 'error' "T10 estado persistido de $filename"
  Assert-Equal $record.indicators.reason 'decode_failed_or_limit_exceeded' "T10 motivo de $filename"
  Assert-Equal $record.sha256 (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() "T10 SHA-256 de $filename"
}
$after = Get-SuccessfulAnalysisCount
Assert-Equal $after $before 'T10 análisis sin error tras rechazar los archivos'
Write-Output "T10 $($results -join ' ') successful_analyses_before=$before successful_analyses_after=$after"
$userLogin=curl.exe --max-time 8 -s --ssl-no-revoke --cacert secrets/tls/ca.crt -H 'Content-Type: application/json' -d '{"identity":"user","password":"User-Secure-2026!"}' https://localhost:3001/api/auth/login | ConvertFrom-Json
if(!$userLogin.access_token){throw 'No se obtuvo JWT USER'}
$denied=curl.exe --max-time 8 -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $($userLogin.access_token)" -F 'file=@tmp/t10/oversized.png;type=image/png' http://localhost:3002/api/steganography/analyze
Assert-Equal $denied 403 'RBAC before multipart size validation'
