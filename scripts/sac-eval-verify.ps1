# Post-WinRE check. Never writes SAC Off (0).
$ErrorActionPreference = "Continue"
$log = "C:\Windows\Temp\sac-eval-verify.log"
function W([string]$m) {
  Add-Content -LiteralPath $log -Value ("{0:u} {1}" -f (Get-Date), $m) -Encoding UTF8
}

$ciPath = "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy"
$protPath = "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Protected"
$st = 0
$min = 0
try { $st = [int](Get-ItemProperty $ciPath).VerifiedAndReputablePolicyState } catch { W "policy read fail: $_" }
try { $min = [int](Get-ItemProperty $protPath).VerifiedAndReputablePolicyStateMinValueSeen } catch { W "min read fail: $_" }
W "VerifiedAndReputablePolicyState=$st MinValueSeen=$min"
if (Test-Path "C:\Windows\Temp\sac-eval-winre.log") {
  W "winre-log:"
  Get-Content "C:\Windows\Temp\sac-eval-winre.log" -ErrorAction SilentlyContinue | ForEach-Object { W "  $_" }
}

if ($st -eq 0) {
  W "SAC Off detected; restoring On (1). 0 is not written."
  try {
    Set-ItemProperty -Path $ciPath -Name VerifiedAndReputablePolicyState -Type DWord -Value 1
  } catch { W "restore-on fail: $_" }
}

$ciTool = Join-Path $env:SystemRoot "System32\CiTool.exe"
$evalOn = $false
$enfOn = $false
if (Test-Path $ciTool) {
  $lp = & $ciTool -lp 2>&1 | Out-String
  $evalOn = $lp -match "(?s)VerifiedAndReputableDesktopEvaluation.*?Is Currently Enforced:\s*true"
  $enfOn = $lp -match "(?s)Friendly Name:\s*VerifiedAndReputableDesktop\r?\n.*?Is Currently Enforced:\s*true"
  W "EvaluationEnforced=$evalOn DesktopEnforced=$enfOn"
}

if ($st -eq 2 -and $min -eq 2) {
  W "Evaluation restore values present."
  schtasks /delete /tn "YYA-SAC-EvalVerify" /f 2>$null | Out-Null
}
W "verify done"
