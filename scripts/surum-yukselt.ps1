# Surumu uc yerde birden yukseltir: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
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
  @{ Yol = "src-tauri\Cargo.toml"; Desen = '(?m)^(version\s*=\s*")[^"]+(")' }
)
# Once hepsini dogrula, sonra yaz: biri bulunamazsa hicbiri degismesin
$yazilacak = foreach ($h in $hedefler) {
  $p = Join-Path $Kok $h.Yol
  $metin = [IO.File]::ReadAllText($p, $utf8)
  $re = [regex]$h.Desen
  $m = $re.Match($metin)
  if (-not $m.Success) { throw "Surum satiri bulunamadi: $($h.Yol)" }
  # Yalniz ilk eslesme: bagimlilik surumlerine dokunma
  @{ Yol = $p; Eski = $m.Value; Metin = $re.Replace($metin, "`${1}$Surum`${2}", 1) }
}
foreach ($y in $yazilacak) {
  [IO.File]::WriteAllText($y.Yol, $y.Metin, $utf8)
  Write-Host ("{0}: {1} -> {2}" -f (Split-Path $y.Yol -Leaf), $y.Eski.Trim(), $Surum)
}
