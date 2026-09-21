# CURRENT SYSTEM AUDIT — StreamAxT

**Denetim tarihi:** 2026-09-21
**Denetlenen sürüm:** git `cdc968e` (etiket `pre-botrix-revision-20260921-182105`)
**Yöntem:** Kaynak kod okuma + canlı veritabanı şeması + çalışan örnek üzerinde
davranış gözlemi. Hiçbir fonksiyonun "kullanılmıyor" olduğu isminden tahmin
edilmedi; her biri için referans araması yapıldı.

---

## 0. Özet

| | |
|---|---|
| **Ne olduğu** | Tek kullanıcılı, yerel çalışan çok platformlu yayın botu + OBS overlay sunucusu |
| **Ne olmadığı** | Çok kiracılı (multi-tenant) SaaS. Kullanıcı hesabı, oturum, yetkilendirme **yok** |
| **Sunucu** | Node 22+ · Express 4.21 · TypeScript 5.7 · `ws` 8.18 · `node:sqlite` |
| **Arayüz** | React 19 · Vite 6 · Tailwind 4 · lucide-react (router yok) |
| **Kod hacmi** | Sunucu 34 dosya / 12.567 satır · İstemci 60 dosya / 17.944 satır |
| **API** | 104 REST uç noktası (tek dosyada: `routes.ts`, 1.868 satır) |
| **Gerçek zamanlı** | 1 WebSocket hub · 36 mesaj türü · 7 istemci sınıfı |
| **Veritabanı** | SQLite (WAL) · 26 tablo · ORM yok · migration sistemi yok |
| **Test** | **Yok** (test koşucusu, lint, CI hiç yok) |
| **Dağıtım** | Taşınabilir klasör + Tauri kabuğu. Docker/nginx/PM2/systemd yok |

**En kritik bulgu:** Sunucu kimlik doğrulaması olmadan, `cors: '*'` ile tüm ağ
arayüzlerinde dinliyor ve `GET /api/platforms` düz metin OAuth tokenını
döndürüyor. Ayrıntı için §12.

---

## 1. Çalışma zamanı ve paket yönetimi

- **Paket yöneticisi:** npm (workspaces: `server`, `client`)
- **Çalışma zamanı:** Node.js — `node:sqlite` kullanıldığı için **Node 22.5+
  zorunlu** (bu API daha eski sürümlerde yok). `package.json`'da `engines`
  alanı **yok** → yanlış Node sürümünde çalıştırma anlaşılmaz hata verir.
- **Modül sistemi:** ESM (`"type": "module"` istemcide; sunucu `tsc` ile NodeNext)
- **Derleme:** sunucu `tsc` → `server/dist`; istemci `tsc -b && vite build` → `client/dist`

## 2. Dizin ve mimari

```
Projeler/
├── server/src/
│   ├── index.ts              (123)  Express + HTTP + WS önyükleme
│   ├── api/routes.ts        (1868)  TÜM REST uçları — tek dosya
│   ├── ws/server.ts          (488)  WebSocket hub + olay→yayın köprüsü
│   ├── core/
│   │   ├── event-bus.ts      (219)  EventEmitter tabanlı iç veri yolu
│   │   ├── pipeline.ts       (157)  Gelen sohbet mesajı işleme hattı
│   │   ├── settings-cache.ts  (51)  bot_settings bellek önbelleği
│   │   └── variable-parser.ts (186) Komut şablon değişkenleri
│   ├── db/
│   │   ├── index.ts          (717)  Bağlantı + şema + TÜM sorgular
│   │   └── schema.ts         (319)  Tip tanımları
│   ├── platforms/            (6 dosya, 1.343 satır)
│   └── modules/              (17 dosya, 6.800 satır)
└── client/src/
    ├── App.tsx               (278)  Yol tabanlı yönlendirme + sekme kabuğu
    ├── pages/                (22 dosya, 10.000+ satır)
    ├── widgets/              (25 dosya, 5.000+ satır)
    ├── hooks/                 (2 dosya)
    └── lib/                   (4 dosya)
```

**Mimari değerlendirme:** Katmanlar (platform adaptörü → olay veri yolu →
işleme hattı → modüller → WS yayını) doğru ayrılmış ve sağlıklı. Sorun
katmanların *içinde*: `routes.ts` 1.868 satırla her şeyi barındırıyor,
`db/index.ts` hem bağlantı hem şema hem sorgu deposu.

## 3. Platform entegrasyonları

| Platform | Dosya | Kütüphane | Sohbet al | Sohbet gönder | Olaylar |
|---|---|---|---|---|---|
| **Kick** | `kick.ts` (572) | `pusher-js` + REST | ✅ | ✅ | follow, sub, gift sub |
| **Twitch** | `twitch.ts` (247) | `@twurple/*` 7.2 | ✅ | ✅ | sub, gift sub, raid, cheer→tip |
| **YouTube** | `youtube.ts` (155) | REST yoklama | ✅ | ✅ | superchat→tip |
| **TikTok** | `tiktok.ts` (140) | `tiktok-live-connector` | ✅ | ✅ | gift, follow |
| **Discord** | `discord.ts` (117) | `discord.js` 14 | ✅ | ✅ | — |

**Adaptör sözleşmesi** (`platforms/base.ts`, 16 satır):

```ts
abstract class BasePlatform {
  abstract readonly name: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(channel: string, message: string): Promise<boolean>;
  abstract isConnected(): boolean;
  abstract getStatus(): PlatformStatus;
}
```

**Eksik:** *Capability (yetenek) modeli yok.* Hangi platformun hangi olayı
verebildiği hiçbir yerde tanımlı değil. Sonuç: arayüz her platform için tüm
ayarları gösteriyor — Discord için "Abone uyarısı", YouTube için "Raid" gibi
karşılığı olmayan ayarlar da dahil.

**İyi haber:** Kodda yalnızca **9 adet** `platform === '...'` koşulu var
(4'ü `'all'`). Yani platform mantığı dağılmamış; capability modeli eklemek
büyük bir yeniden yazım gerektirmiyor.

## 4. Olay sistemi

`core/event-bus.ts` — Node `EventEmitter` üzerine ince bir katman.

**Yayılan olaylar (8):** `chat`, `follow`, `sub`, `tip`, `raid`,
`gift_tiktok`, `bot_message`, `bot_send_error`

**Normalize edilmiş payload alanları:** `platform`, `channel`, `username`,
`displayName`, `avatarUrl`, `timestamp` + olaya özel alanlar (`amount`,
`currency`, `tier`, `months`, `isGift`, `viewers`, `count`, `diamonds`).

**Eksik olay türleri:**

| Olay | Durum |
|---|---|
| `gift_sub` | Ayrı olay değil — `sub` içinde `isGift: true` ile geliyor |
| `kicks` / `cheer` / `bits` | Veri yolunda **yok**; yalnız test yolundan yayınlanıyor |
| `host` | Veri yolunda **yok**; yalnız test yolundan |
| `ban` / `timeout` / `mesaj silme` | **Yok** |
| `stream_online` / `stream_offline` | **Yok** — yayın başlangıcı `setStreamStartTime(Date.now())` ile sunucu açılışına sabitlenmiş |
| `channel_points_redeem` | **Yok** |

**Sonuç:** `alert_presets` tablosunda `host` ve `kicks` için ayar satırı var
ama bu olaylar gerçek yayında hiç tetiklenmiyor — yalnız "Test" düğmesiyle.

## 5. Mesaj işleme hattı

`core/pipeline.ts` — tek giriş noktası, sıralı:

1. Boş mesaj ele
2. Bot kendi çıktısını yankılamasın (15 sn'lik `Set`)
3. Dış botları yok say (`botrix`, `nightbot`, `streamlabs` — **sabit kodlu liste**)
4. Kick paylaşımlı ban listesi kontrolü
5. Shield Mode (sub-only / link engelleme)
6. Chat Rescue'ya aktivite bildir
7. `economy.recordMessage()` (puan + mesaj sayacı)
8. **AutoMod** → ihlalde uyar ve dur
9. **Bil Bakalım oyu** → kabul edilirse dur
10. **Mini oyun yanıtı** → varsa dur
11. **Komut işleme** → varsa dur
12. `!tts ` ön eki
13. Cross-chat aktarımı

**Değerlendirme:** Sıralama mantıklı. Sorunlar:
- Dış bot listesi sabit kodlu, panelden düzenlenemiyor.
- Yankı koruması mesaj **metnine** dayanıyor; aynı metni yazan bir izleyicinin
  mesajı 15 sn boyunca sessizce yutuluyor.
- Hat boyunca hiçbir aşama kendi süresini ölçmüyor (gözlemlenebilirlik yok).

## 6. Komut sistemi

`modules/commands/command-manager.ts` (543 satır)

**Veritabanı alanları:** `name`, `response`, `user_level`, `cooldown`,
`aliases`, `is_enabled`, `use_count`, `description`

**Desteklenen yetki seviyeleri:** `everyone`, `sub`, `vip`, `mod`, `broadcaster`

**Şablon değişkenleri:** `{user}` `{touser}` `{query}` `{args}` `{uptime}`
`{platform}` `{points}`/`{puan}` `{1}`…`{9}` — hem `{x}` hem `$(x)` sözdizimi

**Yerleşik komutlar:** `!puan` `!sıralama` `!sr` `!skip` `!clip` `!oy`
`!zar` `!heist` `!yarış` `!anagram` `!tahtikap` `!kral` `!permit`
`!puanver`/`!puanekle`/`!givepoints` ve Bil Bakalım komutları

**Eksikler (BotRix'te olup bizde olmayan alanlar):**

| Özellik | Durum |
|---|---|
| Kullanıcı başına bekleme (per-user cooldown) | **Yok** — yalnız global cooldown |
| Komut maliyeti (puan) | **Yok** |
| Seviye/XP gereksinimi | **Yok** |
| Platform başına açma/kapama | **Yok** — komut tüm platformlarda aynı |
| Sayaç (counter) komutu | Tablo var (`counters`), komut entegrasyonu **yok** |
| Rastgele yanıt listesi | **Yok** |
| Büyük/küçük harf duyarlılığı ayarı | **Yok** (hep duyarsız) |
| Komut ön eki ayarı | `bot_settings.prefix` var, arayüzde **yok** |

## 7. Zamanlayıcılar

`modules/timers/timers.ts` (82 satır)

**Alanlar:** `name`, `messages` (çoklu), `interval_minutes`, `min_chat_lines`,
`is_enabled`, `last_run_at`

Aralık + minimum sohbet satırı birlikte çalışıyor (BotRix ile aynı model).
**Eksik:** platform seçimi, mesaj sırası (sıralı/rastgele) ayarı, zamanlayıcıya
özel yetki/ön ek yok.

## 8. Moderasyon

`modules/automod/automod.ts` (165) + `modules/moderation/shield-mode.ts` (131)

| Kural | Ayarlar |
|---|---|
| Caps | açık/kapalı, min uzunluk, maks % |
| Emote | açık/kapalı, maks adet |
| Link | açık/kapalı, beyaz liste |
| Sembol | açık/kapalı, maks % |
| Kara liste | kelime listesi |
| AI moderasyon | açık/kapalı, toksisite eşiği |
| Shield Mode | sub-only, link engelle, min hesap yaşı, raid mesajı temizleme |

**Eksik:** Zaman aşımı/ban **uygulanmıyor** — AutoMod yalnız sohbete uyarı
yazıyor, platformda gerçek bir moderasyon eylemi yapmıyor. Tekrarlayan mesaj
kuralı yok. Ceza kademesi (1. ihlal uyarı → 2. timeout → 3. ban) yok.

## 9. TTS

`modules/tts/tts-engine.ts` (613 satır)

**5 motor:** `edge` · `google` · `gemini` · `elevenlabs` · `webspeech`
**14 dil**, cinsiyet etiketli ses listesi
**Yapılandırma:** `primaryEngine` + `fallbackChain` (sıralı yedekleme)
**Kuyruk:** sunucuda üretim, istemcide (AudioPlayer widget) oynatma

**Eksikler:** kullanıcı bazlı bekleme, puan maliyeti, minimum/maksimum mesaj
uzunluğu, emoji/URL okuma davranışı ayarı, kara liste, atlama/iptal
(sunucuda `/tts/clear` var ama tek mesaj atlama yok), hız/perde ayarı.

## 10. Ekonomi / sadakat

`modules/economy/economy.ts` (551 satır)

**Kazanç:** mesaj başına (`points_per_message`), zaman aralığı başına
(`points_per_interval` / `interval_minutes`, 5 dk tik), abone çarpanı
(`sub_points_multiplier`), abone/hediye abone/bağış bonusları

**Kullanıcı kaydı:** `points`, `watch_time_minutes`, `messages_count`,
`subs_count`, `gifted_subs_count`, `tips_amount`, `loyalty_tier`

**Mağaza:** `loyalty_rewards` (başlık, maliyet, tür, yük, açık/kapalı) +
`loyalty_redemptions` (onay durumu ile)

**Eksikler:** seviye/XP sistemi, stok limiti, kullanıcı başına satın alma
limiti, ödül bekleme süresi, ödül görseli, genel (public) mağaza sayfası —
zaten tek kullanıcılı mimaride public sayfa karşılığı yok.

## 11. Widget ve overlay sistemi

**29 widget** — tamamı `useWidgetSettings(id, defaults)` ile panele bağlı
(önceki turda tamamlandı).

**Ayar akışı:**
```
Panel formu → POST /api/widgets/:id/settings
            → bot_settings['widget_settings_<id>'] = JSON
            → WS yayını { type:'widget_settings', widgetId, settings }
            → widget anında uygular (sayfa yenilemeden)
```

**Mimari sorunlar:**

1. **Şema yok.** Ayarlar şekilsiz JSON blob. Doğrulama yok, tip güvenliği yok,
   sunucu gelen her şeyi kabul ediyor. Varsayılanlar yalnız istemcide
   (`widget-defaults.ts`), sunucu bilmiyor.
2. **Tek tablo değil, anahtar-değer satırı.** `widget_settings` tablosu yok;
   `bot_settings` içinde `widget_settings_<id>` anahtarlı satır.
3. **Önizleme ile gerçek widget aynı bileşeni kullanıyor** ✅ (bu doğru
   yapılmış — `?preview=1` bayrağı ile)
4. **Animasyon sistemi yok.** Her widget kendi içinde Tailwind
   `animate-bounce` / `animate-pulse` kullanıyor. Yeniden kullanılabilir
   giriş/bekleme/çıkış ön ayarı, süre/gecikme/easing parametresi yok.
5. **Alert kuyruğu yok.** `AlertBoxWidget` `queueEnabled`/`gapMs` ayarlarına
   sahip ama gerçek bir durum makinesi (`queued→entering→visible→exiting→
   completed`) yok. Arka arkaya gelen iki olay çakışabiliyor.
6. **Medya kütüphanesi yok.** `client/public` **boş**; ses/görsel yükleme
   uç noktası yok. Tüm medya harici URL ile veriliyor.
7. **Hype Train ve Subathon durumu tarayıcıda.** Sunucuda motor yok; iki OBS
   kaynağı açılırsa iki farklı sayaç görünür.

## 12. Güvenlik — **KRİTİK**

| # | Bulgu | Kanıt | Şiddet |
|---|---|---|---|
| **S1** | **Kimlik doğrulama hiç yok** | 104 uç noktanın hiçbirinde auth kontrolü yok | 🔴 Kritik |
| **S2** | **`cors: { origin: '*' }`** | `index.ts:30` | 🔴 Kritik |
| **S3** | **Tüm arayüzlerde dinliyor** | `server.listen(PORT)` — host verilmemiş → `0.0.0.0` | 🔴 Kritik |
| **S4** | **OAuth tokenı API'den düz metin dönüyor** | `GET /api/platforms` → `SELECT * FROM channels` (token + refresh_token dahil) | 🔴 Kritik |
| **S5** | **API gizli anahtarı API'den dönüyor** | `GET /api/settings` → `kick_client_secret`, `gemini_api_key` | 🔴 Kritik |
| **S6** | Tokenlar veritabanında şifrelenmemiş | `channels.token` düz metin (48 karakter) | 🟠 Yüksek |
| **S7** | Hız sınırı yok | Hiçbir uçta rate limit | 🟠 Yüksek |
| **S8** | Widget URL'i korumasız | `/widgets/*` herkese açık, token yok | 🟡 Orta |
| **S9** | Girdi doğrulama yok | `req.body` doğrudan kullanılıyor; şema doğrulayıcı yok | 🟡 Orta |
| **S10** | 75 boş `catch` bloğu | Hatalar sessizce yutuluyor | 🟡 Orta |

**S1+S2+S3+S4 birleşik etkisi:** Kullanıcı herhangi bir web sitesini
ziyaret ettiğinde, o sitedeki JavaScript `fetch('http://localhost:3001/api/platforms')`
çağrısıyla **Kick OAuth tokenını ve istemci gizli anahtarını okuyabilir** —
`cors: '*'` buna izin veriyor. Aynı ağdaki başka bir cihaz da doğrudan
erişebilir. Bu, revizyonun **en yüksek öncelikli** düzeltmesidir.

> Not: Bu bir yerel araç olduğu için "internete açık" değil; ancak CORS
> yıldızı tarayıcı üzerinden uzaktan sömürüyü mümkün kılıyor.

## 13. Veri kalıcılığı ve migration

- **ORM yok.** Ham SQL, `db.prepare(...)` ile. Hazır ifade (prepared
  statement) kullanıldığı için **SQL injection riski düşük** ✅
- **Migration sistemi yok.** Şema `CREATE TABLE IF NOT EXISTS` ile her
  açılışta idempotent kuruluyor. Sütun eklemek için ayrıca `ALTER TABLE`
  denemeleri var (`try { ALTER } catch {}` deseni).
- **Sonuç:** Sütun tipi değişikliği veya sütun silme **mümkün değil**;
  yapılırsa mevcut veriyi kırar. Sürüm takibi (`schema_version`) yok.

## 14. Gözlemlenebilirlik

| | Durum |
|---|---|
| Yapılandırılmış log | **Yok** — 92 adet `console.log/warn/error` |
| Log seviyeleri | Yok |
| Dosyaya log | Yok |
| İstek logu | Yok |
| Hata izleme (Sentry vb.) | Yok |
| Metrik | Yok |
| Denetim kaydı | Kısmi — `audit_logs` tablosu var, yalnız moderasyon kullanıyor (1 kayıt) |
| Sağlık ucu | `/health` ✅ |

## 15. Arayüz (panel)

**Yönlendirme:** React Router **yok**. `App.tsx` içinde `window.location.pathname`
karşılaştırmaları + `useState` sekme durumu. Tarayıcı geri tuşu çalışmıyor,
derin bağlantı yalnız `#hash` ile (gömülü sürümde yamalanmış).

**Tasarım sistemi:** **Yok.** Ortak `Button`, `Input`, `Select`, `Modal`,
`Toast` bileşeni yok — her sayfa kendi Tailwind sınıflarını tekrarlıyor.
Ölçüm: `bg-purple-600 hover:bg-purple-500` deseni **47 farklı yerde** elle
yazılmış.

| Durum | Var mı |
|---|---|
| Yükleniyor (skeleton) | Kısmi |
| Boş durum | Kısmi |
| Hata durumu | Nadir |
| Toast bildirimi | **Yok** (bazı sayfalarda yerel `status` metni) |
| Onay diyaloğu | **Yok** — silme işlemleri doğrudan |
| Kaydedilmemiş değişiklik uyarısı | **Yok** |
| Form doğrulama | **Yok** (alan seviyesinde hata gösterimi yok) |
| Tooltip | Yok |
| Klavye gezinme | Yok |
| Dil | Türkçe/İngilizce **karışık** (i18n altyapısı yok) |

## 16. Test, lint, CI

**Hiçbiri yok.**

- Test koşucusu yok, tek bir test dosyası yok
- ESLint/Prettier yapılandırması yok
- CI (GitHub Actions vb.) yok
- Tek otomatik kontrol: `tsc --noEmit` (elle çalıştırılıyor)

## 17. Dağıtım

**Docker / compose / nginx / PM2 / systemd: hiçbiri yok.**

Dağıtım modeli: derlenmiş `client/dist` + `server/dist` bir klasöre kopyalanıp
`node dist/index.js` ile çalıştırılıyor.

İki hedef:
1. `release/app/` ve `release/StreamAxT-v1.0.0-Portable/app/` — taşınabilir klasör
2. `yayin-yonetim-araci` (Tauri 2) — `scripts/streamaxt-hazirla.mjs` ile
   turkuaz temalı derleme yapıp Bot sekmesine iframe ile gömüyor. Rust tarafı
   Node sürecini Windows job object ile uygulama ömrüne bağlıyor.

---

## 18. Teknik borç listesi (öncelik sırası)

| # | Borç | Etki | Çaba |
|---|---|---|---|
| 1 | Kimlik doğrulama + CORS + bind adresi (S1-S5) | 🔴 Token sızıntısı | Düşük |
| 2 | Token şifreleme (S6) | 🔴 | Orta |
| 3 | Alert kuyruğu ve animasyon motoru yok | 🟠 Ürün kalitesi | Orta |
| 4 | Widget ayarları şemasız/doğrulamasız | 🟠 | Orta |
| 5 | Hype Train / Subathon durumu istemcide | 🟠 | Orta |
| 6 | `routes.ts` 1.868 satır — tek dosya | 🟠 Bakım | Orta |
| 7 | Platform capability modeli yok | 🟠 Yanlış arayüz | Düşük |
| 8 | Medya kütüphanesi yok | 🟠 | Orta |
| 9 | Test/lint/CI yok | 🟠 Regresyon riski | Orta |
| 10 | Tasarım sistemi yok (47 kopya buton) | 🟡 | Yüksek |
| 11 | Migration sistemi yok | 🟡 | Düşük |
| 12 | 75 boş catch — sessiz hata | 🟡 | Düşük |
| 13 | Yapılandırılmış log yok | 🟡 | Düşük |
| 14 | i18n yok, dil karışık | 🟡 | Yüksek |
| 15 | Router yok (geri tuşu çalışmıyor) | 🟡 | Orta |
| 16 | `engines` alanı yok (Node 22.5+ zorunlu) | 🟢 | Çok düşük |
| 17 | Dış bot listesi sabit kodlu | 🟢 | Çok düşük |
| 18 | AutoMod gerçek moderasyon eylemi yapmıyor | 🟠 | Orta |

---

## 19. BotRix karşılaştırması için ön not

BotRix **çok kiracılı bir SaaS**; StreamAxT **tek kullanıcılı yerel bir
araç**. Bu yapısal fark bazı BotRix özelliklerini bizim için *uygulanamaz*
kılar ve gap analizinde `NOT_APPLICABLE` olarak işaretlenecektir:

- Kullanıcı kaydı / giriş / parola sıfırlama
- Genel (public) profil ve mağaza sayfaları
- Abonelik/ödeme planları, premium kilitler
- Çok kullanıcılı yetkilendirme ve takım yönetimi

Buna karşılık *bot ve widget işlevselliği* tam olarak karşılaştırılabilir ve
parity hedefidir.
