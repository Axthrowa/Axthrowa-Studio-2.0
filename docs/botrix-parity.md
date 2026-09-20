# BotRix denklik haritası

Kaynak: botrix.live paneli (19.09.2026 tarihinde giriş yapılmış hesapla gezildi)
ve `botrix.live/docs/#/` resmî dokümantasyonu.

Amaç: projedeki bot tarafını BotRix'in **tüm** işlevlerini karşılayacak hâle
getirmek. Bu dosya "ne var / ne yok" listesidir; uygulama sırası en altta.

Durum kodları: **✅ var** · **🟡 kısmi** · **❌ yok**

---

## 1. Panel haritası (BotRix'in kendi menüsü)

| Bölüm | Alt sekmeler |
|---|---|
| Uyarılar | `/panel/alerts` |
| Widgets | 25 widget — `/panel/widget` |
| Sohbet Botu | Moderasyon · İsim · Komutlar (Komutlarım / Varsayılan) · Zamanlayıcılar · Ekstralar |
| Profil | `/panel/profile` |
| Sadakat | Sıralama · Mağaza · Satış kayıtları |
| Entegrasyonlar | Twitch / YouTube Live / YouTube Videos / TikTok / Kick → Discord bildirimi |
| Mini oyunlar | BDuel · Roulette · Slots · Gamble |
| Etkileşim | Şarkı İstekleri · Topluluk Bahisleri · İzleyici Kuyruğu |
| Alt kullanıcılar | workspace üyeleri (yetki devri) |

### 1.1 Sohbet Botu → Moderasyon
Beş filtre; her biri aç/kapa + "Yapılandır":
Büyük harf · Link · Emoji · Sembol · Küfür/argo.

Beş filtrenin **ayar ekranları tarandı** (19.09.2026, filtreler açık hâlde).

**Her filtrede ortak alanlar**

| Alan | Değerler |
|---|---|
| İhlal eylemi | `timeout` · `message` · `timeout_message` *(varsayılan)* · `delete` · `delete_message` |
| Timeout süresi | 30 · 60 · 120 · 300 · 900 · 1800 · 3600 · 7200 · 18000 · 43200 · 86400 sn |
| Özel mesaj | aç/kapa — açıkken serbest metin |
| Bypass rolleri | **Moderatör (kilitli, her zaman bypass)** · OG · VIP · Abone |

**Filtreye özel alanlar**

| Filtre | Ek alan |
|---|---|
| Büyük harf | Mesaj başına izin verilen büyük harf: 5 / 10 / 15 *(varsayılan)* / 20 / 30 / 40 |
| Link | İzin verilen alan adları (serbest metin, **en çok 5**; örn. `tiktok.com, youtube.com`) |
| Emoji | Mesaj başına izin verilen emote (varsayılan 10) |
| Sembol | Mesaj başına izin verilen sembol (varsayılan 10) |
| Küfür/argo | Yasaklı kelimeler (çok satırlı metin) — bu filtrede sayı eşiği yok |

> **Denklik sağlandı (doğrulandı).** `studio/botChat/BotrixTabs.tsx` beş
> eylemin, on bir timeout süresinin, özel mesajın, link allowlist'inin ve
> bypass rollerinin (OG/VIP/Subscriber) tamamını içeriyor.

### 1.2 Sohbet Botu → Ekstralar
- Sohbet uyarıları (karşılama / takip vb. olayda mesaj)
- Klip komutu (`!clip`)
- Seviye sistemi
- Watchtime ve puan sistemi
- Sıralamalar (puan / seviye / ikisi sıfırlama)
- **Nightbot'tan içe aktar** (komut + zamanlayıcı + moderasyon)

---

## 2. Yerleşik komutlar

| Komut | İşlev | Gerekli sistem | Yetki | Durum |
|---|---|---|---|---|
| `!followage` | Takip süresi | — | Herkes | ✅ |
| `!followers` | Takipçi sayısı | — | Herkes | ❌ |
| `!uptime` | Yayın süresi | — | Herkes | ✅ |
| `!top` | Seviye sisteminde ilk sıralar | Seviye | Herkes | ✅ |
| `!level` | Gönderenin seviyesi | Seviye | Herkes | ✅ |
| `!xp` | Seviye sisteminde ilk kullanıcılar | Seviye | Herkes | ✅ |
| `!watchtime` | İzleme süresi | Puan | Herkes | ✅ |
| `!points` | Puan görüntüle/yönet | Puan | Değişken | ✅ |
| `!commands` | Komut listesi | — | Herkes | ✅ (`!komutlar`) |
| `!so` / `!promo` | Başka yayıncıyı öne çıkar | — | Mod | ✅ |
| `!editcounter` | Sayacı belirli değere ayarla | — | Mod | ✅ |
| `!clip` | Klip oluştur | — | — | ✅ |
| `!addcom`/`!editcom`/`!delcom` | Komut yönetimi | — | Mod | ✅ |

### 2.1 Puan komutu
```
!points @viewer          → bir izleyicinin puanı            (Herkes)
!points add @viewer 100  → puan ekle                        (Mod)
!points add all 100      → sistemdeki herkese puan ekle     (Mod)
```
Durum: ✅ — `add_points` / `add_points_all` ile, moderatör yetkisi aranıyor.

### 2.2 Puan düşürme (point drops)
`!pdrops start` · `!pdrops stop` · `!pdrops status` — Durum: ❌ (sistem yok)

### 2.3 Şarkı istekleri
`!sr` · `!currentsong` · `!songs` · `!skipsong` · `!songpause` · `!songresume` ·
`!songvol 0-100` — Durum: ❌ Rust motorunda; 🟡 `lib/smartBot` içinde taslak var

### 2.4 Tahminler
`!bet yes 1000` · `!bet create` (Mod) · `!bet result yes` (Mod)
Durum: ❌ Rust motorunda; `game_bets` tablosu mevcut

### 2.5 Kuyruk
`!joinq` · `!joinq <kullanıcı>` (Mod) · `!leaveq` · `!posq` · `!queue` / `!listq`
Mod: `!openq` · `!closeq` · `!nextq` · `!removeq <ad>` · `!clearq`
Durum: ❌

---

## 3. Değişkenler

Standart sözdizimi `$(...)`. Eski biçimler: `Rand[...]`, `RandomList[...]`,
`fetch[...]`.

> **Projedeki durum:** `bot/variables.rs` motoru komut yoluna bağlı.
> Metin/hesap/zaman/işaretleme değişkenleri, `$(points)` `$(xp)`
> `$(watchtime)` `$(uptime)`, **sayaçlar** ve **kalıcı değişkenler**
> (uservar/globalvar + listeleri) çalışıyor.
> Kalanlar: JSON yardımcıları, `fetch[]` / `$(urlfetch)` / `$(earlyFetch)`,
> `$(followers)` `$(subs)` `$(title)` `$(settitle)` `$(category)`
> `$(setcategory)`, `$(leagueoflegends)`, `$(eval)`.
>
> Yazma işlemleri motorun içinde değil: `variables::Effect` listesine
> birikiyor, `render_command` render sonrası veritabanına uyguluyor. Motor
> böylece saf kalıyor ve testleri veritabanısız çalışıyor.

### 3.1 Kullanıcı ve girdi
`$(sender)` · `$(roles)` · `$(variable)` · `$(variable fallback)` ·
`$(optionalvariable)` · `$(v1)` `$(v2)` (+fallback) · `$(toname)`

### 3.2 Kanal ve yayın
`$(followers)` · `$(subs)` · `$(commands)` · `$(uptime)` · `$(title)` ·
`$(settitle ...)` · `$(category)` · `$(setcategory ...)` · `$(platform)` ·
`$(platformUrl)` · `$(userid)` / `$(senderid)` · `$(channel)`

### 3.3 Sadakat ve sayaçlar
`$(points)` · `$(addPoints n)` · `$(addPoints @kullanıcı n)` ·
`$(setPoints n)` · `$(setPoints @kullanıcı n)` · `$(level)` ·
`$(count)` `$(count +1)` `$(count -10)` · `$(getcounter ad)` ·
`$(setcounter değer)` · `$(setcounter ad değer)`

### 3.4 Rastgele ve metin
`Rand[min,max]` · `$(random min max)` · `RandomList[a;b;c]` ·
`$(repeat n metin)` (en çok 10) · `$(randomuser)` · `$(optionalrandomuser)`

### 3.5 Web ve API
`fetch[url]` · `$(urlfetch url)` · `$(earlyFetch url)` ·
`$(urlencode ...)` · `$(urldecode ...)`

### 3.6 Matematik ve zaman
`$(math 5*5)` · `$(round 4.6)` · `$(countdown tarih)` · `$(countup tarih)` ·
`$(time Europe/Istanbul tr-TR)`

### 3.7 Kalıcı değişkenler ve JSON
- Yerel (yalnız komut süresince, en çok 5): `$(setlocal k;v)` · `$(local k)` · `$(local k;varsayılan)`
- Kullanıcı başına kalıcı: `$(setuservar ...)` · `$(uservar ...)` · `$(uservarlist)`
- Kanal geneli kalıcı: `$(setglobalvar ...)` · `$(globalvar ...)` · `$(globalvarlist)`
- JSON: `$(json kapsam;anahtar;yol[;varsayılan])` · `$(jsonset ...)` · `$(jsonunset ...)`
  Kapsamlar: `local`, `uservar`, `globalvar`. Yol biçimi: `stats.wins`, `items[0].name`.
  Geçersiz JSON'da `(json invalid)` döner.

### 3.8 İleri düzey
`$(leagueoflegends <riot_id> <bölge>[; şablon])` · `$(eval <js>)` (beta)

### 3.9 Özel işaretleme
`<ifTwitch>…</ifTwitch>` · `<ifKick>…</ifKick>` · `<ifYouTube>…</ifYouTube>` ·
`<hideText>…</hideText>`

---

## 4. Projede BotRix'te olmayanlar (bizim artımız)

- `!heist` toplu soygun oyunu
- `!buy` ile puan mağazası → **OBS sahne değiştirme** ve **ses efekti** tetikleme
- Bot yanıtlarının doğrudan overlay'e düşmesi (`reply_to_overlay`)
- Tek uygulamada Kick + Twitch + YouTube sohbetinin birleşik akışı
- Yerel çalışma: bulut hesabı ve üyelik gerekmiyor

---

## 5. Uygulama sırası

1. ~~**Zamanlayıcılar çalışsın**~~ → `bot/timers.rs`, 4 test. ✅
2. ~~**Değişken motoru**~~ → `bot/variables.rs`, 16 test + komut yolunda 3 test. ✅
3. ~~**Eksik yerleşik komutlar**~~ — `!uptime` `!top` `!xp` `!points add`
   `!editcounter` ✅ · kalan: `!followers` (Kick API takipçi sayısı).
4. ~~**Sayaçlar**~~ → `db/bot_vars.rs` + `009_counters_variables.sql`, 6 test. ✅
5. ~~**Kalıcı değişkenler**~~ (uservar / globalvar + listeleri) ✅ ·
   kalan: JSON yardımcıları.
6. **Kuyruk sistemi** (`!joinq` ailesi) + panel sekmesi.
7. **Tahminler** (`!bet`) — `game_bets` tablosu hazır.
8. **Şarkı istekleri** (`!sr` ailesi) — mevcut müzik altyapısına bağlanır.
9. **Point drops** (`!pdrops`).
10. **Nightbot içe aktarma**.
11. **Slots / Gamble** mini oyunları (Rust tarafına).
12. Moderasyon filtre ayarlarının BotRix ile birebir karşılaştırılması.
