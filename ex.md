# AxthrowA Studio — Tauri Dönüşüm Spesifikasyonu (ex.md)

> **Durum:** Faz 1–4 tamamlandı · Release üretildi · `cikti/` klasöründe  
> **İmza:** axthrowa  
> **Tarih:** 2026-09-05  

### Çıktı
- `cikti/AxthrowA Studio_1.0.0_x64-setup.exe`
- `cikti/portable/AxthrowAStudio.exe` + `Baslat.bat` + `dist/`

### Not (WDAC)
Bu makinede Windows Uygulama Denetimi (os error 4551) Desktop/AppData altında cargo build-script’lerini engelleyebiliyor. Release, izinli sandbox target dir ile üretildi.

---

## 0. Temel İlke

Mevcut web projesindeki **hiçbir özellik, tasarım veya davranış çıkarılamaz**. Dönüşüm = taşıma + güçlendirme.

| Korunacak | Yeni |
|-----------|------|
| Giriş overlay (`obs-giris-ekrani`) | `/starting` React route |
| Çıkış overlay (`obs-cikis-ekrani`) | `/ending` + jenerik scroll |
| Ana yayın formu (`index.html` / `app.js`) | Control Panel modülleri |
| Video upload + trim + parçacıklar + drag positions | Rust stream + gelişmiş snap drag |
| `serve.py` sync modeli | Embedded Rust HTTP + WS |
| Dragon stinger dosyaları | Kaynak olarak kalır |

**Kritik OBS gerçeği:** OBS Tarayıcı Kaynağı Tauri WebView değildir. `asset://` / `tauri://` OBS içinde **çalışmaz**. Overlay’ler ve büyük medya, uygulamanın içinde açılan **yerel HTTP sunucusu** üzerinden servis edilmelidir (bugünkü `serve.py`’nin Rust karşılığı). Control Panel içi önizleme ise aynı URL’leri veya ek olarak `stream://` protokolünü kullanabilir.

---

## 1. Hedef Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                     TAURI DESKTOP APP (Rust)                    │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │  Control Panel       │    │  Embedded HTTP + WebSocket     │ │
│  │  (React / Vite)      │◄──►│  127.0.0.1:8843 (veya dinamik) │ │
│  │  • Ayarlar           │    │  GET  /starting /ending /brb   │ │
│  │  • Drag preview      │    │       /chat                    │ │
│  │  • OBS WebSocket UI  │    │  GET  /media/*  (Range/206)    │ │
│  │  • System tray       │    │  WS   /ws/overlay-sync         │ │
│  │  • Stop Stream buton │    │  API  /api/settings?screen=…   │ │
│  └──────────┬───────────┘    └───────────────┬────────────────┘ │
│             │ invoke / emit                  │                  │
│             ▼                                ▼                  │
│  ┌──────────────────────┐         OBS Browser Sources           │
│  │ Rust Backend         │         http://127.0.0.1:8843/…       │
│  │ • media stream proto │◄─────── /starting?obs=1               │
│  │ • settings store     │         /ending?obs=1                 │
│  │ • Kick chatroom fetch│         /brb?obs=1                    │
│  │ • obs-websocket bridge│        /chat?obs=1                   │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 İki iletişim kanalı (karıştırılmamalı)

| Kanal | Kimler arasında | Ne için |
|-------|-----------------|---------|
| **Tauri IPC** (`invoke` / `emit`) | Control Panel ↔ Rust | Dosya seçici, tray, native dialog, OBS bridge komutları |
| **HTTP + WebSocket** | Control Panel / Overlay / OBS | Ayar senkronu, medya stream, canlı pozisyon güncellemesi |

OBS overlay’e “Tauri Event” **doğrudan gitmez**. Pozisyon/ayar değişiklikleri Rust state’e yazılır → WebSocket ile tüm overlay istemcilerine yayınlanır. Control Panel içindeki canlı önizleme de aynı WS’i dinler → tek kaynak, tutarlı durum.

### 1.2 Dizin yapısı (hedef)

```
/
├── legacy/                      # Mevcut HTML/JS/CSS — DOKUNULMAZ arşiv kopyası
│   ├── obs-giris-ekrani.html
│   ├── obs-cikis-ekrani.html
│   ├── obs-app.js
│   ├── serve.py
│   └── …
├── src/                         # React (Vite) frontend
│   ├── main.tsx
│   ├── App.tsx                  # Router: panel | overlay routes
│   ├── routes/
│   │   ├── panel/               # Control Panel
│   │   ├── starting/            # Giriş overlay
│   │   ├── ending/              # Çıkış + jenerik
│   │   ├── brb/                 # Mola
│   │   └── chat/                # Kick chat
│   ├── components/
│   │   ├── overlay/             # Drag layer, particles, countdown…
│   │   ├── panel/               # Settings drawers, OBS dropdowns
│   │   └── media/               # <video>/<audio> stream src helpers
│   ├── hooks/
│   ├── lib/                     # WS client, OBS client, Kick pusher
│   └── styles/                  # Mevcut obs-style.css + Tailwind
├── src-tauri/                   # Rust
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── media/               # Range stream protocol + HTTP media
│   │   ├── server/              # axum HTTP + WS
│   │   ├── settings/            # JSON persist (intro/outro/brb/chat)
│   │   ├── kick/                # reqwest chatroom_id
│   │   └── obs/                 # optional native bridge helpers
│   ├── capabilities/
│   ├── tauri.conf.json
│   └── Cargo.toml
├── docker/                      # Mevcut Docker toolchain kullanımı
│   ├── Dockerfile.dev
│   └── docker-compose.yml
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── ex.md                        # Bu dosya
```

**Kural:** Eski dosyalar önce `legacy/` altına taşınır; React port tamamlanana kadar referans olarak kalır. Hiçbir özellik “sonra ekleriz” diye düşürülmez — port checklist’i `ex.md` §8’de.

---

## 2. Medya Motoru — Boyut/Süre Sınırsız, Base64 YOK

### 2.1 Neden base64 yasak?

- 2 GB video ≈ 2.7 GB base64 string → RAM patlar, JSON settings şişer, localStorage ölür.
- OBS Browser Source her senkronde yeniden parse eder → kasma.

### 2.2 Doğru model: disk yolu + HTTP Range stream

1. Control Panel’de kullanıcı video/ses seçer → Tauri `dialog` / `open` → **yalnızca mutlak dosya yolu** settings’e yazılır:
   ```json
   {
     "bgStyle": "video",
     "bgVideoPath": "D:/Videos/intro-loop.mp4",
     "bgVideoStart": 0,
     "bgVideoEnd": 0,
     "bgAudioPath": "D:/Music/brb-loop.mp3"
   }
   ```
2. Overlay `<video src="http://127.0.0.1:8843/media/stream?token=…">` kullanır.
3. Rust HTTP handler:
   - `Range: bytes=…` okur
   - `seek` + chunk okur (örn. 1 MiB)
   - `206 Partial Content` + `Accept-Ranges: bytes` + doğru `Content-Type` döner
4. Tarayıcı/OBS yalnızca ihtiyaç duyduğu dilimleri RAM’e alır → **sınırsız boyut**, düşük bellek.

Bu, mevcut `serve.py` `_get_media_file` mantığının birebir Rust portudur; fark: kaynak `media/` klasörüne kopyalanmak zorunda değil — kullanıcı diskindeki orijinal dosya path’i ile stream edilir (isteğe bağlı kopyalama/cache yok; kopya = disk israfı + süre sınırı hissi).

### 2.3 Custom protocol (`stream://`) — nerede kullanılır?

| Ortam | Protokol |
|-------|----------|
| OBS Browser Source | **Sadece HTTP** (`http://127.0.0.1:8843/media/...`) |
| Tauri Control Panel önizleme | HTTP **veya** `stream://localhost/<url-encoded-path>` |

Rust tarafında Tauri v2:

```rust
// Pseudocode — Faz 1’de birebir implement
.register_asynchronous_uri_scheme_protocol("stream", |ctx, req, responder| {
    // 1) path decode
    // 2) whitelist: yalnızca kullanıcı onaylı path’ler / app data
    // 3) Range parse → 206
    // 4) MIME: mp4/webm/mp3/ogg/wav…
})
```

Frontend helper:

```ts
export function mediaUrl(absolutePath: string): string {
  // OBS / overlay (her zaman HTTP — OBS için zorunlu)
  return `http://127.0.0.1:${PORT}/media/file?path=${encodeURIComponent(absolutePath)}`;
}
```

**Güvenlik:** Path traversal engeli (`..`), allowlist (kullanıcının panelden seçtiği path’ler + `app_data_dir/media`), Windows drive letter doğrulama.

### 2.4 Ses (BRB müzik) + Audio Visualizer

- `<audio src={mediaUrl(path)} loop />` aynı Range stream.
- Visualizer: Web Audio API `AnalyserNode` → canvas/bars; müzik HTTP’den geldiği için CORS header’ları Rust’ta `Access-Control-Allow-Origin: *` (yalnızca localhost) ile açılır.
- Ağır decode Rust’ta değil — tarayıcı decode eder; Rust sadece byte sunar (doğru iş bölümü).

### 2.5 Eski upload akışından geçiş

Mevcut: dosya POST → ffmpeg 1080p → `media/bg-video.mp4`.  
Yeni varsayılan: **kopyalamadan path**.  
Opsiyonel (ayar): “Projeye kopyala / 1080p optimize et” → Rust’ta ffmpeg spawn (mevcut davranış korunur, zorunlu değil). Böylece özellik silinmez, varsayılan daha hafif olur.

---

## 3. Sürükle-Bırak + Snapping + Anlık Sync

### 3.1 Motor seçimi

- Overlay edit: **`react-rnd`** (mevcut yüzde bazlı `positions` modeline uyumlu: `{ x: 0–100, y: 0–100 }`).
- Grid/snap: 1920×1080 sanal canvas üzerinde:
  - Grid: 10 px / 20 px / 50 px (panelden seçilir)
  - Merkez kılavuzları (yatay/dikey orta çizgi)
  - Element-to-element snap (kenar hizalama, ±6 px threshold)
- Edit yalnızca Control Panel’deki **Preview** (veya `?edit=1` overlay) içinde; OBS `?obs=1` modunda drag kapalı (mevcut davranış).

### 3.2 Veri akışı (60 FPS hissi)

```
Pointer move (preview)
  → local React state (raf throttle)
  → her frame sonunda debounce 0ms / rAF emit
  → invoke('settings_patch', { positions })  VEYA  WS mesajı
  → Rust AppState
  → WS broadcast { type: "positions", payload }
  → Tüm overlay istemcileri (OBS dahil) applyPositions()
```

**Performans kuralları:**

- Drag sırasında tam settings JSON yazılmaz; sadece `positions`/`sizes` patch.
- Disk persist: drag bitince (`onDragStop`) debounce 300–500 ms.
- Overlay tarafında CSS `transform: translate(-50%, -50%)` + `left/top %` (mevcut) korunur → layout thrash azalır.
- Particle canvas ayrı `requestAnimationFrame`; drag ile paylaşılmaz (iki RAF döngüsü).

### 3.3 Mevcut alanlar (taşınacak)

`logo`, `title`, `countdown`/`badge`, `socials`, `ticker` + BRB’de `brbMessage`, Ending’de `credits`.

---

## 4. Overlay Rotaları

| Route | Kaynak | OBS URL örneği |
|-------|--------|----------------|
| `/starting` | `obs-giris-ekrani` portu | `http://127.0.0.1:8843/starting?obs=1` |
| `/ending` | `obs-cikis-ekrani` + credits scroll | `…/ending?obs=1` |
| `/brb` | YENİ — müzik loop + “X dk sonra” | `…/brb?obs=1` |
| `/chat` | Kick Pusher chat | `…/chat?obs=1` |

SPA: Vite build tek `index.html`; Rust static serve + client-side React Router. OBS deep-link için Rust’ta fallback: bilinmeyen path → `index.html` (SPA).

Query: `?obs=1` → ayar UI yok (mevcut).

---

## 5. OBS Otomasyonu (obs-websocket-js)

Control Panel (React) içinde `obs-websocket-js` v5:

1. Bağlantı: `ws://127.0.0.1:4455` + şifre (panel ayarı).
2. Bağlanınca:
   - `GetSceneList` → dropdown
   - `GetSceneTransitionList` → dropdown (Fade, Cut, Stinger…)
   - Input list → mikrofon kaynağı seçimi
3. Sayaç bitince sıra:
   ```
   SetCurrentSceneTransition { transitionName }
   SetCurrentSceneTransitionDuration { transitionDurationMs }
   SetCurrentProgramScene { sceneName }
   ```
4. BRB sahnesine geçişte: `SetInputMute { inputName, inputMuted: true }`  
   BRB’den çıkışta: `inputMuted: false`
5. Ending panel: **Stop Stream** → `StopStream`

Not: OBS WebSocket tarayıcıdan (localhost) çalışır; Rust’a taşımak zorunlu değil. İleride istenirse `obws` crate ile Rust’a alınabilir — Faz 3’te JS client yeter (daha hızlı entegrasyon, mevcut ekosistem).

---

## 6. Kick Chat

1. **Rust `reqwest`:**  
   `GET https://kick.com/api/v2/channels/{slug}`  
   Header: gerçekçi browser User-Agent + Accept + dil.  
   → `chatroom.id`
2. **Frontend `pusher-js`:** Kick’in public key / cluster ile `chatrooms.{id}.v2` subscribe.
3. Overlay: kalın `text-shadow`, slide-in animasyon, saturate/renk badge’leri.

Cloudflare: User-Agent + gerekirse cookie jar; başarısız olursa panelde manuel `chatroom_id` fallback alanı (özellik kaybı yok).

---

## 7. Control Panel & System Tray

- Ana pencere: ayarlar + canlı mini preview (iframe → aynı `/starting` HTTP).
- Tray: küçült / göster / “OBS URL’lerini kopyala” / çıkış.
- Uygulama kapanınca embedded server durur → OBS’e bilgi toast’ı (opsiyonel).

---

## 8. Özellik Taşıma Checklist (silinmeyecekler)

### Giriş / Çıkış (mevcut)
- [ ] Metinler: eyebrow, title, sub, ticker, liveText
- [ ] Geri sayım + canlı/rozet davranışı (outro’da rozet varsayılan)
- [ ] Renkler, fontlar, per-text effect/anim
- [ ] Logo fit/frame/zoom/pan
- [ ] Sosyal: Twitch, YT, Kick, X, IG, Discord, TikTok
- [ ] Positions / sizes / visibility
- [ ] bgStyle: mix | accent | dark | custom | video | youtube
- [ ] Video trim start/end + timeline handles
- [ ] YouTube embed + trim
- [ ] Particles + assets/particles dinamik keşif
- [ ] Transparent overlay
- [ ] Video sound + volume
- [ ] Ana araçtan başlık çek
- [ ] Ayar sıfırla
- [ ] OBS URL kopyala
- [ ] Server sync (mtime / poll → WS’e yükseltilir)

### Ana araç
- [ ] AI önerileri, platform sekmeleri, geçmiş, şablonlar, import/export, ayarlar

### Yeni
- [ ] `/brb` müzik + sayaç + mute otomasyonu
- [ ] `/ending` credits `@keyframes scrollUp` + Stop Stream
- [ ] `/chat` Kick
- [ ] Audio visualizer
- [ ] Scene/transition dropdown + duration + auto switch
- [ ] Snap guides drag

---

## 9. Fazlar

### Faz 1 — Dönüşüm & Medya Motoru *(onay sonrası başlar)*
1. Docker ile Vite + React + Tauri v2 iskeleti
2. `legacy/` arşivi
3. Embedded axum: static SPA + `/media` Range + settings API
4. `stream://` protocol (panel preview)
5. `/starting` ve `/ending` ilk React portu (görsel parity)
6. Path-based video/audio seçimi (base64 yok)

### Faz 2 — Arayüz & Drag-Drop
1. Control Panel shell + tray
2. react-rnd + snap guides
3. WS anlık position sync
4. Tailwind ile panel; overlay’de mevcut CSS korunur/taşınır

### Faz 3 — OBS Otomasyonu
1. obs-websocket-js bağlacı
2. Scene/transition listeleri + süre
3. Sayaç bitince geçiş pipeline
4. BRB mute/unmute

### Faz 4 — BRB, Kick, Jenerik
1. `/brb` tam
2. Kick Rust fetch + Pusher overlay
3. Ending credits scroll + Stop Stream
4. Audio visualizer

---

## 10. Docker Kullanımı

Makinedeki **mevcut Docker** ile geliştirme/build (host’a Rust dayamadan tekrarlanabilir ortam):

```yaml
# docker/docker-compose.yml (Faz 1’de oluşturulacak)
services:
  tauri-dev:
    build: ./docker
    volumes:
      - ..:/app
    network_mode: host   # OBS'in 127.0.0.1:8843 erişimi için
    environment:
      - DISPLAY=...      # Linux GUI; Windows'ta native Tauri tercih
```

**Windows notu:** Tauri native pencere için asıl `npm run tauri dev` host’ta (WebView2) çalışır. Docker:

- Linux CI build
- Rust bağımlılık cache
- Tutarlı toolchain

Plan: **geliştirme Windows native + Docker opsiyonel toolchain**; medya/HTTP her iki ortamda `127.0.0.1`.

---

## 11. Performans SLA (hedef)

| Metrik | Hedef |
|--------|--------|
| Overlay UI | 60 FPS (transform + canvas ayrımı) |
| Video RAM | O(chunk); dosya boyutu ≠ RAM |
| Settings sync latency | &lt; 50 ms (WS, localhost) |
| App idle RSS | Mümkün olduğunca düşük (gereksiz kopya/base64 yok) |

---

## 12. Onay Kapısı

Bu belge **mimari sözleşmedir**.  

**Faz 1’e geçmek için onayın gerekli:**  
“Onaylıyorum, Faz 1’e başla” (veya eşdeğeri).

Onay gelmeden:
- Tauri/React iskeleti kurulmaz
- Mevcut çalışan HTML/JS/Python akışı bozulmaz

---

## İmza

```
Doküman : ex.md — Tauri Dönüşüm Spesifikasyonu
Yazar   : axthrowa
Rol     : Mimari + uygulama sahibi imzası
Tarih   : 2026-09-05
Hash    : PHASE0-ARCH-ONLY / AWAIT-APPROVAL-FOR-PHASE1
Docker  : mevcut Docker kullanılacak (dev/CI)
Medya   : HTTP Range + optional stream:// — base64 yasak
OBS     : Overlay’ler localhost HTTP; Tauri Events yalnızca panel↔Rust
```

**— axthrowa**
