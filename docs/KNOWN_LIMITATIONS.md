# KNOWN LIMITATIONS

**Sürüm:** `revamp/botrix-parity-20260921` · 2026-09-21
**Amaç:** Bu turda *yapılmayan*, *yarım kalan* veya *doğrulanamayan* her şeyin
açık listesi. "Yaklaşık aynı" diyip geçilen madde yok.

---

## 1. Uygulandı ama CANLI DOĞRULANMADI

| # | Konu | Neden doğrulanmadı | Risk |
|---|---|---|---|
| L1 | **Kick zaman aşımı** (`kick.ts → timeoutUser`) | Gerçek bir izleyiciye timeout atmak kullanıcının kanalında görünür bir moderasyon eylemi olurdu; kullanıcı "gerçek moderatör/ban işlemi yapma" dedi | API sözleşmesi (`POST /public/v1/moderation/bans`) mevcut `sendKickMessage` desenine göre yazıldı. Yanlışsa **sessiz kalmaz**: hata panele bildirilir ve uyarı mesajına düşülür |
| L2 | Kick tokenının moderasyon kapsamı | Token OAuth ile alındı; hangi scope'ları taşıdığı bilinmiyor | 401/403 gelirse "Kick tokeni moderasyon yetkisine sahip değil" mesajı verilir |

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

## 4. Bu turda YAPILMAYAN parity maddeleri

`BOTRIX_GAP_ANALYSIS` P2/P3 listesinden kalanlar. Sırası ve gerekçesi
`IMPLEMENTATION_REPORT.md §6`'da.

| Öncelik | Madde | Durum |
|---|---|---|
| P2 | Animasyon motoru (37 ön ayar) | **Yapılmadı** — tasarımı `TARGET_ARCHITECTURE §7`'de hazır |
| P2 | Alert kuyruk durum makinesi | **Yapılmadı** — mevcut `queueEnabled`/`gapMs` ayarları hâlâ motorsuz |
| P2 | Uyarı varyantları | **Yapılmadı** |
| P2 | Metin görünüm penceresi (ms–ms), ayrı üst/alt metin rengi, metin konumu px | **Yapılmadı** |
| P2 | Seviye / XP sistemi (`!level`, `!xp`) | **Yapılmadı** — DB sütunları (`economy.xp`, `economy.level`) göç #4 ile hazır |
| P2 | TTS filtreleri (sayı/sembol/emoji/link yok say, karakter sınırı, bekleme, ton, okuma şablonu, kara liste, min. rol) | **Yapılmadı** |
| P2 | Sohbet tarafı olay mesajları (7 olay + eşikler) | **Yapılmadı** |
| P2 | Medya kütüphanesi (yükleme + boyut sınırı) | **Yapılmadı** — widget medyası hâlâ yalnız URL |
| P2 | Widget tema kütüphanesi (widget başına 10+ tema) | **Yapılmadı** — şu an 4-5 tema |
| P3 | Tahminler (`!bet`), İzleyici kuyruğu, Puan düşüşleri | **Yapılmadı** |
| P3 | Discord duyuru entegrasyonu | **Yapılmadı** |
| P3 | Trovo adaptörü | **Yapılmadı** |
| P3 | Tasarım sistemi, toast, onay diyaloğu, kaydedilmemiş değişiklik uyarısı | **Yapılmadı** |
| P3 | Nightbot içe aktarma, uyarı dışa/içe aktarma | **Yapılmadı** |
| P3 | Panelde moderasyon eylemi ve değişken kataloğu arayüzü | **Yapılmadı** — API uçları hazır (`/api/platforms/capabilities`, `/api/variables`), arayüz bağlanmadı |

---

## 5. Mevcut sistemden devam eden teknik borç

`CURRENT_SYSTEM_AUDIT §18` listesinden bu turda **kapatılmayanlar**:

| # | Borç | Not |
|---|---|---|
| B1 | `routes.ts` 1.900+ satır, tek dosya | Bölme yapılmadı; yeni uçlar da aynı dosyaya eklendi |
| B2 | Widget ayarları şemasız/doğrulamasız | Sunucu hâlâ gelen her JSON'u kabul ediyor |
| B3 | Hype Train / Subathon durumu tarayıcıda | İki OBS kaynağı açılırsa iki farklı sayaç görünür |
| B4 | 75 boş `catch` bloğu | Yalnız dokunduğum yerlerde düzeltildi |
| B5 | Yapılandırılmış log yok | 92 `console.*` duruyor |
| B6 | Tasarım sistemi yok (47 kopya buton) | — |
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

---

## 7. Geri alma

Her şey geri alınabilir. `BACKUP_MANIFEST.md §7`:

```bash
cd "C:\Users\Axthrowa\Desktop\Projeler" && git checkout pre-botrix-revision-20260921-182105 -- .
```

Veritabanı değişiklikleri **eklemeli** (yeni tablo + varsayılanlı yeni sütun);
eski kod yeni şema üstünde sorunsuz çalışır, geri alma veri kaybettirmez.
