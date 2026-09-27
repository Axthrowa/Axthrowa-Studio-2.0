# OBS yukarı akış (upstream) sürüm stratejisi

> Motor, kullanıcının kurulu OBS'inin `obs.dll`'ini yükler; kendi başlıklarımız yoktur, yapı düzenleri OBS 32.2.2
> başlıklarından birebir yazılmış ve boyut testleriyle kilitlenmiştir. Bu yüzden OBS güncellemesi motor için bir
> "uyumluluk olayı"dır.

## 1. Kurallar

| Değişiklik | Motor | Eklentiler |
|---|---|---|
| Yama (32.2.2 → 32.2.3) | Çalışır (aynı ABI beklenir; `obs_get_version_string` günlüğe yazılır) | Yoklamalar geçerli kalır |
| Ara sürüm (32.2 → 32.3) | Çalışır ama **doğrulama listesi** koşulur (aşağıda) | Önceki başarılı yoklama geçersiz → eklenti "yeniden sınayın" der (çökme sonuçları geçerli kalır) |
| Ana sürüm (32 → 33) | **Açılmaz**: `DESTEKLENEN_ANA_SURUM = 32`; "libobs 33 desteklenmiyor" hatası | Aynı; motor yeni yapı düzenleriyle güncellenene kadar |

Kod: `motor/src/obs.rs` (`Api::yukle` sürüm kapısı), `src-tauri/src/eklenti/hizmet.rs::yoklama_guncel`.

## 2. Yeni OBS sürümünde doğrulama listesi

1. Sürüm notlarını oku (GitHub releases): libobs API değişiklikleri, kullanımdan kaldırılanlar, eklenti yükleme
   davranışı (32.2'de "Improved DLL loading behavior on Windows" ve "Applied process mitigation policies" gibi).
2. Seyrek kaynak kopyasını yeni etikete çek (`libobs`, `frontend/plugin-manager`, `frontend/api`); aşağıdakilerin
   farkına bak: `obs.h`, `obs-source.h` (`obs_source_info`), `obs-output.h`, `obs-service.h`, `obs-encoder.h`,
   `media-io/video-io.h`, `obs-properties.h` enum değerleri, `obs-module.c` (`load_module_exports`, sürüm kuralı).
3. Motorun yapı boyutu testlerini yeni başlıklara göre güncelle (`motor` birim testleri: VideoInfo, ServiceInfo,
   OutputInfo, Calldata, VideoScaleInfo, VideoData; test eklentisinde `obs_source_frame`).
4. `yayin-motoru sinama` (sentetik uçtan uca, 18+ denetim) ve `cargo test --test server_api` (motor + eklenti uçtan uca).
5. Test eklentilerini yeni libobs ile yokla (`eklenti-yokla`): kaynak/filtre kaydı, eksik bağımlılık, sürüm reddi, çökme.
6. `DESTEKLENEN_ANA_SURUM`'u yalnız 2–5 geçtikten sonra yükselt; belgeleri (OBS_CURRENT_VERSION_AUDIT) güncelle.

## 3. Kullanıcıya görünen

- Motor başlatılamazsa hata metni sürümü söyler; OBS'e dokunulmaz (kullanıcının OBS'i ayrıca çalışmaya devam eder).
- Eklenti Yöneticisi'nde "Gereken libobs" sütunu ve "Son sınama libobs X ile yapılmıştı; OBS güncellendi, yeniden
  sınayın" nedeni.
