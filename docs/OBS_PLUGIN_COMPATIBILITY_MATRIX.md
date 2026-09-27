# OBS eklenti uyumluluk matrisi

> Tarih: 2026-09-26 · Motor libobs 32.2.2 · Sınıflandırma kodu: `src-tauri/src/eklenti/uyumluluk.rs` (ad ile özel durum
> yoktur; her karar dosyanın kendisinden ya da gözlenen davranışından çıkar).

## 1. Durumlar (istem §51 ve iç ad)

| Arayüz (§51) | İç durum | Anlamı | Motor yükler mi |
|---|---|---|---|
| COMPATIBLE | NativeCompatible | Yalıtılmış süreçte ya da motorda yüklendi, türlerini kaydetti; ön yüz bağı yok | Evet |
| LIKELY_COMPATIBLE | LikelyCompatible | Statik denetimler geçti (x64, 3 zorunlu dışa aktarım, bağımlılıklar); **hiç yüklenmedi** | Evet (kullanıcı etkinleştirirse) |
| TEST_REQUIRED | FrontendDependent / CompatibilityModeRequired / Unverified | obs-frontend-api ya da Qt'ye bağlı; ya da eski ana libobs için derlenmiş; ya da karar verilemedi | Yalnız **açık onayla** (Unverified hiç) |
| MISSING_DEPENDENCY | DependencyMissing | Bulunamayan DLL (adıyla gösterilir; dolaylı bağımlılık dahil) | Hayır |
| OBS_VERSION_MISMATCH | ObsVersionMismatch | Daha yeni libobs için derlenmiş (libobs da reddeder) | Hayır |
| ARCHITECTURE_MISMATCH | ArchitectureMismatch | x86 / ARM64 | Hayır |
| UNSUPPORTED | Unsupported | OBS eklentisi değil, .NET, ya da `obs_module_load` false döndü | Hayır |
| QUARANTINED | Quarantined | Kullanıcı ya da çökme bekçisi karantinaya aldı | Hayır |
| BLOCKED | BlockedForSafety | Yoklamada çöktü/yanıt vermedi ya da dosya imzadan sonra değişmiş | Hayır |
| ENGINE_MANAGED | (motor_notu) | OBS ile gelen modül: motor kendisi yükler ya da bilerek yüklemez (obs-websocket, frontend-tools, rtmp-services) | — |

"Muhtemelen uyumlu" asla "uyumlu" gibi gösterilmez. OBS'in ana/ara sürümü değişirse önceki başarılı yoklama geçersiz
sayılır ve eklenti yeniden sınama ister (çökme sonucu ise güvenlik için geçerli kalır).

## 2. Denetimler

| Denetim | Nasıl | Kod çalışır mı |
|---|---|---|
| Mimari | PE `Machine` (0x8664 = x64) | Hayır |
| OBS eklentisi mi | Dışa aktarım tablosunda `obs_module_load`, `obs_module_set_pointer`, `obs_module_ver` | Hayır |
| Bağımlılıklar | İçe + gecikmeli içe aktarımlar; OBS'in arama sırası (eklenti klasörü → OBS bin → System32 → API kümeleri); birlikte gelen DLL'lerin bir düzey dolaylı bağımlılıkları | Hayır |
| Ön yüz / Qt / tarayıcı | `obs-frontend-api.dll`, `qt5*/qt6*`, `libcef.dll`/`obs-browser` içe aktarımı | Hayır |
| İmza | WinVerifyTrust (ağsız: iptal denetimi kapalı, yalnız önbellek) + imzalayan adı | Hayır |
| Sürüm / yayıncı | Sürüm kaynağı (FileDescription, ProductVersion, CompanyName), `manifest.json` | Hayır |
| Bütünlük | SHA-256 | Hayır |
| libobs API sürümü, kaydedilen türler, çökme | **Yalıtılmış yoklama** (motorun `eklenti-yokla` kipi, ayrı süreç, onaylı) ya da gerçek motor yüklemesi | **Evet** |

## 3. Kendi test eklentilerimiz (GPL, `motor/test-eklentileri/`)

| Eklenti | Statik | Yalıtılmış yoklama | Motor yüklemesi | Son durum |
|---|---|---|---|---|
| `yym_test_kaynak` (kaynak + filtre) | LIKELY_COMPATIBLE | yuklendi, 2 tür, API 32.0 | yuklendi; kaynak sahnede, özellik formu, önizleme karesi | COMPATIBLE |
| `yym_test_eksik_bagimlilik` | MISSING_DEPENDENCY (`yym-olmayan-kutuphane.dll`) | acilamadi (-2) | etkinleştirilemez | MISSING_DEPENDENCY |
| `yym_test_yeni_surum` | LIKELY_COMPATIBLE | surum (-4), API 99.0 | — | OBS_VERSION_MISMATCH |
| `yym_test_onyuz` (obs-frontend-api) | TEST_REQUIRED | yuklendi, 0 tür | açık onayla yüklendi | TEST_REQUIRED |
| `yym_test_cokme` (açılışta erişim ihlali) | LIKELY_COMPATIBLE | cokme 0xC0000005 | motor düştü → çökme istemi → devre dışı + karantina | QUARANTINED / BLOCKED |

## 4. Bu makinedeki OBS 32.2.2 kurulumu (statik tarama, eklenti kodu çalışmadı)

Taranan 35 DLL · 29 OBS eklentisi · 27 birinci taraf · 2 üçüncü taraf · 6 yardımcı kitaplık.
Durumlar: ENGINE_MANAGED 14 · LIKELY_COMPATIBLE 8 · TEST_REQUIRED 7.

| Modül | Görünen ad | İmza | Taraf | Durum | Bağlılık | Eksik | Neden |
|---|---|---|---|---|---|---|---|
| `logi_obs_plugin_x64` | Logitech G OBS Studio Plugin | Logitech Inc | **üçüncü** | TEST_REQUIRED | ön yüz | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `obs-streamelements-core` | obs-streamelements-core | İmzasız | **üçüncü** | TEST_REQUIRED | ön yüz, Qt | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `aja` | OBS AJA Windows module | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `aja-output-ui` | OBS AJA Output UI | OBS Project, LLC | birinci | TEST_REQUIRED | ön yüz, Qt | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `coreaudio-encoder` | OBS CoreAudio encoder | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `decklink` | OBS DeckLink Windows module | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `decklink-captions` | OBS DeckLink Captions module | OBS Project, LLC | birinci | TEST_REQUIRED | ön yüz, Qt | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `decklink-output-ui` | OBS Decklink Output UI | OBS Project, LLC | birinci | TEST_REQUIRED | ön yüz, Qt | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `frontend-tools` | OBS Frontend Tools | OBS Project, LLC | birinci | ENGINE_MANAGED | ön yüz, Qt | 0 | Motor bilerek yüklemez: OBS'in Qt arayüzünü ister (betikler, otomatik sahne değiştirici) |
| `image-source` | OBS image module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `nv-filters` | NVIDIA A/V Filters | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `obs-browser` | OBS Browser module | OBS Project, LLC | birinci | TEST_REQUIRED | ön yüz, Qt, CEF | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `obs-ffmpeg` | OBS FFmpeg module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `obs-filters` | OBS A/V Filters | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `obs-nvenc` | OBS NVENC module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `obs-outputs` | OBS output module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `obs-qsv11` | OBS QSV encoder | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `obs-text` | OBS GDI+ text module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `obs-transitions` | OBS Transitions module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `obs-vst` | OBS VST2 module | OBS Project, LLC | birinci | TEST_REQUIRED | Qt | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `obs-webrtc` | OBS WebRTC module | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `obs-websocket` | obs-websocket | OBS Project, LLC | birinci | ENGINE_MANAGED | ön yüz, Qt | 0 | Motor bilerek yüklemez: Kullanıcının OBS'iyle aynı portu açar; panel OBS'e zaten bağlanır |
| `obs-x264` | OBS x264 encoder | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `rtmp-services` | OBS RTMP Services | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bilerek yüklemez: Açılışta obsproject.com'dan servis listesi indirir; motor kendi RTMP servisini kullanır |
| `text-freetype2` | OBS FreeType text module | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `vlc-video` | OBS VLC Plugin | OBS Project, LLC | birinci | LIKELY_COMPATIBLE | — | 0 | Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı. |
| `win-capture` | OBS Windows Capture module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `win-dshow` | OBS DirectShow module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |
| `win-wasapi` | OBS WASAPI module | OBS Project, LLC | birinci | ENGINE_MANAGED | — | 0 | Motor bu modülü kendisi yükler |

Üçüncü taraf eklentiler için sonuç: ikisi de OBS'in Qt ön yüzüne bağlı olduğundan **TEST_REQUIRED**. Logitech eklentisi
kaynak/filtre kaydetmiyor olabilir (OBS'in modules.json'unda kayıtlı türü yok: `OBSERVED_IN_RUNTIME`), yani motorda
işlevi olmayabilir. SE.Live (obs-streamelements-core) OBS'in ön yüzüne derinden bağlıdır ve **imzasızdır**; ayrıca
Aitum Vertical ile birlikte kurulmamalı uyarısı vardır (resmi belge). Bu eklentiler kullanıcı onayı olmadan
yüklenmez/sınanmaz.
