. "$PSScriptRoot/assertions.ps1"
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot;Set-Location $root;Push-Location stego;node .\scripts\generate-samples.mjs;Pop-Location
$login=curl.exe -s --ssl-no-revoke --cacert .\secrets\tls\ca.crt -H 'Content-Type: application/json' -d '{"identity":"analyst","password":"Analyst-Pass-2026!"}' https://localhost:3001/api/auth/login|ConvertFrom-Json;$header="Authorization: Bearer $($login.access_token)"
$files=@('samples/original/reference.png','samples/original/checkerboard.png','samples/original/noisy-unmodified.png','samples/stego/lsb-random-payload.png','samples/stego/lsb-sparse-payload.png','samples/stego/lsb-inconclusive-pattern.png')
if(!$login.access_token){throw 'No se obtuvo JWT ANALYST'}
$expected=@('sin_indicios','sin_indicios','sospechoso','sospechoso','sin_indicios','no_concluyente');$index=0
foreach($file in $files){$result=curl.exe --max-time 15 -s -H 'x-request-id: detector-validation' -H $header -F "file=@$file;type=image/png" http://localhost:3002/api/steganography/analyze|ConvertFrom-Json;Assert-Equal $result.status $expected[$index] "T09 $file";$index++;[pscustomobject]@{file=$file;status=$result.status;score=$result.indicators.anomaly_score;ones=$result.indicators.lsb_one_ratio;transitions=$result.indicators.transition_rate}}
