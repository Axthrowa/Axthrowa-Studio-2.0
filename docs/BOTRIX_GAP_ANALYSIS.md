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

## 13. FİNAL DURUM — iki tur sonu (2026-09-21 · 2026-09-22)

İki tur yapıldı:

* **1. tur (2026-09-21)** — yedek, denetim, BotRix araştırması, güvenlik (P0),
  değişken motoru ve moderasyon (P1).
* **2. tur (2026-09-22)** — P2 (ürün kalitesi) ve P3 (genişleme), panel
  arayüzleri, Trovo, dokümantasyon.

Durum kodları: `DONE` · `PARTIAL` · `NOT_DONE` · `NOT_APPLICABLE` ·
`BLOCKED_BY_PLATFORM` · `UNVERIFIED_BOTRIX_FEATURE`.
Ayrıntı: [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md),
[`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md),
[`TEST_REPORT.md`](TEST_REPORT.md)

### P0 — Güvenlik

| Madde | 1. tur | Final |
|---|---|---|
| S1 Kimlik doğrulama yok | `DONE` | `DONE` — yerel bağlama + köken doğrulaması (tek kullanıcılı yerel araçta parola gereksiz) |
| S2 `cors: '*'` | `DONE` | `DONE` |
| S3 `0.0.0.0` dinleme | `DONE` | `DONE` |
| S4 `/api/platforms` token sızıntısı | `DONE` | `DONE` |
| S5 `/api/settings` sır sızıntısı | `DONE` | `DONE` |
| S6 Token disk şifrelemesi | `NOT_DONE` | `NOT_DONE` — `KNOWN_LIMITATIONS N5` |
| S7 Hız sınırı | `NOT_DONE` | `NOT_DONE` — yerel bağlama S7'nin saldırı yüzeyini büyük ölçüde kapatıyor |
| S8 Widget URL token'ı | `NOT_DONE` | `NOT_DONE` — widget URL'leri sır taşımıyor; kimliksiz |
| **S9 Discord webhook düz metin dönüyordu** (2. turda bulundu) | — | `DONE` — `webhook` sır listesine eklendi, maskelenir; maskeli değer geri gönderilince mevcut adres korunur |

### P1 — En yüksek etki

| Madde | 1. tur | Final |
|---|---|---|
| Değişken motoru | `DONE` | `DONE` — 63 değişken, 10 grup |
| Komut derinliği | `PARTIAL` | `PARTIAL` — kullanıcı başına bekleme, fiyat, platform `DONE`; anahtar kelime tetikleyici ve erişim kipi şema hazır, mantık bağlanmadı |
| Moderasyon eylemleri | `PARTIAL` | `PARTIAL` — motor, 5 eylem, 11 kademe, bypass `DONE`; Kick timeout **uygulandı, canlı doğrulanmadı** (`L1`); Twitch/YouTube/TikTok `BLOCKED_BY_PLATFORM` |
| Sayaçlar | `DONE` | `DONE` |
| Yerleşik komutlar | `DONE` | `DONE` |

### P2 — Ürün kalitesi

| Madde | 1. tur | Final |
|---|---|---|
| Animasyon motoru | `NOT_DONE` | `DONE` — 38 ön ayar (`lib/animations.ts`), eski ayar adları korunur, `prefers-reduced-motion` desteği |
| Alert kuyruk durum makinesi | `NOT_DONE` | `DONE` — `queued → entering → visible → exiting → completed`, boşluk (gap) durumu, ses uzunsa görünür aşama sese uyar |
| Uyarı varyantları | `NOT_DONE` | `DONE` — eşik + ağırlık seçimi, panel arayüzü (`AlertVariants.tsx`), yedeğe dahil |
| Metin efektleri | `NOT_DONE` | `DONE` — 6 efekt (`METIN_EFEKTLERI`) |
| Seviye / XP sistemi | `NOT_DONE` | `DONE` — eğri, XP, sıralama, panel (`BotAdvanced → Seviye/XP`) |
| TTS filtreleri | `NOT_DONE` | `DONE` — link/emoji/sayı/simge/tekrar süzgeçleri, rol eşiği, kullanıcı başına bekleme |
| Sohbet tarafı olay mesajları | `NOT_DONE` | `DONE` — 9 olay, eşik ve bekleme süreleri |
| Medya kütüphanesi | `NOT_DONE` | `DONE` — yükleme, içerik imzası doğrulaması, panel arayüzü, 5 MB/dosya · 500 MB toplam |
| Tema kütüphanesi | `NOT_DONE` | `DONE` — 20 genel tema + widget'a özel temalar |
| Önizleme = OBS eşitliği | (bu turda bulundu) | `DONE` — stüdyo sahte çizim yerine gerçek `OverlayKatmanlari` kullanıyor |

### P3 — Genişleme

| Madde | 1. tur | Final |
|---|---|---|
| Platform yetenek modeli | `DONE` (sunucu) · `NOT_DONE` (panel) | `DONE` — panelde olay kaynağı etiketleri (Alert Box + Varyantlar), dış kaynaklı bağış ayrıca anılıyor |
| Tahminler | `NOT_DONE` | `DONE` — havuz dağıtımı, Türkçe büyük/küçük harf eşleşmesi, panel + sohbet komutları |
| İzleyici kuyruğu | `NOT_DONE` | `DONE` — öncelik, kota, yalnız-abone, panel + komutlar (`!kuyruk` `!listq` `!siradakiler`) |
| Puan düşüşleri | `NOT_DONE` | `DONE` — havuz/sabit paylaşım, kontenjan, panel + `!pdrops` |
| Discord duyuru entegrasyonu | `NOT_DONE` | `DONE` — 4 kaynak, webhook doğrulaması, `allowed_mentions` koruması, panel |
| Nightbot içe aktarma | `NOT_DONE` | `DONE` — komut + zamanlayıcı, değişken eşlemesi, desteklenmeyende uyarı, panel |
| Uyarı dışa/içe aktarma | `NOT_DONE` | `DONE` — sırsız JSON, sürüm kontrolü, yinelenen varyant engeli, panel |
| Trovo adaptörü | `NOT_DONE` | `PARTIAL` — protokol resmi belgeye göre uygulandı ve eşleme katmanı 30 testle kilitlendi; **canlı bağlantı doğrulanmadı** (`L3`) |
| Tasarım sistemi / toast / onay diyaloğu | `NOT_DONE` | `DONE` — `ui/index.tsx` |
| Subathon | (bu turda istendi) | `DONE` — sunucu tarafı motor, abone/hediye/KICKs/bağış kuralları, otomatik süre ekleme |
| Gemini AI asistanı | (bu turda bulundu) | `DONE` — panel sohbeti gerçek uca bağlandı, model listesi ve kota soğuması eklendi |

### Kapsam dışı (değişmedi)

| Madde | Final |
|---|---|
| Çok kiracılı her şey | `NOT_APPLICABLE` — BotRix SaaS, StreamAxT tek kullanıcılı yerel araç (`§0`) |
| Premium/plan kilitleri (varyant 5/25, 5 MB/50 MB) | `NOT_APPLICABLE` — yerel araçta plan yok; sınırlar disk korumasıdır |
| `$(eval <js>)` | `NOT_DONE` (bilinçli — keyfi JS yürütme, `N2`) |
| `$(leagueoflegends)` | `NOT_DONE` (niş, Riot API anahtarı, `N3`) |
| `$(settitle)` / `$(setcategory)` | `BLOCKED_BY_PLATFORM` — yazma yetkili token yok (`N4`) |
| Hype Treni / BotRix Subathon **ayar ekranı** | `UNVERIFIED_BOTRIX_FEATURE` — premium kilidi ardında; bizim subathonumuz BotRix'e bakılmadan, kullanıcının istediği kurallarla yazıldı |

---

## 14. YAN YANA KARŞILAŞTIRMA — özet

Satırlar `BOTRIX_UI_INVENTORY.md` menü yapısından türetildi. "Bizde" sütunu
panelde **kullanıcının görebildiği** karşılığı gösterir; yalnız sunucuda
duran bir yetenek `DONE` sayılmadı.

| BotRix menüsü | Bizdeki karşılığı | Durum |
|---|---|---|
| Panel / Genel Bakış | `Genel Bakış` | `DONE` |
| Sohbet Botu → Komutlar | `Komutlar` | `PARTIAL` — anahtar kelime tetikleyici bağlanmadı |
| Sohbet Botu → Zamanlayıcılar | `Zamanlayıcılar` | `DONE` |
| Sohbet Botu → Moderasyon | `Bot Moderation` + `Gelişmiş Bot → Moderasyon Eylemleri` | `PARTIAL` — yalnız Kick'te uygulanabiliyor |
| Sohbet Botu → Ekstralar (Nightbot içe aktarma) | `Entegrasyonlar → Nightbot'tan İçe Aktar` | `DONE` |
| Sohbet Botu → Değişkenler | `Gelişmiş Bot → Değişkenler` | `DONE` — 63 değişken kataloğu, arama ve önizleme |
| Sadakat → Puanlar / Mağaza / Sıralama | `Sadakat & Ekonomi`, `Rankings` | `DONE` |
| Sadakat → Seviyeler | `Gelişmiş Bot → Seviye / XP` | `DONE` |
| Uyarılar (Alerts) → olay başına ayar | `Alert Box` sekmeleri | `DONE` |
| Uyarılar → varyantlar | `Alert Box → Varyantlar` | `DONE` |
| Uyarılar → yükleme (medya) | `Alert Box → Medya Kütüphanesi` | `DONE` |
| Widget'lar / Overlay | `OBS Overlay Stüdyo` (29 widget) | `DONE` — önizleme ile OBS aynı bileşeni çiziyor |
| TTS | `5-Motorlu TTS` + `Gelişmiş Bot → TTS Filtreleri` | `DONE` |
| Etkileşim → Tahminler | `Etkileşim → Tahminler` | `DONE` |
| Etkileşim → İzleyici Kuyruğu (BETA) | `Etkileşim → İzleyici Kuyruğu` | `DONE` |
| Etkileşim → Puan Düşüşleri | `Etkileşim → Puan Düşüşleri` | `DONE` |
| Anketler (Polls) | `Polls` | `DONE` |
| Çekilişler | `Çekilişler` | `DONE` |
| Şarkı isteği | `Şarkı İsteği (SR)` | `DONE` |
| Entegrasyonlar (Discord duyurusu) | `Entegrasyonlar → Discord Duyuruları` | `DONE` |
| Platform bağlantıları | `Platformlar` (Kick, Twitch, YouTube, TikTok, Discord, Trovo) | `PARTIAL` — Trovo canlı doğrulanmadı |
| Hesap / Plan / Faturalama | — | `NOT_APPLICABLE` |

### Bizde olup BotRix'te gözlenmeyenler

Bunlar parity hedefi değil, kullanıcının kendi istekleri ve mevcut sistemin
güçlü yanları:

* Bil Bakalım (trivia) stüdyosu — 3311 soruluk yerel havuz
* JumpScare + BynoGame bağış zinciri
* Subathon sayacı ve otomatik süre kuralları
* Gemini AI asistanı
* 5 motorlu TTS yedeklemesi (fail-safe)
* Birleşik Multi-Chat
* Kalkan & Denetim ekranı
* Tauri panel kabuğuna gömülü çalışma
