# Platform marka varlıkları denetimi

**Kullanıcı kararı (2026-09-26):** platform logoları indirilmez ve kullanılmaz; **nötr simge + ad**.

| Platform | Arayüzde | Logo / renk / yazı karakteri | Not |
|---|---|---|---|
| Twitch | "Twitch" metni + baş harf rozeti (T) | kullanılmıyor | ad yalnız platformu tanıtmak için (tanımlayıcı kullanım) |
| YouTube | "YouTube" + (Y) | kullanılmıyor | |
| Kick | "Kick" + (K) | kullanılmıyor | |
| Özel RTMP | "Özel RTMP" + (Ö) | — | |
| OBS Studio | "OBS" adı yalnız uyumluluğu anlatırken | OBS logosu, simgeleri, QSS'i kullanılmıyor | [ADR-004](OBS_LICENSE_ARCHITECTURE_DECISION.md) |

- Rozet: `dt-platform-simge` (daire içinde baş harf, nötr renk). Kaynak kodda ya da pakette hiçbir platform görseli
  yoktur; ağdan görsel indirilmez.
- Platformların marka kılavuzları bu sürümde okunmadı; logo kullanılmadığı için gerekmedi. Logo eklenirse önce her
  platformun resmi marka kılavuzu okunmalı ve izin/kullanım koşulları belgelenmelidir.
