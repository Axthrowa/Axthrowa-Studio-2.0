import os
import struct
import urllib.request

OUT = r"C:\Users\Axthrowa\Desktop\yayin-yonetim-araci\media\discord-red-dragon"
os.makedirs(OUT, exist_ok=True)

FILES = {
    "intro.png": "https://cdn.discordapp.com/assets/content/6898a8357b824710c262b697192bc8240eb9280b5c2e2d86ed1f8401bd78cee9",
    "loop.png": "https://cdn.discordapp.com/assets/content/3507e936802583b79c956d08db8babd92b183f7006a28457aba9f778910e7201",
    "thumbnail.png": "https://cdn.discordapp.com/assets/content/4d4b146448f47711415a15db8988977a88860da9fb67d233e4e6a8972446337b",
    "reduced-motion.png": "https://cdn.discordapp.com/assets/content/398251d43aac4e49adf54af81070be10b58a1d839ac2c67594a46b855b1edc3f",
}

for name, url in FILES.items():
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    path = os.path.join(OUT, name)
    with open(path, "wb") as f:
        f.write(data)
    info = ""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", data[16:24])
        apng = b"acTL" in data
        info = f" PNG {w}x{h} APNG={apng}"
    print(name, len(data), info)
