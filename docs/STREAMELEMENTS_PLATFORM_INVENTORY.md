# StreamElements Web Platformu — Envanter ve Farklar

> Kaynak: `docs.streamelements.com` (okundu). Hesaplı panel bu turda gözlenemedi (Chrome bağlı değil) →
> panel ayrıntıları `UNVERIFIED`. Yetkisiz kazıma veya tescilli dışa aktarma çözümlemesi YAPILMADI.

Sınıflar: [REFERENCE_PRODUCT_RESEARCH §1](REFERENCE_PRODUCT_RESEARCH.md#1-kaynak-sınıflandırması)

## 1. Overlay ve widget'lar

| Özellik | Sınıf | Ayrıntı |
|---|---|---|
| Overlay Editor içinde özel widget: **HTML, CSS, JavaScript, Fields, Data** sekmeleri | `CONFIRMED_IN_OFFICIAL_DOCS` | Kod editörün kum havuzunda çalışır |
| Fields: JSON ile tanımlı alanlar (metin, sayı, açılır liste, anahtar, gizli…) | `CONFIRMED_IN_OFFICIAL_DOCS` | Kod değiştirmeden yapılandırma |
| `SE_API.store` — hesap genelinde kalıcı anahtar-değer; aynı anahtarı kullanan widget'lar veriyi paylaşır; kısmi güncelleme yok, anahtar silinemez | `CONFIRMED_IN_OFFICIAL_DOCS` | |
| `SE_API.counters`, `sanitize` (küfür filtresi), `cheerFilter`, `getOverlayStatus` (editör kipi + sessiz durumu), `setField` (kalıcı değil), **`resumeQueue`** | `CONFIRMED_IN_OFFICIAL_DOCS` | |
| Kuyruk: `widgetDuration` en uzun bekleme süresi (çakışmayı önler); animasyon erken biterse `resumeQueue()` | `CONFIRMED_IN_OFFICIAL_DOCS` | "Dinamik" kuyruk |
| Güvenlik: `document.cookie` ve IndexedDB erişimi yok | `CONFIRMED_IN_OFFICIAL_DOCS` | |
| `onWidgetLoad`: alan değerleri, kanal bilgisi (**apiToken dahil**), oturum verisi | `CONFIRMED_IN_OFFICIAL_DOCS` | Bizde widget'a hesap tokenı verilmeyecek |
| Olaylar (`onEventReceived`): follower/subscriber/host/cheer/**kicks**/tip/raid-latest, `message`, `delete-message`, `delete-messages`, **`event:skip`** (uyarı atla düğmesi), **`alertService:toggleSound`** (uyarıları sustur), `bot:counter`, `kvstore:update`, `widget-button` | `CONFIRMED_IN_OFFICIAL_DOCS` | Kuyruk denetimi olay olarak widget'a ulaşıyor |
| AlertBox, hazır overlay paketleri, overlay tarayıcı kaynağı | `INFERRED` (ürünün bilinen parçaları) | ayrıntı `UNVERIFIED` |

## 2. Sohbet botu ve topluluk

| Özellik | Sınıf |
|---|---|
| Komutlar, zamanlayıcılar, modüller, spam filtreleri, sayaçlar, değişkenler | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` (Ground Control 2.0 bunları yönetir) |
| Sadakat puanları, çekilişler, yarışmalar, izleyici kuyruğu, şarkı isteği, bağış (tipping), liderlik tabloları, sohbet uyarıları, etkinlik akışı | `INFERRED` (platformun bilinen modülleri) — ayrıntı `UNVERIFIED` |

## 3. Bizim sistemle (AxBoT + panel) farklar

| Konu | StreamElements | Bizde | Değerlendirme |
|---|---|---|---|
| Özel widget SDK'sı | HTML/CSS/JS + Fields + SE_API, kum havuzu | Yok (hazır React widget'ları) | **Eksik** — güvenli kum havuzlu SDK tasarlanacak (sandbox iframe, `postMessage` köprüsü, alan şeması, izin kapsamlı API) |
| Widget'a verilen kimlik | apiToken | Widget URL'lerinde OAuth tokenı yok (kullanıcı kuralı) | Bizim yaklaşım daha güvenli; kapsamlı widget tokenı planlanacak |
| Kuyruk denetimi (atla, sustur, devam) | Olay + API | AxBoT'ta kuyruk var, **denetim yok** | **Eksik** — P1 |
| Paylaşılan anahtar-değer deposu | `SE_API.store` | AxBoT sayaç/değişkenleri | Kısmi |
| Küfür süzgeci API'si | `sanitize` | AxBoT AutoMod + TTS filtresi | Var (widget API'si olarak yok) |
| Kick "KICKs" olayı | var | var (AxBoT) | Eşdeğer |
| Çoklu platform etkinlik akışı | var | AxBoT `stream_events` + widget | Kısmi |

## 4. Ürüne alınacaklar (seçici — hepsini körlemesine değil)

1. **Kuyruk denetimi olayları** (`skip`, `mute`, `pause/resume`) — widget'lara ve Control Center'a aynı olayla.
2. **Alan şemalı widget yapılandırması** — mevcut widget ayar formlarını ortak şemaya taşımak.
3. **Kum havuzlu özel widget** — sır içermeyen, izin kapsamlı API (P3; güvenlik incelemesiyle).
4. `widgetDuration` benzeri **en uzun süre + erken bitirme** — uyarı durum makinesinde `exiting → complete`.
