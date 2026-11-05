$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
function Reset-Auth {
  docker compose restart auth | Out-Host
  if($LASTEXITCODE){throw 'No se pudo reiniciar AUTH'}
  for($attempt=0;$attempt -lt 30;$attempt++){
    $status=curl.exe --max-time 2 -s -o NUL -w '%{http_code}' --ssl-no-revoke --cacert secrets/tls/ca.crt https://localhost:3001/health
    if($status -eq '200'){return}
    Start-Sleep -Seconds 1
  }
  throw 'AUTH no estuvo listo en el tiempo esperado'
}
Reset-Auth
& "$PSScriptRoot/setup-demo.ps1"
foreach($script in @('test-core-security.ps1','test-jwt-special.ps1','test-t10.ps1','test-detector.ps1','test-fail-closed.ps1','test-independence.ps1','test-login-limit.ps1')){
  # Reset the limiter between test groups without weakening its configured limits.
  Reset-Auth
  & "$PSScriptRoot/$script"
  if(!$?){throw "Fallo $script"}
}
Reset-Auth
Write-Output 'PASS integration suite'
