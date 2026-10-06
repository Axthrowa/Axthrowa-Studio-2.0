# Lisans ve Bağımlılık İncelemesi

> Tarih: 2026-09-26. Yöntem: `cargo metadata` (580 crate), `node_modules/**/package.json` taraması (panel 189,
> Resonance 124, StreamAxT 308 paket), npm kayıt defteri (`npm view <paket>@<sürüm> license`), GitHub API.
> **Hukuki görüş değildir**; mühendislik açısından risk ve seçenekleri kaydeder. Nihai lisans stratejisi ürün sahibinin
> kararıdır.

## 1. Ürünlerin kendi lisansları

| Bileşen | Beyan | Not |
|---|---|---|
| Panel (Yayın Yönetim Aracı) | **lisans dosyası yok** (özel GitHub deposu) | varsayılan: tüm hakları saklı. Dağıtılan ikili: imzalı exe + NSIS kurulumu |
| Resonance | beyan yok (panel içinde) | panelle aynı |
| StreamAxT | **MIT** (`package.json`) | `release/` altında taşınabilir zip ve kurulum olarak dağıtılıyor; panelin içine de gömülü |

## 2. Bağımlılık taraması — sonuç

| Ağaç | Güçlü copyleft (GPL/AGPL) | Zayıf copyleft | Değerlendirme |
|---|---|---|---|
| Panel Rust (580 crate) | **yok** | MPL-2.0: `cssparser`, `cssparser-macros`, `dtoa-short`, `selectors`, `option-ext` (Tauri/wry zinciri); `r-efi` (MIT OR Apache OR LGPL — MIT seçilir) | MPL-2.0 dosya düzeyinde: değiştirilmeden kullanıldığı sürece yalnız lisans bildirimi. Uygun |
| Panel npm (189) | yok | yok (`CC-BY-4.0` 1 veri paketi — atıf) | Uygun |
| Resonance npm (124) | yok | MPL-2.0: `lightningcss` (yalnız derleme aracı, dağıtılmaz) | Uygun |
| StreamAxT npm (308) | **vardı: `tiktok-live-connector@2.5.0` ve `tiktok-live-proto@0.2.4` — AGPL-3.0-only** | MPL-2.0: `lightningcss` (derleme) | **Düzeltildi (71d0c37)** — §3 |

## 3. Bulgu: AGPL bağımlılık (StreamAxT) — DÜZELTİLDİ

- `server/package.json` `"tiktok-live-connector": "^2.0.1"` aralığı paketi **2.5.0**'a taşımıştı. Kayıt defterine göre
  lisans 2.4.0'a kadar **MIT**, **2.4.1'den itibaren AGPL-3.0-only**; bağımlılığı `tiktok-live-proto` 0.2.3 MIT,
  0.2.4 AGPL-3.0-only.
- StreamAxT MIT beyan ediyor ve bağımlılıklarıyla birlikte dağıtılıyor; AGPL bir bağımlılık dağıtılan birleşik eser
  için AGPL yükümlülükleri (karşılık gelen kaynağı sunma; ağ üzerinden sunulan değiştirilmiş sürümlerde kaynak
  erişimi) doğurur. Bu, MIT beyanıyla çelişir.
- **Uygulanan:** tam sürüm `"2.4.0"` sabitlendi → zincirin tamamı MIT (connector 2.4.0, proto 0.2.3,
  api-sdk 0.4.0-beta1). Kullandığımız yüzey (`TikTokLiveConnection`, `connect`, `chat/gift/follow/streamEnd`)
  değişmedi; tsc temiz, sunucu 451 + istemci 81 test, içe aktarma denemesi başarılı.
- **Risk:** TikTok'un resmi olmayan canlı yayın protokolü değişirse 2.4.0 bağlanamayabilir (TikTok zaten
  `BLOCKED_BY_PLATFORM` yazma/moderasyon, yalnız okuma).
- **Seçenekler (ürün sahibinin kararı):** (a) 2.4.0'da kal — bugünkü durum; (b) AGPL'i kabul et (StreamAxT'i
  AGPL-3.0 ile dağıt ve kaynak sun) ve sabitlemeyi kaldır; (c) TikTok bağdaştırıcısını isteğe bağlı ayrı bir
  eklenti/süreç yap (AGPL yalnız o bileşende).
- **Önlem:** kilit dosyası güncellenirken lisans değişimi yakalansın diye bu inceleme her bağımlılık güncellemesinde
  tekrarlanmalı (otomatik denetim sonraki iş).

## 4. OBS / libobs / eklenti yolu

| Bileşen | Lisans | Bizim kullanımımız | Sonuç |
|---|---|---|---|
| OBS Studio, libobs | GPL-2.0-or-later | **ayrı süreç**; bağlanmıyoruz, dağıtmıyoruz | yükümlülük yok |
| obs-websocket (OBS'e dahil) | GPL-2.0 | ağ protokolüyle konuşuyoruz (`obws`, MIT) | protokol kullanımı türev eser değildir — yükümlülük yok |
| `obs-streamelements-core` | GPL-2.0 | **yalnız araştırma** (kaynak okundu, kod alınmadı) | yükümlülük yok |
| Aitum `obs-vertical-canvas` | GPL-2.0 | araştırma; ileride obs-websocket **vendor istekleriyle** konuşma seçeneği (süreç sınırı) | yükümlülük yok |
| **Kendi OBS eklentimiz (ADR-002 seçenek B)** | libobs'a bağlandığı için **GPL-2.0 uyumlu olmak zorunda** | henüz yok | Eklenti GPL-2.0 ile açık kaynak dağıtılmalı; ana uygulama ile yalnız IPC (WebSocket/adlandırılmış kanal) üzerinden konuşursa ana uygulama ayrı eser kalır (SE.Live'ın modeli: GPL eklenti + kapalı web arayüzü). Eklentiye ana uygulamadan kod kopyalanmamalı |
| libobs'u ana uygulamaya gömme (Seçenek A) | GPL-2.0+ | yok | ana uygulamanın tamamı GPL olur — mevcut (lisanssız/özel) strateji ile **uyumsuz** |
| **Kendi yayın çekirdeğimiz `yayin-motoru` (ADR-003)** | libobs'u çalışma anında yüklediği için **GPL-2.0-or-later** | ayrı program (`motor/`), kaynak depoda, `motor/LICENSE` (GPL-2.0 metni); portable pakete `yayin-motoru-LICENSE.txt` ile girer | Panel yalnız stdio JSON protokolüyle konuşur ve çekirdeğe bağlanmaz → ayrı eser (`INFERRED`). Dağıtımda kaynak erişimi sağlanmalı (depo). OBS'in kendi dosyaları (`obs.dll`, eklentiler, `obs-ffmpeg-mux.exe` vb.) paketlenmez; kullanıcının kurulu OBS'inden kullanılır/kopyalanır |
| Motor Rust bağımlılıkları (2026-09-26) | `base64`, `libloading` (ISC), `png`, `serde`, `serde_json`, **`jpeg-encoder` 0.6** (canlı önizleme akışı) — hepsi MIT ve/veya Apache-2.0 | GPL-2.0-or-later motorla uyumlu (izin verici lisanslar GPL esere katılabilir) | Uygun. Motorun uygulama bildirimi (`motor/kaynaklar/yayin-motoru.manifest`) kendi yazımımız |
| OBS'in tarayıcı kaynağı (`obs-browser`, CEF/Chromium) | obs-browser GPL-2.0; CEF BSD; Chromium BSD + üçüncü taraf | kullanıcının kurulu OBS'inden **çalışma anında** motora yüklenir (paketlenmez) | Yükümlülük dağıtımda doğar; kişisel kullanım kararı (ADR-004) geçerli |

## 5. FFmpeg ve kodlayıcı SDK'ları

| Bileşen | Durum |
|---|---|
| FFmpeg (çoklu yayın alıcı/yayıncı) | **harici süreç**; `PATH`'teki kullanıcı kurulumu (WinGet gyan.dev "full" — GPL-3.0 derlemesi) ya da ilk kullanımda `yt-dlp/FFmpeg-Builds` "win64-gpl" arşivi **kullanıcının makinesine indirilir**. Uygulama FFmpeg'i paketlemiyor, bağlanmıyor. Paketlenirse: GPL derlemesi için kaynak sunma ve lisans metni; LGPL derlemesi (x264/x265 olmadan) daha esnek |
| NVENC / AMF / QSV | OBS ve FFmpeg üzerinden; doğrudan SDK kullanmıyoruz. Doğrudan kullanım (yerel motor, Seçenek C) NVIDIA Video Codec SDK lisans koşullarını gerektirir |
| x264 (GPL) | yalnız OBS/FFmpeg içinde |

## 6. Diğer

| Bileşen | Lisans | Not |
|---|---|---|
| Tauri, wry, tao | MIT/Apache-2.0 | bildirim |
| WebView2 | Microsoft yazılım lisansı (Evergreen çalışma zamanı) | sistem bileşeni, yeniden dağıtım yok |
| Qt, CEF | kullanılmıyor | — |
| Referans ürünler (BotRix, Ground Control, SE.Live web arayüzü, Restream) | kapalı kaynak | yalnız davranış/kategori referansı; kod, marka, görsel kopyalanmadı |

## 7. Eksikler (yapılacak)

1. Üçüncü taraf lisans bildirimleri (`THIRD_PARTY_NOTICES`) dağıtım paketlerinde yok — MIT/Apache/MPL atıfları için
   üretilmeli (`cargo about` / `license-checker` benzeri, çevrimdışı).
2. Panel deposuna ürün lisans dosyası (ürün sahibinin kararı).
3. ~~Bağımlılık güncellemelerinde otomatik lisans denetimi~~ → **yapıldı (2026-09-26):** panel
   `src/lib/licenses.test.ts` (panel + Resonance npm kilitleri, vitest'te her çalıştırmada), StreamAxT
   `server/src/core/licenses.test.ts` (kök kilit dosyası + `tiktok-live-connector` 2.4.0/MIT sabitlemesi),
   Rust crate'leri `node scripts/lisans-denetimi.mjs` (`cargo metadata --offline`; 579 crate, izin listesi dışı yok).
   İzin listesi: MIT, Apache-2.0, BSD-2/3, ISC, Zlib, 0BSD, Unlicense, CC0, Unicode, BSL-1.0, MPL-2.0 (dosya düzeyi),
   CC-BY-4.0 (yalnız veri paketi). GPL/AGPL/SSPL/BUSL → test kırılır. Kilit dosyasında `license` alanı olmayan tek
   paket (`xmlhttprequest-ssl`, Resonance) LICENSE metni okunarak MIT doğrulandı ve istisna olarak kaydedildi.
4. **Dağıtım klasörleri:** StreamAxT `release/app` ve `release/StreamAxT-v1.0.0-Portable/app` kendi `node_modules`
   kopyalarını taşıyor ve kaynak ağaçtaki sabitlemeden etkilenmiyordu (`tiktok-live-connector` 2.5.0 AGPL) — bu turun
   dağıtımında 2.4.0'a indirildi (bkz. IMPLEMENTATION_REPORT). Eski `StreamAxT-v1.0.0-*.zip` arşivleri 2.5.0 içerir;
   yeniden paketlenmeden dağıtılmamalı.

## OBS Yami görünümü (2026-10-05)

| Bileşen | Kaynak | Lisans | Not |
|---|---|---|---|
| OBS "Dark" simgeleri (`src/assets/obs/`) | Kurulu OBS 32.2.2 `data/obs-studio/themes/Dark` | GPL-2.0-or-later (OBS Project) | Kullanıcının kişisel kullanım kararıyla; ürün zaten GPL-2.0-or-later (ADR-005). OBS logosu/markası kullanılmadı. |
| Yami renk ve ölçü değerleri (`src/styles/obs-yami.css`) | `Yami.obt` | GPL-2.0-or-later | Değerler CSS'e çevrildi (QSS kopyalanmadı, kurallar yeniden yazıldı). |
| Open Sans (`@fontsource/open-sans`) | npm | OFL-1.1 | Yalnız yazı tipi dosyası; kodla birleşmez. Lisans bekçisine gerekçesiyle eklendi. |
