. "$PSScriptRoot/backend-http.ps1"
. "$PSScriptRoot/assertions.ps1"
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot;Set-Location $root
function Login(){(Invoke-BackendRest -Method Post -Uri 'https://localhost:3001/api/auth/login' -ContentType 'application/json' -Body (@{identity='analyst';password='Analyst-Pass-2026!'}|ConvertTo-Json)).access_token}
$token=Login;$headerJson=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($token.Split('.')[0].Replace('-','+').Replace('_','/')+'===').Substring(0,[math]::Ceiling($token.Split('.')[0].Length/4)*4)))
Push-Location auth;$variants=node .\scripts\create-jwt-variants.mjs $token|ConvertFrom-Json;Pop-Location;$rows=@()
foreach($name in @('tamperedUsername','tamperedSub','fakeRoles','wrongIssuer','wrongAudience','algNone')){$candidate=$variants.$name;$code=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $candidate" http://localhost:3002/api/steganography/results/x;$rows+=[pscustomobject]@{case=$name;http=$code}}
$logoutToken=Login;Invoke-BackendRest -Method Post -Uri 'https://localhost:3001/api/auth/logout' -Headers @{Authorization="Bearer $logoutToken"}|Out-Null;$logoutCode=curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $logoutToken" -F 'file=@samples/original/reference.png;type=image/png' http://localhost:3002/api/steganography/analyze
Write-Output "header=$headerJson";$rows|Format-Table -AutoSize;Write-Output "logout_reuse=$logoutCode"
foreach($row in $rows){Assert-Equal $row.http 401 "JWT $($row.case)"}
Assert-Equal $logoutCode 401 'Logout revokes JWT'
