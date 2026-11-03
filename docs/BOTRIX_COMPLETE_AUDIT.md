> **Streaming OS notu (2026-09-25):** Bu envanter AxBoT deposundaki `docs/BOTRIX_COMPLETE_AUDIT.md` belgesinin
> kopyasıdır; 2026-09-21 turunda tarayıcı eklentisi ile BotRix panelinde doğrudan gözlemle (`OBSERVED_IN_UI`)
> çıkarıldı. 2026-09-25 turunda yeniden gözlem **`BLOCKED`** (Chrome uzantısı bağlı değildi); değişiklik varsa
> Chrome bağlandığında bu belge güncellenecek. Streaming OS için çıkarılan ders: komut, olay, uyarı, widget, TTS,
> hedef, sadakat ve platform yetkisi ortak olay mimarisi üzerinde ([REFERENCE_PRODUCT_RESEARCH](REFERENCE_PRODUCT_RESEARCH.md)).

# BOTRIX UI INVENTORY

> **GÜNCELLİK NOTU (2026-09-22):** Bu belge **BotRix'i** anlatır, bizi değil; araştırma kaydı olarak değişmedi. Her satırın bizdeki karşılığı ve durumu için [`BOTRIX_GAP_ANALYSIS §14 — Yan yana karşılaştırma`](BOTRIX_GAP_ANALYSIS.md).

**İnceleme tarihi:** 2026-09-21
**Yöntem:** Chrome'da kullanıcının kendi yetkili BotRix oturumu üzerinden
sayfa sayfa gezinti. Kimlik doğrulama veya erişim kontrolü **bypass edilmedi**.
Gerçek sohbet mesajı, bildirim, ödül veya ödeme **tetiklenmedi**.
**Hesap:** `botaxt` · Platform: **Kick** · Plan: **Ücretsiz** · Dil: TR

> **Kural:** BotRix kaynak kodu, özel varlıkları, logosu veya telifli
> tasarımları kopyalanmaz. Burada yalnızca *gözlemlenen davranış ve ayar
> listesi* kayıt altına alınmıştır; kendi uygulamamız sıfırdan yazılır.

## Kaynak sınıflandırması

| Etiket | Anlamı |
|---|---|
| `OBSERVED_IN_UI` | Panelde doğrudan görüldü |
| `CONFIRMED_IN_PUBLIC_DOCS` | botrix.live/docs'ta belgelendi |
| `OBSERVED_IN_PREVIEW` | Önizleme/test ile gözlemlendi |
| `UNVERIFIED` | Erişilemedi (premium kilidi / hesapta veri yok) |

---

## 1. Navigasyon haritası — `OBSERVED_IN_UI`

Sol kenar çubuğu (sabit), üstte platform göstergesi `Platform: Kick`,
sağ üstte `Premium'a geç` + profil menüsü.

| # | Menü | Rota | Rozet |
|---|---|---|---|
| 1 | Uyarılar | `/panel/alerts` | — |
| 2 | Widgets | `/panel/widget` | — (varsayılan açılış; `/panel` buraya yönlendirir) |
| 3 | Sohbet Botu | `/panel/bot` | — |
| 4 | Profil | `/panel/profile` | — |
| 5 | Sadakat | `/panel/loyalty` | — |
| 6 | Entegrasyonlar | `/panel/integrations` | — |
| 7 | Mini Oyunlar | `/panel/minigames` | — |
| 8 | Etkileşim | `/panel/interaction` | **yeni** |
| 9 | Alt Kullanıcılar | `#` (açılır) | **BETA** |
| 10 | Referanslar | `/panel/referals` | — |

**Diğer Seçenekler:** Dokümantasyon (`/docs`), Destek Al (Discord), Çıkış Yap.

> `/panel/widget/hypetrain` ve `/panel/widget/subathon` **ücretsiz hesapta
> açılmıyor**; ilki `/panel/premiumv2?fe=hypetrain` ödeme sayfasına
> yönlendiriyor, ikincisi rota olarak bulunmuyor. İkisi `UNVERIFIED`.

---

## 2. Sayfa iskeleti — `OBSERVED_IN_UI`

Her widget sayfası aynı düzeni kullanıyor:

1. Başlık + tek cümlelik açıklama
2. Varsa bağımlılık uyarısı (ör. "Aktivite akışının çalışması için Uyarılar
   widget'ı gerekir")
3. Üst eylem çubuğu: `Değişiklikleri kaydet` · widget'a özel eylem
   (ör. `Kupayı boşalt`, `Bekleme süresini sıfırla`)
4. **OBS Widget'ı** bloğu: "Bu linki KİMSEYLE paylaşma, hiçbir sohbete
   yapıştırma" uyarısı + salt-okunur `Widget URL'si` + `Kopyala`
   (+ bazılarında `Önizleme`, `Gelişmiş ayarlar`)
5. `Ayarlar` / `Seçenekler` bölümü: **PLATFORMLAR** onay kutuları +
   **SEÇENEKLER**
6. Premium bölümleri `⭐️` / `Premium` rozetiyle, tıklanınca ödeme sayfası

**Kaydetme davranışı iki türlü:** bazı sayfalar otomatik kaydediyor
(Chat Overlay'de kaydet düğmesi yok), bazıları açık `Değişiklikleri kaydet`
istiyor (Şans Çarkı, Kupa, TTS, Uyarılar). Sohbet Botu sayfasında
**"Kaydedilmeyi bekleyen chatbot değişikliklerin var / Onayla"** şeklinde
kalıcı bir uyarı şeridi var.

---

## 3. Widget galerisi — `OBSERVED_IN_UI`

**22 widget.** Arama kutusu (`Widget ara...`) + kategori filtresi (`Tümü`).

| Widget | Rota | Durum |
|---|---|---|
| Abone Hedefi | (hedef ailesi) | açık |
| Aktivite Akışı | `/panel/widget/activityfeed` | açık |
| Bağış Hedefi | (hedef ailesi) | açık |
| Chat Overlay | `/panel/widget/chat` | açık |
| Ekranda Emojiler | — | açık |
| Emoji Kombosu | `/panel/widget/emotecombo` | açık |
| Encuestas (Anketler) | `/panel/widget/polls` | açık |
| Etkinlik Etiketleri | `/panel/widget/labels` | açık |
| **Hype Treni** | `/panel/widget/hypetrain` | **premium kilitli** · BETA |
| Kapanış Jeneriği | — | BETA |
| Kupa | `/panel/widget/cup` | açık |
| Sabitlenmiş Mesajlar | — | BETA |
| Sadakat Ödülleri | — | açık |
| Shoutout | — | BETA |
| **Subathon** | — | **rota bulunamadı** · BETA V2 |
| Takipçi Hedefi | `/panel/widget/followers` | açık |
| TTS | `/panel/widget/tts` | açık |
| KICKs Hedefi | (hedef ailesi) | açık |
| Çekilişler | — | açık |
| İzleyici Sayacı | `/panel/widget/viewers` | açık |
| Şans Çarkı | `/panel/widget/fortunewheel` | açık |
| Şu An Çalan Şarkı | `/panel/widget/songrequest` | açık |

---

## 4. Widget bazında ayar envanteri

### 4.1 Chat Overlay — `OBSERVED_IN_UI`
**22 kontrol** (5 metin, 3 anahtar, 3 açılır liste, 10 onay kutusu, 1 kaydırıcı)
Kaydetme: **otomatik** (kaydet düğmesi yok). Önizleme: yok.

- PLATFORMLAR: Twitch · YouTube · Kick
- **Animasyon (10):** Kayarak giriş, Soluk geçiş, Zıplama, Sekerek giriş,
  Yakınlaşma, Dönerek giriş, Döndürerek giriş, Sallanarak giriş,
  Yuvarlanarak giriş, Animasyon yok
- **Tasarım (24, 12'si premium ⭐):** Aurora, Bubbles, Cake, Carbon, Default,
  Glass, Minimal, Platform Accent, Side, StreamLine, Transparent, White,
  ★Hacker, ★Neon, ★Neon Cards, ★Pastel Pop, ★Pixel Quest, ★Rounded, ★Sky,
  ★Sunset, ★Window Glass, ★WhatsChat, ★Retro, ★Velvet
- Yazı tipi · Yazı boyutu (kaydırıcı) · Arka plan (renk)
- **Mesaj yönü (2):** Yeni mesajlar altta / üstte
- Bot mesajlarını gizle · BetterTTV / 7TV emojileri
- Eski mesajları gizle + süre (`15 saniye`)
- Yeni mesaj sesi · Bağış mesajlarını göster · Puan ödülü mesajlarını göster
- Komutları gizle ( ! ) · Stream Together mesajları
- Yoksayılan kullanıcılar (liste) · Platform ikonunu göster · Mesaj saatini göster

### 4.2 Şans Çarkı — `OBSERVED_IN_UI`
Eylemler: `Değişiklikleri kaydet` · `Bekleme süresini sıfırla` · `Önizleme`

- **Çark profilleri:** `Yeni profil`, ücretsizde `1 / 1 çark`,
  "Premium: en fazla 10 çark"
- Komut
- **Bekleme süresi (20 kademe):** 30sn · 1/2/3/5/10/15/20/30 dk ·
  1/2/3/4/5/6/8/12/24 sa · 7g · 30g
- **Tema (28, 15'i premium ⭐️):** Rainbow, Red, Green, Blue, Yellow, Cyan,
  Magenta, Orange, Purple, Pink, Brown, White, Slot Machine, ⭐Confetti,
  ⭐UNO, ⭐Papercraft, ⭐PixelQuest, ⭐NoirLux, ⭐Candy, ⭐Aurora, ⭐Slate,
  ⭐Inferno, ⭐Neon Glow, ⭐Carnival, ⭐Hacker, ⭐Retro 8-bit, ⭐Vegas, ⭐Matrix
- İzin verilen roller (Kick): Herkes / …
- Kullanıcı adını göster (anahtar)
- **Öğe listesi:** tek bir `textarea` (satır başına bir öğe) — ağırlık/renk yok
- **Gelişmiş ayarlar (Premium):**
  - **Tetikleme modu:** Komut / ⭐️ Otomatik (BETA)
  - **Bekleme modu:** Genel / **Kullanıcı başına**
  - **Puan maliyeti** (sayı)
  - **Gerekli seviye** (sayı)

### 4.3 Hedef widget'ları (Takipçi/Abone/Bağış/KICKs) — `OBSERVED_IN_UI`
**7 kontrol** — dört hedef aynı iskeleti paylaşıyor.

- Tasarım (`Clean`)
- **Mod:** Tüm zamanlar / Özel süre
- Hedef tutar · Arka plan rengi · Metin rengi · Mesaj (şablon) · Tipografi

### 4.4 Aktivite Akışı — `OBSERVED_IN_UI`
**1 kontrol.** Bağımlılık: "Uyarılar widget'ı gerekir".

- **Mod:** Dock / Widget
- Yardım bağlantısı: "OBS'ye dock eklemeyi bilmiyorsan buraya tıkla"
- Yönetim eylemleri (açıklamada geçiyor): uyarıyı tekrar et, sessiz,
  duraklat, atla

### 4.5 İzleyici Sayacı — `OBSERVED_IN_UI`
`Önizleme` düğmesi var.

- İkonu göster · Yuvarlatılmış · Arka plan · Renk · Tipografi · Hizalama
- Platformlar: Kick · Twitch · YouTube
- **Tema (ücretsiz 4):** Classic · Minimal · Glass · Neon
- **Tema (premium 5):** Velvet · Ticker · Capsule · Holochip · SplitFlap
- Çoklu platform modu

> **UX notu:** Tema seçici her temayı **canlı örnek sayı (128) ile
> küçük bir önizleme kartı** olarak gösteriyor — düz açılır liste değil.

### 4.6 Şu An Çalan Şarkı — `OBSERVED_IN_UI`
Uyarı: "SongRequest'in tarayıcında açık olması gerekir."

- **Mod:** YouTube / Spotify (Yakında)
- **Tasarım (16, 9'u premium ⭐):** Base, Glass, Pill, Wave, HoloChip,
  IsoBand, PaperCraft, ⭐Light, ⭐Neon, ⭐Retro, ⭐Minimalist,
  ⭐TimeShow (Beta), ⭐Emberrail, ⭐Marquee, ⭐Spectrum, ⭐Synthwave
- Bağlantı: "Ayarları ve şarkı kuyruğunu görüntüle"

### 4.7 Emoji Kombosu — `OBSERVED_IN_UI`
- PLATFORMLAR
- BetterTTV / 7TV emojileri
- Maksimum eşzamanlı emoji · Kombonun minimum sayısı · Emoji zaman aşımı (sn)

### 4.8 Anketler (Encuestas) — `OBSERVED_IN_UI`
Kullanım: sohbete `/poll` yazılıyor.

- PLATFORMLAR
- **Tema (13, 6'sı premium ⭐️):** Default, Compact Battle, Platform Brand,
  Broadcast, Bubbles, White, Cake, ⭐Hacker, ⭐Neon, ⭐Rounded, ⭐Lightsaber,
  ⭐Battle, ⭐Minimal
- Maks. anket · Önizleme anketleri
- **Bitiş sonrası görünürlük:** 30 / 60 / 90 / 120 / 180 / 300 sn
- Benzer anketleri birleştir · Oy sayısını göster

### 4.9 Kupa — `OBSERVED_IN_UI`
Eylemler: `Değişiklikleri kaydet` · **`Kupayı boşalt`**
- TASARIM
- **KICKs Minimum**

### 4.10 Etkinlik Etiketleri — `OBSERVED_IN_UI`
**Sekmeli yapılandırma:** `Şablon` · `Tipografi` · `Kontur` · `Animasyon`
Bağımlılık: "ChatBot ve BotRix uyarı widget'ı aktif olmalı". `Önizleme` var.

- **Etiket:** Son takipçi / … (açılır)
- Şablon · Varsayılan değer · **Global mod**

### 4.11 TTS widget'ı — `OBSERVED_IN_UI`
Eylemler: `Değişiklikleri kaydet` · `Önizleme`
Uyarı: yerel ses yoksa OBS widget'ı olarak çalışmayabilir; bulut sesleri için
tarayıcı önizlemesi açık tutulmalı.

- **Dil (19 bulut sesi 🟡):** Google Deutsch, UK English Female/Male,
  US English, español, español (EEUU), français, हिन्दी, Bahasa Indonesia,
  italiano, 日本語, 한국의, Nederlands, polski, português (BR), русский,
  普通话, 粤語, 國語
- Komut
- **Minimum rol (Kick, 6):** Herkes · Abone · VIP · **OG** · Moderatör · Sahip
- **Platformu devre dışı bırak**
- Ses düzeyi (%)
- **Gelişmiş ayarlar:**
  - Sayıları yok say · Sembolleri yok say · Emojileri yok say
  - **Tekrarlanan harfleri yok say** · Linkleri yok say
  - **Karakter sınırı** (144)
  - **Bekleme süresi** (0 saniye)
  - **Ton** (1) — pitch
  - **Okuma şablonu**
  - **Kara liste**
- **PREMIUM:** Puan maliyeti · Gerekli seviye

---

## 5. Uyarılar (Alerts) — `/panel/alerts` — `OBSERVED_IN_UI`

Ayrıntılı matris: [`BOTRIX_ALERT_MATRIX.md`](BOTRIX_ALERT_MATRIX.md)

Üst çubuk: `Widget URL'si` + `Kopyala` + **`Gelişmiş ayarlar`**
Alt çubuk: `Özel kod` · `Bu uyarıyı dışa aktar` · `Değişiklikleri kaydet` ·
`Uyarıları içe aktar`

**Test düğmeleri (6):** Abonelik · Bağış · Takipçiler · Host · KICKs ·
Hediye abonelik
**Yapılandırma sekmeleri (6):** aynı altı olay

**Gelişmiş ayarlar** = yalnız seçilen uyarıları içeren **filtrelenmiş widget
URL'i** üretiyor. Platform + olay türü onay kutuları:

1. Abonelikler (Twitch/Kick)
2. Hediye abonelikler (Twitch/Kick)
3. Takipçiler / YouTube abonelikleri
4. Raid / Host
5. Bağış
6. **Bits** (Twitch)
7. **KICKs** (Kick)
8. **Super Chat** (YouTube)
9. **Jewels**
10. **Üyeler** (ücretli YouTube üyelikleri)
11. **Hediye üyeler** (YouTube)

---

## 6. Sohbet Botu — `/panel/bot` — `OBSERVED_IN_UI`

Üst uyarı: "BotRix'e mod vermeyi unutma: `/mod BotRix`"
**Sekmeler:** Moderasyon · İsim · Komutlar · Zamanlayıcılar · Ekstralar

### 6.1 Moderasyon
Beş koruma, her biri `Yapılandır` ile ayrı bir modal açıyor:
Büyük harf · Link · Emoji · Sembol · Küfür/argo

**Büyük harf koruması modalı (örnek derinlik):**
- **İhlal eylemi (5):** Kullanıcıya timeout ver · Uyarı mesajı gönder ·
  Timeout + uyarı mesajı · Mesajı sil · Sil + uyarı mesajı
- **Timeout süresi (11):** 30sn · 1dk · 2dk · 5dk · 15dk · 30dk ·
  1sa · 2sa · 5sa · 12sa · 1g
- **Özel mesaj** (uyarı metni)
- **Mesaj başına izin verilen büyük harf:** 5 / 10 / 15 / 20 / 30 / 40
- **Bypass rolleri:** Moderatör · OG · VIP · Abone
  ("Moderatör her zaman bypass'a sahiptir")

### 6.2 Komutlar
Alt sekmeler: `Komutlarım` · `Varsayılan` · `Ekle`

**Komut oluşturma formu:**
| Alan | Değerler |
|---|---|
| Komut | `!` ön ekiyle |
| **Erişim** | `Her zaman` (açılır) |
| **Etkinleştirme** (Premium) | `Sadece komut` / **`Sohbet anahtar kelimesi`** |
| Mesaj | yanıt metni |
| **Düzenleyici modu** | `Normal` / `Experimental` |
| **Platform** | Kick · Twitch · YouTube · Discord (çoklu seçim) |
| Bekleme süresi | `3 sn` |
| **Bekleme modu** | `Genel` / **`Kullanıcı başına`** |
| Takma ad | aliases |
| **Fiyat** | puan maliyeti |
| Rol | `Herkes` |

**Varsayılan komutlar (tablo: Komut · Mesaj · Rol · Etkin · Ayarlar):**

| Komut | Rol |
|---|---|
| `!addcom` · `!editcom` · `!delcom` | Moderatör |
| `!commands` | Herkes |
| `!followage` | Herkes |
| `!level` · `!xp` | Herkes |
| `!points` | Herkes |
| `!points add` | Sahip |
| `!promo`, `!so` | Moderatör |
| `!shop` · `!top` | Herkes |
| `!uptime` · `!watchtime` | Herkes |

### 6.3 Zamanlayıcılar
`Ekle` — hesapta zamanlayıcı yok, form içeriği `UNVERIFIED`.
Premium tablosundan: ücretsiz **20**, premium **100** zamanlanmış mesaj.

### 6.4 Ekstralar
| Özellik | Eylem |
|---|---|
| **Sohbet uyarıları** — "her etkileşimde sohbete mesaj gönder" | Yapılandır |
| Klip komutu (`!clip`) | Yapılandır |
| **Seviye sistemi** — etkileşimli takipçileri seviyeyle ödüllendir | — |
| Watchtime ve puan sistemi | — |
| **Sıralamalar** — puanları/seviyeleri/ikisini birden sıfırla | Sıfırla |
| **Nightbot'tan içe aktar** — komut, zamanlayıcı, moderasyon | İçe aktar |

**Sohbet uyarıları modalı (Metin uyarıları):**
| Olay | Ek ayar |
|---|---|
| Takip | — |
| **KICKs** | **Minimum tutar** |
| Abonelik | — |
| **Yeniden abonelik** | — |
| Hediye abonelik | — |
| **Host** | **Minimum izleyici** |
| **Karşılama** | Premium |

> "Uyarı yalnızca etkinlik değeri bu minimuma ulaşırsa gönderilir."

---

## 7. Sadakat — `/panel/loyalty` — `OBSERVED_IN_UI`

**Sekmeler:** Sıralama · Mağaza · Satış kayıtları · `Göster: 10` · `Yapılandır`

### Gelişmiş yapılandırma modalı

**İzleyiciler puanı nasıl kazanır**
- **Başlangıç puanı** — ilk etkileşimde verilen puan
- **Her 5 dakikada puan** ("Güncellenmesi 30 dakikayı bulabilir")
- **Her 5 dakikada bonus puan (aboneler)** — Premium
- **Sohbet etkinliği doğrulaması** — "gerçek etkileşimi ödüllendirmek ve
  otomatik görünen etkinliği azaltmak için genel davranışı zaman içinde
  değerlendirir" (anti-farming)

**Liderlik tablosu görünürlüğü**
- **Varsayılan sıra:** Puanlar / Seviyeler / İzleme süresi
- Liderlik tablosunu devre dışı bırak
- **Liderlik tablosu aralığı** (Premium): Tüm zamanlar / Aylık / Haftalık /
  Günlük — "yalnızca görsel liderlik tablosunu değiştirir, harcanabilir
  puanlar aynı kalır", **değişiklik 24 saatte bir**
- **Yok sayılan kullanıcılar:** en fazla 3, maks 32 karakter, tek kelime

**Destek odaklı kazançlar** (Premium)
- Abone olma / abonelik hediye etme için puanlar
- **Her 100 KICKs için puan**

**Mağaza sekmesi:** widget URL'i + kullanım şartları onayı.
Ödül oluşturma formu **`UNVERIFIED`** (şartlar kabul edilmedi — kullanıcı
adına sözleşme onaylamak kapsam dışı).

---

## 8. Entegrasyonlar — `/panel/integrations` — `OBSERVED_IN_UI`

**Platform bağlantısı değil — Discord duyuru otomasyonu:**

| Kaynak | Tetik |
|---|---|
| Twitch | Yayına başlayınca Discord'a mesaj |
| YouTube Live | Yayına başlayınca Discord'a mesaj |
| **YouTube Videos** | Video veya Shorts yayınlayınca |
| **TikTok** | Video yükleyince |
| Kick | Yayına başlayınca |

---

## 9. Profil — `/panel/profile` — `OBSERVED_IN_UI`

**Profil kartı:** Avatar · İsim · Seviye (`Normal`) · Platform (`Kick`) ·
Dil (`EN`) · sponsor afişi

**Platformlar (6) — OAuth bağlantı noktası:**
Twitch · Discord · **Kick (Seçili)** · YouTube · **Trovo** · TikTok
Her biri "Şununla giriş yap" düğmesi. Discord ve TikTok ayrı
`/discord/botlink`, `/tiktok/botlink` rotalarına gidiyor.

**Bağışlar:**
- Bağış bağlantısı (kopyalanabilir) — "Bağış slotu için önce PayPal
  entegrasyonu yapılmalıdır"
- **PayPal:** `Bağlı değil` + `Kur`

**Değişiklik günlüğü (uygulama içi changelog):**
- *May 14, 2026* — Hype Train widget'ı Beta'da: platforma özel trenler,
  premium animasyonlar, emojiler, seviyeler, en çok katkı yapanlar
- *May 6, 2026* — Liderlik tablosu aralığı premium kullanıcılara açıldı

---

## 10. Mini Oyunlar — `/panel/minigames` — `OBSERVED_IN_UI`

| Oyun | Durum |
|---|---|
| **BDuel** — karakter oluştur, beceri/silah/pet ile donat | BETA |
| Roulette | açık |
| Slots | açık |
| Gamble | açık |

"Yakında daha fazla mini oyun."

---

## 11. Etkileşim — `/panel/interaction` — `OBSERVED_IN_UI` (`yeni`)

| Özellik | Durum | Açıklama |
|---|---|---|
| **Şarkı İstekleri** | BETA | Şarkılar sohbetten · Yayın çalma listesi |
| **Topluluk Bahisleri** | BETA V2 | Puanlı tahminler · Risk ve ödül · Canlı sonuçlar |
| **İzleyici Kuyruğu** | BETA | Net sıra düzeni · Çağrı konukları · Mod kontrolleri |

---

## 12. Premium limit tablosu — `OBSERVED_IN_UI`

`/panel/premiumv2` — planlar: 1 ay $3.99 · 3 ay $9.99 · 6 ay $17.99 ·
12 ay $29.99

| Özellik | Ücretsiz | Premium |
|---|---|---|
| Yayındaki bot adı | BotRix | Özelleştirilebilir |
| Discord yayın başlangıç uyarıları | 2 | 20 |
| **Uyarılarda maksimum dosya boyutu** | **5 MB** | **50 MB** |
| **Uyarı türü başına seçenek (varyant)** | **5** | **25** |
| Sohbet mesajlarını seslendirme (Cloud TTS) | 400/ay · 100/hafta | Sınırsız |
| Özel komutlar | 100 | Sınırsız |
| **Anahtar kelime komutları** | — | 10 |
| Zamanlanmış mesajlar | 20 | 100 |
| Sıralamadaki kullanıcılar | 20 | 100 |
| **Puan sıfırlama** | Her 30 günde | Her 7 günde |
| Sadakat sistemi | Temel | Gelişmiş |
| Sadakat mağazası ödülleri | 6 | 150 |
| **Öğe başına işlem** | 2 | 6 |
| Şarkı istek kuyruğu | 15 | 50 |
| Premium widget'lar | — | ✓ |

---

## 13. Komut ve değişken sistemi — `CONFIRMED_IN_PUBLIC_DOCS`

Kaynak: `botrix.live/docs/#/` bölüm 2 ve 3.

### 13.1 Yerleşik komutlar
`!followage` `!followers` `!uptime` `!top` `!level` `!xp` `!watchtime`
`!points` `!commands` `!so` `!editcounter`

**Puan:** `!points @viewer` · `!points add @viewer 100` ·
**`!points add all 100`**

**Puan Düşüşleri (Point Drops) — panelde görülmedi, belgede var:**
`!pdrops start` · `!pdrops stop` · `!pdrops status`

**Komut yönetimi (sohbetten):** `!addcom !hello Hi $(sender)` ·
`!editcom` · `!delcom hello`

**Şarkı isteği:** `!sr` · `!currentsong` · `!songs` · `!skipsong` ·
`!songpause` · `!songresume` · `!songvol 65`

**Tahmin/bahis:** `!bet yes 1000` · `!bet create` · `!bet result yes`

**Kuyruk:** `!joinq` · `!joinq <kullanıcı>` · `!leaveq` · `!posq` ·
`!queue` / `!listq` · `!openq` · `!closeq` · `!nextq` · `!removeq <ad>` ·
`!clearq`

### 13.2 Değişken sistemi — **en büyük fark**

**Sözdizimi kuralları:** standart `$(...)`; eski biçim `Rand[...]`,
`RandomList[...]`, `fetch[...]`. Konumsal argümanlar `$(v1)`, `$(v2)`.
Yedek değer opsiyonel.

| Grup | Değişkenler |
|---|---|
| **Kullanıcı / girdi** | `$(sender)` `$(roles)` `$(variable)` `$(variable yedek)` `$(optionalvariable)` `$(v1)` `$(v2)` `$(toname)` |
| **Kanal / yayın** | `$(followers)` `$(subs)` `$(commands)` `$(uptime)` `$(title)` **`$(settitle ...)`** `$(category)` **`$(setcategory ...)`** `$(platform)` `$(platformUrl)` `$(userid)` `$(senderid)` `$(channel)` |
| **Sadakat / sayaç** | `$(points)` `$(addPoints n)` `$(addPoints @user n)` `$(setPoints n)` `$(level)` `$(count)` `$(count +1)` `$(getcounter ad)` `$(setcounter ...)` |
| **Rastgele / metin** | `Rand[0,10]` `$(random 0 10)` `RandomList[a;b;c]` `$(repeat 3 ha)` (maks 10) `$(randomuser)` `$(optionalrandomuser)` |
| **Web / API** | `fetch[url]` `$(urlfetch url)` **`$(earlyFetch url)`** `$(urlencode)` `$(urldecode)` |
| **Matematik / zaman** | `$(math 5 * 5)` `$(round 4.6)` `$(countdown 2024-12-31)` `$(countup ...)` `$(time Europe/Berlin de-DE)` |
| **Kalıcı depolama** | `$(setlocal k;v)` `$(local k)` `$(local k;varsayılan)` — **maks 5/çalıştırma**; `$(setuservar ...)` `$(uservar ...)` `$(uservarlist)`; `$(setglobalvar ...)` `$(globalvar ...)` `$(globalvarlist)` |
| **JSON** | `$(json kapsam;anahtar;yol)` `$(jsonset ...)` `$(jsonunset ...)` — kapsamlar: `local`, `uservar`, `globalvar`; yol biçimi `profile.coins`, `items[0].name`; hatada `(json invalid)` |
| **Gelişmiş** | `$(leagueoflegends <riot_id> <region>)` (+şablon) · **`$(eval <js>)`** (beta, elle erişim) |
| **Özel etiketler** | `<ifTwitch>` `<ifKick>` `<ifYouTube>` · **`<hideText>`** |

### 13.3 Özel uyarı kodu — `CONFIRMED_IN_PUBLIC_DOCS`
HTML/CSS/JSON ile kendi uyarı tasarımı. Kullanılabilir değişkenler:
`{name}` `{text}` `{sound}` `{image}` `{amount}` `{message}`
Kalıp sınıfları: `{disposition}` `{transition}` `{img}` `{animation}`

### 13.4 Genel notlar — `CONFIRMED_IN_PUBLIC_DOCS`
- Puan, seviye, watchtime, anket, kuyruk veya Şarkı İsteği'ne bağlı komutlar
  yalnız ilgili sistem açıkken çalışır
- Başlık/kategori değiştirme gibi platform eylemleri bot moderatör değilse
  veya platform izin vermiyorsa başarısız olur
- Yeni komutlarda eski sözdizimi yerine `$(...)` tercih edilmeli

---

## 14. Erişilemeyen alanlar — `UNVERIFIED`

| Alan | Sebep |
|---|---|
| Hype Treni ayarları | Premium kilidi (ödeme sayfasına yönlendiriyor) |
| Subathon ayarları | Rota ücretsiz hesapta yok |
| Sadakat mağazası ödül formu | Kullanım şartları onayı gerekiyor — kullanıcı adına sözleşme onaylanmadı |
| Zamanlayıcı formu alanları | Hesapta zamanlayıcı yok, form açılmadı |
| Çekilişler / Shoutout / Sabitlenmiş Mesajlar / Kapanış Jeneriği / Ekranda Emojiler / Sadakat Ödülleri widget ayarları | Rotaları galeriden tıklama gerektiriyor; bu turda açılmadı |
| Alt Kullanıcılar (Workspace Members) | `#` bağlantısı, BETA |
| **Uyarı animasyonlarının kare kare zamanlaması** | Test uyarısı **paneli değil gizli widget URL'ini** tetikliyor; o URL gizli token taşıdığı için açılmadı. Animasyon **listesi** alındı, **süre ölçümü** yapılmadı |
| Puan Düşüşleri (Point Drops) paneli | Belgede var, panelde bulunamadı |
| Topluluk Bahisleri / İzleyici Kuyruğu ayar ekranları | Kart açılmadı |

---

## 15. Genel UX gözlemleri — `OBSERVED_IN_UI`

| Konu | BotRix davranışı |
|---|---|
| Düzen | Sabit sol kenar çubuğu + tek sütunlu içerik; koyu tema |
| Kaydetme | Karışık: bazı sayfalar otomatik, bazıları açık kaydet |
| Kaydedilmemiş değişiklik | Kalıcı şerit: "Kaydedilmeyi bekleyen chatbot değişikliklerin var / Onayla" |
| Modal | Ortalanmış, `Onayla` / `İptal` + sağ üstte ✕ |
| Premium | Satır içi `⭐️` / `Premium` rozeti; tıklayınca ödeme sayfası |
| Bağımlılık uyarısı | Sayfa başında sarı bilgi kutusu |
| Güvenlik uyarısı | Her widget URL'inde "KİMSEYLE paylaşma" |
| Tema seçimi | Açılır liste **veya** canlı önizlemeli kart ızgarası (İzleyici Sayacı) |
| Yardım | Satır içi bağlantılar ("OBS'ye dock eklemeyi bilmiyorsan…") |
| Changelog | Profil sayfasında uygulama içi panel |
| Dil | Türkçe yerelleştirme (bazı yerlerde İspanyolca kalıntı: "Encuestas", "Ninguno (Desactivar TTS)") |

## Güncelleme — 2026-09-26

Bu envanter BotRix arayüzü **gözlemlenerek** (`OBSERVED_IN_UI`, 2026-09-21 turunda) çıkarıldı. Bu turda tarayıcı
eklentisi bağlı olmadığı için yeniden gözlem yapılamadı (`NOT_ACCESSIBLE`); içerik geçerliliğini korur ancak BotRix'in
o tarihten sonraki değişiklikleri `UNVERIFIED`.

**Ek (aynı gün, Chrome bağlandıktan sonra):** `botrix.live/panel` açıldığında oturum olmadığı için ana sayfaya
yönlendirdi → panel yine `NOT_ACCESSIBLE` (giriş yapılmadı; kimlik bilgisi girmek kural dışı). Herkese açık
`botrix.live/docs` okundu (`CONFIRMED_OFFICIAL_DOCS`): yerleşik komutlar (takip süresi, çalışma süresi, seviye/XP,
izleme süresi, puan, shoutout, sayaç düzenleme), puan ve puan yağmuru komutları, sohbetten özel komut
ekle/düzenle/sil, şarkı isteği denetimi, tahmin (bahis) komutları, sıra (kuyruk) sistemi ve `$(...)` değişken
sözdizimi (gönderen, roller, konumsal argümanlar ve yedek değerler, takipçi/abone sayısı, başlık okuma/değiştirme).
Bu liste 2026-09-21 envanteriyle çelişmiyor; AxBoT'taki karşılıklar `Desktop/Projeler/docs/BOTRIX_GAP_ANALYSIS.md`. Özellik bazında karşılaştırma ve eşdeğerlik durumu AxBoT
deposunda: `Desktop/Projeler/docs/BOTRIX_GAP_ANALYSIS.md`, `BOTRIX_ALERT_MATRIX.md`. BotRix kodu/varlığı
kopyalanmadı.
