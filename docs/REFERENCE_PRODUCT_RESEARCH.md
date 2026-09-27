# Referans Ürün Araştırması — Streaming OS

> Tarih: 2026-09-25 · Amaç: işlevsel davranışları anlamak; arayüz, marka, kod veya varlık KOPYALANMAZ.
> Bu belge yöntem, erişim durumu ve ana bulguları özetler. Ürün bazında ayrıntı:
> [OBS](OBS_COMPLETE_FEATURE_INVENTORY.md) · [BotRix](BOTRIX_COMPLETE_AUDIT.md) · [SE.Live](SELIVE_COMPLETE_AUDIT.md) ·
> [Ground Control](GROUND_CONTROL_COMPLETE_AUDIT.md) · [Quick Actions](GROUND_CONTROL_QUICK_ACTION_MATRIX.md) ·
> [StreamElements](STREAMELEMENTS_PLATFORM_INVENTORY.md) · [Karşılaştırma matrisi](REFERENCE_FEATURE_MATRIX.md)

## 1. Kaynak sınıflandırması

| Etiket | Anlamı |
|---|---|
| `OBSERVED_IN_UI` | Ürünün kendi arayüzünde doğrudan görüldü |
| `OBSERVED_IN_PREVIEW` | Ürünün önizleme / test çıktısında görüldü |
| `CONFIRMED_IN_OFFICIAL_DOCS` | Üreticinin resmi belgesinden okundu (sayfa içeriği) |
| `CONFIRMED_IN_OFFICIAL_DOCS (özet)` | Resmi sayfa otomatik okumaya kapalıydı; içerik resmi sayfanın arama motoru özetinden alındı |
| `INFERRED` | Doğrulanmış olgulardan mantıksal çıkarım — ürünün davranışı olarak iddia edilmez |
| `UNVERIFIED` | Doğrulanamadı; tasarımda "gerçek" kabul edilmez |
| `BLOCKED` | Erişim engeli (giriş, bot koruması, araç bağlantısı) |

## 2. Erişim durumu (bu tur)

| Kaynak | Durum | Etki |
|---|---|---|
| **Tarayıcı eklentisi** | `BLOCKED` — uzantı bağlı değil (iki deneme) | BotRix / StreamElements panellerinin bu turda yeniden arayüz gözlemi yapılamadı. BotRix için 2026-09-21 turunda Chrome ile yapılmış `OBSERVED_IN_UI` envanteri kullanıldı |
| support.streamelements.com (Zendesk) | `BLOCKED` — HTTP 403 | SE.Live / Ground Control makaleleri arama özetlerinden doğrulandı (`özet` etiketi) |
| blog.streamelements.com | `BLOCKED` — 403 | Ground Control 2.0 duyurusu arama özetinden |
| docs.streamelements.com | erişildi | SE.Live genel bakış, custom widget, widget olayları |
| streamelements.com/groundcontrol | erişildi | Ground Control özellik sayfası |
| obsproject.com (blog, KB) | erişildi | 32.1 / 32.2 sürüm notları, kaynak ve filtre rehberleri |
| github.com/obsproject/obs-websocket | erişildi | protokol belgesi (5.7 tuval olayları dahil) |
| help.twitch.tv | kısmen — sayfa JS ile çiziliyor | Dual Format / Enhanced Broadcasting / eşzamanlı yayın kuralları arama özetleri + Twitch blogu (erişildi) |
| help.kick.com | erişildi | yayın gereksinimleri |
| support.google.com/youtube | erişildi | kodlayıcı ayarları |
| Restream yardım merkezi | kısmen — makale adresi 404 | arama özetleri |

Erişilemeyen alanlarda iş durdurulmadı; ilgili satırlar belgelerde `UNVERIFIED` / `BLOCKED` olarak işaretlendi.

## 3. Ana bulgular

### 3.1 OBS Studio (32.2.2 bu makinede kurulu)
- Yayın ilkelleri (sahne, kaynak, filtre, çıkış, kodlayıcı, servis, ses, video) olgun ve eksiksiz. `CONFIRMED_IN_OFFICIAL_DOCS`
- **obs-websocket 5.x** neredeyse tüm ilkelleri dışarıya açıyor: `GetCanvasList` + sahne isteklerinde `canvasUuid` (5.7), çıkış başlat/durdur/ayar, 6 ses izi (`SetInputAudioTracks`), senkron kaydırma, izleme türü, ses ölçerleri, tekrar arabelleği (`SaveReplayBuffer`, `ReplayBufferSaved`), kayıt bölme/bölüm, sanal kamera, stüdyo modu, geçişler, `GetStats`. `CONFIRMED_IN_OFFICIAL_DOCS`
- 32.1: obs-websocket'e kısmi tuval desteği, ses karıştırıcı yenilemesi, WebRTC simulcast; 32.2: çoklu iz video (Enhanced Broadcasting) için dinamik bit hızı, NVENC SDK 13 (sürücü ≥ 570), tuval karışımlarının video sıfırlamasından sonra geri yüklenmesi düzeltildi. `CONFIRMED_IN_OFFICIAL_DOCS`
- **libobs GPLv2+**: bağlanan (link) uygulama da GPL olmalı. `CONFIRMED_IN_OFFICIAL_DOCS (özet)` → motor kararını doğrudan etkiliyor ([STREAMING_ENGINE_DECISION](STREAMING_ENGINE_DECISION.md)).

### 3.2 SE.Live (StreamElements'in OBS eklentisi)
- Twitch, YouTube, TikTok, Kick, X, Trovo ve özel RTMP'ye eşzamanlı yayın; dikey tuval. `CONFIRMED_IN_OFFICIAL_DOCS (özet)`
- Sınırsız yatay/dikey tuval, **bağlı sahneler** (linked scenes). `CONFIRMED_IN_OFFICIAL_DOCS (özet)`
- **Backtrack**: sürekli geçici arabelleğe kayıt; Build .477'den beri özel tuvallerde; **yalnız yayın sırasında** çalışır; 180 sn üstü önerilmez (sistem yükü). `CONFIRMED_IN_OFFICIAL_DOCS (özet)`
- Tamamen yerelde çalışır, harici servise bağlanmaz → çoklu yayın her hedefe bilgisayardan ayrı bağlantı demek. Bağlantı ayrılığı `INFERRED`; kodlayıcı paylaşımı ve çıkış başına ses izi `UNVERIFIED`.
- Twitch Dual Format rehberi var (ayrıntı `BLOCKED`).

### 3.3 StreamElements Ground Control
- Masaüstü "yayın kontrol merkezi": çok platformlu sohbet (Twitch, YouTube, X; sonradan Kick), çok platformlu etkinlik akışı, sürükle-bırak/yeniden boyutlandırılabilir paneller, hızlı eylemler (uyarıları duraklat/sustur, reklam erteleme), Stream Deck, sohbet botu komut/sayaç/modül yönetimi, **ekip çapında gerçek zamanlı uyarı kuyruğu yönetimi**, tek tıkla tahmin, Twitch başlık/kategori, yayın önizlemesi, anket/tahmin (Affiliate/Partner). Windows + macOS (x86). `CONFIRMED_IN_OFFICIAL_DOCS` (ürün sayfası) + `özet`
- Sonraki güncellemeler: Kick çoklu sohbet ve etkinlik, sohbet botu zamanlayıcı aç/kapa, sıradaki uyarıları duraklat/oynat, **yayın öncesi kontrol listesi**. `CONFIRMED_IN_OFFICIAL_DOCS (özet — resmi X hesabı)`
- Asıl ders: **yayını üreten motor ile yayını yöneten iş akışı ayrı**.

### 3.4 StreamElements web platformu
- Custom widget: HTML/CSS/JS/Fields/Data sekmeleri, `SE_API` (store, counters, sanitize, cheerFilter, getOverlayStatus, setField, resumeQueue), `widgetDuration` ile kuyruk süresi, çerez/IndexedDB erişimi yok. `CONFIRMED_IN_OFFICIAL_DOCS`
- Olaylar: follower/subscriber/host/cheer/**kicks**/tip/raid-latest, message, delete-message(s), `event:skip`, `alertService:toggleSound`, `bot:counter`, `kvstore:update`, `widget-button`. `CONFIRMED_IN_OFFICIAL_DOCS`
- Dikkat: `onWidgetLoad` kanal bilgisiyle birlikte **apiToken** taşıyor — bizim tasarımda widget'lara hesap tokenı verilmeyecek (kapsamlı, iptal edilebilir widget tokenı).

### 3.5 BotRix
- 2026-09-21 turunda Chrome ile ayrıntılı arayüz envanteri çıkarıldı (24 bölüm `OBSERVED_IN_UI`); bu tur yeniden gözlem `BLOCKED`. Ders: komut, olay, uyarı, widget, TTS, hedef, sadakat ve platform yetkisi **ortak olay mimarisi** üzerinde.

### 3.6 Restream
- 30+ hedef; özel RTMP, SRT, HLS, WHIP; gelen/giden SRT, SRT şifreleme, SRT→RTMP otomatik dönüştürme. Bulut tarafı dağıtım (tek yükleme, sunucuda çoğaltma). `CONFIRMED_IN_OFFICIAL_DOCS (özet)`; yedek/failover durumu API'de yok (`özet`).

### 3.7 Platform gereksinimleri ve kuralları

| Platform | Doğrulanan | Sınıf |
|---|---|---|
| Kick | RTMPS; en fazla 8000 kbps **CBR** (VBR desteklenmiyor); en fazla 1920×1080, 60 fps; yalnız H.264 (HEVC yok); anahtar kare 2 sn; ses en fazla stereo 48 kHz | `CONFIRMED_IN_OFFICIAL_DOCS` |
| YouTube | RTMP/RTMPS ile H.264, HEVC, AV1 (AV1 HDR değil); HLS alternatif; en fazla 4K; 1080p60 H.264 önerisi 12 Mbps; anahtar kare 2 sn (en fazla 4); ses AAC/MP3, 128 kbps stereo | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Twitch | 2026-06-17'den beri **Dual Format** (yatay + dikey) herkese; 2K (1440p) Partner/Affiliate; 2K için HEVC, 1440p'de 9 Mbps'e kadar, 1080p 7.5 Mbps; ikisi de **Enhanced Broadcasting** (istemci tarafı çoklu kodlama) gerektirir | `CONFIRMED_IN_OFFICIAL_DOCS` (blog) + `özet` (yardım) |
| Twitch eşzamanlı yayın | 2023-10'dan beri serbest; koşullar: Twitch'teki kalite diğerlerinden düşük olamaz; izleyiciyi başka platforma yönlendirmek yasak; **yayında diğer platformların birleşik etkinliği/sohbeti gösterilemez** (2026-07-15 tarihli yazılı şartlarda hâlâ var; Şubat 2026'da aksi yönde sözlü açıklama bildirildi) | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` — kurallar değişken |

**Mimariye etkisi:** Birleşik sohbet overlay'imiz ve çapraz sohbet aktarımımız, Twitch'e eşzamanlı yayın sırasında Twitch şartlarıyla çatışabilir. Kural kodda değil **yapılandırılabilir politika tablosunda** tutulmalı ve yayın öncesi kontrol listesinde uyarı olarak gösterilmeli ([PLATFORM_CAPABILITY_MATRIX](PLATFORM_CAPABILITY_MATRIX.md)).

## 4. Ürün derslerinin özeti

| Referans | Alınacak asıl fikir |
|---|---|
| OBS | Yayın ilkelleri (sahne, kaynak, filtre, çıkış, kodlayıcı, servis, ses, video) sağlam ve genel kurulmadan üst özelliğe geçilmez |
| SE.Live | Tuval ve çıkış bağımsız kavramlar; çıkış hangi tuvali, hangi ses karışımını, hangi kodlayıcı profilini ve hangi platform üst verisini kullanacağını seçer |
| Ground Control | Yayını üreten (Broadcast), yöneten (Control Center) ve topluluğu yöneten (Moderator) iş akışları aynı durumu paylaşır, aynı arayüz olmak zorunda değildir |
| BotRix | Topluluk otomasyonu derin, kullanıcı tarafından yapılandırılabilir ve ortak olay mimarisi üzerinde |
| StreamElements | Widget'lar kum havuzunda, alanlarla (fields) yapılandırılır; kuyruk denetimi (atla, sustur, devam) widget API'sinin parçası |
| Restream | Tek yükleme + dağıtım (fan-out); hedef başına bağımsız durum |

## 5. Kaynaklar

- OBS: [32.1 notları](https://obsproject.com/blog/obs-studio-32-1-release-notes), [32.2 notları](https://obsproject.com/blog/obs-studio-32-2-release-notes), [32.0 notları](https://obsproject.com/blog/obs-studio-32-0-release-notes), [Kaynak rehberi](https://obsproject.com/kb/sources-guide), [Filtre rehberi](https://obsproject.com/kb/filters-guide), [obs-websocket protokolü](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md), [lisans tartışması](https://obsproject.com/forum/threads/obs-license-inquiry.58557/)
- SE.Live: [docs.streamelements.com/selive](https://docs.streamelements.com/selive), [Tam rehber](https://support.streamelements.com/hc/en-us/articles/18771457842066-SE-Live-The-Complete-Guide-Setup-Features-Multistreaming-Troubleshooting) (403), [Backtrack](https://support.streamelements.com/hc/en-us/articles/26268419155858-Using-Backtrack-on-SE-Live-Canvas-Replay-Buffer-Guide) (403), [Tuval](https://support.streamelements.com/hc/en-us/articles/23190715979538-Understanding-Canvas-How-to-Decide-What-to-Stream) (403), [Twitch Dual Format](https://support.streamelements.com/hc/en-us/articles/30289137045778-Dual-Format-Streaming-on-Twitch-SE-Live) (403), [ürün sayfası](https://streamelements.com/selive)
- Ground Control: [ürün sayfası](https://streamelements.com/groundcontrol), [destek makalesi](https://support.streamelements.com/hc/en-us/articles/22154503415314-Ground-Control) (403), [2.0 duyurusu](https://blog.streamelements.com/meet-ground-control-2-0-the-ultimate-companion-app-to-manage-your-stream-d255c9f0657b) (403), [Çok platformlu etkinlik akışı](https://support.streamelements.com/hc/en-us/articles/19391486266514-Multiplatform-Activity-Feed) (403), [güncelleme duyurusu](https://x.com/StreamElements/status/1891582187197137123), [ekip özellikleri](https://x.com/StreamElements/status/1827121631778554016)
- StreamElements: [Custom widget](https://docs.streamelements.com/overlays/custom-widget), [Widget olayları](https://docs.streamelements.com/overlays/events)
- Restream: [SRT ile yayın](https://support.restream.io/en/articles/9943983-how-to-stream-to-restream-using-srt), [Twitch kuralları](https://restream.io/blog/twitch-multistreaming-rules-explained/)
- Platformlar: [Kick yardım](https://help.kick.com/en/articles/7066931-how-to-stream-on-kick-com), [YouTube kodlayıcı ayarları](https://support.google.com/youtube/answer/2853702?hl=en), [Twitch Dual Format + 2K duyurusu](https://blog.twitch.tv/en/2026/06/17/introducing-dual-format-and-2k-streaming-on-twitch/), [Twitch Dual Format yardım](https://help.twitch.tv/s/article/dual-format-vertical-video?language=en_US), [Enhanced Broadcasting](https://help.twitch.tv/s/article/enhanced-broadcasting?language=en_US), [Twitch eşzamanlı yayın SSS](https://help.twitch.tv/s/article/simulcasting-guidelines?language=en_US), [birleşik sohbet kuralı özeti](https://upstream.so/blog/twitch-allows-unified-chat-simulcasting-rules/)
