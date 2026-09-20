# SAC / WDAC kapatILMAZ.
# Yeni EXE = yeni hash = Event 3077. Bu script exe'ye DOKUNMAZ.
# Arayuzu (dist + resonance) ayni imzali portable exe'nin yanina yazar.
# Ilk calistirmada exe cikti\sac-frozen\ icine kilitlenir; sonra ezilirse geri yuklenir.
#
#   powershell -ExecutionPolicy Bypass -File scripts\guncelle-ui.ps1
#   npm run guncelle

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
Set-Location $proj

$portable = Join-Path $proj "cikti\portable"
$exe = Join-Path $portable "YayinYonetimAraci.exe"
$frozenDir = Join-Path $proj "cikti\sac-frozen"
$frozenExe = Join-Path $frozenDir "YayinYonetimAraci.exe"
New-Item -ItemType Directory -Force -Path $frozenDir | Out-Null

if (-not (Test-Path -LiteralPath $exe) -and -not (Test-Path -LiteralPath $frozenExe)) {
  throw "cikti\portable\YayinYonetimAraci.exe yok. SAC kabul ettigi exe'yi portable klasorune koyun; sonra npm run guncelle."
}

if ((Test-Path -LiteralPath $frozenExe) -and (Test-Path -LiteralPath $exe)) {
  $frozenHash = (Get-FileHash -LiteralPath $frozenExe -Algorithm SHA256).Hash
  $liveHash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
  if ($frozenHash -ne $liveHash) {
    Write-Warning "Portable exe hash degismis. SAC-frozen kopya geri yukleniyor (yeni hash 3077)."
    Get-Process YayinYonetimAraci -ErrorAction SilentlyContinue | ForEach-Object {
      $_ | Stop-Process -Force
    }
    Start-Sleep -Milliseconds 600
    Copy-Item -LiteralPath $frozenExe -Destination $exe -Force
  }
} elseif (Test-Path -LiteralPath $frozenExe) {
  Copy-Item -LiteralPath $frozenExe -Destination $exe -Force
} elseif (Test-Path -LiteralPath $exe) {
  Copy-Item -LiteralPath $exe -Destination $frozenExe -Force
  Write-Host "Bu exe SAC icin donduruldu: $frozenExe"
}

# Bilinen onceki acilan kopya (yedek; otomatik ezilmez)
$knownGoodSrc = Join-Path $proj "Portable-Build-NEW\YayinYonetimAraci.exe"
$knownGoodDest = Join-Path $frozenDir "YayinYonetimAraci-2026-09-11.exe"
if ((Test-Path -LiteralPath $knownGoodSrc) -and -not (Test-Path -LiteralPath $knownGoodDest)) {
  Copy-Item -LiteralPath $knownGoodSrc -Destination $knownGoodDest -Force
  Write-Host "Onceki acilan kopya yedeklendi: $knownGoodDest"
}

$hashBefore = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
$sig = Get-AuthenticodeSignature -LiteralPath $exe
Write-Host ("Exe korunuyor (SAC): {0}  imza={1}" -f $hashBefore.Substring(0, 16), $sig.Status)

Write-Host "== Frontend (exe yok) =="
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
if (Test-Path (Join-Path $proj "resonance\package.json")) {
  npm run build:resonance
  if ($LASTEXITCODE -ne 0) { throw "resonance build failed" }
}

$srcDist = Join-Path $proj "dist"
$destDist = Join-Path $portable "dist"
if (-not (Test-Path (Join-Path $srcDist "index.html"))) { throw "dist/index.html yok" }
robocopy $srcDist $destDist /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "dist kopyalanamadi (robocopy $LASTEXITCODE)" }

$srcRes = Join-Path $proj "resonance\dist"
$destRes = Join-Path $portable "resonance\dist"
if (Test-Path (Join-Path $srcRes "index.html")) {
  robocopy $srcRes $destRes /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "resonance kopyalanamadi (robocopy $LASTEXITCODE)" }
}

$marker = Join-Path $portable "portable.txt"
if (-not (Test-Path -LiteralPath $marker)) {
  Set-Content -LiteralPath $marker -Value "portable" -Encoding ASCII
}

$hashAfter = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
if ($hashAfter -ne $hashBefore) {
  throw "Exe hash degisti - SAC tekrar takilir. Bu script exe yazmamali."
}

$wasRunning = @(Get-Process YayinYonetimAraci -ErrorAction SilentlyContinue)
foreach ($proc in $wasRunning) {
  Write-Host "Ayni exe yeniden baslatiliyor (pid $($proc.Id))..."
  $proc | Stop-Process -Force
}
if ($wasRunning.Count -gt 0) {
  Start-Sleep -Milliseconds 800
  Start-Process -FilePath $exe -WorkingDirectory $portable
}

Write-Host ""
Write-Host "UI guncellendi, EXE ayni (SAC hash degismedi)."
Write-Host "  $exe"
Write-Host "  hash $hashAfter"
Write-Host "Sonraki arayuz isleri: npm run guncelle"
Write-Host "Rust/OBS/sunucu degistiyse o zaman (yeni hash): scripts\build-release-signed.ps1"
