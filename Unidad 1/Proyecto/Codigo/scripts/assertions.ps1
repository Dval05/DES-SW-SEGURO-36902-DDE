function Assert-Equal($Actual, $Expected, [string]$Scenario) {
  if ([string]$Actual -ne [string]$Expected) { throw "$Scenario esperado=$Expected obtenido=$Actual" }
  Write-Output "PASS $Scenario ($Actual)"
}
