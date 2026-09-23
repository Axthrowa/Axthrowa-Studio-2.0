# IMPLEMENTATION REPORT — BotRix parity revizyonu

**Tarih:** 2026-09-21
**Çalışma branch'i:** `revamp/botrix-parity-20260921`
**Başlangıç commit'i:** `cdc968e` (etiket `pre-botrix-revision-20260921-182105`)

---

## 1. Revizyon öncesi durum

StreamAxT: tek kullanıcılı, yerel çalışan çok platformlu yayın botu.

| | |
|---|---|
| Sunucu | Node + Express 4.21 + TypeScript · 34 dosya / 12.567 satır |
| Arayüz | React 19 + Vite 6 + Tailwind 4 · 60 dosya / 17.944 satır |
| API | 104 uç nokta (tek dosyada) |
| Gerçek zamanlı | 1 WebSocket hub · 36 mesaj türü |
| Veritabanı | SQLite · 26 tablo · ORM yok · **migration yok** |
| Test | **yok** · Lint **yok** · CI **yok** |
| Git | **depo yoktu** |

Tam denetim: [`CURRENT_SYSTEM_AUDIT.md`](CURRENT_SYSTEM_AUDIT.md)

---

## 2. Yedek ve geri alma

| | |
|---|---|
| Yedek konumu | `C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\backup-pre-botrix-revision-20260921-182105\` |
| Boyut | 4.040 dosya · 1.604,3 MB |
| İçerik | İki projenin tüm kaynağı, yapılandırması, **tüm SQLite veritabanları + WAL** |
| Hariç | `node_modules`, derleme çıktıları, Rust `target` (manifestte belirtildi) |
| **Doğrulama** | 11 kritik dosyanın **SHA-256** özeti kaynakla karşılaştırıldı — hepsi eşleşti |
| Git etiketi (StreamAxT) | `pre-botrix-revision-20260921-182105` → `cdc968e` |
| Git etiketi (panel) | aynı ad → `9a4faa6`, **working tree'ye dokunulmadı** |

Ayrıntı ve restore adımları: [`BACKUP_MANIFEST.md`](../BACKUP_MANIFEST.md)

> Panelin branch'i bilerek değiştirilmedi: o klasörde başka bir araç da
> eşzamanlı çalışıyor.

---

## 3. BotRix araştırması

**Yöntem:** Chrome'da kullanıcının kendi yetkili oturumu. Kimlik doğrulama
**bypass edilmedi**, gerçek sohbet mesajı / bildirim / ödül / ödeme
**tetiklenmedi**, ayarlarda kalıcı değişiklik **yapılmadı**.

**İncelenen alanlar (10 menü, 22 widget):**
Widget galerisi · Chat Overlay · Şans Çarkı · Hedefler · Aktivite Akışı ·
İzleyici Sayacı · Şu An Çalan · Emoji Kombosu · Anketler · Kupa ·
Etkinlik Etiketleri · TTS · Uyarılar (+ gelişmiş ayarlar) · Sohbet Botu
(Moderasyon / Komutlar / Zamanlayıcılar / Ekstralar) · Sadakat ·
Entegrasyonlar · Profil · Mini Oyunlar · Etkileşim · Premium ·
resmi dokümantasyon

**Erişilemeyenler:** Hype Treni ve Subathon (premium kilidi), sadakat mağazası
ödül formu (şartlar onayı gerekiyordu), uyarı animasyonlarının kare kare
zamanlaması (test düğmesi gizli token taşıyan widget URL'ini tetikliyor —
o URL açılmadı). Tam liste: [`KNOWN_LIMITATIONS.md §3`](KNOWN_LIMITATIONS.md)

**Çıktılar:**
- [`BOTRIX_UI_INVENTORY.md`](BOTRIX_UI_INVENTORY.md) — kaynak sınıflandırmalı
  (`OBSERVED_IN_UI` / `CONFIRMED_IN_PUBLIC_DOCS` / `UNVERIFIED`)
- [`BOTRIX_ALERT_MATRIX.md`](BOTRIX_ALERT_MATRIX.md) — 11 olay, 37 animasyon
- [`BOTRIX_GAP_ANALYSIS.md`](BOTRIX_GAP_ANALYSIS.md) — 12 alan, durum kodlu
- [`TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md)

> **Telif:** BotRix kaynak kodu, varlığı veya tasarımı kopyalanmadı. Yalnız
> *gözlemlenen davranış ve ayar listesi* kaydedildi; her uygulama sıfırdan
> yazıldı. Sözdizimi uyumu (`$(...)`, `<ifKick>`) kullanıcının şablonlarını
> taşıyabilmesi için bilinçli bir arayüz kararıdır.

---

## 4. Yapılanlar

### 4.1 Güvenlik — P0 (commit `1f169a6`)

Denetimde bulunan **4 kritik bulgu** kapatıldı:

| Bulgu | Önce | Sonra |
|---|---|---|
| Bağlama adresi | `0.0.0.0` (tüm ağ arayüzleri) | `127.0.0.1` · `STREAMAXT_HOST` ile açık tercih + uyarı |
| CORS | `origin: '*'` | Yerel köken beyaz listesi |
| `GET /api/platforms` | Düz metin OAuth tokenı | Maskeli + `tokenVar` bayrağı |
| `GET /api/settings` | `kick_client_secret`, `gemini_api_key` düz metin | Maskeli |

**Birleşik etki (önce):** Kullanıcının ziyaret ettiği herhangi bir web
sayfası `fetch('http://localhost:3001/api/platforms')` ile Kick OAuth
tokenını okuyabiliyordu.

**CSRF:** Basit istekler ön kontrole tabi olmadığı için CORS tek başına
yetmiyor — yanıt gizlense bile istek sunucuda çalışır. Yazma yöntemlerinde
köken ayrıca doğrulanıyor (yabancı köken → 403).

**Panel kırılmadı:** Maskelenmiş veya boş sır değeri kaydedildiğinde
**mevcut değer korunuyor** (`yeniSirDegeri`); `kick/verify` tokeni sunucudaki
kayıttan okuyor. Panelde hiçbir dosya değiştirilmeden çalışmaya devam etti.

**Yeni dosyalar:** `core/security/redact.ts`, `core/security/local-guard.ts`

### 4.2 Değişken motoru — P1 (commit `6e41059`)

En büyük işlev açığı: BotRix ~60 değişken belgeliyor, bizde **8** vardı.

| Dosya | İş |
|---|---|
| `core/variables/resolve.ts` | Saf çözümleyici: iç içe `$(...)` (en içten dışa), eski biçim `Rand[]`/`RandomList[]`/`fetch[]`, `<ifKick>`/`<ifTwitch>`/`<ifYouTube>`, `<hideText>` |
| `core/variables/registry.ts` | **60 değişken** — 10 grup |
| `core/variables/net.ts` | `fetch` için SSRF koruması |
| `core/variables/store.ts` + `pure.ts` | `kv_store` (uservar/globalvar), sayaçlar |
| `core/variables/index.ts` | Genel arayüz |

**Gruplar:** kullanıcı (7) · metin (16) · kanal (7) · sadakat (5) ·
sayaç (3) · rastgele (4) · matematik-zaman (5) · web (4) · depo (8) · JSON (1)

**Güvenlik sınırları:** derinlik 3, değişken 25, `repeat` 10, çıktı 4000
karakter, ağ 5 sn / 64 KB, **özel ve yerel IP aralıkları engelli**,
yönlendirme takip edilmiyor. `$(eval)` **uygulanmadı** (keyfi JS yürütme).

**Test kipi:** Yazan değişkenler (`addPoints`, `setcounter`…) `isTest: true`
ile atlanıyor — test uyarısı gerçek puanı bozmuyor.

**Geriye uyum:** Eski `{user}` biçimi `variable-parser.ts` ile önce çözülüyor;
mevcut komutlar aynen çalışıyor (regresyon testiyle kanıtlandı).

### 4.3 Komut sistemi — P1

| Yeni alan | Karşılık |
|---|---|
| `cooldown_mode` + `user_cooldown` | BotRix "Bekleme modu: Genel / Kullanıcı başına" |
| `cost_points` | BotRix "Fiyat" |
| `platforms` | BotRix platform onay kutuları |
| `trigger_type`, `access_mode`, `min_level` | Şema hazır, arayüz bağlanmadı |

**Yeni yerleşik komutlar:** `!uptime` `!watchtime` `!followage` `!so`
`!editcounter` `!addcom` `!editcom` `!delcom`
`!komutlar` artık sabit liste yerine **gerçek komut listesini** veriyor.

### 4.4 Moderasyon — P1 (commit `26911f3`)

AutoMod bir ihlal gördüğünde platformda **hiçbir eylem yapmıyordu**.

| Yeni | Ayrıntı |
|---|---|
| `platforms/capabilities.ts` | Hangi platform hangi olayı/moderasyonu destekliyor; `if (platform === 'kick')` yerine yetenek sorgusu |
| `modules/automod/enforcement.ts` | **5 ihlal eylemi**, **11 timeout kademesi**, kural başına özel mesaj, **bypass rolleri** (saf, test edilebilir) |
| `platforms/kick.ts → timeoutUser` | Kick resmi moderasyon API'si |
| `base.ts` | İsteğe bağlı `timeoutUser` / `deleteMessage` sözleşmesi |
| Denetim kaydı | Her eylem `audit_logs`'a yazılıyor |

**Yetenek tablosu dürüst:** "platform ne yapabilir"i değil **"biz ne
yapabiliyoruz"u** ilan ediyor. Twitch moderasyonu henüz uygulanmadığı için
`false` — panel olmayan bir şey vaat etmiyor.

### 4.5 Veritabanı göç sistemi

`db/migrations.ts` — sürümlü, **yıkıcı olmayan**. 5 göç uygulandı
(yeni tablo `kv_store`, `commands` +7 sütun, `counters`, `economy` +3 sütun,
`automod_settings` +20 sütun). Sütun silinmedi, tip değiştirilmedi.

Önceki durum: dağınık `try { ALTER TABLE } catch {}` satırları — hangi göçün
uygulandığı bilinmiyordu, hata sessizce yutuluyordu.

### 4.6 Test altyapısı

Projede hiç test yoktu. Vitest kuruldu: **98 test**, hepsi geçiyor.
Kapsam: [`TEST_REPORT.md §1`](TEST_REPORT.md)

---

## 5. Yeni API uçları

| Uç | İş |
|---|---|
| `GET /api/variables` | Değişken kataloğu (panelde komut yazarken) |
| `POST /api/variables/preview` | Şablon önizleme (test kipi, yazmaz) |
| `GET /api/platforms/capabilities` | Yetenek haritası + eylem/timeout seçenekleri |
| `POST /api/automod` (genişledi) | Kural başına eylem/timeout/mesaj/bypass |

---

## 6. Yapılmayanlar ve gerekçesi

Bu bir **çok turluk** iş; bu turda P0 ve P1 tamamlandı, P2/P3 kalmadı.

**Neden bu sıra:** risk × etki ÷ çaba. Token sızıntısı her şeyden önce
gelir. Ardından en yüksek etki/çaba oranı değişken motorundaydı (saf metin
işleme, platform API'si gerektirmiyor). Moderasyon eylemleri üçüncü sıradaydı
çünkü "AutoMod var ama hiçbir şey yapmıyor" somut bir işlev yanılsamasıydı.

**Kalan başlıklar** (tam liste [`KNOWN_LIMITATIONS.md §4`](KNOWN_LIMITATIONS.md)):
animasyon motoru (37 ön ayar), alert kuyruk durum makinesi, uyarı varyantları,
seviye/XP sistemi, TTS filtreleri, sohbet tarafı olay mesajları, medya
kütüphanesi, tema kütüphanesi, tahminler/kuyruk/puan düşüşleri, Discord
duyuru entegrasyonu, Trovo, tasarım sistemi, panel arayüzü bağlantıları.

**Hazır zemin:** Animasyon motoru ve widget şeması `TARGET_ARCHITECTURE`'da
tasarlandı; seviye sistemi için `economy.xp`/`economy.level` sütunları göç
#4 ile açıldı; moderasyon ve değişken API uçları hazır — panel arayüzü
bağlanmayı bekliyor.

---

## 7. Yol boyunca bulunan ve düzeltilen hatalar

| # | Hata | Düzeltme |
|---|---|---|
| 1 | `$(math 12 * (3 + 4))` iç parantezde kesiliyor, `(math geçersiz))` dönüyordu | `enIcteki` düz parantez derinliğini sayıyor + regresyon testi |
| 2 | `eylem = timeout` seçiliyken çalışma anında başarısızlık (token yok/bağlantı kopuk) ihlali **sessizce geçiriyordu** | Çalışma anındaki hata da uyarıya düşürüyor, sebep panele bildiriliyor |
| 3 | Yetenek tablosu Twitch için uygulanmamış moderasyon vaat ediyordu | Gerçeğe uyarlandı + test güncellendi |
| 4 | `release/app` kökü sunucu dosyalarıyla kirletilmişti (önceki turdan) | Temizlendi, `dist/` doğru güncellendi |

---

## 8. Regresyon sonucu

| Alan | Sonuç |
|---|---|
| 30 mevcut API ucu | ✅ hepsi 200 |
| **Eski `{user}` komut şablonları** | ✅ aynen çalışıyor |
| Mevcut yerleşik komutlar | ✅ |
| AutoMod kuralları + moderatör muafiyeti | ✅ |
| İstemci derlemesi | ✅ |
| Tip kontrolü (sunucu + istemci) | ✅ 0 hata |
| Veritabanı verisi | ✅ kayıp yok (yalnız eklemeli göç) |

Ayrıntı: [`TEST_REPORT.md §4`](TEST_REPORT.md)

---

## 9. Dağıtım

| Hedef | Durum |
|---|---|
| `release/app/{dist,public}` | ✅ |
| `release/StreamAxT-v1.0.0-Portable/app/{dist,public}` | ✅ |
| Panel gömmesi `cikti/portable/streamaxt` | ✅ turkuaz derleme |

> Kullanıcının kendi StreamAxT'si (port 3001) kapalıydı; açınca yeni sürümü
> alacak. Tüm doğrulama **izole test örneğinde** (port 3011, boş veritabanı)
> yapıldı.

---

## 10. Geri alma

```bash
# Yalnız kaynak kodu geri al
cd "C:\Users\Axthrowa\Desktop\Projeler" && git checkout pre-botrix-revision-20260921-182105 -- .
```

```bash
# Tüm revizyonu iptal et
cd "C:\Users\Axthrowa\Desktop\Projeler" && git checkout -B main pre-botrix-revision-20260921-182105
```

Veritabanı göçleri **eklemeli** olduğu için eski kod yeni şema üstünde
sorunsuz çalışır; geri alma veri kaybettirmez. Dosya sistemi yedeğinden
tam geri yükleme: [`BACKUP_MANIFEST.md §7`](../BACKUP_MANIFEST.md)

---

## 11. Commit geçmişi

```
26911f3  moderasyon: gerçek ihlal eylemleri (P1)
6e41059  değişkenler: 8 -> 60 değişkenli şablon motoru (P1)
1f169a6  güvenlik: token sızıntısını kapat (P0)
2301fe5  Araştırma fazı: denetim + BotRix envanteri + gap analizi
cdc968e  Revizyon öncesi anlık görüntü  ← pre-botrix-revision-20260921-182105
```

---

## 12. İKİNCİ TUR — P2 / P3 (2026-09-22)

Birinci tur güvenlik ve motor katmanını kurdu ama **P2 ve P3 maddeleri
panelde görünmüyordu**. Bu turun kuralı şuydu: bir yetenek yalnız sunucuda
duruyorsa `DONE` sayılmaz — yayıncı ekranda göremiyorsa yok demektir.

### 12.1 Sunucuda yeni modüller

| Dosya | İş |
|---|---|
| `modules/alerts/backup.ts` | Uyarı ayarlarının dışa/içe aktarımı. Beyaz listeli alanlar, sürüm kontrolü, yinelenen varyant engeli. İçinde **token/webhook/şifre taşımaz** |
| `platforms/trovo.ts` | Trovo adaptörü — WebSocket sohbet, AUTH/PING-PONG, üstel yeniden bağlanma, `chat/send` |
| `platforms/trovo-map.ts` | Trovo tür kodlarının bizim olaylarımıza saf eşlemesi (DB'siz, testli) |
| `modules/integrations/discord-rules.ts` | Discord kurallarının DB'siz parçası |
| `modules/integrations/nightbot-map.ts` | Nightbot değişken eşlemesinin DB'siz parçası |

Son iki dosya davranış değiştirmez; testler çalışan sunucunun SQLite
kilidine takıldığı için ayrıldı (`prediction-math.ts` ile aynı desen).
Bu, tam takımda düzensiz düşen bir test dosyasını kalıcı olarak düzeltti.

### 12.2 Panelde yeni ekranlar

| Ekran | Kapsam |
|---|---|
| `Etkileşim` (`pages/Interaction.tsx`) | **Tahminler** (canlı havuz çubukları, kilit, sonuçlandır, iptal+iade), **İzleyici Kuyruğu** (aç/kapa, sıradakini çağır, tek tek çıkar, öncelik/kota/yalnız-abone kuralları), **Puan Düşüşleri** (canlı geri sayım, katılan listesi, havuz/sabit paylaşım) |
| `Entegrasyonlar` (`pages/Integrations.tsx`) | **Discord Duyuruları** (4 kaynak, şablon, bekleme, etiket, test), **Nightbot'tan İçe Aktar** (dosya veya yapıştır, üzerine yazma onayı, uyarı listesi), **Uyarı Yedeği** (indir / geri yükle) |
| `Alert Box → Varyantlar` (`components/AlertVariants.tsx`) | Olay başına varyant listesi, eşik + ağırlık, kopyala/sil, kütüphaneden medya seçimi |
| `Alert Box → Medya Kütüphanesi` (`components/MediaLibrary.tsx`) | Çoklu yükleme, önizleme, doluluk çubuğu, bağlantı kopyalama, silme onayı |
| `lib/capabilities.ts` | Olayın hangi kaynaktan geldiğini panelde etiketler |

Ayrıca olay sekmelerindeki `Görsel / Ses URL` alanlarına "kütüphaneden seç"
düğmesi eklendi; medya artık yalnız harici URL olmak zorunda değil.

### 12.3 Yetenek etiketleri — gizlemek yerine söylemek

BotRix karşılığı olmayan ayarları **gizlemek** yerine, hangi platformun
ürettiğini yazıyoruz. Sessizce çalışmayan bir ayar, sebebini söylemekten
kötüdür.

Bir incelik: bağış (`tip`) yalnız platform tablosuna bakılırsa
"Twitch · YouTube" görünüyordu. Ama BynoGame bağışı **platformdan bağımsız**
bir webhook'tan gelir ve Kick yayıncısında da çalışır. Etiket bu yüzden dış
kaynakları da anıyor (`DIS_KAYNAKLAR`) — aksi hâlde panel kullanıcıyı
yanıltırdı.

### 12.4 Trovo — belgeye dayalı, uydurmasız

Protokolün her ayrıntısı Trovo'nun **resmi geliştirici belgesinden** alındı
(`CONFIRMED_IN_PUBLIC_DOCS`), tahmin edilmedi:

* `wss://open-chat.trovo.live/chat`, AUTH → RESPONSE, PING → PONG (`data.gap`)
* Sohbet jetonu `GET /openplatform/chat/channel-token/{id}` — **erişim jetonu
  istemez**, yalnız Client-ID. Bu yüzden *okuma* OAuth kurmadan çalışır
* Kanal kimliği `POST /openplatform/getusers`
* Mesaj gönderme `POST /openplatform/chat/send` — `chat_send_self` ister

Tür kodları (0, 5, 6–9, 5001, 5003, 5005, 5006, 5008, 5009, 5012) belgedeki
tablodan birebir alındı. **Tanınmayan tür sessizce yok sayılır** — uydurma
bir olaya bağlanmaz; yanlış uyarı göstermek hiç göstermemekten kötüdür.

Trovo'da VIP rolü yoktur; `editor`/`supermod` en yakın kanal ayrıcalığı
olduğu için `isVip` yalnız onlarda açılır. Trovo üyeliği (`ace`, `ace+`)
kanal rolü olmadığı için VIP saymıyoruz — bunun testi de var.

Spell (hediye) bağış olarak iletilir ama `amount: 0` gider: spell'in para
karşılığı sohbet olayında gelmiyor, **uydurma tutar üretmiyoruz**. Hediye
adı ve adedi mesajda taşınır.

Yetenek tablosunda Trovo moderasyonu `false` — Trovo'nun uçları var, biz
uygulamadık. Tablo "platform ne yapabilir"i değil "biz ne yapabiliyoruz"u
ilan eder.

### 12.5 Bu turda bulunan ve düzeltilen hatalar

| # | Hata | Kök neden | Düzeltme |
|---|---|---|---|
| H1 | `!queue` ve `!sira` izleyici kuyruğunu **hiç** açmıyordu | Aynı adlar `switch` içinde daha yukarıda şarkı isteğine bağlıydı; izleyici kuyruğu dalı ölü koddu | İzleyici kuyruğuna çakışmayan adlar verildi: `!kuyruk` `!listq` `!siradakiler`. `!sira` şarkı isteğinde kaldı |
| H2 | **Discord webhook adresi düz metin dönüyordu** | `webhook` sır listesinde değildi; oysa adresi bilen herkes o kanala mesaj atabilir | `redact.ts`'e eklendi. Artık maskeleniyor; maskeli değer geri gönderilince mevcut adres korunuyor (4 test) |
| H3 | Aynı yedeği ikinci kez yüklemek varyant listesini kopyalarla şişiriyordu | Varyant her zaman `INSERT` ediliyordu | (olay + ad) ikilisi anahtar kabul edildi: yoksa ekler, varsa `uzerineYaz` durumuna göre atlar veya günceller |
| H4 | Kuyruk ayarı yazarken girdi geri sıçrayabiliyordu | POST havadayken gelen yoklama yanıtı eski değeri yazıyordu | Son düzenleme zaman damgası ile 2 sn'lik koruma |
| H5 | Bağış uyarısı "Twitch · YouTube" etiketleniyordu | Etiket yalnız platform tablosuna bakıyordu | `DIS_KAYNAKLAR` eklendi; BynoGame/webhook bağışı ayrıca anılıyor |
| H6 | `integrations.test.ts` tam takımda düzensiz düşüyordu | Test dosyası DB'ye dokunan modülü içeri alıyordu; çalışan sunucuyla SQLite kilidi çakışıyordu | Saf mantık DB'siz modüllere ayrıldı |

### 12.6 Yeni API uçları

| Uç | İş |
|---|---|
| `GET /api/alerts/backup` | Uyarı yedeğini JSON olarak indirir (sırsız) |
| `POST /api/alerts/backup/import` | Yedeği geri yükler; `uzerineYaz` seçeneği ve uyarı listesi döner |

Diğer P3 uçları (tahmin/kuyruk/puan düşüşü/varyant/medya/Discord/Nightbot)
birinci turda yazılmıştı; bu turda **panele bağlandı**.
