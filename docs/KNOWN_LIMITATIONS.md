# KNOWN LIMITATIONS

**Sürüm:** `revamp/botrix-parity-20260921` · 1. tur 2026-09-21 · 2. tur 2026-09-22 · 3. tur 2026-09-23/24
**Amaç:** *Yapılmayan*, *yarım kalan* veya *doğrulanamayan* her şeyin açık
listesi. "Yaklaşık aynı" diyip geçilen madde yok.

3. turda bu listedeki §4–§6 maddelerinin tamamı ele alındı. Kapananlar
aşağıda üstü çizili değil, **durumu ve commit'iyle** yazılı: neyin
gerçekten kapandığı, neyin yalnız kodda olup canlıda denenemediği ayrı
tutuluyor.

---

## 0. Kullanıcının yapması gereken tek seferlik adımlar (3. tur)

| # | Adım | Neden |
|---|---|---|
| U1 | **Kick'i bir kez yeniden bağlayın** (Platformlar → Kick → Kick ile giriş) | Eski token yalnız `chat:write channel:read user:read` izniyle alınmıştı. Zaman aşımı, mesaj silme ve başlık/kategori değiştirme `moderation:ban`, `moderation:chat_message:manage`, `channel:write` ister. Yeniden bağlanmadan bu eylemler 403 alır; sebep panelde ve günlükte yazar |
| U2 | Twitch jetonunun izinleri | Moderasyon için `moderator:manage:banned_users` ve `moderator:manage:chat_messages`, başlık/kategori için `channel:manage:broadcast`. Eksikse eylem **hangi iznin eksik olduğunu söyleyerek** reddedilir |
| U3 | YouTube'da yazma/moderasyon için OAuth jetonu | API anahtarı yalnız okur. Gönderme, silme, zaman aşımı ve başlık OAuth jetonu ister; yoksa "YouTube moderasyonu için OAuth jetonu gerekir" döner |
| U4 | Taşınabilir kopyayı **başka bilgisayara** taşırsanız tokenları yeniden girin | Sırlar Windows DPAPI ile bu Windows kullanıcısına bağlı şifrelenir; başka makinede çözülemez, boş sayılır ("yeniden bağlan"). Kapatmak: `STREAMAXT_SIFRELEME=kapali` (yeni yazımlar düz kalır, mevcut şifreliler okunmaya devam eder) |
| U5 | OBS başka bilgisayardaysa (LAN kipi) | `STREAMAXT_HOST=0.0.0.0`. Makine adı/IP'si dışında bir adla erişiliyorsa `STREAMAXT_IZINLI_HOSTLAR="ad1,ad2"`; aksi hâlde Host denetimi 403 verir |

---

## 1. Uygulandı ama CANLI DOĞRULANMADI

Kullanıcının kuralı: gerçek moderasyon eylemi, gerçek başlık değişikliği,
gerçek sohbet mesajı veya gerçek Discord gönderisi **yapılmadı**. Bu
yüzden aşağıdakiler resmi belgelere göre yazıldı (`CONFIRMED_IN_PUBLIC_DOCS`)
ve hata durumunda **sessiz kalmayacak** şekilde kuruldu; ama gerçek hesapta
denenmedi.

| # | Konu | Neden doğrulanmadı | Hata olursa |
|---|---|---|---|
| L1 | **Kick** zaman aşımı, mesaj silme, başlık/kategori (`PATCH /public/v1/channels`) | Gerçek izleyiciye moderasyon / kanal değişikliği görünür olurdu | Hata panele ve günlüğe yazar; uyarı mesajına düşülür |
| L2 | Kick token kapsamı | 3. turda OAuth isteğine moderasyon ve `channel:write` izinleri **eklendi** (1. turda eksikti, zaman aşımı her zaman 403 alırdı) | Yeniden bağlanana kadar eski token 403 alır (`U1`) |
| L3 | **Trovo** canlı WebSocket bağlantısı | Trovo hesabı ve Client-ID yok | Sebep panelde `getStatus().error`; eşleme 30 testle kilitli |
| L4 | Trovo mesaj gönderme, mesaj silme, `settitle` (`/channels/command`) | Jeton (`chat_send_self`, `manage_messages`) yok | Yanıt hatası sebebiyle döner |
| L5 | **Twitch Helix**: zaman aşımı, mesaj silme, başlık/kategori, yayın durumu, hesap yaşı | Gerçek moderasyon/başlık değişikliği yapılmadı; yayın kapalıydı | Eksik izin adıyla bildirilir (`U2`) |
| L6 | **YouTube**: video kimliğinden sohbet bulma (`activeLiveChatId`), zaman aşımı (`liveChatBans`), silme, başlık (snippet korunarak) | Açık yayın yok | 401/403/kota hatası panelde görünür |
| L7 | Kullanıcının **kendi yayınında** canlı durum algılama (Kick/Twitch/YouTube yoklaması) | Yayın açık değildi. Kick yanıt biçimi canlı bir kanalda **gözlendi** (`start_time` UTC ve saat dilimsiz) | Hiçbir platform bildirmezse durum "bilinmiyor" kalır; pano bunu gösterir |
| L8 | **Otomatik Discord duyurusu** (yayın açılınca) | Gerçek Discord kanalına gönderi olurdu; test düğmesine basılmadı | Webhook hatası günlükte; aynı yayın iki kez duyurulmaz (kalıcı tekilleştirme) |
| L9 | Kullanıcının **gerçek veritabanında** DPAPI göçü | Göç, yeni sürüm ilk açıldığında çalışır; yalnız izole test örneğinde denendi | Göç tek transaction; gidiş-dönüş doğrulaması tutmayan değer değiştirilmez, hata olursa geri alınır |

**Doğrulama yolu:** yayındayken bir test hesabıyla büyük harf spamı yapıp
AutoMod kuralını `timeout` moduna alın; başarısız olursa sohbette ve
günlükte sebep yazar. Başlık için `!title Yeni başlık` (mod/yayıncı).

---

## 2. Bilinçli olarak UYGULANMADI

| # | Konu | Gerekçe |
|---|---|---|
| N1 | **TikTok** sohbete yazma ve moderasyon | `BLOCKED_BY_PLATFORM` — resmi TikTok canlı sohbet API'si yok; bağlayıcı yalnız okur. Yetenek tablosunda `gonder: false` (2. turda yanlışlıkla `true`'ydu) |
| N1b | **Kalıcı ban** (hiçbir platformda) | Yöntem yazılmadı; tablo her platformda `ban: false`. AutoMod eylemleri uyarı / silme / zaman aşımı ile sınırlı |
| N1c | **Trovo zaman aşımı** | Trovo belgesinde komut sözdizimi yok — uydurulmadı. Trovo'da yalnız mesaj silme ve başlık |
| N1d | **YouTube kategori** | YouTube'da yayın "oyun kategorisi" yok (video kategorisi başka kavram); `kategoriDegistir: false` |
| N1e | Discord moderasyonu | Discord botu duyuru/sohbet kanalıdır; moderasyon kapsam dışı |
| N2 | **`$(eval <js>)` değişkeni** | Keyfi JavaScript yürütme. BotRix'te bile beta ve elle erişim kontrollü |
| N3 | **`$(leagueoflegends)`** | Riot API anahtarı gerektiriyor, niş kullanım |
| N6 | Çok kiracılı özellikler | Mimari fark: BotRix SaaS, StreamAxT tek kullanıcılı yerel araç (`BOTRIX_GAP_ANALYSIS §0`) |
| N7 | Widget adresine kimlik token'ı | Kullanıcı şartı: widget/tarayıcı kaynağı adreslerinde sır olmayacak. Koruma bunun yerine yerel bağlama + Host izin listesi + köken denetimiyle sağlanıyor (`S8`) |

2. turda burada duran **N4** (`$(settitle)`/`$(setcategory)`) ve **N5**
(token disk şifrelemesi) 3. turda uygulandı — `§4`.

---

## 3. Araştırmada ERİŞİLEMEYEN BotRix alanları (`UNVERIFIED`)

Bunlar parity hedefi olarak yazılmadı — var olduğu doğrulanmadı.

| Alan | Neden |
|---|---|
| **Hype Treni ayarları** | Premium kilidi; `/panel/premiumv2` ödeme sayfasına yönlendiriyor |
| **Subathon ayarları** | Ücretsiz hesapta rota bulunamadı |
| **Sadakat mağazası ödül formu** | Kullanım şartları onayı gerekiyordu; kullanıcı adına sözleşme onaylamak kapsam dışı |
| **Zamanlayıcı formu alanları** | Hesapta zamanlayıcı yok, form açılmadı |
| **Çekilişler / Shoutout / Sabitlenmiş Mesajlar / Kapanış Jeneriği / Ekranda Emojiler / Sadakat Ödülleri widget ayarları** | Kartları açılmadı |
| **Uyarı animasyonlarının kare kare zamanlaması** | Test düğmesi **gizli token taşıyan widget URL'ini** tetikliyor; o URL açılmadı (sır). Animasyon **listesi** alındı, süre/easing ölçülmedi |
| **Alert kuyruk davranışı** | Panelde kuyruk/öncelik/cooldown ayarı gözlemlenmedi |
| **Puan Düşüşleri (`!pdrops`) paneli** | Belgede var, panelde bulunamadı |
| **Topluluk Bahisleri / İzleyici Kuyruğu ayar ekranları** | Kartlar açılmadı |
| **Alt Kullanıcılar (Workspace Members)** | `#` bağlantısı, BETA |

---

## 4. Parity maddeleri — 3. tur sonu

| Öncelik | Madde | Durum |
|---|---|---|
| P1 | Komutlarda **anahtar kelime tetikleyici** ve erişim kipi | `DONE` (`8ffab37`) — bütün kelime, Türkçe katlamalı eşleşme, en uzun anahtar kazanır, 3 sn sel koruması; erişim: her zaman / yalnız yayında / yalnız yayın dışı; canlıda doğrulandı |
| P1 | Twitch / YouTube moderasyonu | `DONE` kodda, canlı doğrulanmadı (`L5`, `L6`). TikTok `BLOCKED_BY_PLATFORM` (`N1`) |
| P2 | Metin görünüm penceresi (ms–ms) ve metin konumu px | `DONE` (`31dfbf7`) — pencere 2. turda yazılmıştı ama **yanlış ölçülüyordu** (uyarının başından değil aşamanın bitişinden); düzeltildi. Konum px ve diğer metin katmanı ayarları Alert Box'a da eklendi |
| P3 | Trovo moderasyonu | `PARTIAL` — mesaj silme ve başlık; zaman aşımı belgelenmemiş (`N1c`) |
| P3 | Alert dışa aktarımında medya gömme | `DONE` (`6d926c9`) — `?medya=1`, en çok 100 MB, içerik imzası korunur, aynı dosya ikinci kez yazılmaz |
| P0 | S6 token disk şifrelemesi | `DONE` (`7ef820b`) — Windows DPAPI (`U4`, `L9`) |
| P0 | S7 hız sınırı | `DONE` (`a4804f1`) — kayan pencere, uç başına kural, 429 + `Retry-After` |
| P0 | S8 widget URL kimliği | `DONE` politika olarak (`a4804f1`) — adreslerde sır yok (`N7`); yabancı sitelerin okuması ve WebSocket'e bağlanması Host/köken denetimiyle engelli |
| — | `$(settitle)` / `$(setcategory)`, `!title` / `!game` ile değiştirme | `DONE` kodda (`59dcbe2`, yalnız mod/yayıncı), canlı doğrulanmadı |

---

## 5. Teknik borç — 3. tur sonu

`CURRENT_SYSTEM_AUDIT §18` listesi:

| # | Borç | Durum |
|---|---|---|
| B1 | `routes.ts` 2.300+ satır, tek dosya | `DONE` (`51af8e6`) — 13 alan modülü (`api/rotalar/`); çalışma anı rota listesi önce/sonra birebir (154 rota), çakışan yollarda öncelik aynı |
| B2 | Widget ayarları şemasız/doğrulamasız | `DONE` (`dce642c`) — kimlik deseni, boyut/derinlik sınırı, prototip kirletme süzgeci, kayıtlı türe göre zorlama |
| B3 | Subathon / Hype Treni durumu tarayıcıda | `DONE` — Subathon 2. turda, Hype Treni 3. turda (`f93f777`) sunucuya taşındı |
| B4 | Boş `catch` blokları | `DONE` (`8eef974`) — 30 blok gözden geçirildi; veri kaybı olanlar günlüğe yazıyor, sohbet başına çalışanlar seyreltiliyor, bilinçli olanlar yorumlu |
| B5 | Yapılandırılmış log yok | `DONE` (`d235c82`) — zaman damgası, seviye, sır maskeleme |
| B6 | Tasarım sistemi yok | `DONE` (2. tur) |
| B7 | Tarayıcı geri tuşu çalışmıyor | `DONE` (`659dbc4`) — sekme adreste (`#sekme`), React Router eklenmeden |
| B8 | Türkçe/İngilizce karışık | `PARTIAL` — menüler ve dokunulan ekranlar Türkçe; çok dilli (i18n) altyapı yok. Tek dilli yerel araç için bilinçli |
| B9 | AutoMod'da tekrarlanan mesaj kuralı yok | `DONE` (`2206329`) — göç #6 eklemeli |
| B10 | `engines` alanı yok | `DONE` (`659dbc4`) — `node >=22.5.0` |

---

## 6. Yeni koddan doğan bilinen kısıtlar

| # | Kısıt | Ayrıntı |
|---|---|---|
| C1 | **Sır alanı panelden temizlenemiyor** | Boş bırakılan token/API anahtarı alanında **mevcut değer korunur** (yanlışlıkla silinmesin diye). Silmek için platformu devre dışı bırakın |
| C2 | **Değişken derinliği 3, değişken sayısı 25** | Aşılırsa `(sınır aşıldı)`. Sonsuz döngü koruması |
| C3 | **`fetch[...]` özel ağ adreslerini engeller** | SSRF koruması bilinçli olarak sıkı |
| C4 | **`$(randomuser)` yalnız ekonomi tablosundan seçer** | Gerçek izleyici listesi yok; son 50 aktif kullanıcı |
| C5 | **`$(followers)` `stream_events` tablosundan sayıyor** | Kanalın gerçek takipçi sayısı değil |
| C6 | **`!followage` yalnız bot çalışırken kaydedilen takipleri bilir** | Geçmiş takip verisi yok. (3. tura kadar `!followage` ve `!watchtime` sahte `case` etiketlerine takılıyor, gerçek uygulamaya **hiç ulaşmıyordu** — düzeltildi, test kilitli) |
| C7 | **Testler geliştirme veritabanına göç uygular** | Göçler idempotent ve eklemeli; şu an 6 göç |
| C8 | **CORS `null` origin reddediliyor** | Sandbox iframe'den erişim çalışmaz; OBS aynı kökten servis edildiği için etkilenmez |
| C9 | **Medya kütüphanesi SVG kabul etmez** | SVG içinde script çalışabilir |
| C10 | **Yedek, yerel medyayı yalnız istenirse taşır** | "Medyayı da göm" seçilmezse `/api/media/...` bağlantıları başka bilgisayarda çözülmez; gömme en çok 100 MB. İçe aktarırken yalnız **gerçekten eksik** dosyalar uyarılır |
| C11 | **Trovo spell'lerinde para değeri yok** | `amount: 0` — uydurma tutar üretilmez |
| C12 | ~~Etkileşim ekranı yoklama ile tazeleniyor~~ | **KAPANDI** (`73e0f90`) — durum değişince WebSocket ile (~40 ms); yoklama yalnız 15 sn'lik yedek |
| C13 | ~~Varyant seçimi test düğmesiyle denenemez~~ | **KAPANDI** (`c53125a`) — test uyarısına değer verilebiliyor (50 → küçük, 750 → büyük varyant canlıda doğrulandı) |
| C14 | **Sırlar bu Windows kullanıcısına bağlı** | `U4`. Şifreleme imzalı `powershell.exe` ile yapılır (yerel modül Akıllı Uygulama Denetimi'ne takılırdı); açılışta tek çağrı, sonra önbellek |
| C15 | **"Yalnız yayındayken" komutları durum bilinmiyorsa engellenmez** | Hiçbir platform yayın durumu bildirmiyorsa komut çalışır (sessiz engel yerine). Pano rozeti durumu gösterir |
| C16 | **Canlı durum dakikada bir yoklanır** | Kick/Twitch/YouTube 60 sn; `$(uptime)` ve erişim kipi yayın açılışından sonra ~1 dk gecikebilir. TikTok/Trovo olayla bildirir |
| C17 | **Anahtar kelime komutları sessizdir** | Yetki reddi, bekleme ve erişim kipi reddinde yanıt verilmez (sohbeti kirletmesin); puan maliyeti uygulanmaz; en az 3 sn bekleme |
| C18 | **Hype Treni durumu bellekte** | Bot yeniden başlarsa süren tren sıfırlanır (ayarlar kalıcı). Önceden her OBS kaynağı yenilendiğinde sıfırlanıyordu |
| C19 | **Günlük maskeleme desen tabanlı** | Bilinen biçimler (webhook, Bearer/OAuth, `?key=`, `access_token=`, JSON sır alanları, `dpapi:v1:`) maskelenir; tanınmayan bir sır biçimi maskelenmeyebilir |
| C20 | **Tekrarlayan hatalar seyreltilir** | Sohbet başına çalışan yollarda aynı hata dakikada bir kez yazılır; bastırılan tekrar sayısı sonraki satırda |
| C21 | **Hız sınırları** | Medya 30/dk, AI 20/dk, Discord testi 5/dk, içe aktarma 10/dk, test uyarısı 60/dk, genel yazma 300/dk, okuma 1200/dk. Bellekte tutulur; yeniden başlatmada sıfırlanır |
| C22 | **Widget ayarında tür koruması yalnız kayıtlı alanlarda** | Sunucuda şema yok (varsayılanlar istemcide); yeni alanlar serbest, kayıtlı sayı/açık-kapalı alanları türünü korur |
| C23 | **Yeni API ucu doğru modüle eklenmeli** | `api/rotalar/*.ts`; aynı yöntem+yol iki kez tanımlanırsa ya da modül toplayıcıya bağlanmazsa `rotalar.test.ts` düşer |

---

## 7. Geri alma

Her şey geri alınabilir. `BACKUP_MANIFEST.md §7` ve `§10`:

```bash
cd "C:\Users\Axthrowa\Desktop\Projeler" && git checkout pre-botrix-revision-20260921-182105 -- .
```

Veritabanı değişiklikleri **eklemeli** (yeni tablo + varsayılanlı yeni sütun);
eski kod yeni şema üstünde sorunsuz çalışır. **Tek istisna DPAPI:** eski kod
`dpapi:v1:` önekli değeri çözemez. 3. turdan öncesine dönülecekse sıra:
(1) yeni sürüm `STREAMAXT_SIFRELEME=kapali` ile açılır, (2) tokenlar
panelden yeniden girilir — bu kipte düz yazılır, (3) kod geri alınır.
Ya da `BACKUP_MANIFEST §10`'daki göç öncesi veritabanı yedeği kullanılır.

## 8. STREAMING OS TURU (2026-09-26)

1. **Kalkan modu:** "yalnız takipçi" ve "en az hesap yaşı" uygulanmaz — sohbet olayları bu bilgiyi taşımıyor; sayfa
   gerekçesiyle "desteklenmiyor" gösterir. Platformun kendi sohbet modları buradan değiştirilmez. Platformda silme
   varsayılan kapalı.
2. **Kaydedilmemiş değişiklik şeridi** yalnız 4 sayfada; diğerleri otomatik kaydediyor ya da tek alanlı.
3. **Kick yetkilendirmesi** güncelleme anında yarımdaysa yeni sürümde `state` eşleşmez; panelden yeniden başlatın.
4. **Çapraz sohbet aktarımı** kullanıcının veritabanlarında açık; Twitch'e eşzamanlı yayında panelin yayın öncesi
   kontrolü uyarır, kendiliğinden kapatılmadı.
5. Uyarı kuyruğu denetim durumu bellekte tutulur; sunucu yeniden başlarsa duraklatma/susturma sıfırlanır.
6. Çoklu yayın ve platform sınırları için panel deposundaki `docs/KNOWN_LIMITATIONS.md`.

## 9. STREAMING OS İKİNCİ TUR (2026-09-26)

1. **Twitch sohbet modları ve tek mesaj silme canlı denenmedi** (gerçek moderasyon kuralı). Twitch bağlantısının
   jetonu `moderator:manage:chat_settings` kapsamını içermiyorsa uç "kapsam eksik" hatası döner; kapsam için Twitch
   bağlantısı yeniden yetkilendirilmeli. Kick ve YouTube'un resmi API'sinde sohbet modu yok → yetenek kapalı.
2. **`tiktok-live-connector` 2.4.0'da sabit:** TikTok'un resmi olmayan protokolü değişirse bağlantı kopabilir;
   daha yeni sürüm AGPL-3.0 (karar ürün sahibinin — panel `docs/LICENSE_AND_DEPENDENCY_REVIEW.md` §3).
3. **Eski arşivler:** `release\StreamAxT-v1.0.0-Portable.zip` ve `StreamAxT-v1.0.0-Setup.zip` hâlâ 2.5.0 (AGPL)
   içerir; yeniden paketlenmeden dağıtılmamalı.
4. `$(jsonset)` / `$(jsonunset)` yalnız `local`, `uservar` ve `globalvar` kapsamlarında çalışır; sonuç 8000 karakteri
   aşarsa yazılmaz ve `(json çok büyük)` döner; bozuk JSON'a yazılmaz (`(json invalid)`).
