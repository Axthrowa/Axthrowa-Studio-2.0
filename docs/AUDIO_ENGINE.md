# Ses Motoru

> ADR-001: ses karıştırma ve filtreler OBS'te. Uygulama obs-websocket ses isteklerini birleşik bir karıştırıcı
> arayüzüne çevirir (`CONFIRMED_IN_OFFICIAL_DOCS` istek adları).

## 1. Kanal denetimi

| Denetim | obs-websocket | Durum |
|---|---|---|
| Ses seviyesi / sessiz | Get/SetInputVolume, Get/SetInputMute, ToggleInputMute | VAR (kısayol eylemleri) |
| Denge (balance) | Get/SetInputAudioBalance | EKSİK (arayüz) |
| Senkron kaydırma | Get/SetInputAudioSyncOffset | EKSİK |
| İzleme (monitor) | Get/SetInputAudioMonitorType | EKSİK |
| **İz yönlendirme (1–6)** | Get/SetInputAudioTracks | EKSİK |
| Ölçer (tepe) | `InputVolumeMeters` olayı (yüksek hacimli abonelik) | EKSİK |
| Solo, ayrı pan, RMS | OBS'te doğrudan yok | `UNVERIFIED` / eklenti |

Ölçer olayları yüksek hacimli: Rust tarafında 20 Hz'e seyreltilip panele toplu gönderilir; WebView ses verisi işlemez.

## 2. Filtreler

OBS: Gain, Compressor (sidechain/ducking), Limiter, Noise Gate, Expander, Noise Suppression, Invert Polarity, VST 2.x
(`CONFIRMED_IN_OFFICIAL_DOCS`). EQ ve de-esser için VST önerilir. Uzaktan: `CreateSourceFilter`,
`SetSourceFilterEnabled/Settings` — mevcut "filtre aç/kapa" kısayol eylemi bunu kullanıyor.

## 3. Çok izli ses ve hedef başına iz (§22, §23)

Önerilen iz düzeni: 1 Yayın karışımı · 2 VOD karışımı (müziksiz) · 3 Kayıt · 4 Klip · 5 Müziksiz · 6 Temiz besleme.
Tek kodlamalı çoklu yayında **tüm hedefler aynı ses izini** alır (paket kopyası) — hedef başına farklı iz ancak
hedef başına ayrı çıkış/kodlama ile mümkündür (ileri faz). Kick: stereo ≤ 48 kHz; YouTube: AAC 128 kbps stereo
(`CONFIRMED_IN_OFFICIAL_DOCS`).
