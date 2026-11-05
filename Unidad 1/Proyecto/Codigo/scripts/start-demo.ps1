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
