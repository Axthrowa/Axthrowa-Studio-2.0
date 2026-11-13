# Platform Yetenek Matrisi ve Politika Kuralları

> İki kaynak birleşiyor: (1) topluluk yetenekleri — AxBoT `server/src/platforms/capabilities.ts` (kodda tek gerçek
> kaynak; arayüz buna göre etiketler); (2) yayın çıkışı gereksinimleri — resmi belgeler (2026-09-25, bkz.
> [REFERENCE_PRODUCT_RESEARCH §3.7](REFERENCE_PRODUCT_RESEARCH.md#37-platform-gereksinimleri-ve-kuralları)).
> Çıkış sınırları ve kurallar kodda sabit değil, **politika tablosunda** tutulur (§131): kural değişince kod
> değişmeden güncellenir.

## 1. Topluluk yetenekleri (AxBoT adaptörleri)

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

## 4. Kick API bağımlılık envanteri

Güncellendi: 2026-11-13, resmi şema [docs.kick.com](https://docs.kick.com) ile karşılaştırıldı (canlı API'ye istek atılmadı).
"Resmi" = `api.kick.com/public` + `id.kick.com` OAuth. "Resmi olmayan" = `kick.com/api/v1|v2` kanal sayfası
ve `web.kick.com` gerçek zamanlı kanalı (Centrifugo, yedeği Pusher); Kick bunları duyurmadan değiştirebilir.

| Özellik | Kod | Uç | Tür | Resmi karşılık |
|---|---|---|---|---|
| Sohbet ve olayları okuma (mesaj, takip, abone, hediye, KICKs, host, ban, temizleme) | bot `platforms/kick-realtime.ts` | `POST web.kick.com/api/v1/realtime/connection` → Centrifugo / Pusher | resmi olmayan | Webhook (`/public/v1/events/subscriptions`): Kick'e açık bir HTTPS adresi ister, yerel uygulamada çalışmaz. **Taşınmadı.** Studio'da webhook aboneliği ucu var (`kick/auth.rs` `subscribe_events`), adres tanımlıysa kullanılır |
| Oda kimliği (gerçek zamanlı kanala abone olmak için) | bot `kick.ts` bağlanma; Studio `kick/mod.rs` `fetch_chatroom` | `kick.com/api/v2/channels/<kanal>` (Studio: v1 → v2 → sayfa) | resmi olmayan | Yok (oda kimliği resmi şemada yok). Gerçek zamanlı kanala bağlı kalır |
| Sohbete yazma | bot `kick.ts` `sendMessage` | `POST /public/v1/chat` | resmi | — (yedek `kick.com/api/v2/messages/send` yalnız resmi uç iki hesapla da başarısızsa) |
| Mesaj silme, zaman aşımı, ban, ban kaldırma | bot `kick.ts`; Studio `kick/auth.rs` | `/public/v1/chat/{id}`, `/public/v1/moderation/bans` | resmi | — |
| Başlık / kategori değiştirme | bot `kick.ts` | `PATCH /public/v1/channels`, `GET /public/v2/categories` | resmi | — |
| Kullanıcı bilgisi (bot hesabı, profil fotoğrafı) | bot `kick.ts`, `api/rotalar/platformlar.ts` | `GET /public/v1/users` | resmi | — (profil fotoğrafı kimlik bilinmezse kanal sayfasına düşer) |
| Yayın durumu (açık mı, izleyici, başlangıç, başlık, kategori) | bot `kick.ts` `yayinDurumu` | `GET /public/v1/users/livestreams?user_id=` | resmi (**T5'te taşındı**) | Token ya da yayıncı kimliği yoksa, uç hata verirse kanal sayfasına düşer. `/public/v1/channels` bilerek kullanılmaz: şemasında yayın anahtarı (`stream.key`) var |
| Hedef kullanıcı kimliği (ban / zaman aşımı için ad → kimlik) | bot `kick.ts` `hedefKimligi` | `GET /public/v1/channels?slug=` | resmi (**T5'te taşındı**) | Yanıttan yalnız `broadcaster_user_id` okunur; hata olursa kanal sayfası |
| Yayıncı kimliği (Studio) | Studio `kick/auth.rs` `broadcaster_user_id_for_slug` | `GET /public/v1/channels?slug=` | resmi | Yedek kanal sayfası; yedekte kanal kimliğinin kullanıcı kimliği sanılması T5'te düzeltildi |
| Takipçi sayısı (takipçi hedefi) | bot `kick.ts` yoklayıcı | `kick.com/api/v2/channels/<kanal>` | resmi olmayan | Yok (resmi kanal şemasında takipçi sayısı yok) |
| Klip | bot `modules/clips/klip.ts` | `kick.com/api/v2/channels/<kanal>[/livestream]` | resmi olmayan | Yok (resmi klip ucu yok) |
| Shoutout kartı (avatar, son oyun) | bot `modules/otomasyon/shoutout.ts` | `kick.com/api/v2/channels/<kanal>` | resmi olmayan | Kısmen: `channels?slug` + `users?id` iki istekle; son oynanan oyun yayın kapalıyken yok. **Taşınmadı**, kart bilgi alınamazsa adıyla çıkar |
| Gönderme öncesi kimlik tazeleme | bot `kick.ts` `sendMessage` | `kick.com/api/v2/channels/<kanal>` | resmi olmayan | Yayıncı kimliği için `channels?slug` var; oda kimliği (v2 yedeği için) yok. Taşınmadı |

Resmi olmayan uç bozulursa: sohbet okuma, takipçi hedefi, klip ve shoutout kartı etkilenir; yazma, moderasyon,
başlık/kategori ve yayın durumu (token varken) etkilenmez.
