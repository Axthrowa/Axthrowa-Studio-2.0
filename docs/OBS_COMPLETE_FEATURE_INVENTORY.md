# OBS Studio — Özellik Envanteri

> Sürüm: bu makinede **OBS Studio 32.2.2** kurulu (`C:\Program Files\obs-studio`), varsayılan eklentiler
> (obs-websocket, NVENC, QSV, x264, win-capture, win-dshow, win-wasapi, obs-browser, obs-vst, obs-webrtc…).
> SE.Live, Aitum Vertical veya çoklu RTMP eklentisi **kurulu değil**.
> "Uzaktan erişim" sütunu, özelliğin **obs-websocket 5.x** üzerinden bizim uygulamamızca yönetilip yönetilemeyeceğini
> gösterir (kaynak: resmi protokol belgesi, `CONFIRMED_IN_OFFICIAL_DOCS`).

Sınıflar için bkz. [REFERENCE_PRODUCT_RESEARCH §1](REFERENCE_PRODUCT_RESEARCH.md#1-kaynak-sınıflandırması).
"Genel bilgi" = OBS'in yıllardır bilinen, bu makinede kurulu sürümde var olan özelliği; bu turda sayfa içeriğiyle
ayrıca doğrulanmadı (`INFERRED`).

## 1. Sahne ve kaynak

| Özellik | Sınıf | Uzaktan erişim (obs-websocket) | Not |
|---|---|---|---|
| Sahneler | `CONFIRMED_IN_OFFICIAL_DOCS` | Get/Create/Remove/SetCurrentProgramScene, SetCurrentPreviewScene | Uygulamamız zaten kullanıyor |
| Kaynak türleri: ses (mikrofon, masaüstü, uygulama sesi), tarayıcı, renk, ekran yakalama, **oyun yakalama (yalnız Windows)**, görüntü/slayt, medya, metin, video yakalama (kamera, capture card), pencere yakalama | `CONFIRMED_IN_OFFICIAL_DOCS` (Kaynak rehberi) | CreateInput, GetInputKindList, GetInputSettings/SetInputSettings | Oyun yakalama OBS'in en zor, en olgun parçası |
| Gruplar, iç içe sahneler | `INFERRED` (genel bilgi) + 32.0 notları iç içe sahne/grup ses tekilleştirmesini anıyor | GetGroupList, sahne kalemi olarak sahne | |
| Sahne koleksiyonları | `CONFIRMED_IN_OFFICIAL_DOCS` | GetSceneCollectionList, SetCurrentSceneCollection, CreateSceneCollection | Profil ile karıştırılmamalı |
| Profiller | `CONFIRMED_IN_OFFICIAL_DOCS` | GetProfileList, SetCurrentProfile, Create/RemoveProfile, Get/SetProfileParameter | Çıkış/kodlayıcı ayarları profilde |
| Sahne kalemi dönüşümü (konum, ölçek, döndürme, kırpma, sınırlar) | `CONFIRMED_IN_OFFICIAL_DOCS` | Get/SetSceneItemTransform | |
| Karıştırma kipi, kilit, görünürlük, sıra, çoğaltma | `CONFIRMED_IN_OFFICIAL_DOCS` | SetSceneItemBlendMode/Locked/Enabled/Index, DuplicateSceneItem | |
| Geri al / yinele | `CONFIRMED_IN_OFFICIAL_DOCS` (32.1: sahne kalemi özelliklerine genişletildi) | — (yalnız OBS arayüzünde) | |
| Etkileşim (Interact) — tarayıcı kaynağına tıklama/yazma | `INFERRED` | — | |
| Özellikler (Properties) | `CONFIRMED_IN_OFFICIAL_DOCS` | GetInputPropertiesListPropertyItems, PressInputPropertiesButton, OpenInputPropertiesDialog | |

## 2. Filtreler

| Tür | Filtreler | Sınıf |
|---|---|---|
| Görüntü / efekt | LUT uygula, Chroma Key, Renk düzeltme, Color Key, Kırp/Doldur, Görüntü maskesi/karıştırma, Luma Key, **Render Delay** (A/V senkronu), Ölçekleme/En-boy, Kaydırma, Keskinleştirme | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Ses | Compressor (ducking/sidechain dahil), Expander, Gain, Invert Polarity, Limiter, Noise Gate, Noise Suppression (RNNoise / NVIDIA), **VST 2.x** | `CONFIRMED_IN_OFFICIAL_DOCS` |
| NVIDIA filtreleri (nv-filters.dll kurulu) | arka plan kaldırma, gürültü giderme vb. | `INFERRED` (dosya mevcut) |
| Uzaktan | GetSourceFilterKindList, CreateSourceFilter, SetSourceFilterEnabled/Settings/Index | `CONFIRMED_IN_OFFICIAL_DOCS` |

EQ, de-esser ve yapay zekâ gürültü temizleme OBS çekirdeğinde yok; VST veya eklenti gerekir (`INFERRED`).

## 3. Ses

| Özellik | Sınıf | Uzaktan erişim |
|---|---|---|
| Ses karıştırıcı (32.1'de yenilendi: yatay/dikey, izleme düğmesi, kaynak sabitleme, gizli/sahne dışı kaynakları gösterme; 32.2: sustur ve izleme bağımsız) | `CONFIRMED_IN_OFFICIAL_DOCS` | Get/SetInputVolume, Get/SetInputMute, ToggleInputMute |
| Gelişmiş ses özellikleri: denge, senkron kaydırma, izleme türü, **ses izleri** | `CONFIRMED_IN_OFFICIAL_DOCS` (istekler) | Get/SetInputAudioBalance, Get/SetInputAudioSyncOffset, Get/SetInputAudioMonitorType, Get/SetInputAudioTracks |
| 6 ses izi | `INFERRED` (genel bilgi; `SetInputAudioTracks` iz eşlemesi 1–6) | yukarıdaki |
| Ses ölçerleri | `CONFIRMED_IN_OFFICIAL_DOCS` | `InputVolumeMeters` olayı (yüksek hacimli, açıkça abone olunmalı) |
| Solo, pan (ayrı), RMS ayrı gösterimi | `UNVERIFIED` | — |

## 4. Çıkış, kodlama, kayıt

| Özellik | Sınıf | Uzaktan erişim |
|---|---|---|
| Yayın (tek servis) | `CONFIRMED_IN_OFFICIAL_DOCS` | Start/Stop/ToggleStream, GetStreamStatus, Get/SetStreamServiceSettings, SendStreamCaption |
| Kayıt; duraklat/sürdür; **dosya bölme**; **bölüm işareti** | `CONFIRMED_IN_OFFICIAL_DOCS` | Start/Stop/ToggleRecord, Pause/ResumeRecord, SplitRecordFile, CreateRecordChapter, `RecordFileChanged` |
| **Tekrar arabelleği** | `CONFIRMED_IN_OFFICIAL_DOCS` | Start/Stop/Toggle/SaveReplayBuffer, GetLastReplayBufferReplay, `ReplayBufferSaved` |
| Sanal kamera | `CONFIRMED_IN_OFFICIAL_DOCS` | Start/Stop/ToggleVirtualCam |
| Genel çıkışlar (eklentilerin ekledikleri dahil) | `CONFIRMED_IN_OFFICIAL_DOCS` | GetOutputList, Start/Stop/ToggleOutput, Get/SetOutputSettings — **yeni çıkış oluşturma yok** |
| Kodlayıcılar (x264, NVENC H.264/HEVC/AV1, QSV, AMF) | `INFERRED` (kurulu eklentiler: obs-x264, obs-nvenc, obs-qsv11) | profil parametreleriyle |
| NVENC SDK 13, sürücü ≥ 570 | `CONFIRMED_IN_OFFICIAL_DOCS` (32.2) | Bu makinede sürücü 617.14 ✓ |
| **Çoklu iz video / Enhanced Broadcasting** (istemci tarafı çoklu kodlama; 32.2: dinamik bit hızı; yapılandırma yalnız Custom serviste) | `CONFIRMED_IN_OFFICIAL_DOCS` | profil/servis ayarı |
| WebRTC (WHIP) çıkışı, WebRTC simulcast (32.1) | `CONFIRMED_IN_OFFICIAL_DOCS` | servis ayarı |
| Video ayarları (taban/çıkış çözünürlüğü, FPS) | `CONFIRMED_IN_OFFICIAL_DOCS` | Get/SetVideoSettings |
| Renk yönetimi (NV12/P010, Rec.709/Rec.2100, tam/sınırlı aralık, HDR) | `INFERRED` (genel bilgi) | profil parametresi |

## 5. Tuvaller (Canvases)

| Özellik | Sınıf | Not |
|---|---|---|
| Çoklu tuval altyapısı (ana + ek tuvaller; eklentiler — ör. dikey tuval — ek tuval oluşturur) | `CONFIRMED_IN_OFFICIAL_DOCS` (32.0 ses tekilleştirme notu, 32.2 tuval karışımı düzeltmeleri, Twitch Dual Format rehberinde "Additional Canvas") | |
| obs-websocket tuval desteği: `GetCanvasList`, sahne/girdi isteklerinde `canvasUuid`, `CanvasCreated/Removed/NameChanged` olayları (5.7) | `CONFIRMED_IN_OFFICIAL_DOCS` | **kısmi** (32.1 notu) |
| OBS arayüzünden tuval oluşturma | `UNVERIFIED` | Twitch rehberi ek tuval için bir eklenti öneriyor → çekirdek arayüzde yok (`INFERRED`) |

## 6. Stüdyo ve çalışma alanı

| Özellik | Sınıf | Uzaktan erişim |
|---|---|---|
| Stüdyo modu (önizleme/program) | `CONFIRMED_IN_OFFICIAL_DOCS` | Get/SetStudioModeEnabled, SetCurrentPreviewScene, TriggerStudioModeTransition, SetTBarPosition |
| Geçişler (kesme, solma, kaydırma, süpürme, luma, stinger; sahne başına geçiş) | `CONFIRMED_IN_OFFICIAL_DOCS` (istekler) | GetTransitionKindList, Set/GetCurrentSceneTransition(+Duration/Settings) |
| Çoklu görünüm, projektörler | `CONFIRMED_IN_OFFICIAL_DOCS` | OpenVideoMixProjector (ana karışım / multiview), OpenSourceProjector |
| Kısayollar | `CONFIRMED_IN_OFFICIAL_DOCS` | GetHotkeyList, TriggerHotkeyByName, TriggerHotkeyByKeySequence |
| Dock'lar (32.1: dock animasyonları kapatıldı), tarayıcı dock'ları | `CONFIRMED_IN_OFFICIAL_DOCS` (kısmi) | — |
| İstatistikler | `CONFIRMED_IN_OFFICIAL_DOCS` | GetStats: CPU, bellek, boş disk, etkin FPS, ortalama kare çizim süresi, çizim/çıkış atlanan ve toplam kareler |
| Günlükler, çökme raporları, **Güvenli Kip**, eklenti yöneticisi (32.1: eksik eklentiler için aç/kapa) | `CONFIRMED_IN_OFFICIAL_DOCS` (eklenti yöneticisi) / `INFERRED` (güvenli kip) | — |
| Olay abonelik kategorileri: General, Config, Scenes, Inputs, Transitions, Filters, Outputs, SceneItems, MediaInputs, Vendors, Ui, **Canvases** + yüksek hacimli | `CONFIRMED_IN_OFFICIAL_DOCS` | |

## 7. Eklenti mimarisi ve lisans

| Konu | Sınıf |
|---|---|
| Eklentiler kaynak, filtre, kodlayıcı, çıkış, servis türü ekleyebilir; 32.2'de yeni kaynak türleri için özel simge | `CONFIRMED_IN_OFFICIAL_DOCS` (kısmi) |
| **libobs GPLv2+** — bağlanan uygulama GPL uyumlu olmalı; ikili dağıtıma kaynak teklifi | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` |
| obs-websocket (GPLv2) ağ protokolüdür; ayrı süreç olarak konuşan istemci lisans yükümlülüğü doğurmaz | `INFERRED` (GPL'nin "ayrı program" yorumu) |

## 8. Bizim sistem için sonuç

OBS'in görüntü/ses motoru yakalama olgunluğu (özellikle oyun yakalama), kodlayıcı kenar durumları ve eklenti ekosistemi
açısından kısa vadede aşılamayacak durumda. obs-websocket 5.7 tuval, çıkış, ses izi, tekrar arabelleği, kayıt ve
istatistikleri uzaktan yönetmeye yetiyor. Karar ve gerekçe: [STREAMING_ENGINE_DECISION.md](STREAMING_ENGINE_DECISION.md).

Eksik kalan ve bizim tamamlayacağımız alanlar: **birden çok hedefe yayın** (OBS tek servis), **hedef başına bağımsız
durum/başlat/durdur**, **birleşik kontrol merkezi**, **ekip/moderatör iş akışları**, **topluluk otomasyonu**.

## 8. Güncelleme — 2026-09-26 (OBS 31.0 → 32.2.2)

Kaynak: GitHub sürüm notları (`CONFIRMED_OFFICIAL_DOCS`), obs-websocket `protocol.md` (`CONFIRMED_OFFICIAL_DOCS`),
kullanıcının OBS'inde salt-okunur yoklama (`OBSERVED_IN_RUNTIME`). Arayüz gözlemi yapılmadı (`NOT_ACCESSIBLE`:
kullanıcının OBS penceresine dokunulmadı).

| Sürüm | Tarih | Öne çıkanlar |
|---|---|---|
| 31.0.0 | 2024-12 | NVENC yeniden yazımı (Kepler desteği kalktı), QSV AV1 ekran içeriği kodlaması, CEF 127, NVIDIA ses efektleri ayrıldı, çok izli video yeniden bağlanma yarışı düzeltmesi, WHIP STUN |
| 31.1.0 | 2025-07 | çok izli video için **ek tuval** desteği, macOS/Linux çok izli video, TCP pacing, yayın gecikmesi, AMF AV1 B-kare |
| 32.0.0 | 2025-09 | temel **eklenti yöneticisi**, Hybrid MP4/MOV varsayılan kayıt biçimi (bölüm işaretleri), NVIDIA RTX ses VAD, iç içe sahne/grup/**çoklu tuvalde ses tekilleştirme** |
| 32.1.0 | 2026-03 | **ses karıştırıcı yeniden tasarımı** (izleme düğmesi, sabitleme, gizli/başka sahnedeki kaynakları gösterme), stüdyo modunda önizlemede kaynaklar, WebRTC simulcast, **obs-websocket'e kısmi tuval desteği**, yerel dosyalı tarayıcı kaynağı güvenliği |
| 32.2.0 | 2026-07 | yeni kaynak ekleme diyaloğu, SDR→HDR birleştirme filtresi, çok izli video için dinamik bit hızı (yalnız Özel servis), eksik dosyalı filtreler, WebP slayt |
| 32.2.1 / 32.2.2 | 2026-07/08 | oyun yakalama kancası düzeltmesi, Windows eklenti yükleme düzeltmesi, NVIDIA SDK 13 (sürücü 570+) |

### obs-websocket 5.7.4 — uzaktan yapılabilenler (tuval)

| Yapılabilir | Yapılamaz |
|---|---|
| `GetCanvasList` (ad, bayraklar: MAIN/ACTIVATE/MIX_AUDIO/SCENE_REF/EPHEMERAL, video ayarları) | tuval oluşturma / silme |
| `canvasUuid` ile sahne listeleme, sahne/girdi/sahne öğesi/filtre oluşturma-silme, dönüşüm, kilit, sıra, blend, ekran görüntüsü, projektör | ikincil tuvalde program sahnesi değiştirme (`SetCurrentProgramScene` tuval parametresi almaz) |
| `CanvasCreated/Removed/NameChanged` olayları | çıkış veya kodlayıcı oluşturma (yalnız `GetOutputList`, `Start/Stop/ToggleOutput`, `Get/SetOutputSettings`) |

### Kullanıcının OBS'i (2026-09-26, `OBSERVED_IN_RUNTIME`)

OBS 32.2.2, obs-websocket 5.7.4 (kimlik doğrulama açık). Tuvaller: **Main** 1920×1080@60 (MAIN, MIX_AUDIO),
**🚀 SE.Live: Vertical** 1080×1920@60 (MIX_AUDIO). Çıkışlar: `adv_stream` (rtmp_output), `adv_file_output`
(mp4_output), `virtualcam_output`. Kurulu eklentiler arasında `obs-streamelements-core` (SE.Live) var, Aitum Vertical yok.
