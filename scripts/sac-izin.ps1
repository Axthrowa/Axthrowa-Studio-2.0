# SAC KAPATILMAZ (deger 0 yazilmaz).
# Onceki calisan durum Degerlendirme (2) idi. Imzasiz WDAC ek politika
# (CiTool --update-policy) SAC tabanina eklenince Microsoft Degerlendirme'yi
# Zorunlu'ya (1) cevirir; Battery Hub / eski portable'lar 3077 ile kesilir.
# Bu script: ek politikayi KURMAZ, bizim yetkisiz ekleri siler, Degerlendirme'ye
# dondurur, cikti dosyalarinin Zone.Identifier'ini temizler.
#
#   powershell -ExecutionPolicy Bypass -File scripts\sac-izin.ps1

param([switch]$NoElevate)

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
$policyDir = Join-Path $PSScriptRoot "ci-policy"
$ourPolicyName = "Allow Axthrowa Yayin Yonetim Araci"

function Test-Admin {
  $p = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-CiTool {
  param([Parameter(Mandatory)][string[]]$CiArgs)
  $ciTool = Join-Path $env:SystemRoot "System32\CiTool.exe"
  if (-not (Test-Path $ciTool)) { throw "CiTool.exe yok" }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $ciTool
  $quoted = foreach ($a in $CiArgs) {
    if ($a -match '[\s"]') { '"' + ($a -replace '"', '\"') + '"' } else { $a }
  }
  $psi.Arguments = ($quoted -join " ")
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = [Diagnostics.Process]::Start($psi)
  $p.StandardInput.Close()
  $out = $p.StandardOutput.ReadToEnd()
  $err = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($out) { Write-Host $out.TrimEnd() }
  if ($err) { Write-Host $err.TrimEnd() }
  return @{ ExitCode = $p.ExitCode; Output = "$out`n$err" }
}

if (-not (Test-Admin)) {
  if ($NoElevate) {
    Write-Warning "Yonetici degil - SAC onarimi atlandi. Calistirin: scripts\sac-izin.ps1"
    exit 0
  }
  Write-Host "Yonetici hakki gerekiyor - UAC onayi bekleniyor..."
  $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $p = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $arg -Wait -PassThru
  exit $p.ExitCode
}

$cikti = Join-Path $proj "cikti"
if (Test-Path $cikti) {
  Get-ChildItem -LiteralPath $cikti -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
  Write-Host "Unblock-File: cikti agaci temizlendi"
}

# 1) Yalnizca bizim imzasiz ek politikalari kaldir. Microsoft SAC tabanina dokunma.
$list = Invoke-CiTool -CiArgs @("-lp")
$ids = New-Object System.Collections.Generic.List[string]
foreach ($block in ($list.Output -split "(?m)^Policy:")) {
  if ($block -notmatch [regex]::Escape($ourPolicyName)) { continue }
  if ($block -match "(?i)Platform Policy:\s*true") { continue }
  if ($block -match "(?i)Policy is Signed:\s*true") { continue }
  $m = [regex]::Match($block, "(?i)Policy ID:\s*([0-9a-f-]{36})")
  if (-not $m.Success) { continue }
  $id = $m.Groups[1].Value.ToLower()
  if ($id -eq "0283ac0f-fff1-49ae-ada1-8a933130cad6") { continue }
  if ($id -eq "1283ac0f-fff1-49ae-ada1-8a933130cad6") { continue }
  if ($ids -notcontains $id) { $ids.Add($id) }
}
foreach ($id in $ids) {
  Write-Host "Ek politika kaldiriliyor: {$id}"
  Invoke-CiTool -CiArgs @("--remove-policy", "{$id}") | Out-Null
}

Get-ChildItem -LiteralPath $policyDir -Filter "*.cip" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Yerel CIP siliniyor (kurulmaz): $($_.Name)"
  Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
}

# SAC asla kapatilmaz (0 yazilmaz). Ek politika da kurulmaz.
# 0 gorulurse (yanlis kapama) tekrar Acik (1) yapilir.
$ciPath = "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy"
$cur = [int](Get-ItemProperty $ciPath).VerifiedAndReputablePolicyState
Write-Host "SAC su an: $cur  (0=Kapali 1=Acik 2=Degerlendirme)"
if ($cur -eq 0) {
  Write-Warning "SAC kapalidi; Acik (1) yapiliyor. 0 yazilmaz."
  Set-ItemProperty -Path $ciPath -Name VerifiedAndReputablePolicyState -Type DWord -Value 1
  Invoke-CiTool -CiArgs @("--refresh") | Out-Null
}

$after = [int](Get-ItemProperty $ciPath).VerifiedAndReputablePolicyState
$verify = Invoke-CiTool -CiArgs @("-lp")
$enf = $false
foreach ($block in ($verify.Output -split "(?m)^Policy:")) {
  $name = ([regex]::Match($block, "Friendly Name:\s*(.+)")).Groups[1].Value.Trim()
  $on = ([regex]::Match($block, "Is Currently Enforced:\s*(\w+)")).Groups[1].Value
  if ($name -eq "VerifiedAndReputableDesktop" -and $on -eq "true") { $enf = $true }
}
Write-Host "Kayit: $after  SAC-AcikYuklu=$enf"
if ($after -eq 0) {
  Write-Warning "SAC hala kapali."
  exit 2
}
Write-Host "SAC acik (kapatilmadi)."
exit 0
