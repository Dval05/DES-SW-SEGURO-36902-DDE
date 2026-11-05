$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:OPENSSL_CONF = 'C:\Program Files\Git\mingw64\etc\ssl\openssl.cnf'
if (!(Test-Path -LiteralPath $env:OPENSSL_CONF)) { $env:OPENSSL_CONF = 'C:\Program Files\Git\usr\ssl\openssl.cnf' }
$openssl = (Get-Command openssl -ErrorAction SilentlyContinue).Source
if (!$openssl) { $openssl = @('C:\Program Files\Git\usr\bin\openssl.exe', 'C:\Program Files\Git\mingw64\bin\openssl.exe') | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1 }
if (!$openssl) { throw 'OpenSSL no disponible. Instale Git para Windows u OpenSSL.' }
$jwt = Join-Path $root 'secrets\jwt'; $tls = Join-Path $root 'secrets\tls'
New-Item -ItemType Directory -Force $jwt,$tls | Out-Null
$required = @((Join-Path $jwt 'private.pem'),(Join-Path $jwt 'public.pem'),(Join-Path $tls 'ca.key'),(Join-Path $tls 'ca.crt'),(Join-Path $tls 'auth.key'),(Join-Path $tls 'auth.crt'))
$present = @($required | Where-Object { Test-Path -LiteralPath $_ })
if ($present.Count -eq $required.Count) { Write-Host 'Los secretos ya existen; se conservan sin cambios.'; exit 0 }
if ($present.Count -gt 0) { throw 'Conjunto de secretos incompleto. Corríjalo manualmente; el script no sobrescribirá claves existentes.' }
& $openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out (Join-Path $jwt 'private.pem')
if ($LASTEXITCODE) { throw 'No se pudo generar la clave JWT' }
& $openssl pkey -in (Join-Path $jwt 'private.pem') -pubout -out (Join-Path $jwt 'public.pem')
if ($LASTEXITCODE) { throw 'No se pudo generar la clave pública JWT' }
& $openssl req -x509 -newkey rsa:3072 -nodes -days 365 -keyout (Join-Path $tls 'ca.key') -out (Join-Path $tls 'ca.crt') -subj '/CN=Secure Backend Dev CA'
if ($LASTEXITCODE) { throw 'No se pudo generar la CA' }
$ext = Join-Path $tls 'auth.ext'; Set-Content -LiteralPath $ext -Value "subjectAltName=DNS:auth,DNS:localhost,IP:127.0.0.1`nextendedKeyUsage=serverAuth"
& $openssl req -newkey rsa:3072 -nodes -keyout (Join-Path $tls 'auth.key') -out (Join-Path $tls 'auth.csr') -subj '/CN=auth'
if ($LASTEXITCODE) { throw 'No se pudo generar la solicitud TLS' }
& $openssl x509 -req -in (Join-Path $tls 'auth.csr') -CA (Join-Path $tls 'ca.crt') -CAkey (Join-Path $tls 'ca.key') -CAcreateserial -days 365 -extfile $ext -out (Join-Path $tls 'auth.crt')
if ($LASTEXITCODE) { throw 'No se pudo firmar el certificado TLS' }
Remove-Item -LiteralPath $ext,(Join-Path $tls 'auth.csr'),(Join-Path $tls 'ca.srl') -ErrorAction SilentlyContinue
Write-Host 'Claves JWT y certificados TLS generados en secrets/ (ignorados por Git).'
