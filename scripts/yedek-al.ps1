# Proje yedegi: kaynak kodu + ayar/veri dosyalari -> proje DISINDA zip.
#
#   powershell -ExecutionPolicy Bypass -File scripts\yedek-al.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\yedek-al.ps1 -Not "kisayol sekmesi"
#   powershell -ExecutionPolicy Bypass -File scripts\yedek-al.ps1 -Sakla 20
#
# Yedekler proje klasorunun YANINDAKI "axthrowa-studio-yedekler" klasorune yazilir
# (proje boyutunu sisirmesin). En yeni -Sakla adet tutulur (varsayilan 10).
#
# Ne yedeklenir:
#   - src, src-tauri/src (+migrations, Cargo.*, tauri.conf, capabilities), resonance/src,
#     scripts, docs, docker, public ve kokteki yapilandirma dosyalari
#   - cikti\portable\data icindeki ayar JSON'lari ve veritabani (media, tarayici profili haric)
# Ne yedeklenmez (yeniden uretilebilir ya da cok buyuk):
#   node_modules, target*, dist, cikti\*.exe, media, kick-edge-profile

param([string]$Not = "", [int]$Sakla = 10)

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
$hedefKok = Join-Path (Split-Path $proj -Parent) "axthrowa-studio-yedekler"
New-Item -ItemType Directory -Force -Path $hedefKok | Out-Null

$damga = Get-Date -Format "yyyyMMdd-HHmmss"
$temiz = ($Not -replace '[^\w\- ]', '' -replace '\s+', '-').Trim('-')
$ad = if ($temiz) { "yedek-$damga-$temiz" } else { "yedek-$damga" }
$zip = Join-Path $hedefKok "$ad.zip"
$sahne = Join-Path $env:TEMP "studio-yedek-$damga"

try {
  New-Item -ItemType Directory -Force -Path $sahne | Out-Null

  # 1) Klasorler (robocopy: /E alt klasorler, /XD dislama, /NFL /NDL /NJH /NJS sessiz)
  $klasorler = @(
    @{ kaynak = "src";                  dislama = @() },
    @{ kaynak = "src-tauri\src";        dislama = @() },
    @{ kaynak = "src-tauri\migrations"; dislama = @() },
    @{ kaynak = "src-tauri\capabilities"; dislama = @() },
    @{ kaynak = "src-tauri\icons";      dislama = @() },
    @{ kaynak = "resonance\src";        dislama = @() },
    @{ kaynak = "resonance\public";     dislama = @() },
    @{ kaynak = "scripts";              dislama = @() },
    @{ kaynak = "docs";                 dislama = @() },
    @{ kaynak = "docker";               dislama = @() },
    @{ kaynak = "public";               dislama = @() }
  )
  foreach ($k in $klasorler) {
    $src = Join-Path $proj $k.kaynak
    if (-not (Test-Path $src)) { continue }
    $dst = Join-Path $sahne $k.kaynak
    $argv = @($src, $dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP") + $(if ($k.dislama.Count) { @("/XD") + $k.dislama } else { @() })
    & robocopy @argv | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy basarisiz: $($k.kaynak) (kod $LASTEXITCODE)" }
  }

  # 2) Tek dosyalar
  $dosyalar = @(
    "package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "tsconfig.node.json",
    "tailwind.config.js", "postcss.config.js", "index.html",
    "src-tauri\Cargo.toml", "src-tauri\Cargo.lock", "src-tauri\tauri.conf.json", "src-tauri\build.rs",
    "resonance\package.json", "resonance\package-lock.json", "resonance\vite.config.js",
    "resonance\vitest.config.js", "resonance\index.html"
  )
  foreach ($f in $dosyalar) {
    $src = Join-Path $proj $f
    if (-not (Test-Path $src)) { continue }
    $dst = Join-Path $sahne $f
    New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }

  # 3) Kullanici verisi: ayar JSON'lari + veritabani (media / tarayici profili haric)
  $veri = Join-Path $proj "cikti\portable\data"
  if (Test-Path $veri) {
    $vdst = Join-Path $sahne "veri\data"
    New-Item -ItemType Directory -Force -Path $vdst | Out-Null
    Get-ChildItem -LiteralPath $veri -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -in ".json", ".db", ".txt" -or $_.Name -like "*.db-*" } |
      Copy-Item -Destination $vdst -Force
  }
  $appdata = Join-Path $proj "cikti\portable\app-data"
  if (Test-Path $appdata) {
    & robocopy $appdata (Join-Path $sahne "veri\app-data") "/E" "/NFL" "/NDL" "/NJH" "/NJS" "/NP" | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy basarisiz: app-data" }
  }

  # 4) Not dosyasi
  @(
    "Yedek: $ad",
    "Tarih: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Not: $Not",
    "Geri yukleme: zip'i ac, klasorleri proje klasorune kopyala; 'veri\' altindakileri",
    "cikti\portable\ altina (data ve app-data) koy."
  ) | Set-Content -LiteralPath (Join-Path $sahne "YEDEK-NOTU.txt") -Encoding UTF8

  Compress-Archive -Path (Join-Path $sahne "*") -DestinationPath $zip -CompressionLevel Optimal -Force
  $boyut = (Get-Item $zip).Length / 1MB
  Write-Host ("Yedek alindi: {0}  ({1:N1} MB)" -f $zip, $boyut)

  # 5) Saklama: en yeni -Sakla adedi kalsin
  $eskiler = Get-ChildItem $hedefKok -Filter "yedek-*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Sakla
  foreach ($e in $eskiler) { Remove-Item -LiteralPath $e.FullName -Force; Write-Host "Eski yedek silindi: $($e.Name)" }
}
finally {
  if (Test-Path $sahne) { Remove-Item -LiteralPath $sahne -Recurse -Force -ErrorAction SilentlyContinue }
}
