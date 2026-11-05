$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
& "$PSScriptRoot/generate-secrets.ps1"
if ($LASTEXITCODE) { throw 'No se pudieron preparar los secretos' }
docker compose config --quiet
if ($LASTEXITCODE) { throw 'Configuracion Compose invalida' }
docker compose up -d --build --wait --wait-timeout 180
if ($LASTEXITCODE) { throw 'No se pudieron iniciar los servicios' }
& "$PSScriptRoot/setup-demo.ps1"
if ($LASTEXITCODE) { throw 'No se pudieron preparar los usuarios de demostracion' }
docker compose ps
if ($LASTEXITCODE) { throw 'No se pudo consultar el estado de los servicios' }
Write-Host 'AUTH Swagger:  https://localhost:3001/docs (CA local: secrets/tls/ca.crt)'
Write-Host 'STEGO Swagger: http://localhost:3002/docs'
