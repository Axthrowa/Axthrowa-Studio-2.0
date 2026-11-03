"""NSIS kurulum görselleri: AxthrowA logosu, koyu zemin, menekşe/camgöbeği parlama.

  python scripts/kurulum-gorselleri.py

Üretir (tauri.conf.json > bundle.windows.nsis):
  src-tauri/icons/nsis-kenar.bmp   164×314  hoş geldiniz / bitti sayfalarının sol kenarı
  src-tauri/icons/nsis-baslik.bmp  150×57   diğer sayfaların sağ üst başlığı
NSIS 24 bit BMP ister (saydamlık yok).
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

KOK = Path(__file__).resolve().parent.parent
IKON = KOK / "src-tauri" / "icons" / "icon.png"
CIKTI = KOK / "src-tauri" / "icons"

KOYU = (9, 9, 11)  # axthrowa.dark
KART = (28, 28, 33)  # axthrowa.card
MENEKSE = (139, 92, 246)
CAMGOBEGI = (6, 182, 212)


def zemin(w: int, h: int) -> Image.Image:
    """Üstten alta koyu geçiş + iki yumuşak parlama (sol üst menekşe, sağ alt camgöbeği)"""
    img = Image.new("RGB", (w, h), KOYU)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(KART[i] * (1 - t) + KOYU[i] * t) for i in range(3)))
    isik = Image.new("RGB", (w, h), (0, 0, 0))
    di = ImageDraw.Draw(isik)
    r = max(w, h) * 0.45
    di.ellipse([w * 0.2 - r, h * 0.25 - r, w * 0.2 + r, h * 0.25 + r], fill=tuple(c // 3 for c in MENEKSE))
    di.ellipse([w * 0.9 - r * 0.7, h * 0.95 - r * 0.7, w * 0.9 + r * 0.7, h * 0.95 + r * 0.7], fill=tuple(c // 4 for c in CAMGOBEGI))
    isik = isik.filter(ImageFilter.GaussianBlur(max(w, h) * 0.18))
    return ImageChops.add(img, isik)


def logo(boy: int) -> Image.Image:
    return Image.open(IKON).convert("RGBA").resize((boy, boy), Image.LANCZOS)


def yazi_tipi(boy: int) -> ImageFont.ImageFont:
    for ad in ("segoeuib.ttf", "seguisb.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(ad, boy)
        except OSError:
            continue
    return ImageFont.load_default()


def kenar() -> Image.Image:
    w, h = 164, 314
    img = zemin(w, h)
    l = logo(88)
    img.paste(l, ((w - 88) // 2, 70), l)
    d = ImageDraw.Draw(img)
    f = yazi_tipi(20)
    yazi = "AxthrowA"
    gen = d.textlength(yazi, font=f)
    d.text(((w - gen) / 2, 172), yazi, font=f, fill=(244, 244, 245))
    # Altta marka şeridi: menekşeden camgöbeğine
    for x in range(24, w - 24):
        t = (x - 24) / (w - 48)
        d.line([(x, 206), (x, 208)], fill=tuple(round(MENEKSE[i] * (1 - t) + CAMGOBEGI[i] * t) for i in range(3)))
    f2 = yazi_tipi(11)
    alt = "AxthrowA Studio"
    d.text(((w - d.textlength(alt, font=f2)) / 2, 218), alt, font=f2, fill=(161, 161, 170))
    return img


def baslik() -> Image.Image:
    w, h = 150, 57
    img = zemin(w, h)
    l = logo(41)
    img.paste(l, (w - 41 - 10, (h - 41) // 2), l)
    d = ImageDraw.Draw(img)
    d.text((12, 18), "AxthrowA", font=yazi_tipi(15), fill=(244, 244, 245))
    for x in range(12, 82):
        t = (x - 12) / 70
        d.point((x, 40), fill=tuple(round(MENEKSE[i] * (1 - t) + CAMGOBEGI[i] * t) for i in range(3)))
    return img


if __name__ == "__main__":
    kenar().save(CIKTI / "nsis-kenar.bmp")
    baslik().save(CIKTI / "nsis-baslik.bmp")
    for ad in ("nsis-kenar.bmp", "nsis-baslik.bmp"):
        with Image.open(CIKTI / ad) as g:
            assert g.mode == "RGB", ad
            print(ad, g.size)
