# SAC KAPATILMAZ.
# Eski davranis: WDAC ek politika kuruyordu. Microsoft, SAC tabanina ek
# politika uygulamanin Degerlendirme'yi kapatabilecegini belgeler.
# Bu script artik yalnizca portable kopyasi + Unblock-File yapar.

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
$portable = Join-Path $proj "cikti\portable"
$destRoot = Join-Path $env:LOCALAPPDATA "YayinYonetimAraci"

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
if (-not (Test-Path (Join-Path $portable "YayinYonetimAraci.exe"))) {
  throw "Portable exe yok: $portable"
}

robocopy $portable $destRoot /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
$exe = Join-Path $destRoot "YayinYonetimAraci.exe"
if (-not (Test-Path $exe)) { throw "Exe yok: $exe" }
Unblock-File -LiteralPath $exe -ErrorAction SilentlyContinue
Write-Host "Kopyalandi (WDAC ek politika kurulmadi): $exe"

$sac = Join-Path $PSScriptRoot "sac-izin.ps1"
if (Test-Path $sac) {
  & powershell -ExecutionPolicy Bypass -File $sac
}
