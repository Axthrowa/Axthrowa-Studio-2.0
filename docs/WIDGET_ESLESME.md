# Widget eşleşme tablosu (WID-0)

Son doğrulama: 2026-11-16 · Plan 3, WID-0

AxBoT widget'ları asıl sayılır. Studio'nun aynı işi yapan sayfaları silindi; eski OBS adresleri Studio sunucusunda AxBoT'taki karşılığına yönlenir (`src-tauri/src/server/eski_widgetlar.rs`, HTTP 307). OBS'e eklenmiş eski kaynaklar çalışmaya devam eder, ama görünüm ve ayar artık botun widget'ından gelir. Studio'da o widget için yapılmış eski ayarlar taşınmaz.

Her eski tür üç biçimde yakalanır: kök (`/goal`), `/widgets/<tür>` ve `/overlay/widgets/<tür>`. Sorgu (`?obs=1`, `?id=…`) olduğu gibi aktarılır.

| Eski Studio adresi | AxBoT widget'ı | Not |
| --- | --- | --- |
| `goal`, `goals` | `/widgets/goals` | `?kind=followers|subs|tips|kicks` ilgili hedef çubuğuna gider (`follower-goal`, `subscriber-goal`, `donation-goal`, `kicks-goal`) |
| `kicksubs`, `kick-subs` | `/widgets/subscriber-goal` | |
| `label`, `labels` | `/widgets/event-labels` | |
| `poll`, `polls` | `/widgets/polls` | |
| `activity`, `activityfeed` | `/widgets/activity-feed` | |
| `subathon` | `/widgets/subathon` | |
| `viewers` | `/widgets/viewer-counter` | |
| `emote-combo`, `emotecombo` | `/widgets/emote-combo` | |
| `emotewall`, `emotes` | `/widgets/emotes` | Uçan emote (kappagen) |
| `shoutout`, `shoutouts` | `/widgets/shoutout` | |
| `wheel`, `fortunewheel` | `/widgets/wheel` | |
| `hype`, `hypetrain` | `/widgets/hype-train` | |
| `now-playing`, `songrequest` | `/widgets/now-playing` | |
| `redeems` | `/widgets/loyalty-redeem` | Studio sayfası kanal ödüllerini gösteriyordu; bot karşılığı market kullanımları. Kick ödül uyarısı uyarı kutusunda |
| `giveaway`, `raffles` | `/widgets/giveaways` | |
| `cup`, `glass` | `/widgets/the-cup` | |
| `tts`, `cloudtts` | `/widgets/audio-player` | Studio tarayıcı sesiyle (SpeechSynthesis) okuyordu; bot kendi TTS sağlayıcısını çalar |
| `credits`, `moviecredits` | `/widgets/credits` | |
| `alerts`, `alert`, `/overlay/alerts` | `/widgets/alertbox` | Uyarı kuyruğu paneli zaten AxBoT'un |
| `/widgets/chat` | `/widgets/chatbox` | Kökteki `/chat` Studio'nun sohbet ekranıdır, yönlenmez |

## Studio'da kalanlar

| Adres | Neden |
| --- | --- |
| `/starting`, `/brb`, `/ending`, `/chat` | Studio ekranları (Giriş, Mola, Çıkış, sohbet ekranı) |
| `/widgets/altyazi` | Canlı altyazı Studio'da çalışır |
| `/sfx` | Ses efekti çalar |
| `/overlay/master`, `/widgets/master` | Birleşik katman; kurulum sihirbazı OBS'e bunu ekler |

**Açık kalan:** birleşik katman (`MasterOverlayCanvas`) içindeki widget'ları hâlâ Studio'nun `src/components/widgets` bileşenleriyle çiziyor. Bunlar `/api/bot/widgets` ile Rust tarafındaki ayar deposunu okuyor. Yani o katman içinde hedef, anket, çark gibi türlerin ikinci bir uygulaması hâlâ var. Bunu kaldırmak birleşik katmanı bot widget'larını gömen bir yapıya çevirmeyi gerektirir. WID-6 (ortak widget çalışma zamanı) ile birlikte ele alınmalı.

## Silinenler

- 18 sayfa (`src/routes/widgets/*Page.tsx`, `WidgetOverlay.tsx`), `OverlayAlertsPage.tsx`, `OverlayWidgetRedirect.tsx`
- Bunların ardından kimsenin kullanmadığı `studioMedia.ts`, `useAlertOverlay.ts`, `patlamaAdedi.ts`, `widgetPreview.tsx`
- Rust: `/api/bot/alerts` GET/PUT ve `/api/bot/alerts/variants` (tek çağıranı silinen sayfaydı)
- Silinen satırlar, Birleştirme fazının toplamı: Studio arayüzü yaklaşık 2.570, Rust yaklaşık 2.550, `axbot/resonance` kopyası 12.850 (RES-1)
