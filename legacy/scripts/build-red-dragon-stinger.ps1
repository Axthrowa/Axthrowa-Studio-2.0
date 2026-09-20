# Build OBS Red Dragon stinger from Discord intro/loop WebM references.
# Timeline (based on Discord effect timing):
#   0–3500ms  intro (dragon enters top-right, breathes fire)
#   ~3000ms   switch point (fire covers screen)
#   3500–3800ms short hold on last intro frame / fire cover for clean cut
# loop.webm is reference for idle look; not concatenated into stinger
# (OBS stingers should end covered, not idle).

$ErrorActionPreference = "Stop"
$Root = "C:\Users\Axthrowa\Desktop\yayin-yonetim-araci\media\discord-red-dragon"
$Intro = Join-Path $Root "intro.webm"
$Out = Join-Path $Root "stinger-1920x1080.webm"
$OutAlpha = Join-Path $Root "stinger-1920x1080-alpha.webm"

if (-not (Test-Path $Intro)) { throw "Missing intro.webm" }

# scale 2.45 → 1103x2156; offsetX=80, offsetY=-100 (matches transition page layout)
$fc = @"
[1:v]fps=30,scale=1103:2156:flags=lanczos,format=rgba[dr];
[0:v]format=rgba[bg];
[bg][dr]overlay=x=1920-w+80:y=-100:shortest=1[v]
"@

# Black background stinger (most compatible with OBS Stinger)
ffmpeg -y `
  -f lavfi -i "color=c=black:s=1920x1080:d=3.8:r=30" `
  -i $Intro `
  -filter_complex $fc `
  -map "[v]" -an `
  -c:v libvpx-vp9 -b:v 6M -row-mt 1 `
  -pix_fmt yuv420p `
  $Out

# Alpha variant for browser/source overlays
ffmpeg -y `
  -f lavfi -i "color=c=0x00000000:s=1920x1080:d=3.8:r=30,format=rgba" `
  -i $Intro `
  -filter_complex $fc `
  -map "[v]" -an `
  -c:v libvpx-vp9 -b:v 6M -row-mt 1 -auto-alt-ref 0 `
  -pix_fmt yuva420p `
  $OutAlpha

Write-Host "OK $Out"
Write-Host "OK $OutAlpha"
Write-Host "SWITCH_POINT_MS=3000"
Write-Host "DURATION_MS=3800"
