# SE.Live — Özellik Envanteri

> SE.Live, StreamElements'in OBS Studio için dağıttığı eklenti paketi. İlk turda destek makaleleri otomatik okumaya
> kapalıydı (HTTP 403) ve Chrome bağlı değildi; **2026-09-26'da Chrome ile beş resmi destek makalesi tam metin okundu
> (§8)**. SE.Live bu makinedeki OBS'te kurulu (`obs-streamelements-core.dll`, `OBSERVED_IN_RUNTIME`) ama arayüzüne
> dokunulmadı (kullanıcı OBS'i; masaüstü girdi otomasyonu yapılmıyor).
> **Kurulum yapılmadı**: kullanıcının OBS kurulumuna eklenti eklemek, çalışan yayın ortamını değiştirmek demektir.

Sınıflar: [REFERENCE_PRODUCT_RESEARCH §1](REFERENCE_PRODUCT_RESEARCH.md#1-kaynak-sınıflandırması)

## 1. Genel

| Özellik | Sınıf | Kaynak |
|---|---|---|
| OBS içine sohbet, etkinlik ve yayın araçları getirir | `CONFIRMED_IN_OFFICIAL_DOCS` | docs.streamelements.com/selive |
| StreamElements overlay'ini OBS sahnesine ekleme; uyarılar | `CONFIRMED_IN_OFFICIAL_DOCS` | aynı |
| Ücretsiz; tamamen yerel çalışır, harici servise bağlanmaz; CPU/GPU'ya aşırı yük bindirmeyecek şekilde optimize | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` | Tam rehber |
| Belgeler: kurulum ve hesap bağlama, overlay/uyarı, çoklu yayın, dikey tuval, rehberler (bağlı sahneler, Backtrack, Twitch dual format), sorun giderme | `CONFIRMED_IN_OFFICIAL_DOCS` | docs.streamelements.com/selive |

## 2. Çoklu yayın (Multistreaming)

| Özellik | Sınıf |
|---|---|
| Aynı anda Twitch, YouTube, TikTok, Kick, X (Twitter), Trovo ve özel RTMP | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| Rehber akışı: çıkışları seç → sesi kontrol et → birden çok platformda yayına geç | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Hesap bağlama ile giriş-yaparak-yayın (login-to-stream) | `UNVERIFIED` (kurulum ve hesap bağlama bölümü var; akış ayrıntısı okunamadı) |
| Platform başına başlık / kategori / YouTube gizlilik | `UNVERIFIED` |
| Çıkış başına aç/kapa, tek çıkışı durdurma, "hepsini başlat" | `UNVERIFIED` |
| Çıkış hata / durum arayüzü | `UNVERIFIED` |
| Çıkış başına ses izi seçimi | `UNVERIFIED` (görev metninde iddia ediliyor; doğrulanamadı) |

### Çoklu yayın analizi (görev §6'daki sorular)

| Soru | Cevap | Sınıf |
|---|---|---|
| Her çıkış bilgisayardan ayrı bağlantı mı açıyor? | Evet olmalı: SE.Live harici servise bağlanmadığına göre hedef başına ayrı RTMP bağlantısı açılır | `INFERRED` |
| Kodlayıcı paylaşımı var mı? | Bilinmiyor | `UNVERIFIED` |
| Aynı tuval birden çok hedefe atanabiliyor mu? | Tuvaller "platforma göre ayrı yerleşim" için; çok hedefli atama muhtemel | `INFERRED` |
| Farklı tuval farklı hedefe atanabiliyor mu? | Evet — dikey tuvalin TikTok/YouTube Shorts için ayrı hedefe gitmesi belgelenmiş amaç | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| Çıkış başına ses izi? | — | `UNVERIFIED` |
| Bir hedef durunca diğerleri devam ediyor mu? | — | `UNVERIFIED` |
| Çıkış hata arayüzü | — | `UNVERIFIED` |

**Bizim tasarım bu soruları kendi mimarimizle cevaplıyor**: tek kodlama → çok hedef (paket çoğaltma), hedef başına
bağımsız durum makinesi, bir hedefin hatası diğerlerini etkilemez ([MULTISTREAM_ARCHITECTURE](MULTISTREAM_ARCHITECTURE.md)).

## 3. Tuvaller (Canvas)

| Özellik | Sınıf |
|---|---|
| Farklı platformlar için ayrı yerleşimler: 16:9 standart ve 9:16 dikey (TikTok, YouTube Shorts…) | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| **Sınırsız** yatay ve dikey tuval | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| **Bağlı sahneler** — yerleşimler arasında kolay geçiş | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` + docs rehber başlığı |
| "Canvas not found" hatası (topluluk forumu) | forum, `INFERRED` — tuvaller sahne koleksiyonuna bağlı bir nesne |
| Tuval çözünürlüğü / yönü / sahne listesi / kaynak yeniden kullanımı / dönüşüm | `UNVERIFIED` (ayrıntı makalesi 403) |
| Tuval → çıkış ataması | `INFERRED` (platform başına yerleşim amacı) |

### Tuval analizi → bizim çoklu tuval mimarimize etkisi

- Tuval **birinci sınıf nesne** olmalı: ad, çözünürlük, yön, FPS, sahne listesi, güvenli alanlar.
- Kaynak tuvaller arasında **paylaşılmalı** (kamera iki kez yakalanmamalı) — OBS'te kaynak (input) sahnelerden
  bağımsızdır, farklı tuvallerin sahnelerine aynı girdi eklenebilir (`INFERRED`, OBS input modeli).
- Bağlı sahne kipleri: bağımsız / tek yönlü / iki yönlü; döngü kontrolü.
- Ayrıntılı tasarım: [MULTICANVAS_ARCHITECTURE](MULTICANVAS_ARCHITECTURE.md).

## 4. Backtrack (tekrar arabelleği)

| Özellik | Sınıf |
|---|---|
| Sürekli geçici arabelleğe kaydeder; öne çıkan anları geriye dönük kaydetme | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| Build **.477**'den itibaren **özel tuvallerde** kullanılabilir | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| **Yalnız yayın sırasında** çalışır | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| **180 sn'den uzun arabellek önerilmez** — sistem performansını belirgin etkiler | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| Kısayol, kayıt yeri, bellek maliyeti rakamları | `UNVERIFIED` |

### OBS Tekrar Arabelleği ile karşılaştırma

| | OBS Replay Buffer | SE.Live Backtrack | Bizim hedef |
|---|---|---|---|
| Kapsam | ana çıkış | özel tuval başına | ana + tuval başına (OBS arabelleği ana tuval için; dikey için ek kodlayıcı maliyeti gösterilerek) |
| Yayın dışında | çalışır (ayrı başlatılır) `INFERRED` | çalışmaz | kullanıcı seçer |
| Denetim | kısayol, obs-websocket `SaveReplayBuffer` | kısayol | kısayol + hızlı eylem + otomasyon (olayla kaydet) + uzaktan |
| Maliyet uyarısı | yok `INFERRED` | 180 sn önerisi | süre × bit hızı ile tahmini bellek/disk gösterimi |

## 5. Diğer

| Özellik | Sınıf |
|---|---|
| Twitch Dual Format (SE.Live ile) | başlık `CONFIRMED_IN_OFFICIAL_DOCS`, ayrıntı `BLOCKED` |
| Sohbet dock'u, etkinlik akışı dock'u | `UNVERIFIED` (ürün "chat, activity" sunduğunu söylüyor: `CONFIRMED_IN_OFFICIAL_DOCS` genel) |
| Ağ gereksinimleri, eklenti çakışma uyarıları, OBS uyumluluk davranışı | `UNVERIFIED` |
| Resmi dışa/içe aktarma (tuval yapılandırması) | `UNVERIFIED` — **yalnız resmi yolla**; tescilli yapılandırma çözümlenmeyecek |

## 6. Doğrulama planı (Chrome bağlandığında)

1. ~~docs.streamelements.com/selive alt sayfaları~~ → destek makaleleri yeterli ayrıntıyı verdi (§8).
2. ~~Destek makaleleri (Tam rehber, Backtrack, Tuval, Dual Format) — tarayıcıdan okuma~~ → **yapıldı 2026-09-26** (§8).
3. SE.Live kurulumu **yalnız kullanıcı onayıyla** ve ayrı bir OBS taşınabilir kopyasında (çalışan OBS profiline dokunmadan).

## 7. Güncelleme — 2026-09-26: kaynak koduyla doğrulananlar

Önceki bölümler resmi yardım metinlerinden (`CONFIRMED_IN_OFFICIAL_DOCS (özet)`). SE.Live'ın OBS tarafı açık kaynak
(`obs-streamelements-core`, GPL-2.0); aşağıdakiler kaynak kodundan (`CONFIRMED_PUBLIC_SOURCE`, ayrıntı
[STREAMELEMENTS_CORE_AUDIT](STREAMELEMENTS_CORE_AUDIT.md)). Web arayüzü (SE.Live panelleri) kapalı kaynak ve bu turda
açılamadı (`NOT_ACCESSIBLE`: tarayıcı eklentisi bağlı değil; kullanıcının OBS'ine arayüz etkileşimi yapılmadı).

| Konu | Kaynaktan doğrulanan davranış |
|---|---|
| Hedef ekleme / aç-kapa | akış çıkışları eklenir, etkinleştirilir / devre dışı bırakılır; **etkin çıkış silinemez** |
| Hedef başına bağlantı | her hedef kendi OBS çıkışı + servisi; isteğe bağlı bağlanılacak IP (`bind_ip`) |
| Tek hedefi durdurma / yeniden başlatma | çıkış başına; yeniden bağlanma sinyalleri çıkış başına |
| Tuval atama | çıkış bir video kompozisyonuna (tuval) bağlı; kodlayıcı tuvalin tembel sağlayıcısından |
| Ses izi seçimi | çıkış başına iz listesi; ses kompozisyonundan iz kodlayıcıları |
| Özel tuval | OBS 31+ özel canvas nesnesi; genişlik 4'ün, yükseklik 2'nin katına hizalanır; en az bir akış kodlayıcısı şart |
| Bağlı sahneler | kaynakta sahne sinyali takibi var; "bağlı sahne" kavramı web arayüzünde (`UNVERIFIED`) |
| Backtrack | tekrar arabelleği çıkışları eklenir/etkinleştirilir; kaydetme tetiklenir (`triggerReplayBufferOutputSaveById`) |
| Paylaşımlı tuval | OBS ön yüzüne yayımlanır, Gelişmiş Yayın ikincil tuvali olabilir; yayın/kayıt etkinken değiştirilemez |
| Çalışma anı | kullanıcının OBS'inde "🚀 SE.Live: Vertical" 1080×1920@60 tuvali mevcut (`OBSERVED_IN_RUNTIME`) |
| Bilinen kamu raporu | #176: ikincil tuvalde sahne geçişinde çökme (26.9.4.994) — `UNVERIFIED` |

## 8. Güncelleme — 2026-09-26: resmi destek makaleleri (Chrome ile tam metin)

Kaynak: `support.streamelements.com` — "SE.Live: The Complete Guide", "Understanding Canvas", "Creating and Managing
Scenes and Sources in SE.Live", "Using Backtrack on SE.Live Canvas", "Dual Format Streaming on Twitch". Sınıf:
`CONFIRMED_OFFICIAL_DOCS`. Aşağıdakiler kendi sözcüklerimizle özettir; metin/görsel kopyalanmadı.

| Konu | Resmi belgede söylenen | Bizim için sonucu |
|---|---|---|
| Gereksinim | OBS 31 veya üstü; yalnız Windows (Mac desteği bırakılmış) | kullanıcı Windows + OBS 32.2.2 |
| OBS 32 | Dual Format makalesi: OBS 32'de SE.Live dahil birçok eklentiyi etkileyen kararlılık sorunları var; çökmede OBS 31'e dönüş öneriliyor | `KNOWN_LIMITATIONS`'a eklendi; ikincil tuval işlemlerinde temkin |
| **Aitum Vertical ile birlikte** | **iki eklenti birlikte kurulmamalı** (kararsızlık/çökme); Aitum varsa kaldırılmalı | ADR-002 katman 2 (Aitum vendor köprüsü) **bu kullanıcıda uygulanamaz** — SE.Live kurulu |
| Çoklu yayın hedefleri | Twitch, YouTube, TikTok, Kick, X, Trovo, özel RTMP; yerel çalışır, harici hizmet yok; X desteği henüz tam değil | Output Router ile aynı ilke (yerel, hedef başına) |
| Bant hesabı | toplam bit hızı = ana bit hızı × platform sayısı önerisi | bizim hesap bunu ses (+160 kbps/hedef), %5 ek yük ve %25 pay ile genişletiyor (`policy.rs`) |
| Çıkış (hedef) ayarı | hedef başına aç/kapa, bağlı tuval, **hedef başına OBS ses izi**, hedef başına yayın başlığı/kategori | ses izi seçimi bizde yok (ADR-002 katman 3); başlık/kategori StreamAxT'te |
| Tek hedefi durdurma | diğerlerini durdurmadan tek platform kapatılabilir | bizde de var (`destination.stop`) |
| Tuval | menüden yeni tuval, ad + çözünürlük (dikey 1080×1920); tuval başına kodlama (gelişmiş, beta) ve çıkış başına genel ayarı ezme | tuval **oluşturma** obs-websocket'te yok → bizde yalnız keşif |
| Bağlı sahneler | sahne bağlanınca çoklu yayın aracında sahne geçişi tüm tuvallere yansır; Stream Deck yapılandırması değişmeden çalışır | bizim `scene.switch` ana tuvalde; bağlı sahnelerin SE.Live tarafından yayılması `UNVERIFIED` (canlı denenmedi) |
| Backtrack | build .477+; özel tuvalde **yalnız yayın sürerken** çalışır; açıkken boşta bile kodlayıcı harcar; 180 sn üstü önerilmiyor; tuval başına "Save Replay" kısayolu | `replay.save` yalnız OBS'in yerel tekrar arabelleğini kaydeder; tuval Backtrack'i tetiklenmez |
| Twitch Dual Format | Twitch Dual Output Beta onayı + SE.Live **Public Beta** gerekir; OBS'te Enhanced Broadcasting açılıp SE.Live tuvali ek tuval seçilir; silinen tuval listede "Inactive" kalır (OBS hatası) | OBS'in kendi özelliği; bizden bağımsız |
| Bulut yedeği | profil + sahne koleksiyonu yedeği, toplam 100 MB sınırı | bizde yerel zip + git bundle yedeği |
| TikTok sohbeti | TikTok API vermediği için etkinlik akışında/çoklu sohbette yok; ayrı TikTok sohbet dock'u | StreamAxT TikTok'u topluluk kütüphanesiyle bağlar (lisans incelemesi: 2.4.0 sabitlendi) |
| Kaplama URL'si | kaplama URL'si gizli bilgi içerir, izleyiciye gösterilmemeli | bizim widget URL'leri kullanıcı parolası/OAuth jetonu taşımaz (`SECURITY_REVIEW`) |
