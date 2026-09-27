# SAC / WDAC kapatILMADAN derleme + NSIS setup + portable paket + imza
# Tum ciktilar: cikti\portable\  ve  cikti\*Setup*.exe
#
# Gunluk arayuz (exe hash degismez):
#   npm run guncelle
#   powershell -ExecutionPolicy Bypass -File scripts\guncelle-ui.ps1
#
# Tam yeni EXE (yalnizca Rust/sunucu; SAC yeni hash gorebilir):
#   powershell -ExecutionPolicy Bypass -File scripts\build-release-signed.ps1
#
# Not: WDAC cargo build-script'leri engelliyorsa (os error 4551) once
# "Sertifikalar > Guvenilen Yayincilar" icinde CN=Axthrowa olmali.

param([switch]$SkipRust, [switch]$SkipBundle, [switch]$SkipSign)

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
Set-Location $proj

# Cargo ciktisini Cursor sandbox cache'e degil kullanici LocalAppData'ya al
$td = Join-Path $env:LOCALAPPDATA "yya-cargo-target"
New-Item -ItemType Directory -Force -Path $td | Out-Null
$env:CARGO_TARGET_DIR = $td

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
      $built = Join-Path $td "release\yayin-yonetim-araci.exe"
      $dest = Join-Path $proj "src-tauri\target\release\yayin-yonetim-araci.exe"
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

# Yerel yayin cekirdegi (motor/, ayri Cargo projesi, GPL-2.0-or-later). Hata paketi durdurmaz: motor yoksa panel
# "motor paketi bulunamadi" der, geri kalan her sey calisir.
if (-not $SkipRust) {
  Write-Host "== Yayin motoru (motor/) =="
  # Motorun kendi hedef klasoru var (motor\target); paketle.ps1 ve kurulum oradan alir. Ustteki ortak
  # CARGO_TARGET_DIR burada gecerli olursa motor baska yere derlenir ve pakete ESKI motor girer.
  $oncekiHedef = $env:CARGO_TARGET_DIR
  $env:CARGO_TARGET_DIR = Join-Path $proj "motor\target"
  Push-Location (Join-Path $proj "motor")
  try {
    cargo build --release
    if ($LASTEXITCODE -ne 0) { Write-Warning "Yayin motoru derlenemedi; pakete eski motor (varsa) konur." }
  } finally {
    Pop-Location
    $env:CARGO_TARGET_DIR = $oncekiHedef
  }
}

# Motor kuruluma kaynak dosyasi olarak girer (uygulama exe'sinin yanina). tauri.conf.json'a yazilmaz: gelistirme
# derlemesi motor exe'si olmadan da calismali. Kurulumdan once imzalanir; SAC imzasiz yeni hash'i keser.
$motorExe = Join-Path $proj "motor\target\release\yayin-motoru.exe"
$motorLisans = Join-Path $proj "motor\LICENSE"
$motorVar = (Test-Path -LiteralPath $motorExe) -and (Test-Path -LiteralPath $motorLisans)
if ($motorVar -and -not $SkipSign -and -not $SkipBundle) {
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sign-cikti.ps1") -Yalniz $motorExe
  if ($LASTEXITCODE -ne 0) { Write-Warning "Motor imzalanamadi; kuruluma imzasiz motor girer." }
}

# NSIS setup - tauri bundle (exe zaten derliyse sadece paketler)
# Updater private key yoksa tauri sonda hata verebilir; NSIS yine de uretilmis olur.
$bundleOk = $false
$nsisDir = Join-Path $td "release\bundle\nsis"
if (-not $SkipBundle) {
  Write-Host "== NSIS setup (tauri bundle) =="
  $cfgPath = Join-Path $env:TEMP "yya-tauri-bundle.json"
  $kaynaklar = [ordered]@{ "../dist" = "dist/"; "../resonance/dist" = "resonance/dist/" }
  if ($motorVar) {
    $kaynaklar[$motorExe.Replace("\", "/")] = "yayin-motoru.exe"
    $kaynaklar[$motorLisans.Replace("\", "/")] = "yayin-motoru-LICENSE.txt"
    Write-Host "Kuruluma motor ekleniyor: $motorExe"
  } else {
    Write-Warning "motor\target\release\yayin-motoru.exe yok - kurulum motorsuz uretilir (panel 'motor paketi bulunamadi' der)."
  }
  $cfg = @{ bundle = @{ createUpdaterArtifacts = $false; resources = $kaynaklar } } | ConvertTo-Json -Depth 5
  # UTF-8 BOM'suz: yol Turkce karakter icerebilir, tauri BOM'lu JSON'u okuyamaz.
  [IO.File]::WriteAllText($cfgPath, $cfg, (New-Object Text.UTF8Encoding($false)))
  npx --yes tauri bundle --bundles nsis --ci --config $cfgPath
  Remove-Item -LiteralPath $cfgPath -Force -ErrorAction SilentlyContinue
  $nsisHit = Get-ChildItem -LiteralPath $nsisDir -Filter "*setup*.exe" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($nsisHit) {
    $bundleOk = $true
    Write-Host ("NSIS -> {0} ({1} MB)" -f $nsisHit.FullName, [math]::Round($nsisHit.Length / 1MB, 1))
  } else {
    Write-Warning "tauri bundle setup uretemedi; portable yine cikti\portable altina yazilacak."
  }
}

Write-Host "== Paketle -> cikti\ =="
$paketArgs = @()
if ($SkipSign) { $paketArgs += "-SkipSign" }
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "paketle.ps1") @paketArgs
if ($LASTEXITCODE -ne 0) { throw "paketle failed" }

# Imza dogrulama + Zone.Identifier temizle (SAC)
$exe = Join-Path $proj "cikti\portable\YayinYonetimAraci.exe"
$setup = Join-Path $proj "cikti\YayinYonetimAraci-Setup.exe"
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

Write-Host ""
Write-Host ("Bitti. rustOk={0} bundleOk={1}" -f $rustOk, $bundleOk)
Write-Host "  Portable: cikti\portable\"
Write-Host "  Setup:    cikti\YayinYonetimAraci-Setup.exe"
