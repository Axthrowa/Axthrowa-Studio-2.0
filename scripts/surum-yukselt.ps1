# Surumu birden yukseltir: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, resonance (K7), README (F0-6)
# (Cargo.lock bir sonraki cargo derlemesinde kendiliginden guncellenir.)
#   powershell -ExecutionPolicy Bypass -File scripts\surum-yukselt.ps1 -Surum 1.7.1
param([Parameter(Mandatory)][string]$Surum, [string]$Kok)

$ErrorActionPreference = "Stop"
# PS 5.1 param varsayilaninda $PSScriptRoot bos: govdede coz
if (-not $Kok) { $Kok = Split-Path $PSScriptRoot -Parent }
if ($Surum -notmatch '^\d+\.\d+\.\d+$') { throw "Surum x.y.z biciminde olmali: $Surum" }

$utf8 = New-Object Text.UTF8Encoding($false)
$hedefler = @(
  @{ Yol = "package.json"; Desen = '(?m)^(\s*"version"\s*:\s*")[^"]+(")' },
  @{ Yol = "src-tauri\tauri.conf.json"; Desen = '(?m)^(\s*"version"\s*:\s*")[^"]+(")' },
  @{ Yol = "src-tauri\Cargo.toml"; Desen = '(?m)^(version\s*=\s*")[^"]+(")' },
  @{ Yol = "resonance\package.json"; Desen = '(?m)^(\s*"version"\s*:\s*")[^"]+(")' },
  # Kilit: ust satir + packages[""] (ilk iki eslesme; bagimliliklar daha sonra gelir)
  @{ Yol = "resonance\package-lock.json"; Desen = '(?m)^(\s*"version"\s*:\s*")[^"]+(")'; Adet = 2 }
)
# Once hepsini dogrula, sonra yaz: biri bulunamazsa hicbiri degismesin
$yazilacak = foreach ($h in $hedefler) {
  $p = Join-Path $Kok $h.Yol
  $metin = [IO.File]::ReadAllText($p, $utf8)
  $re = [regex]$h.Desen
  $m = $re.Match($metin)
  if (-not $m.Success) { throw "Surum satiri bulunamadi: $($h.Yol)" }
  # Yalniz ilk eslesme: bagimlilik surumlerine dokunma
  $adet = if ($h.Adet) { $h.Adet } else { 1 }
  @{ Yol = $p; Eski = $m.Value; Metin = $re.Replace($metin, "`${1}$Surum`${2}", $adet) }
}
# README: "Gecerli surum: **x** (icinde AxBoT y)" satiri; AxBoT surumu axbot/package.json'dan okunur
# (desen ASCII: PS 5.1 BOM'suz betigi ANSI okur, Turkce harf yazilmaz)
$botPaket = [IO.File]::ReadAllText((Join-Path $Kok "axbot\package.json"), $utf8)
$botSurum = ([regex]'(?m)^\s*"version"\s*:\s*"([^"]+)"').Match($botPaket).Groups[1].Value
if (-not $botSurum) { throw "AxBoT surumu okunamadi: axbot\package.json" }
$readme = Join-Path $Kok "README.md"
$readmeMetin = [IO.File]::ReadAllText($readme, $utf8)
$readmeRe = [regex]'(Ge.erli s.r.m: \*\*)[^*]+(\*\* \(i.inde AxBoT )[^)]+(\))'
$readmeEski = $readmeRe.Match($readmeMetin)
if (-not $readmeEski.Success) { throw "Surum satiri bulunamadi: README.md" }
$yazilacak = @($yazilacak) + @{ Yol = $readme; Eski = $readmeEski.Value; Metin = $readmeRe.Replace($readmeMetin, "`${1}$Surum`${2}$botSurum`${3}", 1) }

foreach ($y in $yazilacak) {
  [IO.File]::WriteAllText($y.Yol, $y.Metin, $utf8)
  Write-Host ("{0}: {1} -> {2}" -f (Split-Path $y.Yol -Leaf), $y.Eski.Trim(), $Surum)
}
