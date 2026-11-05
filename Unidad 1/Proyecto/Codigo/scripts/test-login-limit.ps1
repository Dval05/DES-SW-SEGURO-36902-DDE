. "$PSScriptRoot/assertions.ps1"
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
foreach($attempt in 1..6){
  $code=curl.exe --max-time 8 -s -o NUL -w '%{http_code}' --ssl-no-revoke --cacert secrets/tls/ca.crt -H 'Content-Type: application/json' -d '{"identity":"nonexistent","password":"invalid-password"}' https://localhost:3001/api/auth/login
  $expected=if($attempt -le 5){401}else{429}
  Assert-Equal $code $expected "Login attempt $attempt"
}
