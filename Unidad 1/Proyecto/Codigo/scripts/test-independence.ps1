$ErrorActionPreference='Stop'; $root=Split-Path -Parent $PSScriptRoot; Set-Location $root
docker compose stop stego | Out-Null
try { $code=curl.exe --max-time 5 -s -o NUL -w '%{http_code}' --ssl-no-revoke --cacert .\secrets\tls\ca.crt https://localhost:3001/health; Write-Output "T01 auth_with_stego_stopped=$code" } finally { docker compose start stego | Out-Null }
Start-Sleep -Seconds 3
docker compose ps
