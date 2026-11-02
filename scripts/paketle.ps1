# Derlenmis surumu cikti\ klasorune paketler (portable + setup) ve imzalar.
# Kullanicinin kutuphanesini (assets, app-data, media) KORUR - sadece
# calistirilabilir dosya ve dist yenilenir.
#
#   powershell -ExecutionPolicy Bypass -File scripts\paketle.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\paketle.ps1 -SkipSign
#   powershell -ExecutionPolicy Bypass -File scripts\paketle.ps1 -KeepExe
#     KeepExe: imzali portable exe'yi ezme (SAC hash korunur; sadece dist).

param([switch]$SkipSign, [switch]$KeepExe)

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
$release = Join-Path $proj "src-tauri\target\release"
$cargoTd = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $env:LOCALAPPDATA "yya-cargo-target" }
# Docker (cargo-xwin) ciktisi da aday: Smart App Control acikken Windows'ta
# cargo calismiyor, capraz derleme tek yol.
$dockerExe = Join-Path $proj "target-docker\x86_64-pc-windows-msvc\release\yayin-yonetim-araci.exe"
$srcExeCandidates = @(
  $dockerExe,
  (Join-Path $cargoTd "release\yayin-yonetim-araci.exe"),
  (Join-Path $release "yayin-yonetim-araci.exe")
) | Where-Object { Test-Path $_ }
# En yeni derleme kazanir. Eskiden "imzasi gecerli olan" tercih ediliyordu;
# taze derleme heniz imzasiz oldugu icin bu, bayat exe'yi paketletiyordu.
$srcExe = $srcExeCandidates |
  Sort-Object { (Get-Item -LiteralPath $_).LastWriteTimeUtc } -Descending |
  Select-Object -First 1
if (-not $srcExe) {
  throw "Derlenmis exe yok. Once: powershell -File scripts\build-release-signed.ps1"
}
Write-Host "kaynak exe -> $srcExe  imza=$((Get-AuthenticodeSignature -LiteralPath $srcExe).Status)"

$cikti = Join-Path $proj "cikti"
$portable = Join-Path $cikti "portable"
$setupName = "YayinYonetimAraci-Setup.exe"
$setupNameVersioned = "Yayin Yonetim Araci_1.2.7_x64-setup.exe"

New-Item -ItemType Directory -Force -Path $cikti | Out-Null
New-Item -ItemType Directory -Force -Path $portable | Out-Null

# 1) Calistirilabilir dosya
$destExe = Join-Path $portable "YayinYonetimAraci.exe"
# Yalniz paketlenen kopya kapatilir: eskiden ADI ayni olan HER surec (baska klasorden calisan,
# yayin yapan uygulama dahil) zorla kapatiliyordu.
$running = @(Get-Process YayinYonetimAraci -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ($_.Path -ieq $destExe) })
foreach ($proc in $running) {
  Write-Host "Calisan uygulama kapatiliyor (pid $($proc.Id))..."
  $proc | Stop-Process -Force
  $proc.WaitForExit(10000) | Out-Null
}

function Wait-FileUnlocked([string]$Path, [int]$TimeoutMs = 15000) {
  if (-not (Test-Path $Path)) { return $true }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    try {
      $fs = [IO.File]::Open($Path, 'Open', 'ReadWrite', 'None')
      $fs.Close()
      return $true
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  return $false
}

if ($KeepExe -and (Test-Path $destExe)) {
  Write-Host "KeepExe: portable exe dokunulmadi (SAC hash ayni)"
} else {
  if (-not (Wait-FileUnlocked $destExe)) {
    throw "cikti\portable\YayinYonetimAraci.exe hala kilitli. Uygulamayi kapatip tekrar deneyin."
  }
  Copy-Item $srcExe $destExe -Force
  Write-Host "portable exe -> $destExe"
}

# 1a) Urun lisansi (GPL-2.0-or-later) ve ucuncu taraf bildirimleri exe yaninda (ADR-005)
foreach ($f in @(@("LICENSE", "LICENSE.txt"), @("THIRD_PARTY_NOTICES.txt", "THIRD_PARTY_NOTICES.txt"))) {
  $kaynakDosya = Join-Path $proj $f[0]
  if (Test-Path -LiteralPath $kaynakDosya) { Copy-Item -LiteralPath $kaynakDosya -Destination (Join-Path $portable $f[1]) -Force }
}

# 2) Web arayuzu (tam ayna - eski chunk'lar kalmasin)
$srcDist = Join-Path $proj "dist"
$destDist = Join-Path $portable "dist"
if (-not (Test-Path (Join-Path $srcDist "index.html"))) { throw "dist/index.html yok (npm run build)" }
robocopy $srcDist $destDist /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "dist kopyalanamadi (robocopy $LASTEXITCODE)" }
Write-Host "portable dist -> $destDist"

# 2b) Gomulu muzik eklentisi
$srcRes = Join-Path $proj "resonance\dist"
$destRes = Join-Path $portable "resonance\dist"
if (Test-Path (Join-Path $srcRes "index.html")) {
  robocopy $srcRes $destRes /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "resonance kopyalanamadi (robocopy $LASTEXITCODE)" }
  Write-Host "portable resonance -> $destRes"
} else {
  Write-Warning "resonance\dist yok - once: npm run build:resonance"
}

# 3) Kutuphane klasorleri - VARSA DOKUNMA, yoksa olustur
foreach ($sub in @("particles", "music", "logos", "videos", "backgrounds")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $portable "assets\$sub") | Out-Null
}
New-Item -ItemType Directory -Force -Path (Join-Path $portable "app-data") | Out-Null

$nested = Join-Path $portable "assets\assets"
if (Test-Path $nested) {
  Remove-Item $nested -Recurse -Force
  Write-Host "temizlik -> assets\assets kaldirildi"
}

$projParticles = Join-Path $proj "assets\particles"
$destParticles = Join-Path $portable "assets\particles"
if ((Test-Path $projParticles) -and -not (Get-ChildItem $destParticles -File -ErrorAction SilentlyContinue)) {
  Copy-Item (Join-Path $projParticles "*") $destParticles -Force -ErrorAction SilentlyContinue
  Write-Host "assets   -> varsayilan parcaciklar kopyalandi"
}

# 4) Baslatici
$batLines = @(
  "@echo off",
  "cd /d `"%~dp0`"",
  "powershell -NoProfile -Command `"Unblock-File -LiteralPath '%~dp0YayinYonetimAraci.exe' -ErrorAction SilentlyContinue`" >nul 2>&1",
  "echo Giris : http://127.0.0.1:8843/starting?obs=1",
  "echo Cikis : http://127.0.0.1:8843/ending?obs=1",
  "echo Mola  : http://127.0.0.1:8843/brb?obs=1",
  "echo Chat  : http://127.0.0.1:8843/chat?obs=1",
  "taskkill /F /IM YayinYonetimAraci.exe >nul 2>&1",
  "timeout /t 1 /nobreak >nul",
  "start `"`" `"%~dp0YayinYonetimAraci.exe`""
)
Set-Content -Path (Join-Path $portable "Baslat.bat") -Value $batLines -Encoding ASCII

# 5) Kurulum paketi (NSIS)
function Find-NsisSetup {
  $dirs = @(
    (Join-Path $cargoTd "release\bundle\nsis"),
    (Join-Path $release "bundle\nsis"),
    (Join-Path $proj "src-tauri\target\release\bundle\nsis")
  )
  foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) { continue }
    $hit = Get-ChildItem -LiteralPath $dir -Filter "*setup*.exe" -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

$srcNsis = Find-NsisSetup
$destSetup = Join-Path $cikti $setupName
$destSetupVer = Join-Path $cikti $setupNameVersioned

if ($srcNsis) {
  Copy-Item -LiteralPath $srcNsis -Destination $destSetup -Force
  Copy-Item -LiteralPath $srcNsis -Destination $destSetupVer -Force
  Write-Host "setup    -> $destSetup"
  Write-Host "setup    -> $destSetupVer"
} else {
  Write-Warning "NSIS setup bulunamadi. build-release-signed.ps1 icinde tauri bundle adimi calismis olmali."
}

# 6) OKU.txt
$okuLines = @(
  "CIKTI KLASORU (cikti\)",
  "======================",
  "",
  "1) PORTABLE (kurulum yok, klasoru tasiyip calistir):",
  "   cikti\portable\Baslat.bat",
  "   cikti\portable\YayinYonetimAraci.exe",
  "",
  "2) SETUP (Windows kurulum sihirbazi):",
  "   cikti\YayinYonetimAraci-Setup.exe",
  "   cikti\Yayin Yonetim Araci_1.2.7_x64-setup.exe",
  "",
  "OBS Browser Source (uygulama ACIK olmali):",
  "  http://127.0.0.1:8843/starting?obs=1",
  "  http://127.0.0.1:8843/ending?obs=1",
  "  http://127.0.0.1:8843/brb?obs=1",
  "  http://127.0.0.1:8843/chat?obs=1",
  "",
  "Imza: CN=Axthrowa (tauri.conf.json certificateThumbprint ile ayni).",
  "Yeniden imzalamak: powershell -ExecutionPolicy Bypass -File scripts\sign-cikti.ps1",
  "",
  "GUNLUK GUNCELLEME (yeni EXE yok - SAC hash ayni kalir):",
  "  npm run guncelle",
  "Exe kilidi: cikti\\sac-frozen\\YayinYonetimAraci.exe",
  "Tam yeni setup/exe (yalnizca Rust/sunucu degisince):",
  "  powershell -ExecutionPolicy Bypass -File scripts\build-release-signed.ps1"
)
Set-Content -Path (Join-Path $cikti "OKU.txt") -Value $okuLines -Encoding UTF8

# 7) Imza — onceki calisan surumler CN=Axthrowa ile imzaliydi.
# SAC (Enterprise signing) imzasiz yeni hash'i 3077 ile keser; self-sign atlamak
# portable'i kilitler. SkipSign yalnizca bilinçli atlama içindir.
if ($SkipSign) {
  Write-Host "Imza atlandi (-SkipSign)."
} elseif ($KeepExe) {
  Write-Host "KeepExe: portable exe yeniden imzalanmiyor (SAC hash ayni)."
  & (Join-Path $PSScriptRoot "sign-cikti.ps1") -SkipPortable
} else {
  & (Join-Path $PSScriptRoot "sign-cikti.ps1")
}

Write-Host ""
Write-Host "Paketleme tamam."
Write-Host "  Portable: $portable"
if (Test-Path $destSetup) {
  Write-Host "  Setup:    $destSetup"
} else {
  Write-Host "  Setup:    (eksik)"
}
