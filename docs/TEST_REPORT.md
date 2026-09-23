# TEST REPORT

**Tarih:** 2026-09-21
**Sürüm:** `revamp/botrix-parity-20260921` · `26911f3`+
**Test örneği:** port 3011, **boş ve izole veritabanı** — kullanıcının
gerçek StreamAxT'sine (3001) hiç dokunulmadı.

---

## 1. Otomatik testler

Projede **hiç test yoktu**. Bu turda Vitest kuruldu.

```bash
npm --prefix server test
```

| Dosya | Test | Sonuç |
|---|---|---|
| `src/core/security/security.test.ts` | 29 | ✅ |
| `src/core/variables/variables.test.ts` | 50 | ✅ |
| `src/modules/automod/enforcement.test.ts` | 19 | ✅ |
| **Toplam** | **98** | **✅ hepsi geçti** |

### Kapsam

| Modül | Ne test edildi |
|---|---|
| `redact` | Sır alanı tanıma, maskeleme, iç içe nesne, **çıktıda ham sır kalmadığı**, kaydetmede mevcut değerin korunması |
| `local-guard` | Yerel köken beyaz listesi, `null` origin reddi, bozuk köken, okuma/yazma ayrımı, bağlama adresi |
| `resolve` | En içteki `$(...)` bulma, **düz parantez regresyonu**, ad/argüman ayırma, platform koşulu, `<hideText>`, iç içe çözüm, tanımsız değişken, patlayan işleyici, çıktı sınırı, **test kipinde yazma atlanması** |
| `pure` | `matematik` (kod enjeksiyonu reddi dahil), `jsonYolu` (dizi indeksi), `sureMetni`, `sayacIfadesi` |
| `net` | **SSRF**: kendi API'mize, özel ağa, `file://`'a erişim engeli |
| `enforcement` | Bypass rolleri, timeout kademesi yuvarlama, 5 eylemin plana dönüşü, **platform desteklemediğinde uyarıya düşme**, DB satırı okuma, bozuk JSON |

### Tip kontrolü ve derleme

| Komut | Sonuç |
|---|---|
| `npx tsc --noEmit -p server/tsconfig.json` | ✅ 0 hata |
| `npx tsc --noEmit -p client/tsconfig.json` | ✅ 0 hata |
| `npm --prefix server run build` | ✅ |
| `npm --prefix client run build` | ✅ `486.86 kB` (gzip 115.20 kB) |

---

## 2. Güvenlik doğrulaması (canlı)

| # | Test | Beklenen | Sonuç |
|---|---|---|---|
| G1 | LAN IP'den `http://192.168.1.109:3011/health` | Bağlantı reddi | ✅ **Kapalı** |
| G2 | `http://127.0.0.1:3011/health` | 200 | ✅ |
| G3 | `GET /api/platforms` yanıtında ham token | Bulunmamalı | ✅ **Maskeli** |
| G4 | `GET /api/settings` → `kick_client_secret` | Maskeli | ✅ |
| G5 | `POST /api/settings` · `Origin: https://evil.example` | 403 | ✅ **403** |
| G6 | `POST /api/settings` · `Origin: http://localhost:3011` | 200 | ✅ **200** |
| G7 | `fetch[http://127.0.0.1:3011/api/platforms]` | Engelli | ✅ `(fetch: özel ağ adresi engelli)` |
| G8 | `$(urlfetch http://localhost:3011/api/settings)` | Engelli | ✅ `(fetch: yerel adres engelli)` |
| G9 | `$(urlfetch http://169.254.169.254/...)` | Engelli | ✅ `(fetch: özel ağ adresi engelli)` |
| G10 | `$(urlfetch file:///etc/passwd)` | Engelli | ✅ `(fetch: yalnız http/https)` |
| G11 | UTF-8 gidiş-dönüş (`icon: 📣`) | Bozulmamalı | ✅ |

> **G1 öncesi durum:** Aynı ağdaki her cihaz botu yönetebiliyor ve
> `GET /api/platforms` ile OAuth tokenını okuyabiliyordu.

---

## 3. Değişken motoru (canlı, `/api/variables/preview`)

| Şablon | Çıktı | ✓ |
|---|---|---|
| `Merhaba $(sender)!` | `Merhaba Önizleme!` | ✅ |
| `Rolun: $(roles)` | `Rolun: yayıncı, moderatör` | ✅ |
| `$(platform) \| $(platformUrl)` | `kick \| https://kick.com` | ✅ |
| `$(math 12 * (3 + 4))` | `84` | ✅ (regresyon düzeltildi) |
| `$(math (2+3)*4)` | `20` | ✅ |
| `$(upper $(math (2+3)))` | `5` | ✅ iç içe |
| `$(round 4.6)` | `5` | ✅ |
| `$(repeat 3 ha)` | `hahaha` | ✅ |
| `$(repeat 9999 x)` | `xxxxxxxxxx` | ✅ **10'da kesildi** |
| `Rand[7,7]` / `RandomList[abc]` | `7` / `abc` | ✅ eski biçim |
| `<ifKick>K</ifKick><ifTwitch>T</ifTwitch>` | `K` | ✅ |
| `onay <hideText>gizlibilgi</hideText>` | `onay` | ✅ sızmadı |
| `$(v1 varsayilan)` | `varsayilan` | ✅ yedek değer |
| `$(v1) ve $(v2)` (args: `birinci ikinci`) | `birinci ve ikinci` | ✅ |
| `$(boyleBirSeyYok)` | `(boylebirseyyok?)` | ✅ döngüye girmedi |
| `$(countdown 2030-01-01)` | `3 yıl 102 gün 5 saat` | ✅ |
| `$(urlencode merhaba dunya)` | `merhaba%20dunya` | ✅ |

### Kalıcı depolama (yazma kipinde)

| Şablon | Çıktı | ✓ |
|---|---|---|
| `$(setglobalvar durum;canli)` → `$(globalvar durum)` | `canli` | ✅ kalıcı |
| `$(setuservar seviye;altin)` → `$(uservar seviye)` | `altin` | ✅ |
| `$(uservar @yok;seviye;bilinmiyor)` | `bilinmiyor` | ✅ yedek |
| `$(globalvarlist)` / `$(uservarlist)` | `durum` / `seviye` | ✅ |
| `$(json globalvar;profil;stats.wins)` | `7` | ✅ |
| `$(json globalvar;profil;items[0].name)` | `kilic` | ✅ dizi indeksi |
| `$(json ...;stats.yok;varsayilan)` | `varsayilan` | ✅ |
| `$(setcounter olum 5)` | `5` | ✅ |
| `$(count +1)` | `1` | ✅ |
| `$(setlocal x;5)$(local x)` | `55` | ✅ (BotRix davranışı: set değeri de döndürür) |

**Önizleme test kipi:** `/api/variables/preview` `isTest: true` ile çalışır;
yazan değişkenler (`setglobalvar`, `count +1`…) **atlanır**. Canlı doğrulandı:
önizlemede boş döndü, gerçek çalıştırmada yazdı.

**Katalog:** `GET /api/variables` → **60 değişken**, 10 grup
(user 7, text 16, channel 7, loyalty 5, counter 3, random 4, math 5, web 4,
store 8, json 1). Önceki sistem: **8 değişken**.

---

## 4. Regresyon — mevcut özellikler bozuldu mu?

### 4.1 API uçları

30 mevcut uç tek tek çağrıldı, **hepsi 200** döndü:
`/health` `/api/status` `/api/platforms` `/api/settings` `/api/commands`
`/api/timers` `/api/automod` `/api/alerts` `/api/economy/leaderboard`
`/api/economy/rewards` `/api/events` `/api/trivia/state` `/api/trivia/stats`
`/api/tts/settings` `/api/tts/voices` `/api/games/settings` `/api/giveaways`
`/api/polls/active` `/api/songrequest/queue` `/api/king`
`/api/moderation/shield` `/api/moderation/audit-logs` `/api/extras`
`/api/overlay/all-in-one` `/api/pinned` `/api/donations/recent`
`/api/chat-rescue/settings` `/api/widgets/chat-overlay/settings`
\+ yeni: `/api/variables` `/api/platforms/capabilities`

> `/api/quotes` ve `/api/counters` 404 döndü — bunlar **revizyondan önce de
> yalnız POST** uçlarıydı (git etiketiyle doğrulandı). Veriye
> `/api/extras` üzerinden erişiliyor. Regresyon değil, test listesi hatası.

### 4.2 Komut sistemi (gerçek işleme hattı üzerinden)

| Senaryo | Sonuç | ✓ |
|---|---|---|
| **Eski `{user}` şablonu** `Selam {user}! Platform: {platform} \| Soru: {query}` | `Selam İzleyici! Platform: KICK \| Soru: merhaba dunya` | ✅ **geriye uyum** |
| Yeni `$(...)` şablonu | `İzleyici -> 42 \| KICK \| tek` | ✅ |
| Puan maliyeti (yetersiz bakiye) | `bu komut 99999 puan gerektiriyor (bakiyen: 106)` | ✅ |
| `!puan` (mevcut yerleşik) | `[🥉 Çaylak] toplam 108 Puan'in var!` | ✅ |
| `!uptime` (yeni) | `⏱️ Yayin 0 saniye once basladi.` | ✅ |
| `!komutlar` (yenilendi) | Gerçek komut listesi döndü | ✅ |

### 4.3 AutoMod

| Senaryo | Sonuç | ✓ |
|---|---|---|
| Caps ihlali, `warn` | Uyarı gönderildi | ✅ |
| Moderatör, caps ihlali | **Sessiz** (muaf) | ✅ |
| Özel uyarı mesajı | `Lutfen bagirma!` | ✅ |
| Bypass `["sub"]`, abone | **Sessiz** (muaf) | ✅ |
| Bypass `["sub"]`, abone değil | Uyarı gönderildi | ✅ |
| Denetim kaydı | `audit_logs`'a yazıldı | ✅ |
| **`timeout` seçili, bağlantı yok** | İlk denemede **sessiz kaldı** → **HATA BULUNDU** | ❌→✅ |

**Bulunan hata:** `eylem = 'timeout'` seçiliyken çalışma anında başarısızlık
(token yok / bağlantı kopuk) olursa ihlal **cevapsız kalıyordu**.
`eylemPlani` yalnız platform *yeteneğini* biliyor, anlık hatayı bilemiyor.
Düzeltildi: çalışma anındaki hata da uyarıya düşürüyor ve sebebi panele
bildiriyor. Yeniden test:
`🛡️ AutoMod: @İzleyici, ... (Kanal kimligi bilinmiyor (baglanti yok))` ✅

### 4.4 Widget'lar

Önceki turda ayağa kaldırılan 29 widget'a bu turda **dokunulmadı**; istemci
derlemesi hatasız ve ayar uçları 200 dönüyor.

---

## 5. Veritabanı göçleri

5 göç uygulandı, hepsi **eklemeli** (yeni tablo / varsayılanlı yeni sütun):

| # | Göç | Etki |
|---|---|---|
| 1 | `kv_store` | Yeni tablo |
| 2 | `commands` + 7 sütun | `cooldown_mode` `user_cooldown` `cost_points` `min_level` `platforms` `trigger_type` `access_mode` |
| 3 | `counters` sağlamlaştırma | Yeni tablo + sütun |
| 4 | `economy` + 3 sütun | `xp` `level` `first_seen` |
| 5 | `automod_settings` + 20 sütun | 5 kural × (action/timeout/message/bypass) |

**Veri kaybı yok:** sütun silinmedi, tip değiştirilmedi. İkinci çalıştırmada
göçler tekrar uygulanmadı (`schema_migrations` doğrulandı).

**Geri alma güvenliği:** Eski kod yeni şema üstünde çalışır — tüm yeni
sütunların varsayılan değeri var.

---

## 6. Dağıtım

| Hedef | Durum |
|---|---|
| `release/app/{dist,public}` | ✅ güncellendi |
| `release/StreamAxT-v1.0.0-Portable/app/{dist,public}` | ✅ güncellendi |
| Panel gömmesi (`cikti/portable/streamaxt`) | ✅ `streamaxt-hazirla.mjs` ile turkuaz derleme |

---

## 7. Yapılmayan testler

| Test | Neden |
|---|---|
| **Kick zaman aşımının gerçek API'ye gitmesi** | Gerçek bir izleyiciye moderasyon eylemi uygulamak gerekirdi — kullanıcı bunu yasakladı |
| Gerçek platform olaylarıyla uçtan uca akış | Yayın açık değil |
| OBS tarayıcı kaynağında widget doğrulaması | Bu turda widget'lara dokunulmadı |
| Yük / eşzamanlılık testi | Tek kullanıcılı yerel araç; kapsam dışı |
| Tarayıcı uyumluluk matrisi | Panel yalnız Chrome/WebView2 hedefliyor |

---

## 8. İKİNCİ TUR TESTLERİ (2026-09-22)

### 8.1 Otomatik test sayısı

| Paket | 1. tur | 2. tur | Fark |
|---|---|---|---|
| Sunucu | 207 | **250** | +43 |
| Panel | 32 | **67** | +35 |
| **Toplam** | 239 | **317** | +78 |

Yeni dosyalar: `modules/alerts/backup.test.ts` (9),
`platforms/trovo.test.ts` (30), `client/src/lib/lib.test.ts` (35),
`core/security/security.test.ts` içine 4 webhook testi.

```
npx --prefix server vitest run --root server   → 11 dosya / 250 test, hepsi geçti
npx --prefix client vitest run --root client   →  2 dosya /  67 test, hepsi geçti
```

### 8.2 Komut çakışması — H1

İzole örnekte (3011, **temiz veritabanı**) tam akış:

```
!joinq        | ali    -> @ali, Kuyruk şu an kapalı.          (varsayılan KAPALI)
!openq        | sahip  -> 🎟️ Kuyruk açıldı!
!joinq        | ali    -> 🎟️ @ali kuyruğa girdi · Sıra: 1
!joinq        | veli   -> 🎟️ @veli kuyruğa girdi · Sıra: 1    (abone öne geçti)
!kuyruk       | ali    -> 🎟️ Kuyruk (2): 1. veli · 2. ali
!listq        | ali    -> 🎟️ Kuyruk (2): 1. veli · 2. ali
!sira         | ali    -> 🎵 Şarkı sırası şu an boş.          (ŞARKI kuyruğu korundu)
!posq         | ali    -> 🎟️ @ali, sıran: 2
!nextq        | sahip  -> ➡️ Sıradaki: @veli
!clearq       | sahip  -> 🧹 Kuyruk temizlendi (1 kişi).
```

### 8.3 Tahmin dağıtımı — kuruş kuruş

Bahis: ali 300 → "Biz", veli 200 → "Onlar", ayşe 100 → "BIZ" (büyük harf,
Türkçe noktasız ı). Havuz 600, kazanan "Biz".

| Kullanıcı | Beklenen | Ölçülen | |
|---|---|---|---|
| ali | +450 (600 × 300/400) | **+450** | OK |
| ayşe | +150 (600 × 100/400) | **+150** | OK |
| veli | 0 (kaybetti) | **0** | OK |

Ölçüm mutlak bakiyeden değil, `!bet result` öncesi/sonrası **farktan**
alındı; sohbet ödülleri sonucu kirletmesin diye.

### 8.4 Puan düşüşü

`!kap` yazan: ali, veli, ali (ikinci kez). Katılan **2** (yinelenen
sayılmadı). 900 puan bölüşümü → kişi başı 450; ölçüm ali +450, veli +450.

### 8.5 Uyarı yedeği

| Adım | Sonuç |
|---|---|
| Dışa aktar | `surum 1 · 8 preset · 2 varyant`; JSON içinde `token`/`webhook`/`password`/`secret` geçen **tek alan yok** |
| İçe aktar (üzerine yazma **kapalı**) | `eklenen 0 · güncellenen 0 · atlanan 8`; `follow` başlığı DEĞİŞMEDİ; uyarı metni kullanıcıya seçeneği anlattı |
| İçe aktar (üzerine yazma **açık**) | `güncellenen 8`; `follow` başlığı yedekteki değere geçti |
| Yabancı dosya (`uygulama: "Nightbot"`) | **HTTP 400**, açıklamalı hata |
| Aynı yedeği iki kez yükle | Varyant sayısı 6 → 6 (**artmadı**), `atlanan 2` |

### 8.6 Medya kütüphanesi — içerik imzası

| Deneme | Sonuç |
|---|---|
| Gerçek 1×1 PNG | `ok: true`, `tur: image`, `/api/media/<uuid>/dosya` |
| **HTML'i `.png` adıyla yükle** | `ok: false` — "Desteklenmeyen dosya türü". İstemcinin bildirdiği MIME'a güvenilmiyor |
| Dosya adı `../../../etc/passwd` | Kabul edildi ama ad `______etc_passwd` olarak temizlendi; diskte UUID adıyla duruyor |
| Dosya sunumu başlıkları | `Content-Type: image/png`, `X-Content-Type-Options: nosniff`, `Cache-Control: immutable` |
| `GET /api/media/..%2f..%2fpackage.json/dosya` | **404** — yol gezinmesi imkânsız (kimlikle aranıyor) |

### 8.7 Discord webhook maskeleme — H2

| Adım | Sonuç |
|---|---|
| Gerçek webhook yaz | POST yanıtı zaten maskeli döndü (`••••1234`) |
| `GET /api/integrations/discord` | `••••1234`, `webhookVar: true`; ham token yanıtta **yok** |
| Maskeli değeri geri gönder + `beklemeDk: 45` | `beklemeDk` güncellendi, **gerçek adres korundu** (maske 8 karakter olsaydı yanıt tamamen noktalı dönerdi; son 4'ün `1234` kalması saklananın uzun gerçek adres olduğunu gösterir) |

`/api/integrations/discord/test` **çalıştırılmadı**: Discord sunucusuna
gerçek, görünür bir mesaj göndermek olurdu.

### 8.8 Panel — tarayıcıda uçtan uca

İzole örnekte (3011) gerçek panel açılarak:

* `Etkileşim → Tahminler`: formdan tahmin açıldı; `GET /api/predictions`
  `{baslik: "Panelden açılan tahmin çalışıyor mu?", durum: "acik",
  secenekler: ["Evet","Hayır"]}` döndü; kart canlı havuz çubuklarıyla
  göründü; sonra iptal edilip temizlendi
* `Etkileşim → İzleyici Kuyruğu` ve `→ Puan Düşüşleri`: doğru durum,
  ayarlar ve komut listeleri
* `Entegrasyonlar`: üç sekme de yüklendi; webhook alanı maskeli, açıklama
  "boş bırakırsanız mevcut adres korunur" diyor
* `Alert Box → Varyantlar`: eşik ve ağırlık doğru listelendi; olay kaynağı
  etiketi göründü
* `Alert Box → Medya Kütüphanesi`: yüklenen iki dosya, boyutlar ve doluluk
  çubuğu doğru

### 8.9 Trovo

Canlı bağlantı **denenmedi** (Trovo hesabı/Client-ID yok — `L3`). Bunun
yerine eşleme katmanı belgedeki **her örnek satırla** test edildi (30 test):
tür kodları, roller, spell JSON'u, hediye abone alıcısı, raid sayısı,
PONG `gap` sınırları, yeniden bağlanma gecikmesi. Ayrıca iki "uydurma
yapmama" kilidi: bilinmeyen tür `yoksay`, Trovo üyeliği (`ace`) VIP değil.

### 8.10 Regresyon

| Alan | Sonuç |
|---|---|
| Sunucu derlemesi (`tsc`) | Temiz |
| Panel derlemesi (`tsc` + `vite build`) | Temiz |
| Tüm testler | 317/317 geçti |
| Mevcut uçlar | `GET /api/alerts`, `/api/predictions`, `/api/queue`, `/api/point-drops`, `/api/media`, `/api/integrations/discord` — hepsi 200 |
| `PlatformAdi` birliğine `trovo` eklenmesi | 5 dosyada 11 yer; derleme temiz, mevcut platform davranışı değişmedi |
| Şarkı isteği `!sira` | Bozulmadı (§8.2) |
