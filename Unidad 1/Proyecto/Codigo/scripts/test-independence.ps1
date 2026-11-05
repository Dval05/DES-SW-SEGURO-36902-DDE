. "$PSScriptRoot/assertions.ps1"
$ErrorActionPreference='Stop'; $root=Split-Path -Parent $PSScriptRoot; Set-Location $root
docker compose stop stego | Out-Null
try { $code=curl.exe --max-time 5 -s -o NUL -w '%{http_code}' --ssl-no-revoke --cacert .\secrets\tls\ca.crt https://localhost:3001/health; Assert-Equal $code 200 'T01 AUTH with STEGO stopped' } finally { docker compose start stego | Out-Null }
Start-Sleep -Seconds 3
docker compose ps
docker compose stop auth | Out-Null
try { $code=curl.exe --max-time 5 -s -o NUL -w '%{http_code}' http://localhost:3002/api/health; Assert-Equal $code 200 'T01 STEGO with AUTH stopped' } finally { docker compose start auth | Out-Null }
