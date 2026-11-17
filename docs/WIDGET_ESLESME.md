# Widget eşleşme tablosu (WID-0)

Son doğrulama: 2026-11-17 · Plan 3, WID-0

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
| `/overlay/master`, `/widgets/master` | `/widgets/overlay` (Tek URL) | Birleşik katman. Kurulum sihirbazı OBS'e hâlâ `/overlay/master` ekler; içerik Overlay Stüdyo'da düzenlenen katmandır. Hazırlık listesi bottan doğrudan eklenen `/widgets/overlay` kaynağını da tanır |

## Studio'da kalanlar

| Adres | Neden |
| --- | --- |
| `/starting`, `/brb`, `/ending`, `/chat` | Studio ekranları (Giriş, Mola, Çıkış, sohbet ekranı) |
| `/widgets/altyazi` | Canlı altyazı Studio'da çalışır |
| `/sfx` | Ses efekti çalar |

**Birleşik katman (2026-11-17):** önceden `/overlay/master` widget'ları Studio'nun kendi bileşenleriyle (`src/components/widgets`) ve Rust'taki `/api/bot/widgets` deposundan çiziyordu; yani hedef, anket, çark gibi türlerin ikinci uygulaması oradaydı ve Studio'da bu katmanı düzenleyen bir ekran kalmamıştı. Artık adres botun Tek URL katmanına yönlenir ve o ikinci uygulama silindi. Eski `/api/bot/widgets` düzeni taşınmaz.

**Açık kalan:** paket paylaşımı (Ayarlar › paket) widget bölümünü hâlâ `/api/bot/widgets`'ten okuyup yazıyor; bu düzen artık çizilmiyor. WID-3'te paket biçimi galeride kullanılırken botun Tek URL düzenine bağlanacak, Rust deposu o zaman kaldırılabilir.

## Silinenler

- 18 sayfa (`src/routes/widgets/*Page.tsx`, `WidgetOverlay.tsx`), `OverlayAlertsPage.tsx`, `OverlayWidgetRedirect.tsx`
- Bunların ardından kimsenin kullanmadığı `studioMedia.ts`, `useAlertOverlay.ts`, `patlamaAdedi.ts`, `widgetPreview.tsx`
- Rust: `/api/bot/alerts` GET/PUT ve `/api/bot/alerts/variants` (tek çağıranı silinen sayfaydı)
- Silinen satırlar, Birleştirme fazının toplamı: Studio arayüzü yaklaşık 2.570, Rust yaklaşık 2.550, `axbot/resonance` kopyası 12.850 (RES-1)
- Birleşik katmanın ikinci uygulaması (WID-0 kapanışı): `MasterOverlay.tsx`, `MasterOverlayCanvas.tsx`, `src/components/widgets` (12 dosya), `src/lib/widgets` (9 dosya; `useWidgetSync` sesli dinleyicide kullanıldığı için kalır), yalnız bunların kullandığı `src/lib/alerts` (3 dosya) ve `parseEmotes.tsx` — 27 dosya, 5.800 satır
