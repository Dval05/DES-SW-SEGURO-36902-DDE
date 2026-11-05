. "$PSScriptRoot/backend-http.ps1"
. "$PSScriptRoot/assertions.ps1"
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot;Set-Location $root
function Login($identity,$password,$requestId){Invoke-BackendRest -Method Post -Uri 'https://localhost:3001/api/auth/login' -Headers @{'x-request-id'=$requestId} -ContentType 'application/json' -Body (@{identity=$identity;password=$password}|ConvertTo-Json)}
function Headers($token){@{Authorization="Bearer $token"}}
$invalid=curl.exe -s -o NUL -w '%{http_code}' --ssl-no-revoke --cacert .\secrets\tls\ca.crt -H 'Content-Type: application/json' -d '{"identity":"admin","password":"invalid-password"}' https://localhost:3001/api/auth/login
$admin=(Login 'admin' 'ChangeMe-Admin-2026!' 'suite-admin').access_token;$analyst=(Login 'analyst' 'Analyst-Pass-2026!' 'suite-analyst').access_token;$user=(Login 'user' 'User-Secure-2026!' 'suite-user').access_token
Write-Output "T02 valid=JWT invalid=$invalid"
$claims=($analyst.Split('.')[1].Replace('-','+').Replace('_','/'));while($claims.Length%4){$claims+='='};$payload=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($claims))|ConvertFrom-Json
Push-Location auth;$expired=node .\scripts\create-expired-token.mjs $payload.sub $payload.username $payload.tokenVersion;Pop-Location
$noToken=curl.exe -s -o NUL -w '%{http_code}' http://localhost:3002/api/steganography/results/x;$tampered=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $($analyst.Substring(0,$analyst.Length-2))xx" http://localhost:3002/api/steganography/results/x;$expiredCode=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $expired" http://localhost:3002/api/steganography/results/x
Write-Output "T03 no_token=$noToken tampered=$tampered expired=$expiredCode"
$userDenied=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $user" -F 'file=@samples/original/reference.png;type=image/png' http://localhost:3002/api/steganography/analyze;Write-Output "T04 user=$userDenied"
$relations=docker compose exec -T auth-db psql -U auth -d auth -At -F ',' -c "select u.username,r.rol from user_roles ur join users u on u.id=ur.user_id join roles r on r.id=ur.role_id order by 1,2";Write-Output "T05 relations=$($relations -join ';')"
$ids=(docker compose exec -T auth-db psql -U auth -d auth -At -F ',' -c "select u.id,r.id,ur.id from users u cross join roles r left join user_roles ur on ur.user_id=u.id and ur.role_id=r.id where u.username='analyst' and r.rol='ANALYST'").Trim().Split(',')
$duplicate=curl.exe -s -o NUL -w '%{http_code}' --ssl-no-revoke --cacert .\secrets\tls\ca.crt -H "Authorization: Bearer $admin" -H 'Content-Type: application/json' -d "{`"userId`":`"$($ids[0])`",`"roleId`":`"$($ids[1])`"}" https://localhost:3001/api/user-roles;Write-Output "T06 duplicate=$duplicate"
$before=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $analyst" -F 'file=@samples/original/reference.png;type=image/png' http://localhost:3002/api/steganography/analyze
try{Invoke-BackendRest -Method Delete -Uri "https://localhost:3001/api/user-roles/$($ids[2])" -Headers (Headers $admin)|Out-Null;$after=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $analyst" -F 'file=@samples/original/reference.png;type=image/png' http://localhost:3002/api/steganography/analyze;Write-Output "T07 before=$before after_same_jwt=$after"}finally{try{Invoke-BackendRest -Method Post -Uri 'https://localhost:3001/api/user-roles' -Headers (Headers $admin) -ContentType 'application/json' -Body (@{userId=$ids[0];roleId=$ids[1]}|ConvertTo-Json)|Out-Null}catch{}}
$adminResult=curl.exe -s -H "Authorization: Bearer $admin" -F 'file=@samples/original/reference.png;type=image/png' http://localhost:3002/api/steganography/analyze|ConvertFrom-Json;$horizontal=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $analyst" "http://localhost:3002/api/steganography/results/$($adminResult.id)";Write-Output "T11 foreign=$horizontal"
$authAudit=(docker compose logs --no-color --since 2m auth|Select-String 'authentication_|authorization_decision').Count;$stegoAudit=(docker compose logs --no-color --since 2m stego|Select-String 'analysis_|request_denied').Count;Write-Output "T12 auth_events=$authAudit stego_events=$stegoAudit"

Assert-Equal $invalid 401 'T02 invalid password'
if (($relations -join ';') -notmatch 'analyst,ANALYST' -or ($relations -join ';') -notmatch 'analyst,USER' -or ($relations -join ';') -notmatch 'user,USER') { throw 'T05 relacion N:M incompleta' }
Assert-Equal $noToken 401 'T03 missing token'
Assert-Equal $tampered 401 'T03 tampered token'
Assert-Equal $expiredCode 401 'T03 expired token'
Assert-Equal $userDenied 403 'T04 USER denied'
Assert-Equal $duplicate 409 'T06 duplicate assignment'
Assert-Equal $before 201 'T07 before revocation'
Assert-Equal $after 403 'T07 after revocation, same JWT'
Assert-Equal $horizontal 403 'T11 foreign resource'
if ($authAudit -lt 1 -or $stegoAudit -lt 1) { throw 'T12 auditoria ausente' }
