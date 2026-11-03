# Hedef Mimari — Streaming OS

> Mevcut sistemi baştan yazmadan, çalışan parçaları koruyarak büyütme planı. Motor kararı:
> [STREAMING_ENGINE_DECISION](STREAMING_ENGINE_DECISION.md) (ADR-001).

## 1. Süreçler (yalıtım sınırları)

```
┌──────────────────────── Panel süreci (Tauri, Rust) ─────────────────────────┐
│  WebView2 (React)  ── Broadcast · Control Center · Bot · Overlay ·          │
│                       Automation · Media · Analytics · Settings             │
│        │ invoke / WS / HTTP (127.0.0.1:8843, local_guard)                   │
│  Rust çekirdek:                                                             │
│   ├─ Engine Supervisor ──(obs-websocket 5.x)──► OBS Studio süreci           │
│   ├─ Output Router ──(FLV boru)──► FFmpeg ingest ──► FFmpeg publisher × N   │
│   ├─ Control Plane (izin + denetim günlüğü + eylem kataloğu)                │
│   ├─ Event Gateway (tokio broadcast) ◄─── AxBoT olayları (HTTP/WS)      │
│   ├─ Policy Engine (platform kuralları, yayın öncesi kontrol listesi)       │
│   └─ Store (SQLite botaxt.db, ayar JSON'ları, keyring)                      │
└─────────────────────────────────────────────────────────────────────────────┘
        │ alt süreç (Job Object)                          │ ayrı uygulama
        ▼                                                  ▼
┌──── AxBoT (Node 24) ────┐                 ┌──── OBS Studio 32.x ────┐
│ platform adaptörleri, bot,  │                 │ yakalama, sahne grafiği, │
│ uyarılar, TTS, sadakat,     │                 │ GPU birleştirme, ses,    │
│ moderasyon, 3001 portu      │                 │ kodlama, kayıt, tekrar   │
└─────────────────────────────┘                 └──────────────────────────┘
```

Kural: **arayüz yayın hattına doğrudan dokunmaz.** Her eylem Control Plane'den geçer (izin → doğrulama → yürütme →
denetim günlüğü). Uzak/moderatör arayüzleri de aynı yoldan gider (§149). Bir sürecin çökmesi diğerlerini düşürmez:
panel çökerse OBS ve FFmpeg yayıncıları sürer; OBS çökerse Supervisor yeniden bağlanır ve kullanıcıyı uyarır.

## 2. Mantıksal katmanlar → gerçek bileşenler

| Katman | Bileşen | Durum |
|---|---|---|
| Desktop Shell | Tauri 2 + React; çalışma alanları | VAR (sekme tabanlı panel) → çalışma alanlarına dönüşecek |
| Broadcast Workspace | sahneler, kaynaklar, önizleme, ses, kontroller, çıkışlar | KISMİ (OBS denetim kartları) |
| Control Center | birleşik sohbet, etkinlik, hızlı eylemler, uyarı kuyruğu, hedefler, sağlık | EKSİK → Faz 11 |
| Bot Workspace | gömülü AxBoT | VAR |
| Overlay Designer | OverlayStudio, widget ayarları | KISMİ |
| Automation Studio | bitiş kuralları, zamanlayıcılar | KISMİ → düğüm editörü Faz 14 |
| Media Manager | kitaplık (`assets/*`), AxBoT medya | KISMİ |
| Analytics | oturumlar, metrikler | KISMİ |
| Capture/Scene/Compositor/Audio/Encoder/Recording/Replay/Virtual Camera | **OBS** (ADR-001), obs-websocket ile yönetilir | VAR (OBS'te) / denetim KISMİ |
| Output Router | tek kodlama → çok hedef | EKSİK → Faz 8–9 (bu turda başlıyor) |
| Platform Layer | AxBoT adaptörleri (Kick, Twitch, YouTube, Trovo, TikTok-okuma, Discord) + panelin kendi okuyucuları | VAR |

## 3. Olay omurgası

```
PLATFORM OLAYLARI (AxBoT adaptörleri, panel okuyucuları)
        ↓  normalize: {id, platform, eventType, ts, channel, user, displayName, avatar,
        ↓              message, amount, currency, quantity, metadata, isTest, raw?}
EVENT GATEWAY (tokio broadcast + kalıcı kuyruklar)
   ├─ Universal Chat   ├─ Activity Feed   ├─ Alerts (durum makinesi + kuyruk denetimi)
   ├─ Bot              ├─ TTS             ├─ Goals        ├─ Automation   ├─ Analytics / Clips
```

Uyarı durum makinesi: `queued → preparing → entering → active → exiting → complete | failed`; kuyruk: FIFO + öncelik,
tekrar önleme (idempotency anahtarı), duraklat/sürdür/atla/sustur/yeniden oynat — Faz 12.

## 4. Durum ve kalıcılık

| Veri | Yer | Sürüm alanı |
|---|---|---|
| Hedefler (destinations), çıkış profilleri | `settings-panel.json` → `multistream` dalı (sırlar keyring'de) | `version` |
| Yerleşimler (Control Center) | `settings-panel.json` → `controlCenter.layouts` | `version` |
| Hızlı eylemler / roller | SQLite (yeni tablolar, geriye uyumlu migrasyon) | migrasyon numarası |
| Denetim günlüğü | SQLite `audit_log` (mevcut tablo) | — |
| Sahneler, kaynaklar, profiller | OBS sahne koleksiyonu / profili (OBS'in kendi dosyaları) | OBS |

Sırlar (yayın anahtarları, OAuth) **asla** ayar JSON'una, günlüğe veya WebSocket anlık görüntüsüne yazılmaz.

## 5. İş parçacığı ve performans ilkeleri

- Görüntü/ses işleme OBS sürecinde; kodlanmış paket çoğaltma Output Router'da (tokio görevleri + FFmpeg alt
  süreçleri). WebView iş parçacığı hiçbir medya verisi taşımaz.
- Yönlendirici hedef başına sınırlı arabellek kullanır; yavaş hedef diğerlerini bekletmez (düşen hedef kuyruğu kırpılır,
  diğerleri etkilenmez).
- Kontrol merkezi güncellemeleri toplu (batch) ve seyreltilmiş (throttle) gelir; yayın hattı UI'yı beklemez.

## 6. Yol haritası (fazlar ve bu turdaki durum)

| Faz | Kapsam | Öncelik | Durum |
|---|---|---|---|
| 0 | Denetim + doğrulanmış yedek + git güvenlik noktası | P0 | **BİTTİ** |
| 1 | Referans araştırması | P0 | **BİTTİ** (Chrome gerektiren arayüz gözlemleri `BLOCKED`) |
| 2 | Mimari | P0 | **BİTTİ** (bu belge + ADR-001) |
| 3 | Çekirdek kanıtı: Output Router prototipi (yerel test hedefleriyle) | P0 | bu turda |
| 4–7 | Yakalama, sahne, ses, kodlama/kayıt | P0 | OBS'te VAR; denetim yüzeyi genişletilecek |
| 8–9 | Yayın çıkışları, çoklu yayın | P1 | bu turda başlıyor |
| 10 | Çoklu tuval (dikey) | P2 | tasarım |
| 11 | Control Center (yerleşim motoru, hızlı eylemler, hedef kartları, sağlık) | P1 | bu turda başlıyor |
| 12 | Uyarı kuyruğu denetimi, olay normalizasyonu | P1 | bu turda |
| 13 | Tekrar/klipler | P2 | OBS tekrar arabelleği denetimi |
| 14 | Otomasyon stüdyosu | P2 | tasarım |
| 15 | Bulut aktarımı | P3 | tasarım |
| 16 | AI | P3 | mevcut Gemini modülleri |
| 17 | Sağlamlaştırma | sürekli | |

MVP kalite kapısı (§138) önce: OBS denetimi (sahne, ekran/oyun yakalama, kamera, mikrofon, masaüstü sesi, 1080p60
önizleme, NVENC H.264, kayıt) + RTMP yayını + Twitch/Kick/YouTube çıkışları + **çoklu yayın** + temel Control Center
+ birleşik sohbet + uyarılar. Yarım özellik "BİTTİ" sayılmaz (§139, §151).
