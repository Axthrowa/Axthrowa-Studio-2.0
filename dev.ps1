# AxthrowA geliştirme ortamı (Windows): masaüstü uygulaması (Tauri), tanıtım sitesi (Next.js) ve kılavuz
# (Docusaurus) tek pencerede, renkli öneklerle. Ctrl+C hepsini kapatır.
#
#   .\dev.ps1                 # üçü birden
#   .\dev.ps1 -TauriYok       # yalnız site + kılavuz
#
# Site ve kılavuz bu klasörün yanında aranır (..\axthrowa-site, ..\axthrowa-docs); başka yerdeyse
# AXTHROWA_SITE / AXTHROWA_DOCS ortam değişkenleriyle verin.
#
# Adresler: uygulama paneli http://127.0.0.1:8843 · site http://localhost:3100 · kılavuz http://localhost:3200
param([switch]$TauriYok)

$ErrorActionPreference = "Stop"
$kok = $PSScriptRoot
$site = if ($env:AXTHROWA_SITE) { $env:AXTHROWA_SITE } else { Join-Path (Split-Path $kok -Parent) "axthrowa-site" }
$docs = if ($env:AXTHROWA_DOCS) { $env:AXTHROWA_DOCS } else { Join-Path (Split-Path $kok -Parent) "axthrowa-docs" }

$adlar = @(); $renkler = @(); $komutlar = @()

if (-not $TauriYok) {
  # Kurulu uygulama açıksa 8843 doludur ve tek-örnek kilidi ikinci kopyayı kapatır: Tauri'yi başlatma
  if (Get-NetTCPConnection -LocalPort 8843 -State Listen -ErrorAction SilentlyContinue) {
    Write-Warning "8843 portu kullanımda (kurulu Yayın Yönetim Aracı açık). Tauri atlandı; uygulamayı kapatıp yeniden deneyin."
  } else {
    $adlar += "tauri"; $renkler += "magenta"; $komutlar += "npm run tauri:dev"
  }
}

foreach ($p in @(@{ Ad = "site"; Yol = $site; Renk = "cyan"; Komut = "run dev -- --port 3100" },
                 @{ Ad = "docs"; Yol = $docs; Renk = "blue"; Komut = "run start -- --port 3200 --no-open" })) {
  if (-not (Test-Path (Join-Path $p.Yol "package.json"))) {
    Write-Warning "$($p.Ad) bulunamadı: $($p.Yol) — atlandı"
    continue
  }
  if (-not (Test-Path (Join-Path $p.Yol "node_modules"))) {
    Write-Host "[$($p.Ad)] bağımlılıklar kuruluyor..."
    npm --prefix $p.Yol install
    if ($LASTEXITCODE -ne 0) { throw "$($p.Ad): npm install başarısız" }
  }
  $adlar += $p.Ad; $renkler += $p.Renk; $komutlar += "npm --prefix `"$($p.Yol)`" $($p.Komut)"
}

if ($komutlar.Count -eq 0) { throw "Başlatılacak bir şey yok." }

Set-Location $kok
# concurrently: her satırın başına renkli [ad] öneki; biri çökerse diğerleri çalışmaya devam eder
& npx --no-install concurrently --names ($adlar -join ",") --prefix-colors ($renkler -join ",") --prefix "[{name}]" @komutlar
exit $LASTEXITCODE
