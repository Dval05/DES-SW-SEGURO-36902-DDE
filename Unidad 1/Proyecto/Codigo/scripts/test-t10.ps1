. "$PSScriptRoot/assertions.ps1"
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot;Set-Location $root;Push-Location stego;node .\scripts\generate-t10-fixtures.mjs;Pop-Location
$login=curl.exe -s --ssl-no-revoke --cacert .\secrets\tls\ca.crt -H 'Content-Type: application/json' -d '{"identity":"analyst","password":"Analyst-Pass-2026!"}' https://localhost:3001/api/auth/login|ConvertFrom-Json
if(!$login.access_token){throw 'No se obtuvo JWT ANALYST'};$header="Authorization: Bearer $($login.access_token)"
$before=docker compose exec -T stego node -e "const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('/app/data/stego.db').prepare('select count(*) n from analyses WHERE status != char(101,114,114,111,114)').get().n)"
$cases=@(@('oversized.png','image/png'),@('corrupt.png','image/png'),@('excessive-pixels.png','image/png'),@('unsupported.gif','image/gif'),@('jpeg-named-png.png','image/png'));$results=@()
foreach($case in $cases){$code=curl.exe --max-time 15 -s -o NUL -w '%{http_code}' -H $header -F "file=@tmp/t10/$($case[0]);type=$($case[1])" http://localhost:3002/api/steganography/analyze;$expected=switch($case[0]){'oversized.png'{413};'corrupt.png'{422};'excessive-pixels.png'{422};default{415}};Assert-Equal $code $expected "T10 $($case[0])";$results+="$($case[0])=$code"}
$after=docker compose exec -T stego node -e "const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('/app/data/stego.db').prepare('select count(*) n from analyses WHERE status != char(101,114,114,111,114)').get().n)"
Write-Output "T10 $($results -join ' ') analyses_before=$before analyses_after=$after";if($before.Trim() -ne $after.Trim()){throw 'Un archivo rechazado generó un análisis'}
$userLogin=curl.exe --max-time 8 -s --ssl-no-revoke --cacert secrets/tls/ca.crt -H 'Content-Type: application/json' -d '{"identity":"user","password":"User-Secure-2026!"}' https://localhost:3001/api/auth/login | ConvertFrom-Json
if(!$userLogin.access_token){throw 'No se obtuvo JWT USER'}
$denied=curl.exe --max-time 8 -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $($userLogin.access_token)" -F 'file=@tmp/t10/oversized.png;type=image/png' http://localhost:3002/api/steganography/analyze
Assert-Equal $denied 403 'RBAC before multipart size validation'
