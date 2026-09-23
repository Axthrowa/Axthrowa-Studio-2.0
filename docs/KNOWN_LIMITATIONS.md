# KNOWN LIMITATIONS

**Sürüm:** `revamp/botrix-parity-20260921` · 1. tur 2026-09-21 · 2. tur 2026-09-22
**Amaç:** *Yapılmayan*, *yarım kalan* veya *doğrulanamayan* her şeyin açık
listesi. "Yaklaşık aynı" diyip geçilen madde yok.

---

## 1. Uygulandı ama CANLI DOĞRULANMADI

| # | Konu | Neden doğrulanmadı | Risk |
|---|---|---|---|
| L1 | **Kick zaman aşımı** (`kick.ts → timeoutUser`) | Gerçek bir izleyiciye timeout atmak kullanıcının kanalında görünür bir moderasyon eylemi olurdu; kullanıcı "gerçek moderatör/ban işlemi yapma" dedi | API sözleşmesi (`POST /public/v1/moderation/bans`) mevcut `sendKickMessage` desenine göre yazıldı. Yanlışsa **sessiz kalmaz**: hata panele bildirilir ve uyarı mesajına düşülür |
| L2 | Kick tokenının moderasyon kapsamı | Token OAuth ile alındı; hangi scope'ları taşıdığı bilinmiyor | 401/403 gelirse "Kick tokeni moderasyon yetkisine sahip değil" mesajı verilir |
| L3 | **Trovo adaptörü** (`platforms/trovo.ts`) — canlı WebSocket bağlantısı | Elimizde Trovo hesabı ve Client-ID yok; bağlanmak için gerçek kimlik gerekiyor | Protokolün her ayrıntısı resmi belgeden alındı (`CONFIRMED_IN_PUBLIC_DOCS`) ve eşleme katmanı 30 testle kilitlendi. Bağlantı kurulamazsa **sessiz kalmaz**: sebep panelde `getStatus().error` olarak görünür. Yetenek tablosu yalnız gerçekten uyguladığımızı ilan eder |
| L4 | Trovo mesaj **gönderme** (`chat/send`) | `chat_send_self` kapsamlı OAuth jetonu gerekiyor | Jeton yoksa gönderme `false` döner ve sebebi log'a yazılır; sessizce yutulmaz |

**Doğrulama yolu:** Yayındayken bir test hesabıyla büyük harf spamı yapıp
AutoMod kuralını `timeout` moduna alın. Başarısız olursa sohbette sebep yazar.

---

## 2. Bilinçli olarak UYGULANMADI

| # | Konu | Gerekçe |
|---|---|---|
| N1 | **Twitch / YouTube / TikTok / Discord moderasyonu** | Twitch moderasyonu Helix API + moderatör kapsamlı token istiyor; sohbet IRC üzerinden yürüdüğü için ayrı bir entegrasyon işi. Yetenek tablosunda `false` ilan edildi — panel olmayan bir şey vaat etmiyor |
| N2 | **`$(eval <js>)` değişkeni** | Keyfi JavaScript yürütme. BotRix'te bile beta ve elle erişim kontrollü. Yerel bir araçta sohbetten tetiklenebilir kod yürütme kabul edilemez |
| N3 | **`$(leagueoflegends)`** | Riot API anahtarı gerektiriyor, niş kullanım |
| N4 | **`$(settitle)` / `$(setcategory)`** | Yayın başlığı/kategorisi değiştirmek platform API'sinde yazma yetkisi ister; yetenek tablosunda `baslikDegistir: false`. Değişken kayıtlı değil — tanımsız değişken olarak `(settitle?)` döner |
| N5 | **Token disk şifrelemesi** | Tokenlar artık API'den dönmüyor ama `data/streamaxt.sqlite` içinde düz metin. İşletim sistemi anahtar deposu Tauri tarafında; sunucu tarafında karşılığı yok. Dosya sistemi erişimi olan biri okuyabilir |
| N6 | Çok kiracılı özellikler | Mimari fark: BotRix SaaS, StreamAxT tek kullanıcılı yerel araç. `BOTRIX_GAP_ANALYSIS §0` |

---

## 3. Araştırmada ERİŞİLEMEYEN BotRix alanları (`UNVERIFIED`)

Bunlar parity hedefi olarak yazılmadı — var olduğu doğrulanmadı.

| Alan | Neden |
|---|---|
| **Hype Treni ayarları** | Premium kilidi; `/panel/premiumv2` ödeme sayfasına yönlendiriyor |
| **Subathon ayarları** | Ücretsiz hesapta rota bulunamadı |
| **Sadakat mağazası ödül formu** | Kullanım şartları onayı gerekiyordu; kullanıcı adına sözleşme onaylamak kapsam dışı |
| **Zamanlayıcı formu alanları** | Hesapta zamanlayıcı yok, form açılmadı |
| **Çekilişler / Shoutout / Sabitlenmiş Mesajlar / Kapanış Jeneriği / Ekranda Emojiler / Sadakat Ödülleri widget ayarları** | Bu turda kartları açılmadı |
| **Uyarı animasyonlarının kare kare zamanlaması** | Test düğmesi paneli değil, **gizli token taşıyan widget URL'ini** tetikliyor. O URL açılmadı (sır). Animasyon **listesi** alındı, **süre/easing ölçülmedi** |
| **Alert kuyruk davranışı** | Panelde kuyruk/öncelik/cooldown ayarı gözlemlenmedi |
| **Puan Düşüşleri (`!pdrops`) paneli** | Belgede var, panelde bulunamadı |
| **Topluluk Bahisleri / İzleyici Kuyruğu ayar ekranları** | Kartlar açılmadı |
| **Alt Kullanıcılar (Workspace Members)** | `#` bağlantısı, BETA |

---

## 4. Hâlâ YAPILMAYAN parity maddeleri

2. turdan sonra kalanlar. 1. turun P2/P3 listesindeki maddelerin tamamı
kapandı; aşağıdakiler bilinçli olarak dışarıda bırakılanlar ve yarım
kalanlardır. Tam tablo: `BOTRIX_GAP_ANALYSIS §13`.

| Öncelik | Madde | Durum |
|---|---|---|
| P1 | Komutlarda **anahtar kelime tetikleyici** ve erişim kipi | **Yarım** — şema (`commands.trigger_type`, `access_mode`) hazır, çalıştırma mantığı bağlanmadı. Bugün yalnız `!komut` biçimi tetikleniyor |
| P1 | Twitch / YouTube / TikTok moderasyonu | `BLOCKED_BY_PLATFORM` — adaptör yazılmadı, yetenek tablosunda `false` (`N1`) |
| P2 | Metin görünüm penceresi (ms–ms) ve metin konumu px | **Yapılmadı** — animasyon ve varyant sistemi geldi, bu iki ince ayar gelmedi |
| P3 | Trovo **moderasyonu** | **Yapılmadı** — Trovo'nun moderasyon uçları var, biz uygulamadık; tabloda `false` |
| P3 | Alert **dışa aktarımında medya gömme** | **Yapılmadı** — yedek yalnız ayar taşır, yüklenen dosyaları taşımaz; içe aktarırken bu açıkça uyarı olarak yazılır |
| P0 | S6 token disk şifrelemesi, S7 hız sınırı, S8 widget URL kimliği | **Yapılmadı** (`N5` ve aşağıdaki gerekçeler) |

---

## 5. Mevcut sistemden devam eden teknik borç

`CURRENT_SYSTEM_AUDIT §18` listesinden bu turda **kapatılmayanlar**:

| # | Borç | Not |
|---|---|---|
| B1 | `routes.ts` 1.900+ satır, tek dosya | Bölme yapılmadı; yeni uçlar da aynı dosyaya eklendi |
| B2 | Widget ayarları şemasız/doğrulamasız | Sunucu hâlâ gelen her JSON'u kabul ediyor |
| B3 | ~~Subathon durumu tarayıcıda~~ | **KAPANDI (Subathon)** — durum sunucuya taşındı, WS ile yayılıyor. Hype Train hâlâ tarayıcıda |
| B4 | 75 boş `catch` bloğu | Yalnız dokunduğum yerlerde düzeltildi |
| B5 | Yapılandırılmış log yok | 92 `console.*` duruyor |
| B6 | ~~Tasarım sistemi yok~~ | **KAPANDI** — `ui/index.tsx`; yeni ekranlar bunu kullanıyor, eski ekranlar aşamalı geçecek |
| B7 | React Router yok, tarayıcı geri tuşu çalışmıyor | — |
| B8 | i18n yok, Türkçe/İngilizce karışık | — |
| B9 | AutoMod'da tekrarlanan mesaj kuralı yok | BotRix'te de doğrulanmadı |
| B10 | `engines` alanı yok (Node 22.5+ zorunlu) | `node:sqlite` gerektiriyor |

---

## 6. Yeni koddan doğan bilinen kısıtlar

| # | Kısıt | Ayrıntı |
|---|---|---|
| C1 | **Sır alanı panelden temizlenemiyor** | Token/API anahtarı alanı boş bırakılınca **mevcut değer korunur** (yanlışlıkla silinmesin diye). Gerçekten silmek için platformu Platformlar sekmesinden devre dışı bırakın |
| C2 | **Değişken derinliği 3, değişken sayısı 25** | Çok derin iç içe şablonlarda `(sınır aşıldı)` yazar. Bilinçli: sonsuz döngü koruması |
| C3 | **`fetch[...]` özel ağ adreslerini engeller** | Yerel bir API'den veri çekmek isteyen kullanıcı için kısıt; SSRF koruması bilinçli olarak sıkı |
| C4 | **`$(randomuser)` yalnız ekonomi tablosundan seçer** | Gerçek izleyici listesi yok; son 50 aktif kullanıcıdan seçiyor |
| C5 | **`$(followers)` `stream_events` tablosundan sayıyor** | Gerçek kanal takipçi sayısı değil, botun gördüğü takip olaylarının sayısı |
| C6 | **`!followage` yalnız bot çalışırken kaydedilen takipleri bilir** | Geçmiş takip verisi yok |
| C7 | **Testler geliştirme veritabanına göç uygular** | `migrations.ts` idempotent ve yıkıcı değil; ilk test çalıştırmasında 5 göç uygulandı |
| C8 | **CORS `null` origin reddediliyor** | Sandbox iframe'den erişim çalışmaz. OBS tarayıcı kaynağı aynı kökten servis edildiği için etkilenmez |
| C9 | **Medya kütüphanesi SVG kabul etmez** | SVG içinde script çalışabilir; overlay aynı kökten servis edildiği için kabul edilemez risk. PNG/JPG/GIF/WEBP kullanın |
| C10 | **Yedek dosyası yerel medyayı taşımaz** | `/api/media/...` bağlantıları başka bilgisayarda çözülmez; içe aktarırken kaç uyarının etkilendiği söylenir |
| C11 | **Trovo spell'lerinde para değeri yok** | Spell bağış olarak (`tip`) iletilir ama `amount: 0` gelir — uydurma bir tutar üretmemek için. Hediye adı ve adedi mesajda taşınır |
| C12 | **Etkileşim ekranı yoklama ile tazeleniyor** | Tahmin 3 sn, kuyruk 4 sn, puan düşüşü 2 sn. WebSocket'e bağlanmadı; panel açıkken küçük bir istek trafiği oluşur |
| C13 | **Varyant seçimi test düğmesiyle tam denenemez** | `Test Alert` sabit bir örnek değerle tetiklenir; eşiğe göre seçim ancak gerçek olayda görülür |

---

## 7. Geri alma

Her şey geri alınabilir. `BACKUP_MANIFEST.md §7`:

```bash
cd "C:\Users\Axthrowa\Desktop\Projeler" && git checkout pre-botrix-revision-20260921-182105 -- .
```

Veritabanı değişiklikleri **eklemeli** (yeni tablo + varsayılanlı yeni sütun);
eski kod yeni şema üstünde sorunsuz çalışır, geri alma veri kaybettirmez.
