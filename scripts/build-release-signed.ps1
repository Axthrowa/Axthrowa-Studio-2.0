# SAC / WDAC kapatILMADAN derleme + NSIS setup + portable paket + imza
# Tum ciktilar: cikti\portable\  ve  cikti\*Setup*.exe
#
# Gunluk arayuz (exe hash degismez):
#   npm run guncelle
#   powershell -ExecutionPolicy Bypass -File scripts\guncelle-ui.ps1
#
# Tam yeni EXE (test, AxBoT, derleme, imza, Defender taramasi). Kurulum indirmez:
#   powershell -ExecutionPolicy Bypass -File scripts\build-release-signed.ps1
# Surumu de yukseltmek icin (package.json + tauri.conf.json + Cargo.toml):
#   powershell -ExecutionPolicy Bypass -File scripts\build-release-signed.ps1 -Surum 1.7.1
#
# Not: WDAC cargo build-script'leri engelliyorsa (os error 4551) once
# "Sertifikalar > Guvenilen Yayincilar" icinde CN=Axthrowa olmali.

param([switch]$SkipRust, [switch]$SkipBundle, [switch]$SkipSign, [switch]$SkipTests, [switch]$SkipScan, [string]$Surum)

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
Set-Location $proj

# Cargo ciktisini Cursor sandbox cache'e degil kullanici LocalAppData'ya al
$td = Join-Path $env:LOCALAPPDATA "studio-cargo-target"
New-Item -ItemType Directory -Force -Path $td | Out-Null
$env:CARGO_TARGET_DIR = $td

if ($Surum) {
  Write-Host "== Surum -> $Surum =="
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "surum-yukselt.ps1") -Surum $Surum
  if ($LASTEXITCODE -ne 0) { throw "surum yukseltilemedi" }
}

if (-not $SkipTests) {
  Write-Host "== Testler =="
  # Studio, axbot/client, axbot/server ve Resonance (TEK-1: tek komut)
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Testler basarisiz" }
  # Yayin provasi (T4): sahte OBS ile baslat, uyari, mola, bitir
  cargo test -j 4 --manifest-path (Join-Path $proj "src-tauri\Cargo.toml") --test yayin_provasi
  if ($LASTEXITCODE -ne 0) { throw "Yayin provasi basarisiz" }
}

Write-Host "== Lisans denetimi + ucuncu taraf bildirimleri + SBOM (ADR-005) =="
node (Join-Path $proj "scripts\lisans-denetimi.mjs")
if ($LASTEXITCODE -ne 0) { throw "lisans denetimi basarisiz: GPL-2.0-or-later ile uyumsuz bagimlilik" }
node (Join-Path $proj "scripts\ucuncu-taraf-bildirimleri.mjs")
if ($LASTEXITCODE -ne 0) { throw "ucuncu taraf bildirimleri uretilemedi" }

Write-Host "== Frontend =="
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
if (Test-Path (Join-Path $proj "resonance\package.json")) {
  npm run build:resonance
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "resonance build basarisiz - portable muzik sekmesi eksik kalabilir"
  }
}

$rustOk = $false
if (-not $SkipRust) {
  Write-Host "== Rust release (CARGO_TARGET_DIR=$td) =="
  Push-Location (Join-Path $proj "src-tauri")
  try {
    cargo build --release
    if ($LASTEXITCODE -eq 0) {
      $rustOk = $true
      $built = Join-Path $td "release\axthrowa-studio.exe"
      $dest = Join-Path $proj "src-tauri\target\release\axthrowa-studio.exe"
      New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
      Copy-Item -LiteralPath $built -Destination $dest -Force
      Write-Host "exe copied -> $dest"
    } else {
      Write-Warning "Rust derlemesi basarisiz (WDAC 4551 olabilir). Eski exe ile paketlenecek."
    }
  } finally {
    Pop-Location
  }
}

# NSIS setup - tauri bundle (exe zaten derliyse sadece paketler)
# Updater private key yoksa tauri sonda hata verebilir; NSIS yine de uretilmis olur.
$bundleOk = $false
$nsisDir = Join-Path $td "release\bundle\nsis"
if (-not $SkipBundle) {
  Write-Host "== NSIS setup (tauri bundle) =="
  $cfgPath = Join-Path $env:TEMP "studio-tauri-bundle.json"
  $kaynaklar = [ordered]@{ "../dist" = "dist/"; "../resonance/dist" = "resonance/dist/" }
  $cfg = @{ bundle = @{ createUpdaterArtifacts = $false; resources = $kaynaklar } } | ConvertTo-Json -Depth 5
  # UTF-8 BOM'suz: yol Turkce karakter icerebilir, tauri BOM'lu JSON'u okuyamaz.
  [IO.File]::WriteAllText($cfgPath, $cfg, (New-Object Text.UTF8Encoding($false)))
  npx --yes tauri bundle --bundles nsis --ci --config $cfgPath
  Remove-Item -LiteralPath $cfgPath -Force -ErrorAction SilentlyContinue
  $surumAdi = (Get-Content -LiteralPath (Join-Path $proj "package.json") -Raw | ConvertFrom-Json).version
  # Yalniz bu surumun kurulumu; bundle duserse eski surumun dosyasi basari sayilmasin
  $nsisHit = Get-ChildItem -LiteralPath $nsisDir -Filter "*_${surumAdi}_x64-setup.exe" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($nsisHit) {
    $bundleOk = $true
    Write-Host ("NSIS -> {0} ({1} MB)" -f $nsisHit.FullName, [math]::Round($nsisHit.Length / 1MB, 1))
  } else {
    Write-Warning "tauri bundle setup uretemedi; portable yine cikti\portable altina yazilacak."
  }
}

Write-Host "== AxBoT =="
node (Join-Path $proj "scripts\axbot-hazirla.mjs")
if ($LASTEXITCODE -ne 0) { throw "AxBoT pakete hazirlanamadi" }

Write-Host "== Paketle -> cikti\ =="
$paketArgs = @()
if ($SkipSign) { $paketArgs += "-SkipSign" }
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "paketle.ps1") @paketArgs
if ($LASTEXITCODE -ne 0) { throw "paketle failed" }

# Imza dogrulama + Zone.Identifier temizle (SAC)
$exe = Join-Path $proj "cikti\portable\AxthrowAStudio.exe"
$setup = Join-Path $proj "cikti\AxthrowAStudio-Setup.exe"
foreach ($f in @($exe, $setup)) {
  if (-not (Test-Path $f)) { continue }
  Unblock-File -LiteralPath $f -ErrorAction SilentlyContinue
  $sig = Get-AuthenticodeSignature -LiteralPath $f
  $name = [IO.Path]::GetFileName($f)
  Write-Host ("Imza: {0}  {1}  <- {2}" -f $sig.Status, $sig.SignerCertificate.Subject, $name)
  if ($sig.Status -ne "Valid") {
    Write-Warning "Imza: $name  $($sig.Status)"
  }
}

# T9: dagitmadan once Windows Defender ile tara (yalniz tarar, dosyaya dokunmaz)
if (-not $SkipScan) {
  Write-Host "== Defender taramasi =="
  $mp = Join-Path $env:ProgramFiles "Windows Defender\MpCmdRun.exe"
  if (-not (Test-Path $mp)) {
    Write-Warning "MpCmdRun.exe yok; tarama atlandi"
  } else {
    foreach ($f in @((Join-Path $proj "cikti\portable"), $setup)) {
      if (-not (Test-Path $f)) { continue }
      & $mp -Scan -ScanType 3 -File $f -DisableRemediation | Out-Host
      # 0: temiz, 2: tehdit bulundu; digerleri tarama hatasi
      if ($LASTEXITCODE -eq 2) { throw "Defender tehdit buldu: $f (dagitma)" }
      if ($LASTEXITCODE -ne 0) { Write-Warning "Defender taramasi tamamlanamadi ($LASTEXITCODE): $f" }
    }
  }
}

Write-Host ""
Write-Host ("Bitti. rustOk={0} bundleOk={1}" -f $rustOk, $bundleOk)
Write-Host "  Portable: cikti\portable\"
Write-Host "  Setup:    cikti\AxthrowAStudio-Setup.exe"
