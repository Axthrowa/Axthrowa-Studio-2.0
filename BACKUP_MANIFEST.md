# Yedek Manifestosu

## A. Streaming OS revizyonu öncesi (2026-09-26 01:05:00) — EN GÜNCEL

| Alan | Değer |
|---|---|
| Zaman damgası | `20260926-010500` (yerel saat) |
| Özgün proje yolları | `C:/Users/Axthrowa/Desktop/yayin-yonetim-araci - Kopya (2)` (panel), `C:/Users/Axthrowa/Desktop/Projeler` (StreamAxT) |
| Yedek yolu | `C:/Users/Axthrowa/Yedekler/backup-pre-streaming-os-revision-20260926-010500` (proje dışında) |
| Git dalı (yedek anında) | iki depoda `revamp/streaming-os-20260925` (temiz ağaç) |
| Git HEAD | panel `809a53393ad5af0daaec1f26a8088522f5d7d2a2`, StreamAxT `aef017d2e372c5f47db4eb86fa9b34cf3ad84c69` |
| Güvenlik etiketi / yeni dal | `pre-streaming-os-revision-20260926-010500` / `revamp/streaming-os-20260926` (iki depoda) |
| Veritabanı türü | SQLite (panel `botaxt.db`, `botrix.db`; StreamAxT `streamaxt.sqlite`, `bilbakalim.db`) |
| Veritabanı yedeği | `db-snapshots/` — 37 dosya, SQLite backup API ile (WAL dahil) tutarlı kopya, **37/37 `integrity_check = ok`** |
| Dahil | iki deponun tamamı (`.git`, kaynak, migrasyonlar, `docs`, `scripts`, `cikti/` taşınabilir kurulum + `data`/`app-data`/`media`/`streamaxt/data`, `release*/…/data`), `%APPDATA%` ve `%LOCALAPPDATA%` altındaki `com.axthrowa.yayin-yonetim-araci` ve `…-tauri` (ayarlar, `botaxt.db`, Kick oturum dosyaları, `kick-edge-profile`, WebView2 `Local Storage`/IndexedDB), `git/panel.bundle` + `git/streamaxt.bundle` (`--all`) |
| Hariç (yeniden üretilebilir) | `node_modules`, `target`/`target-docker`/`target-linux`, panel `dist` + `resonance/dist`, StreamAxT `server/dist` + `client/dist`, junction'lar (`/XJ`), WebView2 önbellek klasörleri |
| Kapsam dışı | Windows Kimlik Yöneticisi girdileri (OBS parolası, Kick sırları, `multistream.key.*`) — dosya olarak yedeklenemez |
| Bütünlük doğrulaması | Her dosyanın SHA-256'sı yedekte ve kaynakta ayrı ayrı hesaplandı: **4404/4404 eşleşti, 0 farklı, 0 eksik**; `git bundle verify` iki pakette 0; kritik dosyalar (iki `.git/HEAD`, migrasyonlar, `botaxt.db`, üç gerçek `streamaxt.sqlite`, `settings-*.json`) yedekte tek tek kontrol edildi |
| Makine-okur liste | yedek klasöründeki `manifest.json` (dosya başına etiket, göreli yol, boyut, sha256, durum; DB anlık görüntüleri; git paketleri) |
| Kopyalama sırasında | panel, StreamAxT ve bot süreçleri kapalıydı |

**Geri yükleme:** `docs/ROLLBACK.md` §3 — depo için `git clone <bundle>` ya da etikete dönüş; veritabanları için
`db-snapshots/` altındaki tutarlı kopyalar (dosya adı `etiket__yol` biçiminde); ayarlar için `appdata-*` klasörlerini
özgün yerlerine kopyalama; sonra `manifest.json` sha256 değerleriyle doğrulama.

---

## B. Streaming OS dönüşümü öncesi (2026-09-25)

| Alan | Değer |
|---|---|
| Tarih | 2026-09-25 17:55:32 (yerel saat) |
| Yedek yolu | `C:\Users\Axthrowa\Yedekler\backup-pre-streaming-os-20260925-175532` |
| Toplam | 3644 dosya · 757 MB (+ 21 SQLite anlık görüntüsü + 2 git paketi) |
| Doğrulama | Her dosya kaynağından SHA-256 ile alındı, hedefte yeniden hesaplandı: **3644/3644 eşleşti, 0 eksik** |
| Makine-okur liste | yedek klasöründeki `manifest.json` (etiket, göreli yol, boyut, sha256) |

## Depolar

| Depo | Özgün yol | Dal (yedek anında) | HEAD | Git paketi |
|---|---|---|---|---|
| Panel (masaüstü kabuğu) | `C:\Users\Axthrowa\Desktop\yayin-yonetim-araci - Kopya (2)` | `streamaxt-bot` | `75f7c97121865d7c04e6b8a9b4f71b67f10e1684` | `git/panel.bundle` (tüm dallar + etiketler, `git bundle verify` OK, geçici klona geri yükleme denendi) |
| StreamAxT (bot) | `C:\Users\Axthrowa\Desktop\Projeler` | `revamp/botrix-parity-20260921` | `ef6481e21c6eb56997442dc91becce7e96714755` | `git/streamaxt.bundle` (aynı doğrulamalar) |

Güvenlik noktası (yedekten sonra): iki depoda da `pre-streaming-os-20260925-175532` açıklamalı etiketi ve
`revamp/streaming-os-20260925` çalışma dalı. Önceki çalışma ağaçları temizdi; hiçbir değişiklik silinmedi.

## Kapsanan yollar (yedek klasöründeki etiket → kaynak)

| Etiket | Kaynak | İçerik |
|---|---|---|
| `panel-repo/` | panel deposu | kaynak kod, `.git`, migrasyonlar, `media/`, `legacy/`, `assets/`, `public/`, `docs/`, `scripts/`, `docker/`, `resonance/` (+ `.env`), `cikti/` ve `cikti - Kopya/` (taşınabilir kurulum + `data`, `app-data`, `media`, `streamaxt/data`, `yedek-20260920`), eski derleme klasörlerinin yalnız veri alt klasörleri |
| `streamaxt-repo/` | StreamAxT deposu | kaynak kod, `.git`, `docs/`, `data/`, `server/data/`, `release*/…/data` |
| `appdata-roaming/com.axthrowa.yayin-yonetim-araci/` | `%APPDATA%\…` | kurulu mod verisi: `botaxt.db`, ayar JSON'ları, Kick OAuth/oturum dosyaları, `kick-edge-profile` (önbellekler hariç) |
| `appdata-roaming/com.axthrowa.yayin-yonetim-tauri/` | `%APPDATA%\…` | eski sürüm ayarları |
| `appdata-local/com.axthrowa.yayin-yonetim-araci/` ve `…-tauri/` | `%LOCALAPPDATA%\…\EBWebView` | WebView2 profili: `Local Storage`, IndexedDB (panel tercihleri, bot yapılandırması, platform yazma oturumları) — önbellekler hariç |
| `db-snapshots/` | yukarıdaki tüm `.db`/`.sqlite` | SQLite **backup API** ile tutarlı kopya (WAL dahil); her biri `PRAGMA integrity_check = ok` |
| `git/` | iki depo | `git bundle create --all` |

Veritabanı anlık görüntüleri (21): `botaxt.db` (kurulu mod, 36 tablo), `cikti/portable/streamaxt/data/streamaxt.sqlite`
(gömülü StreamAxT, 29 tablo), `Projeler/data` ve `server/data` StreamAxT veritabanları, `bilbakalim.db`'ler, eski
`botrix.db` ve yedek klasörlerindeki kopyalar.

## Dışarıda bırakılanlar (yeniden üretilebilir)

`node_modules/`, `src-tauri/target/`, `target-docker/` (2.3 GB), `target-linux/`, Vite `dist/`,
`Portable-Build*` / `Dist-AxthrowA` / `release*` içindeki derlenmiş ikili dosyalar, tarayıcı önbellek klasörleri
(`Cache`, `Code Cache`, `GPUCache`, `Dawn*Cache`, `ShaderCache`, `CacheStorage`, `Crashpad` …).

**Dosya olarak yedeklenemeyen:** Windows Kimlik Yöneticisi girdileri (`keyring`: OBS WebSocket parolası, Kick bot
sırları). Kaynak sistemde duruyor; yeni makineye taşınırsa yeniden girilmeleri gerekir.

Sırlar (OAuth dosyaları, `.env`, tarayıcı profili) yedeğin İÇİNDEDİR; bu belgeye ve raporlara değerleri yazılmadı.

## Geri yükleme

1. Uygulamayı ve StreamAxT'i kapatın (tepsi simgesi → Çıkış).
2. **Kod:** `git clone <yedek>\git\panel.bundle hedef-klasor` (StreamAxT için `streamaxt.bundle`), ya da mevcut depoda
   `git reset --hard pre-streaming-os-20260925-175532` (yalnız bu etiketten sonraki işi geri almak istiyorsanız).
3. **Kurulu mod verisi:** `%APPDATA%\com.axthrowa.yayin-yonetim-araci` klasörünü yeniden adlandırın, yerine
   `appdata-roaming\com.axthrowa.yayin-yonetim-araci` içeriğini kopyalayın. Veritabanı için `db-snapshots\…\botaxt.db`
   tercih edilmeli (tutarlı kopya); `-wal`/`-shm` dosyalarını birlikte KOPYALAMAYIN.
4. **WebView2 profili:** `%LOCALAPPDATA%\com.axthrowa.yayin-yonetim-araci\EBWebView` için aynı yöntem.
5. **Taşınabilir kurulum / gömülü StreamAxT verisi:** `panel-repo\cikti\portable\{data,app-data,media,streamaxt\data}`.
6. Kopyadan sonra `manifest.json` ile SHA-256 karşılaştırması yapılabilir.
