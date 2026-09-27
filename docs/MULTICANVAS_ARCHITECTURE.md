# Çoklu Tuval Mimarisi

> SE.Live'dan alınan fikir: **tuval ve çıkış bağımsız kavramlardır.** Uygulama OBS'in çoklu tuval altyapısını
> obs-websocket 5.7 üzerinden yönetir (ADR-001, ADR-002). Durum: **tasarım** (Faz 10). 2026-09-26 güncellemesi: §2 ve §3
> protokol belgesi ve kullanıcının OBS'inde salt-okunur yoklamayla düzeltildi.

## 1. Model

```
Canvas {id (OBS canvasUuid), name, width, height, fps?, orientation, safeAreas[], scenes[] (OBS sahneleri),
        replay: {enabled, seconds}, outputs[] (Destination kimlikleri)}
Source (OBS input) — tuvalden bağımsız; aynı girdi (kamera, capture card) birden çok tuvalin sahnesine
        sahne kalemi olarak eklenir → yakalama bir kez yapılır (§17)
SceneLink {from: sceneUuid, to: sceneUuid, mode: independent | oneWay | twoWay}
Destination.canvasId — çıkış hangi tuvali yayınlar (§154)
```

## 2. OBS eşlemesi

| Bizim kavram | OBS | Uzaktan erişim |
|---|---|---|
| Canvas listesi | tuvaller | `GetCanvasList`, `CanvasCreated/Removed/NameChanged` (5.7) — `CONFIRMED_IN_OFFICIAL_DOCS` |
| Tuvaldeki sahneler | `canvasUuid` parametreli sahne istekleri | `CONFIRMED_IN_OFFICIAL_DOCS` |
| Tuval oluşturma | OBS arayüzünde çekirdek özellik değil; eklentiler (SE.Live, Aitum Vertical) oluşturuyor | `CONFIRMED_OFFICIAL_DOCS`: websocket'te oluşturma isteği **yok**; kullanıcının OBS'inde "🚀 SE.Live: Vertical" 1080×1920@60 (`OBSERVED_IN_RUNTIME`) |
| Tuval çıkışı | eklentinin çıkışı veya Enhanced Broadcasting "Additional Canvas" | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` (Twitch rehberi) |

Sonuç: dikey tuval için kullanıcının OBS'inde bir ek tuval sağlayıcısı gerekir. Uygulama bunu **kurmaz**; kurulu ise
keşfeder, yoksa yayın öncesi kontrol listesinde açıklar.

## 3. Bağlı sahneler (§16)

- `oneWay`: yatay sahne değişince bağlı dikey sahne de değişir; tersi değil.
- `twoWay`: ikisi de birbirini tetikler; **döngü koruması**: bir değişiklik bir işlem kimliği taşır; aynı kimlikle
  gelen yankı uygulanmaz; ayrıca 250 ms içinde aynı çifte ikinci geçiş yapılmaz.
- Tetikleyici: OBS `CurrentProgramSceneChanged` olayı (ana tuval) → bağlantı tablosu → **ikincil tuvalde geçiş**.
- **Düzeltme (2026-09-26):** obs-websocket 5.7'nin `SetCurrentProgramScene` isteği tuval parametresi **almaz**
  (`CONFIRMED_OFFICIAL_DOCS`); ikincil tuvalde sahne değiştirmek yalnız o tuvali sağlayan eklentinin vendor isteğiyle
  (ör. Aitum `aitum-vertical-canvas` → `switch_scene`) ya da kendi eklentimizle (ADR-002 katman 3) mümkündür.
  SE.Live tuvalleri uzaktan değiştirilemez (vendor kaydı yok). Ayrıca SE.Live'da ikincil tuvalde sahne geçişinin
  çöktüğüne dair açık bir kamu raporu var (GitHub #176, `UNVERIFIED`) — bağlı sahne özelliği varsayılan kapalı olmalı.
- **Resmi belge (2026-09-26, `CONFIRMED_OFFICIAL_DOCS`):** SE.Live'ın kendi "bağlı sahne" özelliği, çoklu yayın
  aracındaki geçişi bağlı tuvallere kendisi yayar. Bu kullanıcıda (SE.Live kurulu) doğru yol: bağlantıyı SE.Live'da
  kurmak; bizim tarafımızda ikinci bir bağlama katmanı **kurulmaz** (çifte tetikleme riski). Aitum Vertical ile
  SE.Live birlikte kurulmamalı (resmi uyarı) → Aitum vendor köprüsü bu kullanıcı için devre dışı.

## 4. Tekrar arabelleği ve kodlama maliyeti (§90)

Her tuval için ayrı tekrar arabelleği = ayrı kodlayıcı oturumu. Arayüz tahmini maliyeti gösterir:
`bellek ≈ süre(sn) × bit hızı(kbps) / 8` (ör. 120 sn × 12000 kbps ≈ 180 MB) ve NVENC oturum sayısı. SE.Live'ın 180 sn
önerisi (`CONFIRMED_IN_OFFICIAL_DOCS (özet)`) varsayılan üst sınır uyarısı olarak kullanılır.
