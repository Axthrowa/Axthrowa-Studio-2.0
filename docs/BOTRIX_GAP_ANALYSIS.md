# BOTRIX GAP ANALYSIS

**Tarih:** 2026-09-21
**Karşılaştırılan:** StreamAxT `cdc968e` ↔ BotRix (ücretsiz plan, Kick, TR)

## Durum kodları

| Kod | Anlamı |
|---|---|
| `EXISTING` | Bizde var ve BotRix seviyesinde çalışıyor |
| `PARTIAL` | Bizde var ama eksik/sığ |
| `MISSING` | Bizde hiç yok |
| `NEEDS_REFACTOR` | Bizde var ama mimari olarak sorunlu |
| `BOTRIX_UNVERIFIED` | BotRix'te doğrulanamadı — parity hedefi **değil** |
| `NOT_APPLICABLE` | Mimari fark nedeniyle bizim için anlamsız |
| `BETTER_THAN_BOTRIX` | Bizde var, BotRix'te yok veya daha zayıf |

> **Kural:** BotRix'te bulunmadığı doğrulanmamış hiçbir özellik parity hedefi
> olarak yazılmadı. `BOTRIX_UNVERIFIED` satırları bilgi amaçlıdır.

---

## 0. Yapısal fark — önce bu

BotRix **çok kiracılı SaaS**, StreamAxT **tek kullanıcılı yerel araç**.
Aşağıdakiler bizim için `NOT_APPLICABLE`:

| BotRix özelliği | Neden uygulanamaz |
|---|---|
| Kullanıcı kaydı / OAuth ile giriş / oturum | Tek kullanıcı, yerel çalışıyor |
| Alt Kullanıcılar (Workspace Members) | Takım yok |
| Genel profil / mağaza / komut listesi sayfaları | Dışarı açık sunucumuz yok |
| Premium planlar, ödeme, Merchant of Record | Ticari ürün değil |
| Referans programı | — |
| Bot adı özelleştirme (BotRix → özel) | Bot zaten bizim |
| BotRix'e `/mod` verme zorunluluğu | Kendi hesabımızla bağlanıyoruz |

**Sonuç:** Parity hedefi *bot + widget + overlay işlevselliği*.

---

## 1. GÜVENLİK — P0

> BotRix karşılaştırmasından bağımsız; denetimde çıkan ve **her şeyden önce
> gelen** bulgular. Ayrıntı: `CURRENT_SYSTEM_AUDIT.md` §12.

| # | Bulgu | Durum | Risk |
|---|---|---|---|
| S1 | Hiçbir API ucunda kimlik doğrulama yok | `MISSING` | 🔴 |
| S2 | `cors: { origin: '*' }` | `NEEDS_REFACTOR` | 🔴 |
| S3 | Sunucu `0.0.0.0` dinliyor | `NEEDS_REFACTOR` | 🔴 |
| S4 | `GET /api/platforms` düz metin OAuth tokenı döndürüyor | `NEEDS_REFACTOR` | 🔴 |
| S5 | `GET /api/settings` `kick_client_secret` döndürüyor | `NEEDS_REFACTOR` | 🔴 |
| S6 | Tokenlar veritabanında şifresiz | `MISSING` | 🟠 |
| S7 | Hız sınırı yok | `MISSING` | 🟠 |
| S8 | Widget URL'i korumasız | `MISSING` | 🟡 |

**BotRix karşılaştırması:** BotRix her widget URL'ine gizli token koyuyor ve
her sayfada "Bu linki KİMSEYLE paylaşma" uyarısı gösteriyor — yani widget
erişimi token ile korunuyor (`OBSERVED_IN_UI`). Bizde widget URL'i tamamen
açık.

**Etki:** S1+S2+S3+S4 birleşince, kullanıcının ziyaret ettiği herhangi bir
web sayfası `fetch('http://localhost:3001/api/platforms')` ile Kick OAuth
tokenını okuyabilir.

---

## 2. KOMUT SİSTEMİ

| Özellik | BotRix | Bizde | Durum | Not |
|---|---|---|---|---|
| Özel komut CRUD (panel) | ✅ | ✅ | `EXISTING` | |
| Yanıt şablonu | ✅ | ✅ | `EXISTING` | |
| Takma ad (alias) | ✅ | ✅ | `EXISTING` | |
| Rol/yetki | ✅ | ✅ 5 seviye | `EXISTING` | |
| Global bekleme | ✅ | ✅ | `EXISTING` | |
| **Kullanıcı başına bekleme** | ✅ `Bekleme modu` | ❌ | `MISSING` | DB: `cooldown_mode` |
| **Puan maliyeti** | ✅ `Fiyat` | ❌ | `MISSING` | DB: `cost_points` |
| **Platform başına açma** | ✅ 4 platform onay kutusu | ❌ | `MISSING` | DB: `platforms` |
| **Anahtar kelime tetikleyici** | ✅ (Premium) | ❌ | `MISSING` | `!` olmadan tetikleme |
| **Erişim (her zaman / yayındayken)** | ✅ | ❌ | `MISSING` | |
| **Seviye gereksinimi** | ✅ (Çark/TTS'te) | ❌ | `MISSING` | Seviye sistemi gerekli |
| **Sohbetten komut yönetimi** | ✅ `!addcom/!editcom/!delcom` | ❌ | `MISSING` | |
| **Sayaç (`$(count)`, `!editcounter`)** | ✅ | ⚠️ tablo var, komut yok | `PARTIAL` | |
| Kullanım sayacı | `BOTRIX_UNVERIFIED` | ✅ `use_count` | `BETTER_THAN_BOTRIX` | |

### 2.1 Yerleşik komutlar

| Komut | BotRix | Bizde | Durum |
|---|---|---|---|
| `!points` / `!puan` | ✅ | ✅ | `EXISTING` |
| `!points add @user n` | ✅ | ✅ `!puanver` | `EXISTING` |
| **`!points add all n`** | ✅ | ❌ | `MISSING` |
| `!top` / `!sıralama` | ✅ | ✅ | `EXISTING` |
| `!uptime` | ✅ | ❌ | `MISSING` |
| **`!followage`** | ✅ | ❌ | `MISSING` |
| **`!followers`** | ✅ | ❌ | `MISSING` |
| **`!watchtime`** | ✅ | ❌ | `MISSING` |
| **`!level` / `!xp`** | ✅ | ❌ | `MISSING` |
| `!commands` | ✅ | ❌ | `MISSING` |
| `!so` / `!promo` | ✅ | ⚠️ shoutout widget var, komut yok | `PARTIAL` |
| **`!editcounter`** | ✅ | ❌ | `MISSING` |
| `!sr` ailesi | ✅ 7 komut | ✅ `!sr`, `!skip` | `PARTIAL` |
| **`!bet` (tahmin)** | ✅ | ❌ | `MISSING` |
| **Kuyruk komutları (10)** | ✅ | ❌ | `MISSING` |
| **`!pdrops` (puan düşüşü)** | ✅ (belgede) | ❌ | `MISSING` |
| Mini oyunlar | 4 oyun | **10 oyun** | `BETTER_THAN_BOTRIX` |
| `!tahtikap` / `!kral` | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| Bil Bakalım | ❌ | ✅ 3.431 soru | `BETTER_THAN_BOTRIX` |

---

## 3. DEĞİŞKEN SİSTEMİ — **en büyük fark**

BotRix ~60 değişken belgeliyor, bizde 8 var.

| Grup | BotRix | Bizde | Durum |
|---|---|---|---|
| Kullanıcı | `$(sender)` `$(roles)` `$(toname)` `$(userid)` | `{user}` `{touser}` | `PARTIAL` |
| Girdi | `$(variable)` `$(optionalvariable)` `$(v1)` `$(v2)` + **yedek değer** | `{query}` `{args}` `{1}..{9}` | `PARTIAL` |
| Kanal | `$(followers)` `$(subs)` `$(channel)` `$(commands)` | ❌ | `MISSING` |
| Yayın | `$(uptime)` `$(title)` `$(category)` | `{uptime}` | `PARTIAL` |
| **Yayın kontrolü** | `$(settitle)` `$(setcategory)` | ❌ | `MISSING` |
| Platform | `$(platform)` `$(platformUrl)` | `{platform}` | `PARTIAL` |
| Sadakat | `$(points)` `$(addPoints)` `$(setPoints)` `$(level)` | `{points}` | `PARTIAL` |
| **Sayaç** | `$(count)` `$(count +1)` `$(getcounter)` `$(setcounter)` | ❌ | `MISSING` |
| **Rastgele** | `$(random)` `RandomList[]` `$(randomuser)` `$(repeat)` | ❌ | `MISSING` |
| **Web/API** | `fetch[]` `$(urlfetch)` `$(earlyFetch)` `$(urlencode/decode)` | ❌ | `MISSING` |
| **Matematik/zaman** | `$(math)` `$(round)` `$(countdown)` `$(countup)` `$(time)` | ❌ | `MISSING` |
| **Kalıcı değişken** | `local` / `uservar` / `globalvar` + liste | ❌ | `MISSING` |
| **JSON** | `$(json)` `$(jsonset)` `$(jsonunset)` | ❌ | `MISSING` |
| **Koşullu etiket** | `<ifTwitch>` `<ifKick>` `<ifYouTube>` `<hideText>` | ❌ | `MISSING` |
| Gelişmiş | `$(leagueoflegends)` `$(eval)` | ❌ | `BOTRIX_UNVERIFIED` (beta, elle erişim) |

**Uygulama notu:** Bunların büyük kısmı **saf sunucu tarafı metin işleme** —
platform API'si gerektirmiyor. En yüksek etki/çaba oranına sahip iş kalemi.

---

## 4. MODERASYON

| Özellik | BotRix | Bizde | Durum |
|---|---|---|---|
| Büyük harf koruması | ✅ | ✅ | `EXISTING` |
| Link koruması + beyaz liste | ✅ | ✅ | `EXISTING` |
| Emoji koruması | ✅ | ✅ | `EXISTING` |
| Sembol koruması | ✅ | ✅ | `EXISTING` |
| Küfür/kara liste | ✅ | ✅ | `EXISTING` |
| **İhlal eylemi (5 seçenek)** | ✅ | ❌ sadece uyarı | `MISSING` |
| **Timeout süresi (11 kademe)** | ✅ | ❌ | `MISSING` |
| **Mesaj silme** | ✅ | ❌ | `MISSING` |
| **Kural başına özel mesaj** | ✅ | ❌ tek genel mesaj | `MISSING` |
| **Bypass rolleri** | ✅ Mod/OG/VIP/Abone | ❌ | `MISSING` |
| **Eşik seçimi (5/10/15/20/30/40)** | ✅ | ✅ sayısal | `EXISTING` |
| Tekrarlanan mesaj | `BOTRIX_UNVERIFIED` | ❌ | — |
| AI moderasyon | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| Shield Mode | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| Paylaşımlı ban listesi | ❌ | ✅ | `BETTER_THAN_BOTRIX` |

**Kritik:** Bizim AutoMod'umuz platformda **hiçbir gerçek eylem yapmıyor** —
sadece sohbete uyarı yazıyor. Timeout/silme için platform adaptörlerine
`timeoutUser()` ve `deleteMessage()` eklenmeli.

---

## 5. TTS

| Özellik | BotRix | Bizde | Durum |
|---|---|---|---|
| Motor sayısı | 1 (Google bulut) | **5** (edge/google/gemini/elevenlabs/webspeech) | `BETTER_THAN_BOTRIX` |
| Yedekleme zinciri | ❌ | ✅ `fallbackChain` | `BETTER_THAN_BOTRIX` |
| Dil sayısı | 19 | 14 | `PARTIAL` |
| Komut | ✅ | ✅ | `EXISTING` |
| Ses düzeyi | ✅ | ✅ | `EXISTING` |
| **Minimum rol** | ✅ 6 Kick rolü | ❌ | `MISSING` |
| **Platformu devre dışı bırak** | ✅ | ❌ | `MISSING` |
| **Sayıları yok say** | ✅ | ❌ | `MISSING` |
| **Sembolleri yok say** | ✅ | ❌ | `MISSING` |
| **Emojileri yok say** | ✅ | ❌ | `MISSING` |
| **Tekrarlanan harfleri yok say** | ✅ | ❌ | `MISSING` |
| **Linkleri yok say** | ✅ | ❌ | `MISSING` |
| **Karakter sınırı** | ✅ (144) | ❌ | `MISSING` |
| **Bekleme süresi** | ✅ | ❌ | `MISSING` |
| **Ton (pitch)** | ✅ | ❌ | `MISSING` |
| **Okuma şablonu** | ✅ | ❌ | `MISSING` |
| **Kara liste** | ✅ | ❌ | `MISSING` |
| **Puan maliyeti / seviye** | ✅ Premium | ❌ | `MISSING` |
| Kuyruk | ✅ | ✅ | `EXISTING` |

---

## 6. SADAKAT / PUAN / SEVİYE

| Özellik | BotRix | Bizde | Durum |
|---|---|---|---|
| Mesaj başına puan | ✅ | ✅ | `EXISTING` |
| Zaman aralığı puanı | ✅ 5 dk | ✅ 5 dk | `EXISTING` |
| Abone çarpanı | ✅ | ✅ | `EXISTING` |
| Abone/hediye abone puanı | ✅ | ✅ | `EXISTING` |
| KICKs başına puan | ✅ 100 KICKs | ✅ birim başına | `EXISTING` |
| **Başlangıç puanı** | ✅ | ❌ | `MISSING` |
| **Sohbet etkinliği doğrulaması (anti-farming)** | ✅ | ❌ | `MISSING` |
| **Seviye / XP sistemi** | ✅ | ❌ | `MISSING` |
| Liderlik tablosu | ✅ | ✅ | `EXISTING` |
| Sıralama ölçütü | Puan/Seviye/İzleme | Puan/İzleme/Mesaj | `PARTIAL` |
| **Liderlik zaman aralığı** (gün/hafta/ay) | ✅ Premium | ❌ | `MISSING` |
| **Liderlik yok sayılan kullanıcı** | ✅ maks 3 | ❌ | `MISSING` |
| **Liderlik tablosunu kapatma** | ✅ | ❌ | `MISSING` |
| **Puan/seviye sıfırlama** | ✅ | ❌ | `MISSING` |
| Mağaza / ödüller | ✅ 6 ücretsiz | ✅ sınırsız | `EXISTING` |
| Ödül onay akışı | ✅ | ✅ `status` | `EXISTING` |
| **Ödül başına birden çok işlem** | ✅ 2/6 | ❌ tek `payload` | `MISSING` |
| Ödül görseli / stok / limit | `BOTRIX_UNVERIFIED` | ❌ | — |

---

## 7. UYARILAR (ALERTS)

Ayrıntı: `BOTRIX_ALERT_MATRIX.md` §7. Özet:

| Özellik | Durum |
|---|---|
| Olay türü 11 vs 8 | `PARTIAL` |
| Giriş animasyonu 37 vs 9 | `PARTIAL` |
| **Varyantlar** | `MISSING` |
| **Metin görünüm penceresi (ms–ms)** | `MISSING` |
| **Üst/alt metin rengi ayrı** | `MISSING` |
| **Metin konumu px** | `MISSING` |
| **Uyarı başına TTS** | `MISSING` |
| **Özel kod (HTML/CSS)** | `MISSING` |
| **Dışa/içe aktarma** | `MISSING` |
| **Filtrelenmiş widget URL'i** | `MISSING` |
| **Medya yükleme** | `MISSING` (bizde yalnız URL) |
| **Kuyruk motoru** | `NEEDS_REFACTOR` |
| **Sohbet tarafı olay mesajı** | `MISSING` |

---

## 8. WIDGET'LAR

| Widget | BotRix | Bizde | Durum |
|---|---|---|---|
| Chat Overlay | 22 ayar · **24 tema** | 36 ayar · tema yok | `PARTIAL` (tema) |
| Uyarı kutusu | çok derin | 14 ayar | `PARTIAL` |
| Hedefler (4) | 7 ayar | 31 ayar | `BETTER_THAN_BOTRIX` |
| Aktivite akışı | 1 ayar | 49 ayar | `BETTER_THAN_BOTRIX` |
| İzleyici sayacı | 9 ayar · **9 tema** | 24 ayar · 5 tema | `PARTIAL` (tema) |
| Şu an çalan | 2 ayar · **16 tema** | 22 ayar · 5 tema | `PARTIAL` (tema) |
| Emoji kombosu | 5 ayar | 24 ayar | `BETTER_THAN_BOTRIX` |
| Anketler | 6 ayar · **13 tema** | 19 ayar · tema yok | `PARTIAL` (tema) |
| Kupa | 2 ayar | 27 ayar | `BETTER_THAN_BOTRIX` |
| Şans Çarkı | **28 tema** · **profiller** · puan maliyeti · seviye | 17 ayar · 5 tema | `PARTIAL` |
| Etkinlik etiketleri | 4 sekme | 24 ayar | `EXISTING` |
| TTS widget | 18 ayar | 16 ayar | `PARTIAL` |
| Hype Treni | **premium kilitli** | 30 ayar | `BOTRIX_UNVERIFIED` |
| Subathon | **rota yok** | 14 ayar | `BOTRIX_UNVERIFIED` |
| Sabitlenmiş mesaj | `UNVERIFIED` | 22 ayar | — |
| Shoutout | `UNVERIFIED` | 24 ayar | — |
| Kapanış jeneriği | `UNVERIFIED` | 27 ayar | — |
| Sadakat ödülleri | `UNVERIFIED` | 24 ayar | — |
| Çekilişler | `UNVERIFIED` | 27 ayar | — |
| Ekranda emojiler | `UNVERIFIED` | 24 ayar | — |
| **Bil Bakalım** | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| **Şarkı sözleri** | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| **Yayın Kralı** | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| **JumpScare** | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| **Sıralama overlay** | ❌ | ✅ | `BETTER_THAN_BOTRIX` |
| **Tek URL OBS tuvali** | ❌ | ✅ | `BETTER_THAN_BOTRIX` |

**Ana örüntü:** *Ayar sayısında biz öndeyiz, tema çeşitliliğinde BotRix
açık ara önde* (widget başına 13–28 tema). Ayrıca BotRix'te
**profil/varyant** kavramı var (çark profilleri, uyarı varyantları).

**Widget altyapısı farkları:**

| Özellik | BotRix | Bizde | Durum |
|---|---|---|---|
| **Widget URL'inde token** | ✅ | ❌ | `MISSING` |
| **Filtrelenmiş URL üretimi** | ✅ | ❌ | `MISSING` |
| **Tema önizleme kartı** | ✅ (İzleyici Sayacı) | ❌ | `MISSING` |
| Canlı ayar uygulama | `BOTRIX_UNVERIFIED` | ✅ WS ile anında | `BETTER_THAN_BOTRIX` |
| Önizleme = gerçek render | `BOTRIX_UNVERIFIED` | ✅ aynı bileşen | `EXISTING` |
| **Medya kütüphanesi** | ✅ (5/50 MB) | ❌ | `MISSING` |

---

## 9. PLATFORM ENTEGRASYONLARI

| Platform | BotRix | Bizde | Durum |
|---|---|---|---|
| Twitch | ✅ | ✅ | `EXISTING` |
| Kick | ✅ | ✅ | `EXISTING` |
| YouTube | ✅ | ✅ | `EXISTING` |
| Discord | ✅ | ✅ | `EXISTING` |
| TikTok | ✅ | ✅ | `EXISTING` |
| **Trovo** | ✅ | ❌ | `MISSING` |
| **Yetenek (capability) modeli** | ✅ (ayarlar platforma göre gizleniyor) | ❌ | `MISSING` |
| **Discord duyuru entegrasyonu** | ✅ 5 kaynak | ❌ | `MISSING` |
| **PayPal bağış** | ✅ | ❌ (BynoGame var) | `PARTIAL` |
| **Nightbot içe aktarma** | ✅ | ❌ | `MISSING` |
| **Yayın başlangıç/bitiş olayı** | ✅ (Discord duyurusu) | ❌ | `MISSING` |

---

## 10. UX / ARAYÜZ

| Özellik | BotRix | Bizde | Durum |
|---|---|---|---|
| Tasarım sistemi | ✅ tutarlı | ❌ 47 kopya buton | `MISSING` |
| **Kaydedilmemiş değişiklik uyarısı** | ✅ kalıcı şerit | ❌ | `MISSING` |
| Otomatik kaydetme | kısmi | ✅ widget ayarlarında | `EXISTING` |
| **Onay diyaloğu (silme)** | ✅ | ❌ | `MISSING` |
| **Toast bildirimi** | `BOTRIX_UNVERIFIED` | ❌ | `MISSING` |
| **Form doğrulama** | `BOTRIX_UNVERIFIED` | ❌ | `MISSING` |
| Arama + kategori filtresi | ✅ | ✅ | `EXISTING` |
| Sekmeli yapılandırma | ✅ | ✅ | `EXISTING` |
| **Uygulama içi changelog** | ✅ | ❌ | `MISSING` |
| **Bağımlılık uyarısı** | ✅ | ❌ | `MISSING` |
| Boş/hata/yükleniyor durumu | ✅ | kısmi | `PARTIAL` |
| Yönlendirme (router) | ✅ gerçek rota | ❌ `pathname` karşılaştırma | `NEEDS_REFACTOR` |
| i18n | ✅ TR yerelleştirme | ❌ karışık | `PARTIAL` |

---

## 11. ETKİLEŞİM ÖZELLİKLERİ (`/panel/interaction`)

| Özellik | BotRix | Bizde | Durum |
|---|---|---|---|
| Şarkı İstekleri | ✅ BETA | ✅ | `EXISTING` |
| **Topluluk Bahisleri (tahmin)** | ✅ BETA V2 · `!bet` | ❌ | `MISSING` |
| **İzleyici Kuyruğu** | ✅ BETA · 10 komut | ❌ | `MISSING` |
| **Puan Düşüşleri** | ✅ (belgede) `!pdrops` | ❌ | `MISSING` |

---

## 12. UYGULAMA ÖNCELİK SIRASI

Sıralama ölçütü: **risk × etki ÷ çaba**.

### P0 — Güvenlik (engelleyici)
1. Yerel bağlama (`127.0.0.1`) + CORS kısıtlama + API anahtarı
2. `/api/platforms` ve `/api/settings` yanıtlarından sır temizleme
3. Widget token'ı

### P1 — En yüksek etki/çaba
4. **Değişken motoru** (~60 değişken, saf metin işleme)
5. **Komut derinliği** (kullanıcı başına bekleme, fiyat, platform, anahtar kelime)
6. **Moderasyon eylemleri** (timeout/sil/bypass rolleri) + adaptör yetenekleri
7. **Sayaçlar** (`$(count)`, `!editcounter`)
8. **Yerleşik komutlar** (`!uptime` `!followage` `!watchtime` `!commands` `!so`)

### P2 — Ürün kalitesi
9. **Animasyon motoru** (37 ön ayar) + **alert kuyruk durum makinesi**
10. **Uyarı varyantları** + metin görünüm penceresi + ayrı metin renkleri
11. **Seviye/XP sistemi** (`!level`, `!xp`, seviye gereksinimi)
12. **TTS filtreleri** (sayı/sembol/emoji/link/karakter sınırı/bekleme/kara liste)
13. **Sohbet tarafı olay mesajları** (7 olay + eşikler)
14. **Medya kütüphanesi** (yükleme + boyut sınırı)
15. **Tema kütüphanesi** (widget başına 10+ tema)

### P3 — Genişleme
16. Platform yetenek modeli + arayüzde koşullu gizleme
17. Tahminler (`!bet`) · İzleyici kuyruğu · Puan düşüşleri
18. Discord duyuru entegrasyonu
19. Trovo adaptörü
20. Tasarım sistemi + toast + onay diyaloğu + kaydedilmemiş değişiklik uyarısı
21. Nightbot içe aktarma · uyarı dışa/içe aktarma

### Kapsam dışı
- Çok kiracılı her şey (`NOT_APPLICABLE`)
- `$(eval)` — BotRix'te bile beta ve elle erişim; güvenlik riski
- `$(leagueoflegends)` — niş

---

## 13. FİNAL DURUM — 2026-09-21 turu sonu

Bu turda tamamlananlar `DONE`, kalanlar `PARTIAL` / `NOT_DONE`.
Ayrıntı: [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md),
[`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md)

### P0 — Güvenlik

| Madde | Final |
|---|---|
| S1 Kimlik doğrulama yok | `DONE` — yerel bağlama + köken doğrulaması ile kapatıldı (tek kullanıcılı yerel araçta parola gereksiz) |
| S2 `cors: '*'` | `DONE` |
| S3 `0.0.0.0` dinleme | `DONE` |
| S4 `/api/platforms` token sızıntısı | `DONE` |
| S5 `/api/settings` sır sızıntısı | `DONE` |
| S6 Token disk şifrelemesi | `NOT_DONE` — `KNOWN_LIMITATIONS N5` |
| S7 Hız sınırı | `NOT_DONE` |
| S8 Widget URL token'ı | `NOT_DONE` |

### P1 — En yüksek etki

| Madde | Final |
|---|---|
| Değişken motoru (~60) | `DONE` — 60 değişken, 10 grup |
| Komut derinliği | `PARTIAL` — kullanıcı başına bekleme, fiyat, platform `DONE`; anahtar kelime tetikleyici ve erişim kipi şema hazır, mantık bağlanmadı |
| Moderasyon eylemleri | `PARTIAL` — motor, 5 eylem, 11 kademe, bypass `DONE`; Kick timeout **uygulandı, canlı doğrulanmadı**; Twitch/YouTube/TikTok `BLOCKED_BY_PLATFORM` (adaptör yazılmadı) |
| Sayaçlar | `DONE` — `$(count)` `$(getcounter)` `$(setcounter)` `!editcounter` |
| Yerleşik komutlar | `DONE` — `!uptime` `!watchtime` `!followage` `!so` `!addcom` `!editcom` `!delcom`; `!komutlar` gerçek liste |

### P2 — Ürün kalitesi

| Madde | Final |
|---|---|
| Animasyon motoru (37 ön ayar) | `NOT_DONE` — tasarım `TARGET_ARCHITECTURE §7` |
| Alert kuyruk durum makinesi | `NOT_DONE` |
| Uyarı varyantları | `NOT_DONE` |
| Metin penceresi / ayrı metin renkleri / metin konumu | `NOT_DONE` |
| Seviye / XP sistemi | `NOT_DONE` — DB sütunları hazır (göç #4) |
| TTS filtreleri | `NOT_DONE` |
| Sohbet tarafı olay mesajları | `NOT_DONE` |
| Medya kütüphanesi | `NOT_DONE` |
| Tema kütüphanesi | `NOT_DONE` |

### P3 — Genişleme

| Madde | Final |
|---|---|
| Platform yetenek modeli | `DONE` (sunucu) · `NOT_DONE` (panel arayüzü) |
| Tahminler / kuyruk / puan düşüşleri | `NOT_DONE` |
| Discord duyuru entegrasyonu | `NOT_DONE` |
| Trovo adaptörü | `NOT_DONE` |
| Tasarım sistemi / toast / onay diyaloğu | `NOT_DONE` |
| Nightbot içe aktarma / uyarı dışa aktarma | `NOT_DONE` |

### Kapsam dışı (değişmedi)

| Madde | Final |
|---|---|
| Çok kiracılı her şey | `NOT_APPLICABLE` |
| `$(eval)` | `NOT_DONE` (bilinçli — keyfi JS yürütme) |
| `$(leagueoflegends)` | `NOT_DONE` (niş) |
| Hype Treni / Subathon BotRix ayarları | `UNVERIFIED_BOTRIX_FEATURE` — premium kilidi |
