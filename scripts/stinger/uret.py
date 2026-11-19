"""Stinger karelerini başsız Chrome'da çizer, VP9 alfa WebM'e kodlar; geçiş noktasında ekranın tam kapalı olduğunu denetler."""
import asyncio, json, os, subprocess, sys, http.server, threading, functools, shutil
from playwright.async_api import async_playwright
KOK = os.path.dirname(os.path.abspath(__file__)); CIKTI = os.path.join(KOK, 'cikti'); FPS = 60
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8771), functools.partial(H, directory=KOK)); threading.Thread(target=srv.serve_forever, daemon=True).start()
async def ana(secili):
    os.makedirs(CIKTI, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080})
        await pg.goto('http://127.0.0.1:8771/sahne.html')
        liste = await pg.evaluate('liste()')
        rapor = []
        for s in liste:
            if secili and s['id'] not in secili: continue
            n = round(s['sure'] / 1000 * FPS); kdir = os.path.join(KOK, 'kare', s['id']); shutil.rmtree(kdir, ignore_errors=True); os.makedirs(kdir)
            nokta_kare = round(s['nokta'] * (n - 1)); kapali = []
            for i in range(n):
                t = i / (n - 1)
                enaz = await pg.evaluate(f"ciz({json.dumps(s['id'])}, {t})")
                if abs(i - nokta_kare) <= 1: kapali.append(enaz)
                await pg.locator('#c').screenshot(path=os.path.join(kdir, f'{i:04d}.png'), omit_background=True)
            webm = os.path.join(CIKTI, f"{s['id']}.webm")
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(kdir, '%04d.png'),
                            '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', os.environ.get('CRF','30'), '-row-mt', '1', '-auto-alt-ref', '0',
                            '-deadline', 'good', '-cpu-used', '2', webm], check=True)
            # Galeri önizlemesi: ekranın kısmen kapalı olduğu an (koyu zemin üstünde)
            shutil.copy(os.path.join(kdir, f'{round(n * 0.3):04d}.png'), os.path.join(CIKTI, f"{s['id']}.png"))
            r = {**s, 'kare': n, 'noktaMs': round(s['nokta'] * s['sure']), 'gecisteEnAzAlfa': min(kapali), 'bayt': os.path.getsize(webm)}
            rapor.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)
        await b.close()
    with open(os.path.join(CIKTI, 'rapor.json'), 'w') as f: json.dump(rapor, f, ensure_ascii=False, indent=1)
asyncio.run(ana(sys.argv[1:]))
