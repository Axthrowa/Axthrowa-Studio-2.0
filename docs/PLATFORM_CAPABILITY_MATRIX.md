# Platform Yetenek Matrisi ve Politika Kuralları

> İki kaynak birleşiyor: (1) topluluk yetenekleri — StreamAxT `server/src/platforms/capabilities.ts` (kodda tek gerçek
> kaynak; arayüz buna göre etiketler); (2) yayın çıkışı gereksinimleri — resmi belgeler (2026-09-25, bkz.
> [REFERENCE_PRODUCT_RESEARCH §3.7](REFERENCE_PRODUCT_RESEARCH.md#37-platform-gereksinimleri-ve-kuralları)).
> Çıkış sınırları ve kurallar kodda sabit değil, **politika tablosunda** tutulur (§131): kural değişince kod
> değişmeden güncellenir.

## 1. Topluluk yetenekleri (StreamAxT adaptörleri)

| Yetenek | Kick | Twitch | YouTube | Trovo | TikTok | Discord |
|---|---|---|---|---|---|---|
| Sohbet oku | ✓ | ✓ | ✓ | ✓ | ✓ (resmi olmayan) | ✓ |
| Sohbet gönder | ✓ | ✓ | ✓ | ✓ | ✗ (resmi API yok) | ✓ |
| Takip | ✓ | ✓ | — | ✓ | ✓ | — |
| Abonelik / hediye abonelik | ✓ / ✓ | ✓ / ✓ (+resub) | üyelik | ✓ / ✓ | — | — |
| Bağış / bits / KICKs / super chat | KICKs | bits, tip | super chat, tip | tip | hediye | — |
| Raid / host | host | raid | — | raid | — | — |
| Mesaj sil | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Sohbet modları (yavaş / takipçi / abone / emote) | ✗ (resmi API yok) | ✓ Helix `PATCH /chat/settings` | ✗ (resmi API yok) | ✗ | ✗ | — |
| Zaman aşımı | ✓ | ✓ | ✓ | ✗ (süre birimi belgesiz) | ✗ | ✓ (≤ 28 gün) |
| Kalıcı ban / kaldırma | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Başlık değiştir | ✓ | ✓ | ✓ | ✓ | ✗ | — |
| Kategori değiştir | ✓ | ✓ | ✗ (API sınırı) | ✗ | ✗ | — |
| İzleyici sayısı | ✓ | ✓ | ✓ | ✗ | ✗ | — |
| Anket / tahmin | `UNVERIFIED` (API var mı?) | Twitch API (Affiliate/Partner) — **uygulanmadı** | ✗ | ✗ | ✗ | — |
| Reklam çalıştır / ertele | ✗ | Twitch API — **uygulanmadı** | ✗ | ✗ | ✗ | — |

Arayüz kuralı (§51, §82): her moderasyon/yayın eylemi çalıştırılmadan önce yetenek denetimi yapılır; desteklenmeyen
eylem gizlenmez, **devre dışı + neden** gösterilir.

## 2. Yayın çıkışı gereksinimleri

| Platform | Protokol | Video kodek | En yüksek | Bit hızı | Anahtar kare | Ses | Kaynak |
|---|---|---|---|---|---|---|---|
| Kick | **RTMPS** | yalnız H.264 | 1920×1080, 60 fps | ≤ 8000 kbps, **CBR zorunlu** | 2 sn | stereo, ≤ 48 kHz | `CONFIRMED_IN_OFFICIAL_DOCS` |
| YouTube | RTMP/RTMPS (HLS alternatif) | H.264, HEVC, AV1 (AV1'de HDR yok) | 2160p, 60 fps | 1080p60 H.264 için 12 Mbps önerisi | 2 sn (≤ 4) | AAC/MP3, 128 kbps stereo | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Twitch | RTMP/RTMPS; Enhanced Broadcasting (çoklu iz) | H.264; 2K için HEVC | 1440p (Partner/Affiliate, HEVC) | 1440p ≤ 9 Mbps, 1080p ≤ 7.5 Mbps (2K yayın notu) | `UNVERIFIED` (2 sn yaygın) | `UNVERIFIED` | `CONFIRMED_IN_OFFICIAL_DOCS` (blog) |
| Twitch Dual Format | Enhanced Broadcasting + ek (dikey) tuval | — | dikey 720×1280 veya 1080×1920 | ≈ 12.5 Mbps (1080p dual format, istemci) | — | — | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| Özel RTMP(S) | RTMP/RTMPS | hedefe bağlı | — | — | — | — | — |

## 3. Politika kuralları (yapılandırılabilir)

Kural kaydı: `{id, platform, koşul, seviye (bilgi/uyarı/engel), mesaj, kaynak, doğrulama tarihi, sınıf}`.
Varsayılanlar uygulamayla gelir; kullanıcı ayarındaki `policyOverrides` ile güncellenebilir.

| Kural | Seviye | Koşul | Kaynak / sınıf |
|---|---|---|---|
| `kick.codec.h264` | engel | Kick hedefi etkin ve kodlayıcı H.264 değil | Kick yardım, `CONFIRMED` |
| `kick.bitrate.max` | engel | video bit hızı > 8000 kbps | Kick yardım, `CONFIRMED` |
| `kick.ratecontrol.cbr` | uyarı | hız denetimi CBR değil | Kick yardım, `CONFIRMED` |
| `kick.resolution.max` | uyarı | çıkış > 1920×1080 veya > 60 fps | Kick yardım, `CONFIRMED` |
| `kick.protocol.rtmps` | engel | hedef URL `rtmps://` değil | Kick yardım, `CONFIRMED` |
| `youtube.keyframe` | uyarı | anahtar kare > 4 sn | YouTube, `CONFIRMED` |
| `common.keyframe.2s` | bilgi | anahtar kare 2 sn değil | Kick + YouTube önerisi |
| `twitch.simulcast.quality_parity` | uyarı | Twitch + başka hedef; Twitch'in aldığı kalite diğerlerinden düşük (tek kodlamada eşit) | Twitch SSS, `özet` |
| `twitch.simulcast.combined_activity` | uyarı | Twitch + başka hedef canlı **ve** birleşik (çok platformlu) sohbet overlay'i ya da çapraz sohbet aktarımı açık | Twitch yazılı şartlar 2026-07-15, `özet`, **değişken kural** |
| `twitch.simulcast.exclusive` | bilgi | Twitch hedefi + başka hedef — özel sözleşmeli yayıncılar eşzamanlı yayın yapamaz | Twitch SSS, `özet` |

Engel seviyesi GO LIVE'ı o hedef için durdurur (diğer hedefler başlar); uyarı yayını durdurmaz ama kontrol listesinde
kalır. Kurallar **hukuki tavsiye değildir**; kaynak ve doğrulama tarihi her uyarıda gösterilir.
