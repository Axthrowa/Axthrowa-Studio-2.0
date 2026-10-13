# BOTRIX ALERT MATRIX

> **GÜNCELLİK NOTU (2026-09-22):** Bu belge **BotRix'in** uyarı matrisidir; araştırma kaydı olarak değişmedi. Bizim tarafımızda 38 animasyon ön ayarı (`client/src/lib/animations.ts`), 6 metin efekti ve eşik/ağırlıklı varyant seçimi uygulandı — [`BOTRIX_GAP_ANALYSIS §13 · P2`](BOTRIX_GAP_ANALYSIS.md).

**Kaynak:** `botrix.live/panel/alerts` — `OBSERVED_IN_UI` (2026-09-21)
**Hesap:** ücretsiz plan, Kick bağlı
**Not:** BotRix kodu kopyalanmadı; yalnız gözlemlenen ayar yüzeyi kaydedildi.

---

## 1. Olay türleri

### 1.1 Yapılandırma sekmeleri (6) — `OBSERVED_IN_UI`

Panelde her biri için **ayrı bir ayar sekmesi** ve **ayrı bir test düğmesi** var:

| # | Sekme | Test düğmesi |
|---|---|---|
| 1 | Abonelik | ✅ |
| 2 | Hediye abonelik | ✅ |
| 3 | Takipçiler | ✅ |
| 4 | Host | ✅ |
| 5 | KICKs | ✅ |
| 6 | Bağış | ✅ |

### 1.2 Gelişmiş ayarlardaki tam olay listesi (11) — `OBSERVED_IN_UI`

"Gelişmiş ayarlar" yalnız seçilen uyarıları içeren **filtrelenmiş bir widget
URL'i** üretiyor. Buradaki onay kutuları BotRix'in desteklediği tam olay
kümesini gösteriyor:

| # | Olay | Platform |
|---|---|---|
| 1 | Abonelikler | Twitch / Kick |
| 2 | Hediye abonelikler | Twitch / Kick |
| 3 | Takipçiler / YouTube abonelikleri | tümü |
| 4 | Raid / Host | Twitch / Kick |
| 5 | Bağış | tümü |
| 6 | **Bits** | Twitch |
| 7 | **KICKs** | Kick |
| 8 | **Super Chat** | YouTube |
| 9 | **Jewels** | — |
| 10 | **Üyeler** (ücretli YouTube üyelikleri) | YouTube |
| 11 | **Hediye üyeler** | YouTube |

> Sekme sayısı (6) ile olay sayısı (11) farklı: Bits/Super Chat/Jewels/Üyeler
> muhtemelen "Bağış" ve "Abonelik" sekmelerinin altında normalize ediliyor.
> Bu eşleme `INFERRED`, doğrulanmadı.

### 1.3 Sohbet tarafı olayları (ayrı sistem) — `OBSERVED_IN_UI`

`Sohbet Botu > Ekstralar > Sohbet uyarıları` — görsel overlay'den **bağımsız**,
sohbete metin mesajı gönderen ayrı bir sistem:

| Olay | Ek eşik |
|---|---|
| Takip | — |
| KICKs | **Minimum tutar** |
| Abonelik | — |
| **Yeniden abonelik** | — |
| Hediye abonelik | — |
| Host | **Minimum izleyici** |
| **Karşılama** (ilk kez yazan) | Premium |

> "Uyarı yalnızca etkinlik değeri bu minimuma ulaşırsa gönderilir."

---

## 2. Olay başına ayar matrisi — `OBSERVED_IN_UI`

Altı sekmenin tamamı aynı ayar kümesini sunuyor (olaya göre bazı alanların
anlamı değişiyor, ör. Bağış'ta tutar değişkenleri).

| Ayar | Tip | Değerler / aralık |
|---|---|---|
| **Etkin uyarı** | anahtar | açık/kapalı |
| **Stil** | seçim | `Compact` · `Legacy` |
| **Yerleşim** | seçim | (görsel/metin yerleşimi) |
| **Uyarı süresi** | sayı | saniye |
| **Animasyon** | seçim | **37 seçenek** (§3) |
| **Görsel** | medya | resim/GIF/video yükleme |
| **Ses** | medya | ses dosyası |
| **Ses düzeyi** | sayı | % |
| **Ses (TTS)** | seçim | **50 seçenek** — `Ninguno (Desactivar TTS)` + 49 dil/yerel |
| **Mesaj** | metin | şablon |
| **Üst metin rengi** | renk | — |
| **Alt metin rengi** | renk | — |
| **Kullanıcı mesajını gizle** | anahtar | — |
| **Metin gölgesi** | sayı | % |
| **Tipografi** | seçim | yazı tipi |
| **Metnin dikey konumu** | sayı | px |
| **Metnin yatay konumu** | sayı | px |
| **Metin animasyonu** | seçim | `Wiggle` `Wave` `Shine` `Skew` `Elastic` `None` |
| **Yazı boyutu** | sayı | px |
| **Metin** | metin | — |
| **Metin görünümü** | aralık | **`ms` – `ms`** (metin başlangıç/bitiş penceresi) |
| **Uyarı varyantları** | liste | `Ekle` · ücretsiz **5**, premium **25** |

### Sayfa düzeyi eylemler

| Eylem | Açıklama |
|---|---|
| `Gelişmiş ayarlar` | Filtrelenmiş widget URL'i üretir |
| `Özel kod` | HTML/CSS/JSON ile kendi uyarı tasarımı |
| `Bu uyarıyı dışa aktar` | Tek uyarıyı dışa aktar |
| `Uyarıları içe aktar` | Toplu içe aktarma |
| `Değişiklikleri kaydet` | Açık kaydetme |
| Test düğmeleri (6) | "Uyarıları denemek için aşağıdaki butonları kullan" |

---

## 3. Animasyon kataloğu — `OBSERVED_IN_UI`

### 3.1 Giriş animasyonları (37)

| Grup | Seçenekler |
|---|---|
| **Yok** | `None` |
| **Fade (11)** | `Fade` · `Fade Down` · `Fade Down Big` · `Fade Left` · `Fade Left Big` · `Fade Right` · `Fade Right Big` · `Fade Up` · `Fade Up Big` · `Fade Top Left` · `Fade Top Right` · `Fade Bottom Left` · `Fade Bottom Right` |
| **Slide (4)** | `Slide Up` · `Slide Down` · `Slide Left` · `Slide Right` |
| **Zoom (5)** | `Zoom` · `Zoom Down` · `Zoom Left` · `Zoom Right` · `Zoom Up` |
| **Rotate (5)** | `Rotate` · `Rotate Down Left` · `Rotate Down Right` · `Rotate Up Left` · `Rotate Up Right` |
| **Flip (2)** | `Flip X` · `Flip Y` |
| **Bounce (5)** | `Bounce` · `Bounce Right` · `Bounce Left` · `Bounce Up` · `Bounce Down` |
| **Back (4)** | `Back Down` · `Back Up` · `Back Right` · `Back Left` |

> Adlandırma `animate.css` ailesiyle örtüşüyor (`fadeInDownBig`,
> `backInLeft`, `rotateInDownLeft`…). Bu bir **isimlendirme benzerliği**
> gözlemi; BotRix'in hangi kütüphaneyi kullandığı doğrulanmadı — `INFERRED`.
> Bizim uygulamamız kendi CSS ön ayarlarını yazacak.

### 3.2 Metin animasyonları (6)
`Wiggle` · `Wave` · `Shine` · `Skew` · `Elastic` · `None`

### 3.3 Çıkış animasyonu
**Ayrı bir çıkış animasyonu seçeneği gözlemlenmedi.** Tek "Animasyon"
alanı var; çıkışın girişin tersi olduğu veya sabit olduğu `INFERRED`.

### 3.4 Zamanlama
- **Uyarı süresi** (saniye) — uyarının toplam ekranda kalma süresi
- **Metin görünümü** `ms` – `ms` — metnin görünür olduğu **alt pencere**;
  görsel/ses ile metin senkronizasyonu böyle kuruluyor

### 3.5 Kare kare gözlem — `UNVERIFIED`
Test düğmeleri paneli değil, **gizli token taşıyan widget URL'ini**
tetikliyor. O URL açılmadığı için animasyonların gerçek süresi, easing
eğrisi ve eleman giriş sırası **ölçülmedi**. Yalnız katalog alındı.

---

## 4. Kuyruk davranışı — `UNVERIFIED`

Panelde **kuyruk, öncelik, yinelenen olay veya bekleme süresi ayarı
gözlemlenmedi**. Aktivite Akışı widget'ının açıklamasında "uyarıyı tekrar
etmeyi ve widget'ı yönetmeyi sağlar (sessiz, duraklat, atla)" geçiyor — bu
bir kuyruk kontrolüne işaret ediyor ama ayar yüzeyi görülmedi.

BotRix'in kuyruk stratejisi (sıralı mı, çakışmalı mı) doğrulanmadı.

---

## 5. Medya kısıtları — `OBSERVED_IN_UI`

| Kısıt | Ücretsiz | Premium |
|---|---|---|
| Uyarı başına maksimum dosya boyutu | **5 MB** | **50 MB** |
| Uyarı türü başına varyant | **5** | **25** |
| Cloud TTS kullanımı | 400/ay · 100/hafta | Sınırsız |

---

## 6. Özel kod arayüzü — `CONFIRMED_IN_PUBLIC_DOCS`

Uyarı tasarımı HTML/CSS ile tamamen değiştirilebiliyor.

**Veri değişkenleri:** `{name}` `{text}` `{sound}` `{image}` `{amount}` `{message}`
**Kalıp/sınıf değişkenleri:** `{disposition}` `{transition}` `{img}` `{animation}`

Belgelerdeki iskelet, uyarının üç katmanlı olduğunu gösteriyor:
`container` → `alert-media-container` → `alert-text-container`
(`line1` = üst metin, `line2` = ad, `custom-message` = izleyici mesajı).

Bu, paneldeki **Üst metin rengi / Alt metin rengi / Kullanıcı mesajını
gizle** ayarlarıyla birebir örtüşüyor — üç ayrı metin katmanı var.

---

## 7. Bizim sistemimizle karşılaştırma

| Ayar | BotRix | StreamAxT | Durum |
|---|---|---|---|
| Olay türü sayısı | 11 | 8 | `PARTIAL` |
| Olay başına etkin/pasif | ✅ | ✅ (`is_enabled`) | `EXISTING` |
| Mesaj şablonu | ✅ | ✅ (`title_template`, `message_template`) | `EXISTING` |
| Görsel | ✅ yükleme | ⚠️ yalnız URL | `PARTIAL` |
| Ses | ✅ yükleme | ⚠️ yalnız URL | `PARTIAL` |
| Ses düzeyi | ✅ | ✅ (`sound_volume`) | `EXISTING` |
| Süre | ✅ | ✅ (`duration_ms`) | `EXISTING` |
| **Giriş animasyonu** | **37** | ~9 | `PARTIAL` |
| **Metin animasyonu** | 6 | 6 (`textEffect`) | `EXISTING` |
| Stil (Compact/Legacy) | ✅ | ❌ | `MISSING` |
| Yerleşim | ✅ | ✅ (`layout_mode`) | `EXISTING` |
| **Üst/alt metin rengi ayrı** | ✅ | ❌ tek renk | `MISSING` |
| Tipografi | ✅ | ✅ (`font_family`) | `EXISTING` |
| **Metin konumu (px)** | ✅ dikey+yatay | ❌ | `MISSING` |
| **Metin gölgesi %** | ✅ | ❌ | `MISSING` |
| Yazı boyutu | ✅ | ❌ | `MISSING` |
| **Metin görünüm penceresi (ms–ms)** | ✅ | ❌ | `MISSING` |
| **Kullanıcı mesajını gizle** | ✅ | ❌ | `MISSING` |
| **Uyarı başına TTS sesi** | ✅ 50 dil | ❌ (genel TTS var) | `MISSING` |
| **Varyantlar** | ✅ 5/25 | ❌ | `MISSING` |
| **Özel kod (HTML/CSS)** | ✅ | ❌ | `MISSING` |
| **Dışa/içe aktarma** | ✅ | ❌ | `MISSING` |
| Test düğmesi | ✅ 6 | ✅ | `EXISTING` |
| **Filtrelenmiş widget URL'i** | ✅ | ❌ | `MISSING` |
| **Kuyruk** | `UNVERIFIED` | ⚠️ ayar var, motor yok | `NEEDS_REFACTOR` |
| **Sohbet tarafı olay mesajı** | ✅ 7 olay + eşik | ❌ | `MISSING` |
