$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$login = curl.exe -s --ssl-no-revoke --cacert .\secrets\tls\ca.crt -H 'Content-Type: application/json' -d '{"identity":"analyst","password":"Analyst-Pass-2026!"}' https://localhost:3001/api/auth/login | ConvertFrom-Json
docker compose stop auth | Out-Null
try {
  $code = curl.exe --max-time 8 -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $($login.access_token)" -F 'file=@samples/original/reference.png;type=image/png' http://localhost:3002/api/steganography/analyze
  Write-Output "T08 auth_down=$code"
} finally {
  docker compose start auth | Out-Null
}
Start-Sleep -Seconds 5
$health = curl.exe --max-time 5 -s -o NUL -w '%{http_code}' --ssl-no-revoke --cacert .\secrets\tls\ca.crt https://localhost:3001/health
Write-Output "AUTH restored=$health"
