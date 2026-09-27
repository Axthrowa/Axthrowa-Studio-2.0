# StreamElements Ses Mimarisi (obs-streamelements-core)

> Kaynak: `StreamElementsAudioComposition*.cpp`, `audio-wrapper-source.c`, `StreamElementsOutput.cpp`
> (commit `c7e0f5a`, `CONFIRMED_PUBLIC_SOURCE`) + `docs/api/host/audio-compositions.md` (`CONFIRMED_OFFICIAL_DOCS`).
> Kod alınmadı; bizim tasarımımız için çıkarımlar son bölümde.

## 1. Bileşenler

| Bileşen | Görev |
|---|---|
| **Ses kompozisyonu** (`StreamElementsAudioComposition`) | Çıkışlara ses kodlayıcısı sağlayan birim. İki tür: OBS yerel (OBS'in kendi kodlayıcıları) ve özel |
| **Ses çıkışı** | Her iki tür de OBS'in **tek küresel ses çıkışını** (`obs_get_audio()`) kullanır — tuval başına ayrı ses karıştırıcısı **yok** |
| **İz başına kodlayıcı** | Özel kompozisyon, `MAX_AUDIO_MIXES` (6) iz için **yayın** ve ayrı olarak **kayıt** ses kodlayıcılarını oluşturulduğu anda (hevesli) yaratır; her biri `obs_encoder_set_audio(…, küresel ses)` |
| **Çıkış tarafı seçim** | Akış çıkışı `m_audioTracks` listesindeki izlerin kodlayıcılarını sırayla `obs_output_set_audio_encoder(output, enc, i)` ile bağlar; hiç iz yoksa çıkış başlamaz ("No audio encoders were set up for requested audio tracks") |
| **`transition_audio_wrapper` kaynağı** | Bileşik giriş kaynağı; bir alt kaynağın ses karışımını seçili karıştırıcı bitlerine kopyalar (`OBS_SOURCE_COMPOSITE`, kullanıcıya kapalı). Özel tuvaldeki sahnenin/geçişin sesini küresel karışıma bağlamak için |

## 2. Akış

```
Ses kaynakları (mikrofon, masaüstü, uygulama, medya, tarayıcı)
        │  (kaynak başına: ses seviyesi, filtreler, izler 1–6 — OBS'in kendi karıştırıcısı)
        ▼
OBS küresel ses çıkışı (6 iz)
        │
        ├── Ses kompozisyonu A: yayın kodlayıcıları [iz1..iz6], kayıt kodlayıcıları [iz1..iz6]
        │         │
        │         ├── Akış çıkışı Twitch  ← iz 1
        │         ├── Akış çıkışı YouTube ← iz 1, iz 2 (VOD izi)
        │         └── Kayıt çıkışı        ← iz 1..6
        └── (OBS yerel kompozisyon: OBS'in kendi kodlayıcıları)
```

## 3. Özellikler ve sınırlar

| Konu | Durum |
|---|---|
| Hedef başına ses izi | **Var** (çıkış iz listesi) |
| Hedef başına farklı karışım | yalnız OBS'in 6 izi üzerinden (izleri OBS'in karıştırıcısında kaynak başına atamak gerekir) |
| Tuval başına ses | yok; `MIX_AUDIO` bayraklı tuvaller küresel karışıma katılır (`OBSERVED_IN_RUNTIME`: "Main" ve "SE.Live: Vertical" ikisi de `MIX_AUDIO: true`) |
| Senkron | OBS'in kendi zaman damgası/tamponlaması; eklenti ek senkron katmanı eklemiyor (`INFERRED`) |
| Örnek biçimi | kodlayıcılar OBS ses çıkışının biçimini kullanır (OBS genelinde 48 kHz float planar) — `INFERRED` |
| Kaynak ömrü | sarmalayıcı kaynak, alt kaynağa zayıf olmayan referansla bağlı; numaralandırma geri çağrıları hem etkin hem tüm alt kaynaklar için (`CONFIRMED_PUBLIC_SOURCE`) |
| Kaynak maliyeti | 6 iz × 2 (yayın + kayıt) kodlayıcı her özel kompozisyonda hevesli oluşturuluyor — kullanılmayan izler için de (video kodlayıcılardaki tembel modelin sese uygulanmadığı görülüyor) |

## 4. Bizim tasarımımız için çıkarımlar

1. **Hedef başına iz seçimi değerlidir ve ucuzdur** — kodlama paylaşılır, çıkış yalnız hangi izi göndereceğini seçer.
   Bizim yönlendiricimizde bugün tüm hedefler OBS'in yayın çıktısındaki izi alır (`KNOWN_LIMITATIONS` §2). Yönlendirici
   FLV'yi `-c copy -map 0` ile aktardığı için, OBS yayın çıkışına çok iz verilse bile RTMP/FLV tek ses izi taşır;
   hedef başına iz için ya OBS içinde hedef başına çıkış (eklenti) ya da hedef başına ayrı ses kodlaması gerekir.
2. Tuval başına ses karıştırıcı yerine **küresel karışım + iz** modeli yeterli ve daha az hataya açık.
3. İz kodlayıcılarını **tembel** oluşturmak (yalnız bir çıkış kullanınca) GPU/CPU tasarrufu sağlar; SE'nin videoda
   yaptığı ama seste yapmadığı şey.
4. Ayrıntılı hedef mimarisi: `AUDIO_ENGINE.md`.
