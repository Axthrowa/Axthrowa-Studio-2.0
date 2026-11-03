# Mevcut Sistem Denetimi — Streaming OS öncesi (salt-okunur)

> Tarih: 2026-09-25 · Yöntem: dosya değiştirmeden inceleme (git, dosya sistemi, kaynak kod, çalışan araç sürümleri)
> Sırlar bu raporda yer almaz; yalnız dosya/konum adları verilir.

Ürün iki depodan oluşuyor. Masaüstü kabuğu (panel) diğerini gömerek çalıştırıyor:

| | **Panel — "AxthrowA Studio"** (masaüstü kabuğu) | **AxBoT** (bot/topluluk sunucusu) |
|---|---|---|
| Kök | `C:\Users\Axthrowa\Desktop\yayin-yonetim-araci - Kopya (2)` | `C:\Users\Axthrowa\Desktop\Projeler` |
| Git | var, uzak: `github.com/Axthrowa/yayin-yonetim-araci` | var, **uzak yok** (yalnız yerel) |
| Etkin dal | `streamaxt-bot` | `revamp/botrix-parity-20260921` |
| HEAD | `75f7c97121865d7c04e6b8a9b4f71b67f10e1684` | `ef6481e21c6eb56997442dc91becce7e96714755` |
| Staged / unstaged / untracked | yok / yok / yok (temiz) | yok / yok / yok (temiz) |
| Önceki güvenlik etiketi | `pre-botrix-revision-20260921-182105` | `pre-botrix-revision-20260921-182105` |
| Paket yöneticisi | npm (`package-lock.json`), Cargo | npm workspaces (`server`, `client`) |

## 1. Panel (masaüstü kabuğu)

| Konu | Durum |
|---|---|
| Masaüstü çatısı | **Tauri 2** (Rust 2021) + WebView2. Tek örnek kilidi (`single_instance.rs`), tepsi, küresel kısayollar (`tauri-plugin-global-shortcut`, Rust tarafında) |
| Ön yüz | React 19, Vite 6, Tailwind 3.4, framer-motion, react-router 7, TypeScript 5.8 |
| Arka uç | Uygulama içinde **axum 0.8** HTTP + WebSocket sunucusu, `127.0.0.1:8843` (isteğe bağlı LAN: `0.0.0.0` + Bearer) |
| Yerel (native) modüller | Rust crate'leri: `obws` (OBS WebSocket v5 istemcisi), `sqlx` (SQLite), `keyring` (Windows Kimlik Yöneticisi), `windows` 0.61 (WASAPI ses markalama, COM, JobObject, ShellExecute), `reqwest`, `tokio-tungstenite` |
| Veritabanı | SQLite `botaxt.db` (+ eski `botrix.db`), WAL |
| ORM | yok — `sqlx` ham sorgular |
| Migrasyonlar | `src-tauri/migrations/001_init.sql … 009_counters_variables.sql` (sqlx migrate) — 37 tablo: alert_types/variants/queue, bot_* (commands, timers, filters, modules, variables, counters, cooldowns, settings), loyalty_*, shop_*, game_*, goals, widget_instances, stream_sessions, stream_metrics_samples, events_log, audit_log, remote_users/sessions, bot_auth, integrations, soundboard_pads, media_share_queue… |
| Ayar deposu | Ekran başına JSON: `settings-{starting,ending,brb,chat,panel}.json`, `overlay-configs.json`, `music.json`; atomik yazım (`write_atomic`) |
| Kimlik doğrulama | Loopback güvenilir; LAN'da Bearer (`remote_users`, `remote_sessions`). 4. turda `local_guard` (Host + Origin + CORS beyaz listesi) eklendi |
| Yetkilendirme | Uzak kullanıcıda `role` (admin / diğer). Kaynak düzeyinde RBAC yok |
| OAuth | Kick OAuth (Rust, `kick/auth.rs`, geri dönüş `/api/kick/oauth/callback`), Spotify PKCE (Rust), Twitch/YouTube/Discord implicit akış (ön yüz, oturumlar WebView2 `localStorage`'da) |
| Platform entegrasyonları | Kick: Pusher sohbet + resmi API + çerez oturumu (Edge CDP ile alınır). Twitch: anonim IRC okuma, OAuth ile yazma. YouTube: innertube yoklama ile okuma, Data API ile yazma. Discord: identify |
| Gerçek zamanlı | WebSocket `/ws/overlay-sync` (tokio `broadcast` kanalı → tüm overlay/panel istemcileri), Tauri olayları (`obs-stream-state`, `obs-sequence`…) |
| SSE | yok |
| Kuyruklar | `alert_queue` tablosu + bellek içi; ön yüzde `replyQueue` (bot yanıtları) |
| Olay veriyolu | Rust: `AppState.tx` (tokio broadcast); JS: `widgetBus`, `chatHub` |
| İşçiler | tokio görevleri: müzik yoklama, Kick dinleyici, OBS olay pompası, zamanlayıcılar, AxBoT süreç izleyici |
| Widget'lar | ~30 OBS rota: alerts, goal, label, poll, activity, subathon, viewers, emote-combo/wall, shoutout, wheel, hype, now-playing, songrequest, redeems, giveaway, cup, glass, tts, credits, master overlay … (React, aynı kökenden) |
| Uyarılar | `alert_types` + `alert_variants` + overlay; test ucu `/api/botaxt/alerts/test` |
| Komutlar | İki motor: ön yüzdeki `smartBot` (JS) ve Rust `bot/chatbot.rs`; ayrıca gömülü AxBoT'un kendi komut motoru |
| TTS | Panelde yalnız overlay rotası (`/tts`, `/cloudtts`); asıl TTS motoru AxBoT'ta |
| Sadakat | Rust `loyalty_*` tabloları + JS `smartBot` sadakat sayacı |
| Medya | `assets/{videos,music,sfx,logos,backgrounds,particles}`; `/media/file` Range akışı (4. turda yalnız medya uzantıları); YouTube arka planı için `yt-dlp` + ffmpeg ilk kullanımda indirilir (`ytdl`) |
| Yükleme | Ham gövde + `x-filename` başlığı (4. turda katı ad doğrulaması) |
| Kayıt / video / ses | **Uygulamanın kendi yakalama, birleştirme, kodlama veya kayıt motoru YOK.** Tüm görüntü/ses işleme harici **OBS Studio 32.2.2**'de; uygulama OBS'i WebSocket ile yönetiyor (sahne, kaynak görünürlüğü, sessize alma, ses seviyesi, filtre aç/kapa, yayın başlat/durdur, kayıt, OBS kısayolu tetikleme) |
| FFmpeg | Uygulama kullanmıyor (yalnız yt-dlp birleştirmesi). Sistemde WinGet ffmpeg (GPL derlemesi; NVENC H.264/HEVC/AV1, AMF, QSV, SVT-AV1 kodlayıcıları mevcut) |
| OBS entegrasyonu | `obs_client.rs` kalıcı bağlantı + sıralı otomasyon (giriş → canlı → çıkış), OBS kısayol eylemleri (`hotkeys.rs`), bitiş kuralları, tek hakem kilidi (`otomasyon_kilidi.rs`); overlay'lerde ayrıca `obs-websocket-js` |
| Docker | `docker/Dockerfile.winbuild` (cargo-xwin ile çapraz derleme), `docker-compose.yml`; üretimde kullanılmıyor |
| nginx / ters vekil | yok |
| CI/CD | yok (`.github` yok) |
| Testler | vitest 29 dosya / 314 test; `cargo test` 192 birim + 21 entegrasyon (1 yok sayılan); Resonance vitest 71 |
| Lint | `tsc --noEmit`, `cargo clippy --all-targets` (uyarısız), Resonance'ta `oxlint` |
| Derleme | `scripts/build-release-signed.ps1` → yerel `cargo build --release` + `tauri bundle` (NSIS) + `paketle.ps1` (imzalama, taşınabilir klasör) |
| Günlük | `yya_log!/yya_warn!` makroları (dosya + konsol), `hotkey-hatalari.log` |
| Dağıtım | `cikti/portable` (exe + `portable.txt` + dist + resonance + streamaxt) ve NSIS kurulum |

Gömülü bileşenler: **Resonance** (`resonance/`, React 19 + Vite 8 + Tailwind 4; müzik/şimdi çalıyor widget'ı, `/resonance` altından servis) ve **AxBoT** (`streamaxt.rs` Node sürecini başlatır/izler; `cikti/portable/streamaxt` kopyası, 3001 portu, panelde iframe).

## 2. AxBoT (bot / topluluk sunucusu)

| Konu | Durum |
|---|---|
| Çalışma ortamı | Node 24.19, Express 4, `ws`, `node:sqlite` (DatabaseSync), TypeScript → CommonJS |
| Ön yüz | React 19 + Vite 6 + Tailwind (panelde iframe olarak gömülü, turkuaz tema yaması) |
| Veritabanı / migrasyon | SQLite `streamaxt.sqlite`, 27 tablo; sürümlü, geriye uyumlu göçler (`db/migrations.ts`, sürüm 7) |
| Kimlik / yetki | Tek kullanıcılı yerel araç; `local-guard` + `origin-guard` (Host, Origin, WS köken) |
| OAuth | Kick (OAuth 2.1 + PKCE), Twitch, Google/YouTube, Trovo; Discord bot tokenı. Sırlar DPAPI ile şifreli (`vault.ts`) |
| Platform adaptörleri | Kick, Twitch (+Helix), YouTube, Trovo, TikTok (yalnız okuma, resmi olmayan), Discord — ortak `base.ts` + `capabilities.ts` yetenek tablosu |
| Gerçek zamanlı | `ws` sunucusu, widget kanalları, köken denetimi |
| Olay veriyolu | `core/event-bus.ts` (EventEmitter) → `pipeline.ts` (kara liste → kalkan → ekonomi/seviye → AutoMod → komut → TTS → çapraz aktarım) |
| Modüller | ai, alerts, automod, chat-alerts, commands, economy, engagement, extras, games, giveaways, hype, integrations (Riot/LoL…), levels, media, moderation (kalkan, ortak kara liste, elle moderasyon), songrequest, stream, subathon, timers, tts, widgets |
| API | 158 REST rotası (`api/rotalar/*.ts`, 13 modül) |
| TTS | Çok sağlayıcılı (Edge, Gemini, ElevenLabs, Google, WebSpeech), kuyruk, filtreler, rol eşiği |
| Medya | Base64 yükleme, içerik imzasıyla tür doğrulaması, UUID dosya adları |
| Testler | server vitest 27 dosya / 431 test, client 75 test |
| Derleme / dağıtım | `tsc` + `vite build` → `release/app` → panel `scripts/streamaxt-hazirla.mjs` ile kopyalar |

## 3. Kullanıcı verisi konumları (yedeklenecek)

| Konum | İçerik |
|---|---|
| `%APPDATA%\com.axthrowa.yayin-yonetim-araci` (~228 MB) | Kurulu mod verisi: `botaxt.db`(+wal/shm), `settings-*.json`, `overlay-configs.json`, `music.json`, `kick-oauth.json`, `kick-bot-session.json`, `media/`, `kick-edge-profile/` |
| `%APPDATA%\com.axthrowa.yayin-yonetim-tauri` (~4 MB) | Eski sürüm verisi (`settings.json`, `media/`) |
| `%LOCALAPPDATA%\com.axthrowa.yayin-yonetim-araci\EBWebView` (~100 MB) | WebView2 profili: `localStorage` (smartBot ayarları, Twitch/YouTube/Discord yazma oturumları, panel tercihleri), IndexedDB |
| `cikti\portable\{data,app-data,media,assets}` | Taşınabilir mod verisi |
| `cikti\portable\streamaxt\data\streamaxt.sqlite` | Panelde gömülü AxBoT'un gerçek veritabanı |
| `Projeler\data`, `Projeler\server\data` | AxBoT geliştirme veritabanları ve medya |
| Windows Kimlik Yöneticisi | OBS WebSocket parolası, Kick bot sırları (`keyring`) — dosya olarak yedeklenemez, rapora not düşülür |

## 4. Streaming OS hedefine göre mevcut yetenekler

| Katman | Durum |
|---|---|
| Yakalama / sahne grafiği / GPU birleştirme / kodlama / kayıt / tekrar arabelleği | **Uygulamada yok** — OBS Studio'ya devredilmiş, WebSocket ile yönetiliyor |
| Çoklu yayın (multistream) | **yok** (OBS tek hedefe yayınlar; eklenti de kurulu değil) |
| Çoklu tuval (dikey/yatay) | **yok** |
| Birleşik sohbet | **var** (Kick + Twitch + YouTube panelde ve overlay'de; AxBoT'ta Trovo/Discord/TikTok da) |
| Etkinlik akışı | **kısmi** (AxBoT `stream_events`, panelde widget) |
| Uyarı kuyruğu denetimi (duraklat/atla/sustur) | **eksik** (AxBoT `alertQueue.atla/temizle` yalnız testte; `skipEnabled` etkisiz) |
| Hızlı eylemler / Stream Deck benzeri | **kısmi** (küresel kısayollar + OBS eylemleri + ses paneli) → 2026-09-26: eylem kayıt defteri + Hızlı eylemler + Kontrol destesi; donanım Stream Deck yalnız HTTP ile (UNVERIFIED) |
| Uzaktan denetim | **kısmi** (LAN Bearer ile `/remote` paneli; QR eşleme yok) |
| Moderasyon | **var** (AxBoT: sil/zaman aşımı/ban, ortak kara liste, AutoMod, kalkan) |
| Otomasyon | **kısmi** (bitiş kuralları, zamanlayıcılar, OBS dizisi; düğüm tabanlı editör yok) |
| Denetim günlüğü | **kısmi** (AxBoT `audit`, panelde `audit_log` tablosu) |
| Tanılama / sağlık | **kısmi** (`StreamHealthCard`: OBS istatistikleri) |
| AI | **kısmi** (AxBoT Gemini: sohbet kurtarma, toksisite, yanıt) |

## 5. Bilinen yapısal riskler

1. Görüntü hattı tamamen OBS'e bağımlı: yakalama/kodlama hataları uygulamanın denetiminde değil.
2. İki ayrı bot motoru (panel `smartBot` + Rust `chatbot.rs` ve AxBoT) aynı sohbete yanıt verebilir; ayrım `rustKickGate` ve ayarlarla yapılıyor.
3. Ön yüz platform yazma oturumları WebView2 `localStorage`'da düz metin.
4. LAN kipinde herkese açık WebSocket anlık görüntüsü OBS parolasını taşıyor (4. turda belgelendi).
5. AxBoT deposunun uzak kopyası yok — tek kopya yerel disk + yedekler.

---

## 6. Revizyon denetimi — 2026-09-26 (ikinci Streaming OS görevi, salt-okunur)

| | Panel | AxBoT |
|---|---|---|
| Dal (denetim anında) | `revamp/streaming-os-20260925` | `revamp/streaming-os-20260925` |
| HEAD | `809a53393ad5af0daaec1f26a8088522f5d7d2a2` | `aef017d2e372c5f47db4eb86fa9b34cf3ad84c69` |
| Staged / unstaged / untracked | yok / yok / yok | yok / yok / yok |
| Etiketler | `pre-botrix-revision-20260921-182105`, `pre-streaming-os-20260925-175532` | aynı |
| Uzak depo | `origin` (GitHub) — bu turun commit'leri gönderilmedi | yok |

### 6.1 Önceki denetimden bu yana değişenler

| Katman | 2026-09-25 | 2026-09-26 |
|---|---|---|
| Çoklu yayın | yok | **var**: `src-tauri/src/multistream/` — OBS → yerel FFmpeg alıcı (127.0.0.1) → Rust FLV çoğaltıcı → hedef başına FFmpeg yayıncı (`-c copy`); hedef başına durum makinesi, geri çekilme, yavaş hedef koruması; API + denetim günlüğü |
| Yayın öncesi kontrol | yok | kısmi: OBS profil okuma + platform kural tablosu (`policy.rs`) |
| Operatör çalışma alanı | yok | kısmi: Kontrol Merkezi (panel ızgarası; oturum, hedefler, ön kontrol, uyarı kuyruğu, sahne/ses, denetim, notlar) |
| Uyarı kuyruğu denetimi | eksik | var (AxBoT, ekip çapında, sürüm kilitli) |
| Sır deposu | mock depo (kalıcı değil) | `keyring` `windows-native` — kalıcı |
| LAN WS | OBS parolası sızıyordu | loopback dışına ayıklanıyor |
| Testler | TS 314, Rust 192+21, AxBoT 431+75 | TS 323, Rust 228+21+2 (uçtan uca), AxBoT 451+81 |

### 6.2 Bu görevin kontrol listesine göre (önceki bölümlerde yoksa)

| Konu | Bulgu |
|---|---|
| libobs / OBS'e bağlanma | **libobs bağlanmıyor.** OBS Studio 32.2.2 ayrı süreç; `obws` 0.14 (obs-websocket v5 istemcisi) ile denetim. Uygulama içinde yakalama, sahne grafiği, GPU birleştirme, kodlayıcı, kayıt, tekrar arabelleği **yok** |
| FFmpeg | Harici ikili (WinGet, GPL derlemesi) — yalnız süreç olarak çağrılır (çoklu yayın alıcı/yayıncı, yt-dlp birleştirme); bağlanmaz |
| RTMP / RTMPS / SRT | RTMP/RTMPS FFmpeg ile (yönlendirici); SRT desteklenmiyor (FFmpeg destekliyor, uygulamada yol yok) |
| Video/ses yakalama, kodlama, GPU | yok (OBS) |
| C / C++ yerel kod | yok. Rust: `windows` 0.61 (WASAPI ses markalama, COM, JobObject, ShellExecute), `keyring`, `sqlx`, `axum`, `obws`, `reqwest`, `tokio-tungstenite` |
| Electron | yok (Tauri 2 + WebView2) |
| Redis / önbellek / mesaj kuyruğu | yok; bellek içi tokio `broadcast` ve Node `EventEmitter` |
| Biçimlendirici | yok (Prettier/rustfmt yapılandırması yok; kod elle tutarlı) |
| Lint | `tsc --noEmit`, `cargo clippy` (uyarısız), Resonance `oxlint`; ESLint yok |
| E2E testleri | yok (Playwright/Cypress yok); uçtan uca: Rust `multistream_e2e` (gerçek FFmpeg), `server_api` (gerçek HTTP/WS), tarayıcı bölmesiyle elle senaryolar |
| Telemetri / çökme raporlama | yok (Sentry vb. yok); yerel günlük dosyaları |
| Masaüstü güncelleyici | yok (`tauri.conf.json`'da updater yok; derlemede `createUpdaterArtifacts: false`) |
| Kod imzalama | var: Authenticode, `CN=Axthrowa` sertifikası, zaman damgalı (`sign-cikti.ps1`, `paketle.ps1`) |
| PM2 / systemd / nginx / Caddy | yok (masaüstü uygulaması) |
| Docker | yalnız eski çapraz derleme imajı (`docker/Dockerfile.winbuild`); kullanılmıyor |
| CI/CD | yok |

### 6.3 Sonuç

Uygulama bir **denetim düzlemi + çoklu yayın yönlendiricisi**; görüntü/ses işleme OBS'te. Bu görevin "yerel yayın
çekirdeği" hedefi (yakalama → sahne grafiği → GPU → kodlayıcı) mevcut kodda **yok**; karar `STREAMING_ENGINE_DECISION.md`
ve `LICENSE_AND_DEPENDENCY_REVIEW.md`'de yeniden değerlendirilir.
