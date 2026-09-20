import http.server
import functools
import glob
import json
import mimetypes
import os
import re
import shutil
import subprocess
import time
from urllib.parse import urlparse, parse_qs

SERVE_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE_INTRO = os.path.join(SERVE_DIR, "obs-settings-data.json")
SETTINGS_FILE_OUTRO = os.path.join(SERVE_DIR, "obs-outro-settings-data.json")
MEDIA_DIR = os.path.join(SERVE_DIR, "media")
PARTICLES_DIR = os.path.join(SERVE_DIR, "assets", "particles")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.startswith("/media/"):
            # Medya dosyaları (video/görsel) önbelleklenebilir; içerik değiştiğinde
            # yükleme sırasında dosya adına eklenen ?t= zaman damgası zaten yeni bir
            # URL oluşturuyor, bu yüzden agresif no-cache burada gereksiz ve video
            # döngü başına sunucudan yeniden indirilmeye çalışılınca takılmaya yol açıyor.
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def _route(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        screen = (qs.get("screen") or ["intro"])[0]
        if screen not in ("intro", "outro"):
            screen = "intro"
        return parsed.path, screen

    def _settings_file(self, screen):
        return SETTINGS_FILE_OUTRO if screen == "outro" else SETTINGS_FILE_INTRO

    def _video_stem(self, screen):
        return "outro-bg-video" if screen == "outro" else "bg-video"

    def do_GET(self):
        path, screen = self._route()
        if path == "/api/settings":
            self._get_settings(screen)
        elif path == "/api/settings/meta":
            self._get_settings_meta(screen)
        elif path.startswith("/media/"):
            self._get_media_file()
        elif path == "/api/particles":
            self._get_particles_list()
        else:
            super().do_GET()

    def do_POST(self):
        path, screen = self._route()
        if path == "/api/settings":
            self._post_settings(screen)
        elif path == "/api/upload-video":
            self._post_upload_video(screen)
        else:
            self.send_error(404)

    def _get_settings(self, screen):
        settings_file = self._settings_file(screen)
        data = "{}"
        if os.path.exists(settings_file):
            with open(settings_file, "r", encoding="utf-8") as f:
                data = f.read()
        body = data.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _get_settings_meta(self, screen):
        settings_file = self._settings_file(screen)
        mtime = os.path.getmtime(settings_file) if os.path.exists(settings_file) else 0
        body = json.dumps({"mtime": mtime}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _get_particles_list(self):
        # assets/particles/ klasöründeki her PNG/WEBP dosyası otomatik olarak
        # bir parçacık şekli olur — kullanıcı kod değiştirmeden, sadece bu
        # klasöre saydam bir görsel bırakarak yeni şekil ekleyebilir.
        names = []
        if os.path.isdir(PARTICLES_DIR):
            for fname in sorted(os.listdir(PARTICLES_DIR)):
                if fname.lower().endswith((".png", ".webp")):
                    names.append(fname)
        body = json.dumps(names).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _get_media_file(self):
        # video etiketinin döngü/atlama (seek) yapabilmesi için Range isteklerini
        # (kısmi içerik) desteklemek şart; aksi halde tarayıcı her seferinde
        # dosyanın tamamını indirmeye çalışır ve oynatım arada takılır.
        rel = self.path.split("?", 1)[0]
        if not rel.startswith("/media/"):
            self.send_error(404)
            return
        rel = rel[len("/media/"):]
        rel = rel.replace("\\", "/").lstrip("/")
        if ".." in rel.split("/"):
            self.send_error(403)
            return
        filepath = os.path.join(MEDIA_DIR, rel.replace("/", os.sep))
        if not os.path.isfile(filepath):
            self.send_error(404)
            return

        file_size = os.path.getsize(filepath)
        ctype = mimetypes.guess_type(filepath)[0] or "application/octet-stream"
        start, end = 0, file_size - 1
        status = 200

        range_header = self.headers.get("Range")
        if range_header:
            m = re.match(r"bytes=(\d*)-(\d*)", range_header)
            if m and (m.group(1) or m.group(2)):
                g1, g2 = m.groups()
                if g1:
                    start = int(g1)
                    end = int(g2) if g2 else file_size - 1
                else:
                    start = max(0, file_size - int(g2))
                    end = file_size - 1
                start = max(0, min(start, file_size - 1))
                end = max(start, min(end, file_size - 1))
                status = 206

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()

        if self.command == "HEAD":
            return

        with open(filepath, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    return
                remaining -= len(chunk)

    def _post_upload_video(self, screen):
        os.makedirs(MEDIA_DIR, exist_ok=True)
        length = int(self.headers.get("Content-Length", 0))
        ctype = self.headers.get("Content-Type", "video/webm").split(";")[0].strip()
        ext = mimetypes.guess_extension(ctype) or ".webm"
        if ext == ".qt":
            ext = ".mov"

        stem = self._video_stem(screen)
        upload_path = os.path.join(MEDIA_DIR, f"_upload_tmp_{stem}" + ext)
        remaining = length
        with open(upload_path, "wb") as f:
            while remaining > 0:
                chunk = self.rfile.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)

        final_name = self._transcode_video(upload_path, ext, stem)

        for stale in glob.glob(os.path.join(MEDIA_DIR, f"{stem}.*")):
            if os.path.basename(stale) != final_name:
                # Eski video, silme anında hâlâ tarayıcıya akıtılıyor olabilir
                # (Windows'ta bu dosyayı kilitler); kısa bir yeniden deneme yeterli.
                for attempt in range(5):
                    try:
                        os.remove(stale)
                        break
                    except OSError:
                        if attempt == 4:
                            break
                        time.sleep(0.3)

        body = json.dumps({"url": f"media/{final_name}?t={int(time.time() * 1000)}"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _transcode_video(self, upload_path, orig_ext, stem):
        # 4K gibi gereksiz yüksek çözünürlükteki videolar OBS'nin Tarayıcı
        # Kaynağı'nda (arka planda yayın da kodlanırken) takılmaya yol açabiliyor.
        # ffmpeg makinede kuruluysa videoyu 1080p'yi aşmayacak şekilde ve
        # OBS/tarayıcılarda donanım hızlandırmalı çözülmesi en olası codec olan
        # H.264/MP4'e dönüştürüyoruz. ffmpeg yoksa dosyayı olduğu gibi kullanırız.
        final_path_mp4 = os.path.join(MEDIA_DIR, f"{stem}.mp4")
        if shutil.which("ffmpeg"):
            try:
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", upload_path,
                        "-vf", "scale=w='min(1920,iw)':h=-2:force_original_aspect_ratio=decrease",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                        "-c:a", "aac", "-b:a", "128k",
                        final_path_mp4,
                    ],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=900, check=True,
                )
                os.remove(upload_path)
                return f"{stem}.mp4"
            except Exception:
                if os.path.exists(final_path_mp4):
                    try:
                        os.remove(final_path_mp4)
                    except OSError:
                        pass
        # ffmpeg yok veya dönüştürme başarısız oldu: orijinal dosyayı kullan.
        final_name = stem + orig_ext
        final_path = os.path.join(MEDIA_DIR, final_name)
        if os.path.exists(final_path):
            os.remove(final_path)
        os.rename(upload_path, final_path)
        return final_name

    def _post_settings(self, screen):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            json.loads(body)
            with open(self._settings_file(screen), "wb") as f:
                f.write(body)
            self.send_response(200)
        except Exception:
            self.send_response(400)
        self.send_header("Content-Length", "0")
        self.end_headers()


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8843
    handler = functools.partial(NoCacheHandler, directory=SERVE_DIR)
    http.server.test(HandlerClass=handler, port=port)
