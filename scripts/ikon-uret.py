#!/usr/bin/env python3
"""Kaynak logodan uygulama ve tepsi ikonlarini uretir.

Kaynak gorsel, yuvarlak kosleli kare rozetin cevresinde dekoratif bir fon
(petek desenleri, parlama) tasiyor. Ikon olarak yalnizca rozet kullanilmali;
fon kirpilip kosleri saydam yapiliyor. Aksi halde Windows tepside ve gorev
cubugunda ikonun etrafinda koyu bir kare blok goruluyor.

    python scripts/ikon-uret.py [kaynak.png]

Cikti:
    app-icon-src/app-icon.png   1024x1024, saydam kosleli  (npx tauri icon girdisi)
    src-tauri/icons/tray.png    64x64, sistem tepsisi icin
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

KOK = Path(__file__).resolve().parent.parent
VARSAYILAN_KAYNAK = KOK / "app-icon-src" / "logo2-kaynak.png"
HEDEF_IKON = KOK / "app-icon-src" / "app-icon.png"
HEDEF_TEPSI = KOK / "src-tauri" / "icons" / "tray.png"

BOYUT = 1024
# Rozetin kose yariciapi kenarin ~%23'u. Kaynaktaki egrilikle ortusuyor;
# daha kucuk deger kose paylarinda koyu ucgenler birakiyor.
KOSE_ORANI = 0.23
TEPSI_BOYUTU = 64


def parlaklik(p: tuple[int, int, int]) -> float:
  return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def rozet_sinirlari(im: Image.Image) -> tuple[int, int, int, int]:
  """Rozetin parlak kenar cizgisinden sol/ust/sag/alt sinirlarini bulur.

  Fon koyu ama duz siyah degil (petekler, parlama), rozetin kenari ise ince
  ve acik renkli bir cizgi. Ortadaki satir ve kolonda esigi gecen ilk/son
  pikseller kenari veriyor. Esik, gorselin kendi parlaklik dagilimindan
  turetiliyor ki farkli bir logo da calissin.
  """
  rgb = im.convert("RGB")
  g, y = rgb.size
  px = rgb.load()

  orta_y, orta_x = y // 2, g // 2
  ornekler = [parlaklik(px[x, orta_y]) for x in range(g)]
  ornekler += [parlaklik(px[orta_x, t]) for t in range(y)]
  ornekler.sort()
  # Kenar cizgisi az sayida piksel; medyanin belirgin ustundeki bir esik
  # fonu disarida birakip cizgiyi yakaliyor.
  esik = max(70.0, ornekler[len(ornekler) // 2] * 2.2)

  def tara(degerler: list[float]) -> tuple[int, int]:
    ustunde = [i for i, v in enumerate(degerler) if v > esik]
    if not ustunde:
      raise SystemExit("Rozet kenari bulunamadi — esik gorsele uymuyor.")
    return ustunde[0], ustunde[-1]

  sol, sag = tara([parlaklik(px[x, orta_y]) for x in range(g)])
  ust, alt = tara([parlaklik(px[orta_x, t]) for t in range(y)])
  return sol, ust, sag, alt


def kareye_al(sol: int, ust: int, sag: int, alt: int, g: int, y: int) -> tuple[int, int, int, int]:
  """Sinirlari, gorselden tasmayacak sekilde merkezli bir kareye cevirir."""
  kenar = max(sag - sol, alt - ust) + 1
  mx, my = (sol + sag) / 2, (ust + alt) / 2
  kenar = min(kenar, g, y)
  x0 = round(min(max(mx - kenar / 2, 0), g - kenar))
  y0 = round(min(max(my - kenar / 2, 0), y - kenar))
  return x0, y0, x0 + kenar, y0 + kenar


def yuvarlak_maske(boyut: int, yaricap: int) -> Image.Image:
  """Kenar yumusatmali yuvarlak kare maske (4x cizip kucultme)."""
  kat = 4
  buyuk = Image.new("L", (boyut * kat, boyut * kat), 0)
  ImageDraw.Draw(buyuk).rounded_rectangle(
    (0, 0, boyut * kat - 1, boyut * kat - 1), radius=yaricap * kat, fill=255
  )
  return buyuk.resize((boyut, boyut), Image.LANCZOS)


def main() -> None:
  kaynak = Path(sys.argv[1]) if len(sys.argv) > 1 else VARSAYILAN_KAYNAK
  if not kaynak.exists():
    raise SystemExit(f"Kaynak gorsel yok: {kaynak}")

  im = Image.open(kaynak).convert("RGBA")
  g, y = im.size
  sol, ust, sag, alt = rozet_sinirlari(im)
  kutu = kareye_al(sol, ust, sag, alt, g, y)
  print(f"kaynak    : {kaynak.name} {g}x{y}")
  print(f"kenar     : sol={sol} ust={ust} sag={sag} alt={alt}")
  print(f"kirpma    : {kutu}  ({kutu[2] - kutu[0]}x{kutu[3] - kutu[1]})")

  rozet = im.crop(kutu).resize((BOYUT, BOYUT), Image.LANCZOS)
  maske = yuvarlak_maske(BOYUT, round(BOYUT * KOSE_ORANI))
  rozet.putalpha(maske)

  HEDEF_IKON.parent.mkdir(parents=True, exist_ok=True)
  rozet.save(HEDEF_IKON)
  print(f"yazildi   : {HEDEF_IKON.relative_to(KOK)} {BOYUT}x{BOYUT}")

  # Tepsi 16-32 px'e kuculuyor; hafif keskinlestirme ince neon halkalarin
  # tamamen kaybolmasini engelliyor.
  tepsi = rozet.resize((TEPSI_BOYUTU, TEPSI_BOYUTU), Image.LANCZOS)
  tepsi = tepsi.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))
  tepsi.putalpha(yuvarlak_maske(TEPSI_BOYUTU, round(TEPSI_BOYUTU * KOSE_ORANI)))
  HEDEF_TEPSI.parent.mkdir(parents=True, exist_ok=True)
  tepsi.save(HEDEF_TEPSI)
  print(f"yazildi   : {HEDEF_TEPSI.relative_to(KOK)} {TEPSI_BOYUTU}x{TEPSI_BOYUTU}")
  print("\nSimdi: npx tauri icon app-icon-src/app-icon.png")


if __name__ == "__main__":
  main()
