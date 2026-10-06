# Authenticode imza (CN=Axthrowa veya -Thumbprint).
# SAC acikken imzasiz yeni hash 3077 ile kesilir; ayni thumbprint ile imza
# onceki acilan surumlerle ayni yoldur. Kullanım:
#   powershell -ExecutionPolicy Bypass -File scripts\sign-cikti.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\sign-cikti.ps1 -Thumbprint <parmakizi>
#   powershell -ExecutionPolicy Bypass -File scripts\sign-cikti.ps1 -SkipPortable
#     SkipPortable: SAC hash'i korunmus portable exe'yi yeniden imzalama.
#   powershell -ExecutionPolicy Bypass -File scripts\sign-cikti.ps1 -Yalniz <dosya>[,<dosya>]
#     Yalniz: yalniz verilen dosyalari imzala.
param([string]$Thumbprint, [switch]$SkipPortable, [string[]]$Yalniz)

$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent

$signTool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\\x64\\' } |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $signTool) { throw "signtool.exe bulunamadi (Windows SDK)" }

$certs = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert

# CN=Axthrowa oncelikli (tauri.conf.json certificateThumbprint ile ayni).
if ($Thumbprint) {
  $cert = $certs | Where-Object { $_.Thumbprint -eq $Thumbprint } | Select-Object -First 1
  if (-not $cert) { throw "Parmak izine uyan sertifika yok: $Thumbprint" }
} else {
  $cert = $certs | Where-Object { $_.Subject -eq 'CN=Axthrowa' } | Select-Object -First 1
  if (-not $cert) { $cert = $certs | Where-Object { $_.Subject -like '*Axthrowa*' } | Select-Object -First 1 }
}
if (-not $cert) { throw "Kod imzalama sertifikasi yok (CN=Axthrowa)" }
Write-Host "Sertifika: $($cert.Subject)  [$($cert.Thumbprint)]"

$files = @(
  (Join-Path $proj "cikti\YayinYonetimAraci-Setup.exe"),
  (Join-Path $proj "cikti\Yayin Yonetim Araci_1.0.0_x64-setup.exe")
)
if (-not $SkipPortable) {
  $files = @((Join-Path $proj "cikti\portable\YayinYonetimAraci.exe")) + $files
}
if ($Yalniz) { $files = $Yalniz }
$files = $files | Where-Object { Test-Path $_ } | Select-Object -Unique

if (-not $files) { throw "cikti icinde imzalanacak dosya yok. Once scripts\paketle.ps1" }

$failed = @()
foreach ($f in $files) {
  # Çalışan uygulama dosyayı kilitler; imza "file is being used" ile düşer.
  if ((Split-Path $f -Leaf) -eq "YayinYonetimAraci.exe") {
    Get-Process YayinYonetimAraci -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Host "Calisan uygulama kapatiliyor (pid $($_.Id))..."
      $_ | Stop-Process -Force
      Start-Sleep -Milliseconds 800
    }
  }

  Unblock-File -LiteralPath $f -ErrorAction SilentlyContinue

  # Zaman damgalı imza: sertifika süresi dolsa da imza geçerli kalır.
  & $signTool sign /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /sha1 $cert.Thumbprint $f
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Zaman damgasi alinamadi, yedek sunucu deneniyor..."
    & $signTool sign /fd SHA256 /td SHA256 /tr http://timestamp.sectigo.com /sha1 $cert.Thumbprint $f
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Zaman damgasiz imzalaniyor (sertifika bitiminde imza gecersizlesir)."
    & $signTool sign /fd SHA256 /sha1 $cert.Thumbprint $f
  }

  $sig = Get-AuthenticodeSignature -LiteralPath $f
  $ts = if ($sig.TimeStamperCertificate) { "zaman-damgasi=VAR" } else { "zaman-damgasi=YOK" }
  Write-Host "$($sig.Status)  $ts  $($sig.SignerCertificate.Subject)  $f"
  if ($sig.Status -ne 'Valid') { $failed += $f }
}

if ($failed) { throw "Imza dogrulanamadi: $($failed -join ', ')" }
Write-Host "Imzalama tamam."
