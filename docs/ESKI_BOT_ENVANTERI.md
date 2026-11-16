# Eski Studio botu envanteri (TEK-2)

Son doğrulama: 2026-11-16 · Plan 3, TEK-2

Studio'nun Rust sunucusunda AxBoT'tan önceki bot katmanı duruyordu: `src-tauri/src/server/bot_api.rs`, `src-tauri/src/db/bot_api.rs`, `src-tauri/src/bot/` ve arayüzde `src/lib/api/botApi.ts`. Her `/api/bot/*` ucunun çağıranı depoda arandı: Studio `src/`, `axbot/client`, `axbot/server`, `resonance/src`, `streamdeck/` ve Rust testleri. Yardımcı üzerinden (`botApi.x()`) yapılan çağrılar da sayıldı.

## Sonuç

- **Kaldırıldı:** çağıranı olmayan 29 uç, 49 işleyici, 34 veritabanı işlevi, 6 model. Toplam yaklaşık 2.600 satır (Rust 2.500, `botApi.ts` 96).
- **Kalan uçların hepsinin çağıranı var.** AxBoT'a yönlendirilmesi gerekenler aşağıda "AxBoT karşılığı" sütununda. Çoğu Studio'nun kendi widget sistemine bağlı, bu yüzden WID-0 ile birlikte taşınır.
- `src-tauri/src/bot/` hâlâ çalışıyor (`SohbetEklentisi`). Kick tarafı yalnız kanal adını ve oda kimliğini tutar. Twitch tarafı sohbeti anonim okur: sohbet sayımı, Studio sohbet katmanı, emote kombosu ve Studio widget komutları (`!oy`, `!katil`, `!sr`). Komut, filtre ve market yan etkisi yok (`tests/eski_bot_kapali.rs`). WID-0'dan sonra yalnız sohbet sayımı ve Studio'ya özgü katmanlar için kalır.

## Kaldırılan uçlar

| Uç | Neden kaldırıldı | AxBoT'taki karşılığı |
| --- | --- | --- |
| `/api/bot/commands`, `/timers`, `/filters` | Arayüzde çağıran yok; komut motoru Rust'ta çalışmıyor | Komutlar, Zamanlayıcılar, Moderasyon sayfaları |
| `/api/bot/loyalty/users`, `/loyalty/settings`, `/loyalty/adjust`, `/loyalty/reset`, `/shop` | Çağıran yok | Ekonomi ve market |
| `/api/bot/games/*` (settings, heist, duel, roulette, 8ball) | Çağıran yok | Sohbet oyunları |
| `/api/bot/goals`, `/widgets/test`, `/alerts/queue`, `/soundboard` | Çağıran yok | Hedef widget'ı, uyarı kuyruğu, ses panosu |
| `/api/bot/bot/console`, `/settings/kick`, `/settings/kick/status` | Çağıran yok | Platformlar sayfası |
| `/api/bot/integrations/{provider}` | Çağıran yok (`/integrations/discord/test` kaldı) | Entegrasyonlar |
| `/api/bot/remote/panel/*`, `/remote/alerts/trigger`, `/remote/chat/send`, `/remote/obs/scene`, `/remote/settings/patch` | Telefon arayüzü `/api/actions` ve `/api/obs/kumanda` kullanıyor | — |
| `/api/bot/bot-settings` PUT | Yalnız GET okunuyor | Bot ayarları |

## Kalan uçlar

| Uç | Durum | Çağıran | AxBoT karşılığı / sonraki adım |
| --- | --- | --- | --- |
| `/api/bot/alerts` GET/PUT, `/alerts/variants` | kullanılıyor | `src/lib/api/studioMedia.ts` | Studio uyarı katmanı; WID-0 eşleşme tablosunda |
| `/api/bot/alerts/seed`, `/alerts/test` | kullanılıyor | Kurulum sihirbazı, Dashboard | AxBoT test uyarısı; WID-0 |
| `/api/bot/widgets*` | kullanılıyor | Paket paylaşımı, `useMasterWidgets`, `useWidgetSync` | Studio widget ayar deposu; WID-0 |
| `/api/bot/runtime/*` (poll, raffle) | kullanılıyor | `src/lib/widgets/runtimeApi.ts` | AxBoT anket ve çekiliş; WID-0 |
| `/api/bot/dashboard`, `/sessions*`, `/markers`, `/metrics`, `/events` | kullanılıyor | Dashboard, Yayın raporu, VOD hatırlatıcı | Studio'ya özgü yayın oturumu; kalır |
| `/api/bot/loyalty/tick` | kullanılıyor | Dashboard (izleme süresi sayacı) | Yalnız sohbet sayımı; AxBoT ekonomisiyle birleştirme açık soru |
| `/api/bot/bot-settings` GET | kullanılıyor | Dashboard | Kanal adı okuması; TEK-3 ortak ayar deposuna taşınabilir |
| `/api/bot/sync/eski-panel` | kullanılıyor | Dashboard (eski verileri AxBoT'a aktar) | Eski kurulumdan geçiş; kalır |
| `/api/bot/integrations/discord/test` | kullanılıyor | Dashboard | AxBoT Discord; kalır |
| `/api/bot/remote/login`, `/setup`, `/logout`, `/me`, `/users*` | kullanılıyor | Uzak giriş sayfası, Dashboard, eşleşmiş cihaz denetimi | Studio'ya özgü; kalır. Kullanıcı listesinin arayüzü yok |
| `/api/bot/remote/eslestirme*`, `/remote/cihazlar*` | kullanılıyor | Cihaz eşleştirme | Studio'ya özgü; kalır |
| `/api/bot/giden` | kullanılıyor | `axbot/server/src/core/pipeline.ts` | AxBoT'un giden iletisini Studio'ya bildirir; kalır |

## Dokunulmayanlar

- Veritabanı tabloları (`bot_commands`, `bot_timers`, `shop_items`, …) yerinde bırakıldı. Eski veri AxBoT'a `/sync/eski-panel` ile aktarılabiliyor; tablo silmek veri kaybı olurdu.
- `seed_default_commands` açılışta çalışmaya devam ediyor; aktarma bu kayıtları okuyor olabilir.
