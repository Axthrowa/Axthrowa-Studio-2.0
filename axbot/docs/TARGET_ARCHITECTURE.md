# TARGET ARCHITECTURE — AxBoT

> **GÜNCELLİK NOTU (2026-09-22):** Bu tasarım 1. turda yazıldı. 2. tur sonunda §7 (animasyon motoru), alert kuyruğu, varyant seçimi, medya kütüphanesi ve yetenek modelinin panel yüzeyi **uygulandı**; hangi maddenin hangi durumda olduğu [`BOTRIX_GAP_ANALYSIS §13`](BOTRIX_GAP_ANALYSIS.md) tablosundadır. Trovo adaptörü mimariye eklendi (`platforms/trovo.ts` + saf `trovo-map.ts`).

**Tarih:** 2026-09-21
**Temel ilke:** Mevcut yığını koru. Node + Express + `ws` + `node:sqlite` +
React/Vite sağlıklı ve bu kullanım için doğru seçimler. **Framework
değiştirilmeyecek.** Sorun katmanların arasında değil, içinde — düzeltme
oraya odaklanır.

---

## 1. Değişmeyecekler (bilinçli karar)

| Katman | Kalıyor | Gerekçe |
|---|---|---|
| Sunucu | Express 4 + TypeScript | 104 uç nokta çalışıyor; taşımanın getirisi yok |
| Gerçek zamanlı | `ws` + tek hub | Tek kullanıcı, tek süreç; Redis/pub-sub gereksiz karmaşa |
| Veritabanı | `node:sqlite` (WAL) | Yerel araç için doğru; ORM eklemek 717 satırı yeniden yazmak demek |
| Arayüz | React 19 + Vite + Tailwind 4 | Sorun yok |
| Olay veri yolu | `EventEmitter` | Yeterli; olay **sözleşmesi** genişleyecek, taşıyıcı değil |
| Dağıtım | Taşınabilir klasör + Tauri | Docker bu senaryoda gereksiz |

**Ölçeklenebilirlik notu:** Tek kullanıcılı yerel araç olduğu için çok
örnekli dağıtım hedef değil. Ancak yeni durum motorları (hype train,
subathon) **sunucuda** tutulacak — böylece iki OBS kaynağı açıldığında
ikisi aynı durumu görür. Bu, ölçek için değil **doğruluk** için.

---

## 2. Domain sınırları

Mevcut `modules/` düzeni korunur; eksik domainler eklenir.

```
server/src/
├── core/                    Çekirdek — platformdan bağımsız
│   ├── event-bus.ts         Olay veri yolu (sözleşme genişliyor → §3)
│   ├── pipeline.ts          Sohbet mesajı işleme hattı
│   ├── settings-cache.ts    Ayar önbelleği
│   ├── variables/           ★ YENİ — değişken motoru (§5)
│   │   ├── registry.ts      Değişken kayıt defteri
│   │   ├── resolve.ts       Çözümleyici (saf, test edilebilir)
│   │   └── groups/          user, channel, loyalty, random, web, math, store, json
│   └── security/            ★ YENİ — §4
│       ├── local-guard.ts   Yerel erişim koruması
│       └── redact.ts        Yanıttan sır temizleme
├── platforms/
│   ├── base.ts              ★ GENİŞLİYOR — yetenek modeli + moderasyon
│   └── capabilities.ts      ★ YENİ — hangi platform ne yapabilir
├── modules/
│   ├── commands/            ★ GENİŞLİYOR — fiyat, kullanıcı-bekleme, platform
│   ├── counters/            ★ YENİ — $(count), !editcounter
│   ├── levels/              ★ YENİ — XP / seviye
│   ├── uservars/            ★ YENİ — uservar / globalvar / JSON deposu
│   ├── automod/             ★ GENİŞLİYOR — ihlal eylemi, bypass rolleri
│   ├── chat-alerts/         ★ YENİ — sohbet tarafı olay mesajları
│   ├── alerts/              ★ YENİ — varyant + kuyruk durum makinesi
│   ├── hype-train/          ★ YENİ — sunucu tarafı tren durumu
│   ├── media/               ★ YENİ — medya kütüphanesi
│   └── (mevcut modüller)
└── api/
    └── routes/              ★ BÖLÜNÜYOR — 1.868 satır → domain başına dosya
```

**Frontend:**
```
client/src/
├── ui/                      ★ YENİ — tasarım sistemi (§9)
├── lib/
│   ├── widget-defaults.ts   (mevcut)
│   ├── widget-schema.ts     ★ YENİ — şema + doğrulama
│   └── animations.ts        ★ YENİ — animasyon ön ayarları (§7)
└── (mevcut)
```

---

## 3. Olay normalizasyonu

### 3.1 Ortak olay modeli

Mevcut payload'lar zaten yarı normalize. Sözleşme netleştirilir:

```ts
interface StreamEvent {
  id: string;                    // idempotency anahtarı
  platform: PlatformName;
  channel: string;
  type: StreamEventType;
  user: { username; displayName; avatarUrl?; userId?; roles: UserRole[] };
  amount?: number;               // bağış tutarı / kicks / bits / hediye adedi
  currency?: string;
  quantity?: number;             // hediye abone adedi, raid izleyicisi
  tier?: string;
  months?: number;
  message?: string;
  isTest?: boolean;              // ★ test olayları açıkça işaretlenir
  timestamp: number;
  raw?: unknown;                 // hata ayıklama; sır içermez
}
```

### 3.2 Olay türü kümesi (genişliyor)

| Mevcut | Eklenecek |
|---|---|
| `chat` `follow` `sub` `tip` `raid` `gift_tiktok` | `gift_sub` (ayrı) · `resub` · `kicks` · `bits` · `superchat` · `host` · `member` · `gift_member` · `stream_online` · `stream_offline` · `ban` · `timeout` · `message_delete` |

**Neden ayrı `gift_sub`:** şu an `sub` içinde `isGift: true` ile geliyor;
`alert_presets` tablosunda ayrı satırı var ama hiç tetiklenmiyor.

### 3.3 Test olayları
Her test olayı `isTest: true` taşır. Kalıcı etkisi olan tüketiciler
(ekonomi, sayaçlar, denetim kaydı) test olaylarını **yok sayar**; görsel
tüketiciler (overlay, uyarı) işler.

---

## 4. Güvenlik mimarisi — P0

### 4.1 Tehdit modeli
Tek kullanıcılı yerel araç. Tehdit "internetten saldırgan" değil:
1. Kullanıcının ziyaret ettiği **kötü niyetli web sayfası** (`cors: '*'`
   nedeniyle `localhost:3001`'e istek atabiliyor)
2. **Aynı ağdaki başka cihaz** (`0.0.0.0` bağlaması nedeniyle)
3. Yanlışlıkla **paylaşılan widget URL'i**

### 4.2 Katmanlar

| Katman | Karar |
|---|---|
| **Bağlama** | Varsayılan `127.0.0.1`. LAN erişimi isteniyorsa `AXBOT_HOST` ile açık tercih |
| **CORS** | Beyaz liste: `localhost`/`127.0.0.1` + `tauri://localhost` + OBS kaynağı (`null` origin). `*` kaldırılıyor |
| **Yazma koruması** | Değiştiren tüm uçlar (`POST`/`PUT`/`DELETE`) yerel origin doğrulaması ister |
| **Sır temizleme** | `redact()` — `token`, `refresh_token`, `*_secret`, `*_api_key` yanıtlardan çıkarılır. Panel "ayarlı/ayarsız" bilgisini görür, değeri değil |
| **Widget token'ı** | `data/widget-token` dosyasında rastgele 32 bayt; `/widgets/*` ve widget API'si bunu ister. Yeniden üretilebilir |
| **Hız sınırı** | Basit bellek içi kova: yazma uçları için 60 istek/dk |
| **Token şifreleme** | Tokenlar `data/` içinde kalıyor ama artık API'den dönmüyor. Disk şifrelemesi **kapsam dışı** — işletim sistemi anahtar deposu Tauri tarafında, sunucu tarafında karşılığı yok (KNOWN_LIMITATIONS) |

**Geriye uyum:** Panel aynı kaynaktan (`localhost:3001`) servis edildiği
için origin kontrolü onu etkilemez. OBS tarayıcı kaynağı `Origin` başlığı
göndermez → `null` origin'e widget token'ı ile izin verilir.

---

## 5. Değişken motoru — P1

### 5.1 Tasarım

Saf, test edilebilir bir çözümleyici. **BotRix kodu kopyalanmaz**; gözlenen
sözdizimi (`$(...)`, `Rand[...]`, `<ifKick>`) desteklenir çünkü kullanıcı
şablonlarını taşıyabilsin.

```ts
type VarContext = {
  event: StreamEvent;
  args: string[];
  rawArgs: string;
  command?: CustomCommand;
  isTest?: boolean;
};

type VarHandler = (args: string[], ctx: VarContext) => Promise<string> | string;

interface VarDef {
  name: string;
  group: 'user'|'channel'|'loyalty'|'counter'|'random'|'web'|'math'|'store'|'json';
  minArgs?: number;
  handler: VarHandler;
  /** Dış ağa çıkar mı? UI'da uyarı için */
  network?: boolean;
  /** Yazma yapar mı? Test kipinde atlanır */
  mutates?: boolean;
}
```

### 5.2 Çözümleme sırası
1. `earlyFetch` — diğer her şeyden önce (getirilen içerik değişken içerebilir)
2. İç içe `$(...)` — en içten dışa, **maks 3 derinlik**
3. Eski biçim `Rand[...]`, `RandomList[...]`, `fetch[...]`
4. Koşullu etiketler `<ifKick>` / `<ifTwitch>` / `<ifYouTube>`
5. `<hideText>` — en son, çıktıdan silinir

### 5.3 Güvenlik sınırları

| Risk | Önlem |
|---|---|
| `fetch[...]` ile SSRF | Yalnız `http(s)`; **özel IP aralıkları engelli** (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1); 5 sn zaman aşımı; 64 KB yanıt sınırı |
| Sonsuz döngü | Maks 3 iç içe derinlik, maks 25 değişken/çalıştırma |
| `$(repeat n)` bomba | Maks 10 tekrar (BotRix ile aynı) |
| `$(eval)` | **Uygulanmayacak** — keyfi JS yürütme; BotRix'te bile beta/elle erişim |
| Yazan değişkenler (`addPoints`, `setcounter`) | Test kipinde atlanır; `mutates: true` ile işaretli |

### 5.4 Kalıcı depolama

Üç kapsam, tek tablo:

```sql
CREATE TABLE IF NOT EXISTS kv_store (
  scope    TEXT NOT NULL,   -- 'user' | 'global'
  owner    TEXT NOT NULL,   -- kullanıcı adı, global'de ''
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, owner, key)
);
```

`local` kapsamı veritabanına yazılmaz — çalıştırma süresince bellekte,
maks 5 anahtar (BotRix ile aynı sınır).

---

## 6. Platform yetenek modeli — P1

```ts
interface PlatformCapabilities {
  chat: { read: boolean; send: boolean };
  events: Set<StreamEventType>;
  moderation: { timeout: boolean; ban: boolean; deleteMessage: boolean };
  stream: { setTitle: boolean; setCategory: boolean; getUptime: boolean };
  viewers: { count: boolean; list: boolean };
  roles: UserRole[];      // platformda gerçekten var olan roller
}
```

`BasePlatform` genişler:
```ts
abstract readonly capabilities: PlatformCapabilities;
timeoutUser?(user: string, seconds: number, reason?: string): Promise<boolean>;
deleteMessage?(messageId: string): Promise<boolean>;
```

**Arayüz kullanımı:** `GET /api/platforms/capabilities` yetenek haritasını
döndürür; panel desteklenmeyen ayarı **devre dışı gösterir ve sebebini
yazar** — sessizce gizlemez (kullanıcı neden olmadığını anlasın).

Kodda `if (platform === 'kick')` yerine
`if (cap(platform).moderation.timeout)`.

---

## 7. Animasyon motoru — P2

### 7.1 Ön ayar mimarisi

Her widget'a tek tek CSS yapıştırmak yerine tek kayıt defteri:

```ts
interface AnimPreset {
  id: string;                       // 'fadeUpBig'
  label: string;                    // 'Yukarı Soluk (Büyük)'
  group: 'fade'|'slide'|'zoom'|'rotate'|'flip'|'bounce'|'back'|'none';
  from: React.CSSProperties;        // başlangıç
  to: React.CSSProperties;          // bitiş
  defaultMs: number;
  defaultEasing: string;
}
```

**Kendi CSS'imiz yazılır.** 37 isim BotRix'te gözlemlendi; davranış
`transform`/`opacity` ile sıfırdan üretilir — kopyalama yok.

### 7.2 Uyarı yaşam döngüsü

```
queued → entering → visible → exiting → completed
```

| Aşama | Süre |
|---|---|
| `entering` | `animationDuration` (varsayılan 600 ms) |
| `visible` | `durationMs - giriş - çıkış` |
| `exiting` | `animationDuration` |

**Kurallar:**
- Tek seferde tek uyarı; kuyruk FIFO
- `gapMs` uyarılar arası boşluk
- `id` ile **idempotency** — yeniden bağlanmada aynı uyarı iki kez oynamaz
  (son 200 id'lik halka tampon)
- Ses süresi `durationMs`'ten uzunsa `visible` uzatılır
- `prefers-reduced-motion` → tüm animasyonlar `fade`e düşer
- **Metin görünüm penceresi** (`textFromMs`–`textToMs`): metin katmanı
  yalnız bu aralıkta görünür

---

## 8. Widget yapılandırma şeması — P2

Mevcut `WIDGET_DEFAULTS` tablosu **şemaya** yükseltilir:

```ts
type FieldSchema =
  | { type:'text'; max?:number }
  | { type:'number'; min?:number; max?:number; step?:number }
  | { type:'boolean' }
  | { type:'color' }
  | { type:'select'; options:{value:string;label:string}[] }
  | { type:'range'; min:number; max:number; step:number }
  | { type:'media'; accept:'image'|'audio'|'video' }
  | { type:'animation' };

interface WidgetSchema {
  id: string;
  label: string;
  route: string;
  sections: { id:string; label:string; fields: Record<string, FieldSchema & {label:string; help?:string; showIf?:(v:any)=>boolean}> }[];
}
```

**Kazanç:** sunucu gelen ayarı doğrular (şu an her şeyi kabul ediyor),
panel formu şemadan üretilir, `showIf` ile koşullu alanlar çalışır.

**Geriye uyum:** Şema `WIDGET_DEFAULTS`'tan türetilir; kayıtlı ayarlar
aynı anahtarlarla okunmaya devam eder. **Göç gerekmez.**

---

## 9. Tasarım sistemi — P3

`client/src/ui/` altında: `Button` `Input` `Select` `Switch` `Slider`
`Tabs` `Accordion` `Modal` `Tooltip` `ColorField` `MediaField`
`AnimationField` `Card` `DataTable` `EmptyState` `ErrorState` `Skeleton`
`Toast` `ConfirmDialog` `FormField`

Kural: **aynı işi yapan ikinci bir bileşen yazılmaz.** Mevcut sayfalar
kademeli taşınır; tek seferde 2.560 satırlık `OverlayStudio.tsx`
yeniden yazılmaz.

---

## 10. Veritabanı göç stratejisi

**Yıkıcı göç yok.** Sütun silme / tip değiştirme yapılmaz.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
```

Her göç: yalnız `CREATE TABLE IF NOT EXISTS` veya `ALTER TABLE ADD COLUMN`
(varsayılan değerli). Uygulanan sürüm kaydedilir, tekrar çalışmaz.

### Planlanan yeni tablolar

| Tablo | Amaç |
|---|---|
| `kv_store` | uservar / globalvar |
| `counters` | mevcut (kullanılacak) |
| `user_levels` | XP / seviye |
| `alert_variants` | uyarı varyantları |
| `chat_alerts` | sohbet tarafı olay mesajları |
| `media_library` | yüklenen dosyalar |
| `widget_settings` | `bot_settings` blob'undan çıkarma (geriye uyumlu okuma korunur) |

### Yeni sütunlar (hepsi `DEFAULT` ile)

| Tablo | Sütun |
|---|---|
| `commands` | `cooldown_mode` · `cost_points` · `platforms` · `trigger_type` · `access_mode` · `min_level` |
| `automod_settings` | kural başına `*_action` · `*_timeout` · `*_message` · `*_bypass` |
| `economy` | `xp` · `level` |

---

## 11. Test stratejisi

Şu an **sıfır test** var. Yeni saf modüller test edilebilir yazılır ve
Vitest eklenir:

| Modül | Test odağı |
|---|---|
| `core/variables/resolve.ts` | Her değişken grubu; iç içe; derinlik sınırı; yedek değer |
| `core/security/redact.ts` | Sır temizleme; iç içe nesne |
| `core/security/local-guard.ts` | Origin beyaz listesi; OBS `null` origin |
| `modules/automod` | İhlal eylemi seçimi; bypass rolleri |
| `modules/counters` | Artır/azalt/ayarla |
| `modules/levels` | XP → seviye eğrisi |
| `modules/alerts/queue` | Durum makinesi; idempotency; ses süresi |
| `client/lib/animations` | Her ön ayarın `from`/`to` bütünlüğü |

**Mevcut kodun testi yazılmaz** (kapsam patlaması); yalnız dokunulan ve
yeni yazılan saf modüller.

---

## 12. Uygulama sırası ve commit stratejisi

Tek devasa commit yok. Her aşama sonunda `tsc --noEmit` + test + build.

| # | Aşama | Commit |
|---|---|---|
| 1 | Güvenlik (P0) | `güvenlik: yerel bağlama, CORS, sır temizleme, widget token` |
| 2 | Göç altyapısı | `db: sürümlü göç sistemi` |
| 3 | Değişken motoru | `değişkenler: ~60 değişkenli çözümleyici` |
| 4 | Sayaçlar + kalıcı değişkenler | `sayaçlar + uservar/globalvar` |
| 5 | Komut derinliği | `komutlar: fiyat, kullanıcı-bekleme, platform, anahtar kelime` |
| 6 | Yetenek modeli + moderasyon eylemleri | `moderasyon: timeout/sil/bypass` |
| 7 | Yerleşik komutlar | `komutlar: !uptime !followage !watchtime !commands !so` |
| 8 | Seviye sistemi | `seviyeler: XP eğrisi, !level, !xp` |
| 9 | Animasyon + kuyruk motoru | `uyarılar: animasyon ön ayarları + kuyruk durum makinesi` |
| 10 | Uyarı varyantları + metin katmanları | `uyarılar: varyantlar, metin penceresi` |
| 11 | TTS filtreleri | `tts: filtreler, kara liste, bekleme, şablon` |
| 12 | Sohbet olay mesajları | `sohbet uyarıları: 7 olay + eşikler` |
| 13 | Regresyon + belgeler | `test raporu + uygulama raporu` |

**Her aşamada:** mevcut çalışan davranış korunur; kırılan test gizlenmez,
kök neden düzeltilir.
