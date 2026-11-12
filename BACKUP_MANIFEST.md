# En güncel yedek — Streaming OS dönüşümü öncesi (2026-09-25 17:55:32)

İki depoyu (bu depo + masaüstü paneli) ve tüm kullanıcı verisini kapsar; ayrıntılı manifesto panel deposunda
`BACKUP_MANIFEST.md` ve yedek klasöründe:

- Yedek: `C:\Users\Axthrowa\Yedekler\backup-pre-streaming-os-20260925-175532` (3644 dosya, SHA-256 ile 3644/3644 doğrulandı)
- Bu depo: dal `revamp/botrix-parity-20260921`, HEAD `ef6481e21c6eb56997442dc91becce7e96714755`, paket `git/axbot.bundle`
- Güvenlik noktası: etiket `pre-streaming-os-20260925-175532`, çalışma dalı `revamp/streaming-os-20260925`

---

# BACKUP MANIFEST — BotRix parity revizyonu öncesi

**Yedek zamanı:** 2026-09-21 18:21:05 (yerel saat)
**Timestamp:** `20260921-182105`
**Yedek türü:** Tam dosya sistemi kopyası + Git anlık görüntüsü
**Amaç:** BotRix.live referanslı kapsamlı revizyona başlamadan önce geri
dönülebilir bir güvenli nokta oluşturmak.

---

## 1. Yedek konumu

```
C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\backup-pre-botrix-revision-20260921-182105\
├── Projeler\                  (AxBoT — bot sunucusu + panel arayüzü)
└── yayin-yonetim-araci\       (Tauri masaüstü kabuğu)
```

**Boyut:** 4.040 dosya · 1.604,3 MB
**Yedek yöntemi:** `robocopy /E /XJ` (junction'lar takip edilmedi — sonsuz
döngü riski)

---

## 2. Yedeklenen projeler

| Proje | Kaynak yol | Rol |
|---|---|---|
| **AxBoT** | `C:\Users\Axthrowa\Desktop\Projeler` | Yayın botu: Express sunucu + React panel + OBS widget'ları |
| **Panel kabuğu** | `C:\Users\Axthrowa\Desktop\yayin-yonetim-araci - Kopya (2)` | Tauri 2 masaüstü uygulaması; AxBoT'yi Bot sekmesinde gömülü çalıştırır |

---

## 3. Yedeğe DAHİL olanlar

- Tüm kaynak kod (`server/src`, `client/src`, `src-tauri/src`, `src/`)
- Tüm yapılandırma (`package.json`, `tsconfig.json`, `vite.config.ts`,
  `tauri.conf.json`, `Cargo.toml`)
- **Tüm SQLite veritabanları ve WAL/SHM dosyaları** (aşağıda liste)
- `scripts/` (yedek alma, soru içe aktarma, AxBoT hazırlama betikleri)
- `docs/` (mevcut araştırma notları)
- `release/` ve `release - Kopya/` dağıtım klasörleri (node_modules hariç)
- Panel `cikti/portable/` (çalışan taşınabilir sürüm, node_modules hariç)
- Git meta verisi (panelin `.git` klasörü)

### Yedeklenen veritabanları

| Dosya | Boyut | İçerik |
|---|---|---|
| `Projeler\server\data\axbot.sqlite` | 1.138.688 B | **Geliştirme veritabanı** (26 tablo) |
| `Projeler\data\axbot.sqlite` | 1.138.688 B | Çalışma dizini kopyası |
| `Projeler\release\data\axbot.sqlite` | 978.944 B | Dağıtım kopyası |
| `Projeler\release\AxBoT-v1.0.0-Portable\app\data\axbot.sqlite` | 1.114.112 B | Taşınabilir sürüm |
| `yayin-yonetim-araci\cikti\portable\axbot\data\axbot.sqlite` (+WAL 622 KB, +SHM) | 1.122.304 B | **Panelde çalışan CANLI veritabanı** |
| `Projeler\server\data\bilbakalim\bilbakalim.db` | 466.944 B | Bil Bakalım soru bankası |
| `Projeler\release - Kopya\**` | çeşitli | Eski sürüm kopyaları |

> WAL dosyaları da kopyalandı; SQLite kurtarması için gereklidir.

---

## 4. Yedeğe DAHİL OLMAYANLAR (bilinçli)

| Hariç tutulan | Gerekçe | Nasıl geri gelir |
|---|---|---|
| `node_modules/` (her seviyede) | ~700 MB + 3,5 GB, `package-lock.json`'dan birebir yeniden kurulur | `npm install` |
| `client/dist/`, `server/dist/` | Derleme çıktısı | `npm run build` |
| `src-tauri/target/`, `target-docker/`, `target-linux/` | Rust derleme önbelleği (GB'larca) | `cargo build` |
| `.vite/`, `.turbo/` | Araç önbelleği | otomatik |
| Junction/symlink hedefleri | `robocopy /XJ`; hedefleri zaten ayrıca yedeklendi | `scripts/axbot-hazirla.mjs` |

**Kritik not:** `package-lock.json` yedeğe dahildir, bu yüzden bağımlılıklar
birebir aynı sürümlerle geri kurulabilir.

---

## 5. Git durumu (revizyon öncesi)

### AxBoT (`Projeler`)

Revizyon öncesinde **git deposu yoktu**. Rollback'i mümkün kılmak için bu
revizyon kapsamında oluşturuldu:

| | |
|---|---|
| Başlangıç commit'i | `cdc968e347666ea44bac82f253a866898ae20496` |
| Commit mesajı | "Revizyon öncesi anlık görüntü: AxBoT mevcut durumu" |
| Güvenlik etiketi | `pre-botrix-revision-20260921-182105` |
| Çalışma branch'i | `revamp/botrix-parity-20260921` |
| İzlenen dosya | 109 |
| Depo boyutu | 811 KB |

`.gitignore` ile depoya **alınmayanlar**: `node_modules`, derleme çıktıları,
`release*/`, **tüm veritabanları ve `.env`** (OAuth tokenları ve API
anahtarları veritabanında durduğu için depoya asla girmemeli).

### Panel kabuğu (`yayin-yonetim-araci - Kopya (2)`)

Mevcut git deposu korundu; **working tree'ye dokunulmadı**.

| | |
|---|---|
| Aktif branch (değişmedi) | `axbot-bot` |
| HEAD | `9a4faa66b91716a568089cdd3144851fce733c64` |
| Son commit | "Sol menü içeriğin üstünde kalsın (Giriş/Çıkış/Mola'da arkada kalıyordu)" |
| Uzak depo | `github.com/Axthrowa/yayin-yonetim-araci` (private) |
| Güvenlik etiketi | `pre-botrix-revision-20260921-182105` |
| Hazırlanan branch | `revamp/botrix-parity-20260921` (checkout **yapılmadı**) |
| Kaydedilmemiş değişiklik | 4 dosya — `SoundBoardPanel.tsx`, `AxBotHost.tsx`, `CopyUrl.tsx`, `PanelPage.tsx` |
| Takip edilmeyen dosya | yok |

> Panelin branch'i bilerek değiştirilmedi: bu klasörde başka bir araç da
> eşzamanlı çalışıyor, checkout değiştirmek onun işini bozardı. Etiket ve
> branch working tree'ye dokunmadan oluşturuldu.

---

## 6. Yedek doğrulaması

Kopyalama sonrası 12 kritik dosyanın **SHA-256 özeti** kaynakla karşılaştırıldı.

| Dosya | Sonuç |
|---|---|
| `Projeler\server\src\index.ts` | ✅ eşleşti (3,7 KB) |
| `Projeler\server\src\api\routes.ts` | ✅ eşleşti (71,8 KB) |
| `Projeler\server\src\ws\server.ts` | ✅ eşleşti (17,9 KB) |
| `Projeler\server\src\db\index.ts` | ✅ eşleşti (25,4 KB) |
| `Projeler\server\data\axbot.sqlite` | ✅ eşleşti (1.112 KB) |
| `Projeler\data\axbot.sqlite` | ✅ eşleşti (1.112 KB) |
| `Projeler\client\src\App.tsx` | ✅ eşleşti (12,6 KB) |
| `Projeler\client\src\pages\OverlayStudio.tsx` | ✅ eşleşti (115,1 KB) |
| `Projeler\package.json` | ✅ eşleşti |
| `yayin-yonetim-araci\src-tauri\src\main.rs` | ✅ eşleşti |
| `yayin-yonetim-araci\src\components\panel\MusicPanel.tsx` | ✅ eşleşti (9,1 KB) |
| `Projeler\release\app\data\axbot.sqlite` | ⚠️ yok — **kaynakta da yok**; doğrulama listesindeki yol hatalıydı, gerçek yollar `release\data\` ve `release\AxBoT-v1.0.0-Portable\app\data\` olup ikisi de yedekte mevcut |

**Sonuç: yedek doğrulandı.** Gerçekten var olan 11 kritik dosyanın tamamı
bit düzeyinde birebir.

---

## 7. Geri yükleme (restore) prosedürü

### A) Tek dosyayı geri almak

```bash
cp "C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\backup-pre-botrix-revision-20260921-182105\Projeler\<yol>" "C:\Users\Axthrowa\Desktop\Projeler\<yol>"
```

### B) Kaynak kodu git ile geri almak (en hızlı yol)

```bash
cd "C:\Users\Axthrowa\Desktop\Projeler" && git checkout pre-botrix-revision-20260921-182105 -- .
```

Tüm revizyonu tamamen iptal etmek için:

```bash
cd "C:\Users\Axthrowa\Desktop\Projeler" && git checkout -B main pre-botrix-revision-20260921-182105
```

### C) Veritabanını geri almak

**Önce AxBoT'yi kapatın** (port 3001 boş olmalı), sonra:

```bash
cp "C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\backup-pre-botrix-revision-20260921-182105\Projeler\server\data\axbot.sqlite" "C:\Users\Axthrowa\Desktop\Projeler\server\data\axbot.sqlite"
```

Panelde çalışan canlı veritabanı için:

```bash
cp "C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\backup-pre-botrix-revision-20260921-182105\yayin-yonetim-araci\cikti\portable\axbot\data\axbot.sqlite" "C:\Users\Axthrowa\Desktop\yayin-yonetim-araci - Kopya (2)\cikti\portable\axbot\data\axbot.sqlite"
```

> WAL/SHM dosyalarını da birlikte kopyalayın, yoksa SQLite eski duruma döner.

### C2) Panel kabuğunu geri almak

```bash
cd "C:\Users\Axthrowa\Desktop\yayin-yonetim-araci - Kopya (2)" && git checkout pre-botrix-revision-20260921-182105 -- .
```

> Bu komut o klasörde eşzamanlı çalışan diğer aracın kaydedilmemiş 4 dosyasını
> da geri alır. Yalnız kendi değişikliklerimi geri almak için dosya yolu verin.

### D) Bağımlılıkları yeniden kurmak

```bash
cd "C:\Users\Axthrowa\Desktop\Projeler" && npm install
```

### E) Tam geri dönüş (nükleer seçenek)

1. AxBoT'yi ve paneli kapatın.
2. `Projeler` ve `yayin-yonetim-araci - Kopya (2)` klasörlerini yeniden adlandırın.
3. Yedekteki iki klasörü Desktop'a kopyalayın.
4. Her iki projede `npm install` çalıştırın.
5. Panelde Rust tarafı için `cargo build` gerekir (veya `cikti/portable`
   içindeki imzalı exe olduğu gibi çalışır).

---

## 8. Güvenlik notu

Bu manifest hiçbir şifre, API anahtarı, OAuth tokenı veya oturum çerezi
içermez. Yedeklenen veritabanları **düz metin OAuth tokenı ve API gizli
anahtarı içerdiği için** yedek klasörü, kaynak proje kadar gizli tutulmalıdır.

**3. tur güncellemesi:** Sırlar artık diskte Windows DPAPI ile şifreli
(`dpapi:v1:`), ama bu yalnız yeni sürüm **açıldıktan sonra** yazılan
veritabanları için geçerli. Bu klasördeki 2026-09-24 ve öncesine ait bütün
zip'ler ve `axbot-veritabani-dpapi-oncesi-*.zip` **düz metin token**
içerir — paylaşmayın. Şifreli bir veritabanı da başka bilgisayarda
çözülemez; taşınabilir yedek için tokenlar yeniden girilmelidir.

---

## 9. İkinci tur yedekleri (2026-09-23)

| Yedek | Konum | Doğrulama |
|---|---|---|
| **AxBoT git paketi — SON** (tüm geçmiş) | `C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\axbot-tur2-final-20260923-182538.bundle` (690 KB) | `git bundle verify` → *is okay*; `revamp/botrix-parity-20260921` = `70610fd` (Trovo düzeltmeleri dahil) |
| AxBoT git paketi — ara | `…\axbot-tur2-20260923-182053.bundle` (687 KB) | `5b48133`; son paket bunu kapsar |
| **Panel kabuğu zip'i** (kaynak + `cikti\portable\data` ayarları ve veritabanı) | `C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\yedek-20260923-181946-axbot-P2-P3-tur2-trovo-etkilesim-entegrasyon.zip` (10,8 MB) | `scripts\yedek-al.ps1` |

Git paketinden geri yükleme:

```bash
git clone axbot-tur2-final-20260923-182538.bundle AxBoT-geri -b revamp/botrix-parity-20260921
```

İkinci turun veritabanı değişiklikleri **eklemeli**dir: beş yeni tablo
(`predictions`, `prediction_bets`, `viewer_queue`, `alert_variants`,
`media_library`) `CREATE TABLE IF NOT EXISTS` ile oluşur; mevcut tablolara ve
sütunlara dokunulmaz, göç yoktur. Trovo mevcut `channels` tablosunu kullanır.
Eski kod bu tabloları görmezden gelir — birinci turun geri alma yolu (`§7`)
veri kaybettirmeden aynen geçerlidir.

---

## 10. Üçüncü tur yedekleri (2026-09-24)

| Yedek | Konum | Doğrulama |
|---|---|---|
| **AxBoT git paketi** (tüm geçmiş) | `C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\axbot-tur3-final-20260924-233106.bundle` (840 KB, sha256 `8c148f2b…0c46ad9`) | `git bundle verify` → *is okay*, tam geçmiş; `revamp/botrix-parity-20260921` = `52b99d0` (kod + belgeler), `master` ve `pre-botrix-revision-20260921-182105` etiketi dahil |
| **Panel kabuğu zip'i** (kaynak + `cikti\portable\data` + `app-data`) | `…\yedek-20260924-233048-axbot-tur3-guvenlik-dpapi-rotalar-belgeler.zip` (10,8 MB, 500 dosya) | Zip bütünlük denetimi OK. `-Sakla 11` ile alındı: betiğin varsayılanı (10) en eski zip'i (`yedek-20260921-013303-…`) **silecekti**; hiçbir yedek silinmedi |
| **AxBoT gerçek veritabanı — DPAPI göçünden önce** | `…\axbot-veritabani-dpapi-oncesi-20260924-233145.zip` (458 KB, sha256 `6013b769…fc528a25daa`) | Zip bütünlük OK; `axbot.sqlite` + `-wal` + `-shm`, bot çalışmıyorken kopyalandı. Panel yedek betiği `cikti\portable\axbot\data` klasörünü **paketlemediği** için ayrıca alındı |
| **AxBoT release veritabanı — DPAPI göçünden önce** (`Projeler\release\data`, `Start-AxBoT.bat` / tepsi başlatıcısının kullandığı) | `…\axbot-release-veritabani-dpapi-oncesi-20260924-233349.zip` (295 KB, sha256 `2ab0a569…406373cf`) | Zip bütünlük OK; bot çalışmıyorken kopyalandı. `release/` git dışında olduğu için başka yedeği yoktu |

Git paketinden geri yükleme:

```bash
git clone axbot-tur3-final-20260924-233106.bundle AxBoT-geri -b revamp/botrix-parity-20260921
```

**Gerçek veritabanlarının durumu** (zip'teki kopyalar geçici klasörde
açılarak okundu; asıl dosyalara ve sır değerlerine dokunulmadı):

| Veritabanı | Uygulanmış göç | Son yazım | Token | İlk açılışta |
|---|---|---|---|---|
| Panel gömmesi (`cikti\portable\axbot\data`) | 1–5 | 2026-09-21 22:50 | Kick, **düz metin** | Göç #6 + DPAPI |
| Release (`Projeler\release\data`) | yok (göç sistemi öncesi) | 2026-09-21 22:07 | Kick, **düz metin** | Göç #1–#6 + DPAPI |

Göçlerin hepsi eklemelidir (yeni tablo / varsayılanlı yeni sütun).

**3. turdan önceye dönüş:** bot kapalıyken ilgili veritabanı zip'indeki üç
dosyayı kendi klasörüne (`cikti\portable\axbot\data\` ya da
`Projeler\release\data\`) koyun ve kodu geri alın (`§7`). Kodu geri almadan yalnız veritabanını geri koymak da
güvenlidir: yeni sürüm açılışta göç #6'yı ve şifrelemeyi yeniden uygular.
