function Invoke-BackendRest {
  param([string]$Uri, [string]$Method='Get', [hashtable]$Headers=@{}, [string]$ContentType, [string]$Body)
  $responseFile=[IO.Path]::GetTempFileName()
  $bodyFile=$null
  try {
    $curlArgs=@('--silent','--show-error','--max-time','15','--ssl-no-revoke','--cacert',(Join-Path $PSScriptRoot '../secrets/tls/ca.crt'),'-X',$Method.ToUpperInvariant(),'-o',$responseFile,'-w','%{http_code}')
    foreach($key in $Headers.Keys){$curlArgs+=@('-H',"${key}: $($Headers[$key])")}
    if($ContentType){$curlArgs+=@('-H',"Content-Type: $ContentType")}
    if($PSBoundParameters.ContainsKey('Body')){$bodyFile=[IO.Path]::GetTempFileName();[IO.File]::WriteAllText($bodyFile,$Body,[Text.UTF8Encoding]::new($false));$curlArgs+=@('--data-binary',"@$bodyFile")}
    $code=& curl.exe @curlArgs $Uri
    if($LASTEXITCODE){throw "No se pudo conectar con $Uri"}
    if([int]$code -ge 400){$errorObject=[Exception]::new("HTTP $code en $Method $Uri");$errorObject.Data['StatusCode']=[int]$code;throw $errorObject}
    $content=[IO.File]::ReadAllText($responseFile)
    if($content){return $content|ConvertFrom-Json}
  } finally {
    Remove-Item -LiteralPath $responseFile -ErrorAction SilentlyContinue
    if($bodyFile){Remove-Item -LiteralPath $bodyFile -ErrorAction SilentlyContinue}
  }
}
