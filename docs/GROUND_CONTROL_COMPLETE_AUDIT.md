# StreamElements Ground Control — Özellik Envanteri

> Ground Control, yayını yöneten bir masaüstü "kontrol merkezi"dir (Windows ve macOS x86). Uygulama kurulmadı /
> açılmadı (hesaplı masaüstü uygulaması). 2026-09-26'da resmi destek makalesi Chrome ile tam metin okundu (§9). Kaynaklar: resmi ürün sayfası
> (`streamelements.com/groundcontrol`, okundu), destek makalesi ve blog (403 → arama özeti), resmi X duyuruları (özet).

Sınıflar: [REFERENCE_PRODUCT_RESEARCH §1](REFERENCE_PRODUCT_RESEARCH.md#1-kaynak-sınıflandırması)

## 1. Genel özellikler

| Özellik | Sınıf |
|---|---|
| "Tüm StreamElements araçlarını" tek arayüzde toplayan uygulama | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Windows ve macOS (x86) indirmesi | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Özelleştirilebilir yerleşim: sürükle-bırak panel düzenleme, sezgisel yeniden boyutlandırma | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Çok platformlu sohbet: Twitch, YouTube, X; (2.0 duyurusu: Trovo); sonraki güncelleme: **Kick çoklu sohbet** | `CONFIRMED_IN_OFFICIAL_DOCS` + `özet` |
| Çok platformlu etkinlik akışı: takip, abonelik, bağış, üyelik; sonra Kick etkinlikleri | `CONFIRMED_IN_OFFICIAL_DOCS` + `özet` |
| Hızlı eylemler: uyarıları duraklat / sustur, reklamı ertele | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Stream Deck: yerleşik destek, "hızlı eylem tuş atamaları"; Sustur, Duraklat, Uyarı Atla | `CONFIRMED_IN_OFFICIAL_DOCS` + `özet` |
| Sohbet botu komutları, sayaçlar, modüller, değişkenler uygulama içinden | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| Sohbet botu **zamanlayıcıları aç/kapa** | `CONFIRMED_IN_OFFICIAL_DOCS (özet — resmi X)` |
| **Sıradaki uyarıları duraklat / oynat** | `CONFIRMED_IN_OFFICIAL_DOCS (özet — resmi X)` |
| **Yayın öncesi kontrol listesi (Pre-Flight Checklist)** | `CONFIRMED_IN_OFFICIAL_DOCS (özet — resmi X)` |
| **Çok kullanıcılı**: ekip çapında gerçek zamanlı uyarı kuyruğu yönetimi, tek tıkla tahmin, moderatörler için özellikler | `CONFIRMED_IN_OFFICIAL_DOCS` + `özet` |
| Twitch'e özel: başlık ve kategori için Hızlı Ayarlar, gerçek zamanlı yayın önizlemesi, anket ve tahmin (Affiliate/Partner) | `CONFIRMED_IN_OFFICIAL_DOCS` |

## 2. Yerleşim motoru (görev §7 soruları)

| Soru | Durum |
|---|---|
| Hangi paneller eklenebiliyor? | Sohbet, etkinlik akışı, hızlı eylemler, önizleme, bot yönetimi (belgelenen işlevler) — tam panel listesi `UNVERIFIED` |
| Panel boyutu / sürükleme | `CONFIRMED_IN_OFFICIAL_DOCS` (sürükle-bırak, yeniden boyutlandırma) |
| Yuvalama / ayırma (undock), gizleme, yeniden sıralama | `UNVERIFIED` |
| Hazır ayarlar, yerleşimi kaydet / sıfırla, birden çok çalışma alanı | `UNVERIFIED` |
| Çok monitör | `UNVERIFIED` |

**Bizim tasarım:** Docking Workspace Engine — sürükle, bırak, yeniden boyutlandır, yuvala/ayır (ayrı pencere),
küçült, gizle, sekme yığını, kalıcı yerleşim, hazır profiller ([CONTROL_CENTER_ARCHITECTURE](CONTROL_CENTER_ARCHITECTURE.md)).

## 3. Çok platformlu sohbet

| Konu | Durum |
|---|---|
| Platformların tek sohbette birleşmesi | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Platform rozetleri, mesaj biçimi, yanıt, moderasyon eylemleri, arama, zaman damgası, bahsetmeler, filtreler, yavaş kip benzeri denetimler | `UNVERIFIED` |

## 4. Etkinlik akışı

| Konu | Durum |
|---|---|
| Takip, abonelik, bağış (tip), üyelik; Kick etkinlikleri | `CONFIRMED_IN_OFFICIAL_DOCS` + `özet` |
| Kalem ayrıntısı (platform, tür, kullanıcı, miktar, zaman), hızlı eylem, genişletilmiş ayrıntı, moderatör durumu | `UNVERIFIED` |

## 5. Moderatör deneyimi

| Konu | Durum |
|---|---|
| Moderatör ve yayıncı aynı sistemi kullanıyor; ekip çapında gerçek zamanlı uyarı kuyruğu | `CONFIRMED_IN_OFFICIAL_DOCS` |
| İzinler, rol kapsamları, ortak eylemler, denetim günlüğü, çakışma çözümü | `UNVERIFIED` |

**Bizim tasarım:** Moderator Control Center — kapsamlı roller (Owner, Producer, Moderator, Chat Moderator, Technical
Operator, Guest Operator, özel), eylem başına izin, denetim günlüğü, iyimser kilitleme ile paylaşılan uyarı kuyruğu
([CONTROL_CENTER_ARCHITECTURE](CONTROL_CENTER_ARCHITECTURE.md)).

## 6. Hızlı eylemler

Ayrı belge: [GROUND_CONTROL_QUICK_ACTION_MATRIX.md](GROUND_CONTROL_QUICK_ACTION_MATRIX.md).

## 7. Alınacak asıl ders

Yayını **üreten** motor (Broadcast) ile yayını **yöneten** iş akışı (Control Center) ve topluluğu yöneten
(Moderator) ayrı yüzeylerdir; aynı durumu paylaşırlar. Kontrol merkezi yavaşlasa bile yayın hattı etkilenmemelidir.

## 8. Güncelleme — 2026-09-26

- Uygulama bu turda da açılamadı (`NOT_ACCESSIBLE`: masaüstü uygulaması; kullanıcının makinesinde arayüz otomasyonu
  yapılmıyor, tarayıcı eklentisi bağlı değil). Bu yüzden panel/yerleşim ayrıntıları önceki bölümlerdeki resmi
  kaynaklarla sınırlı.
- Yeni resmi kanıt (`CONFIRMED_OFFICIAL_DOCS (başlık)`): StreamElements'in resmi YouTube kanalında "yeni Ground
  Control özelliği: **yayın öncesi kontrol listeleri**" duyurusu — içerik ayrıntısı `UNVERIFIED`.
- Resmi ürün sayfası ve duyurular (`CONFIRMED_OFFICIAL_DOCS`): tek sohbette Twitch, YouTube ve X; çok platformlu
  etkinlik akışı (takip, abone, bağış, üyelik…); uyarı duraklat/sustur, reklam erteleme; Stream Deck hızlı eylem
  bağları; **ekip çapında gerçek zamanlı uyarı kuyruğu yönetimi**, tek tıkla tahmin; sürükle-bırak panel düzeni ve
  yeniden boyutlandırma.
- Bizdeki karşılıklar bu turda: uyarı kuyruğu (ekip çapında, sürüm kilitli), yayın öncesi kontrol, Kontrol Merkezi
  düzeni, evrensel sohbet ve etkinlik akışı panelleri, eylem kayıt defteri — durumları
  [REFERENCE_FEATURE_MATRIX](REFERENCE_FEATURE_MATRIX.md).

## 9. Güncelleme — 2026-09-26: resmi destek makalesi (Chrome ile tam metin)

Kaynak: `support.streamelements.com` "Ground Control" makalesi (sürüm 2.0.5 notları dahil). Sınıf:
`CONFIRMED_OFFICIAL_DOCS`; kendi sözcüklerimizle özet.

| Özellik | Belgede | Bizde (2026-09-26) |
|---|---|---|
| Özelleştirilebilir yerleşim | sürükle-bırak panel, yeniden boyutlandırma | Kontrol Merkezi: gizle/sırala/genişlik/hazır profil (bölme ağacı yok) |
| Çoklu sohbet | Twitch, YouTube, Trovo, X; 2.0.5'te yazı boyutu ayarı | Evrensel sohbet: Kick/Twitch/YouTube + StreamAxT (Trovo/Discord/TikTok); yazı boyutu ayarı **yok** |
| Çok platformlu etkinlik akışı | takip, abone, bahşiş, üyelik; 2.0.5'te platform başına birden çok akış | tek tekilleştirilmiş akış + filtre; platform başına ayrı akış **yok** |
| Hızlı eylemler | uyarı duraklat/sustur, reklam erteleme | eylem kayıt defteri (18 eylem); reklam erteleme **yok** (platform API'si) |
| Stream Deck | yerel Elgato entegrasyonu | Kontrol destesi (yazılım) + HTTP ucu; yerel Elgato eklentisi PLANNED |
| Moderatörler | ekip çapında uyarılar, gerçek zamanlı kuyruk eylemleri, tek tıkla tahmin | ekip çapında uyarı kuyruğu (sürüm kilitli, denetimli) var; tahmin **yok** |
| Komut düzenleme (2.0.5) | uygulamadan çıkmadan komut düzenleme | StreamAxT komut sayfaları (ayrı sekme) |
| Üst metrikleri gizleme (2.0.5) | var | Kontrol Merkezi'nde panel gizleme |
| Topluluk içgörüleri | 30 günlük topluluklar arası izleyici etkinliği; ilk kez destek verenler için bildirim | **yok** (topluluklar arası veri bizde yok ve toplanmayacak) |
| Yalnız Twitch | hızlı ayarlar (başlık/kategori), yayın önizlemesi, anket/tahmin (Affiliate/Partner) | başlık/kategori StreamAxT'te; Twitch sohbet modları (yavaş/takipçi/abone/emote) bu tur eklendi |
