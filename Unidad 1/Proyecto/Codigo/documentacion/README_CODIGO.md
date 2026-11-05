# Backend V1 seguro - AUTH y STEGO

Dos microservicios NestJS independientes. AUTH administra identidades en PostgreSQL, usa Argon2id y JWT RS256 sin roles en el token. STEGO valida PNG, solicita autorización vigente a AUTH por HTTPS autenticado y ejecuta análisis estadístico LSB, persistiendo resultados en SQLite.

## Inicio rápido en PowerShell

```powershell
.\scripts\start-demo.ps1
```

Credencial de demostración: `admin` / `ChangeMe-Admin-2026!`. Cámbiela mediante `SEED_ADMIN_PASSWORD` antes de un uso distinto a la sustentación.

- AUTH Swagger: https://localhost:3001/docs
- STEGO Swagger: http://localhost:3002/docs
- PostgreSQL publicado: localhost:5435

AUTH usa una CA local de desarrollo (`secrets/tls/ca.crt`). Si el navegador o Postman no confían en esa CA, mostrarán un error de certificado. Para probar desde PowerShell con validación de cadena y nombre del servidor:

```powershell
$login = curl.exe --ssl-no-revoke --cacert .\secrets\tls\ca.crt `
  -H 'Content-Type: application/json' `
  -d '{"identity":"admin","password":"ChangeMe-Admin-2026!"}' `
  https://localhost:3001/api/auth/login | ConvertFrom-Json

curl.exe -H "Authorization: Bearer $($login.access_token)" `
  -F 'file=@samples/stego/lsb-random-payload.png;type=image/png' `
  http://localhost:3002/api/steganography/analyze
```

`--ssl-no-revoke` solo evita la consulta de revocación inexistente de la CA de desarrollo; el certificado, hostname y cadena siguen verificándose. STEGO confía explícitamente en `ca.crt` mediante `NODE_EXTRA_CA_CERTS` y nunca desactiva TLS.

## Operación

```powershell
docker compose stop auth
docker compose start auth
docker compose restart stego
docker compose down       # conserva volúmenes; no usar -v
```

La persistencia se mantiene en los volúmenes `auth_data` y `stego_data`. Variables completas: [auth/.env.example](auth/.env.example) y [stego/.env.example](stego/.env.example). Para desarrollo fuera de Docker, copie cada ejemplo a `.env`, ajuste rutas/puertos, ejecute `npm install` y `npm run start:dev` en cada carpeta.

## Contratos principales

AUTH: `POST /api/auth/login`, `GET /api/auth/profile`, `POST /api/auth/logout`, CRUD requerido de `/api/users`, `/api/roles`, `/api/user-roles` y `POST /internal/authorization/check`.

STEGO: `POST /api/steganography/analyze` (`multipart/form-data`, campo `file`) y `GET /api/steganography/results/:id`.

## Comprobación

```powershell
npm run build --prefix auth
npm run test --prefix auth
npm run build --prefix stego
npm run test --prefix stego
.\scripts\test-fail-closed.ps1
```

Si AUTH no inicia, compruebe que el conjunto de secretos esté completo. El generador conserva claves existentes y se detiene ante un conjunto parcial. Si 5435 está ocupado, defina `AUTH_DB_PORT`.

Los puertos se publican únicamente en `127.0.0.1`. STEGO usa HTTP externo solo para la demostración local; antes de habilitar acceso desde otros equipos se debe añadir HTTPS mediante proxy inverso o terminación TLS equivalente.

## Documentación para la defensa

- [Plan de pruebas previo al commit](PLAN_PRUEBAS_PRE_COMMIT.md)
- [Colección y entorno QA de Postman](pruebas/postman-export/)
- El enunciado, el informe, las guías y las evidencias se organizan localmente en `../documentacion/`, excluida temporalmente de Git.
