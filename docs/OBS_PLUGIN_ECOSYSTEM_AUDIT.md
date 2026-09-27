# OBS eklenti ekosistemi — adli denetim

> Tarih: 2026-09-26 · Referans: OBS Studio **32.2.2** (güncel kararlı = kurulu), kaynak `obsproject/obs-studio@32.2.2`
> (libobs, frontend/plugin-manager, frontend/api, frontend/widgets). Resmi belgeler: docs.obsproject.com/plugins,
> obsproject.com/kb/plugins-guide. Sınıflar: `CONFIRMED_PUBLIC_SOURCE` (OBS kaynağı), `CONFIRMED_OFFICIAL_DOCS`,
> `OBSERVED_IN_RUNTIME` (bu makinede gözlem), `INFERRED`.

## 1. Modül yaşam döngüsü (libobs/obs-module.c, obs-module.h) — `CONFIRMED_PUBLIC_SOURCE`

| Adım | İşlev | Not |
|---|---|---|
| Keşif | `obs_find_modules2` → `find_modules_in_path` | Her modül yolu (bin, data) çifti için `*.dll` ya da `%module%` klasörleri |
| Ön süzgeç | `get_plugin_info` (util/platform-windows.c) | DLL'i **eşleyip** dışa aktarım tablosunda `obs_module_load` arar; yoksa "OBS eklentisi değil" |
| Açma | `obs_open_module` → `os_dlopen` | `LoadLibraryExW(tam_yol, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR \| LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)` — DllMain burada çalışır |
| Zorunlu dışa aktarımlar | `obs_module_load`, `obs_module_set_pointer`, `obs_module_ver` | Biri yoksa `MODULE_MISSING_EXPORTS` (-3) |
| İsteğe bağlı | `obs_module_unload`, `obs_module_post_load`, `obs_module_set_locale`, `obs_module_free_locale`, `obs_module_name`, `obs_module_description`, `obs_module_author`, `obs_module_get_string` | |
| Sürüm kuralı | `obs_module_ver() & 0xFFFF0000 > LIBOBS_API_VER` → `MODULE_INCOMPATIBLE_VER` (-4) | Yama sürümü yok sayılır; **eski** sürüm yüklenir |
| Meta veri | `obs_module_load_metadata`: `<veri>/manifest.json` | display_name, id, version, os_arch, name, description, long_description, urls{repository, website, support}, has_banner, has_icon |
| Başlatma | `obs_init_module` → modülün `obs_module_load()` | `false` → `OBS_MODULE_FAILED_TO_INITIALIZE`; kayıtlar `loadingModule` üzerinden modüle bağlanır |
| Sonrası | `obs_post_load_modules` | Tüm modüllerin `obs_module_post_load`'u |
| Kapanış | `obs_shutdown` → `free_module` → `obs_module_unload` | Çalışırken güvenli boşaltma API'si yok |

Hata kodları (obs-defs.h): SUCCESS 0, ERROR -1, FAILED_TO_OPEN -2, MISSING_EXPORTS -3, INCOMPATIBLE_VER -4,
HARDCODED_SKIP -5. Yük durumu: ENABLED, DISABLED, DISABLED_SAFE, FAILED_TO_OPEN, FAILED_TO_INITIALIZE.

## 2. Konumlar ve yol uyumluluğu (Windows)

| Konum | bin | veri | Kaynak |
|---|---|---|---|
| Kurulum ("legacy") | `<OBS>\obs-plugins\64bit\<m>.dll` | `<OBS>\data\obs-plugins\<m>` | libobs obs-windows.c; KB: "gelecek sürümde çalışmayacak" |
| Önerilen | `%ProgramData%\obs-studio\plugins\<m>\bin\64bit\<m>.dll` | `…\<m>\data` | frontend `AddExtraModulePaths`; KB plugins-guide |
| Ortam değişkeni | `OBS_PLUGINS_PATH\*.dll` | `OBS_PLUGINS_DATA_PATH\<m>` | frontend `AddExtraModulePaths` |
| Taşınabilir kip | ek yollar eklenmez | | frontend |

Veri klasörü bulunamazsa ve modül adı `lib` ile başlıyorsa öneksiz ad denenir (`make_data_directory`).

## 3. Kayıt türleri ve bizim motordaki karşılığı

| OBS kayıt işlevi | Tür | Motorumuzda |
|---|---|---|
| `obs_register_source_s` (INPUT) | Giriş kaynağı | **Destekleniyor**: "Kaynak ekle" menüsünde eklenti türü; genel özellik formu |
| `obs_register_source_s` (FILTER) | Video/ses filtresi | Tür kaydı görülür; filtre ekleme arayüzü Aşama 2 (motor filtre API'si) |
| `obs_register_source_s` (TRANSITION) | Geçiş | Aşama 2 (geçiş seçicisinde çalışma anı türleri) |
| `obs_register_output_s` | Çıktı | Tür kaydı görülür; özel çıktı kullanımı yok (motor kendi RTMP/kayıt çıktılarını kurar) |
| `obs_register_encoder_s` | Kodlayıcı | Çalışma anı kodlayıcı listesinde görünür (Uzman kip, Aşama 5) |
| `obs_register_service_s` | Servis | Motor yalnız kendi `yym_rtmp` servisini kullanır |
| Ön yüz (obs-frontend-api): dock, araç menüsü, olay geri çağrısı | Qt arayüz | **Yok** — OBS'in Qt ön yüzü motorda çalışmaz; çağrılar "no callbacks" ile boş döner (frontend/api) |
| Betikler (Lua/Python, frontend-tools) | Otomasyon | **Desteklenmiyor** (frontend-tools Qt ister) |
| obs-websocket istek/olay uzantıları (vendor) | Uzak denetim | **Yok** — motor obs-websocket'i yüklemez (kullanıcının OBS'iyle port çakışır) |

## 4. OBS'in kendi güvenli kipi ve eklenti yöneticisi (32.x)

- Temiz olmayan kapanış: `%APPDATA%\obs-studio\.sentinel`; açılışta "Güvenli kipte başlat / Normal başlat"
  (frontend/OBSApp.cpp, utility/CrashHandler.cpp). Güvenli kipte yalnız paketle gelen modüller (`SAFE_MODULES`,
  derleme zamanı listesi) yüklenir; `frontend-tools` ve `obs-websocket` "güvensiz" sayılır. `--safe-mode`,
  `--only-bundled-plugins` komut satırı seçenekleri.
- OBS **hangi** eklentinin çöktüğünü bilmez. Bizim motor eklentileri tek tek, işaret dosyasıyla yükler; şüpheli adıyla
  bilinir ([OBS_PLUGIN_CRASH_RECOVERY](OBS_PLUGIN_CRASH_RECOVERY.md)).
- Eklenti yöneticisi (frontend/plugin-manager): `%APPDATA%\obs-studio\plugin_manager\modules.json` — yalnız devre
  dışı bırakılabilen (çekirdek olmayan) modüller; display_name, module_name, id, version, enabled ve kaydettiği
  sources/outputs/encoders/services. Değişiklik yeniden başlatmada geçerli (`obs_add_disabled_module`). Bizim içe
  aktarma bu dosyayı **salt-okunur** kullanır (OBS'teki etkin/kapalı bilgisi).

## 5. Bu makinedeki gözlem — `OBSERVED_IN_RUNTIME`

- `C:\Program Files\obs-studio\obs-plugins\64bit`: 35 DLL; 29'u OBS eklentisi, 6'sı yardımcı kitaplık (chrome_elf,
  libcef, libEGL, libGLESv2, se-crash-wer, sentry-wer).
- 27 birinci taraf ("OBS Project, LLC" geçerli imzası) + **2 üçüncü taraf**: `logi_obs_plugin_x64` (Logitech Inc
  imzalı, obs-frontend-api'ye bağlı) ve `obs-streamelements-core` (SE.Live; **imzasız**, Qt6 + obs-frontend-api).
- `%ProgramData%\obs-studio\plugins` yok. OBS'in modules.json'unda 2 modül (yukarıdaki üçüncü taraflar, ikisi etkin).
- `obs-browser.dll` (birinci taraf) Qt6Core/Gui/Widgets + obs-frontend-api + libcef'e bağlı: motorda tarayıcı kaynağı
  ancak yalıtılmış yoklama + gerçek sınamadan sonra "destekleniyor" denebilir (Aşama 2).
- `win-capture`, `win-wasapi`, `obs-filters`, `obs-transitions` yalnız obs.dll (+w32-pthreads) — motorun doğrudan
  yüklediği modüller.

## 6. Temsilî eklentiler

Rastgele ikili indirilmedi, çalıştırılmadı. Uyumluluk düzeneği kendi GPL test eklentilerimizle sınandı
([PLUGIN_TEST_REPORT](PLUGIN_TEST_REPORT.md)); bu makinedeki gerçek üçüncü taraf eklentiler yalnız **statik** çözümlendi
(eklenti kodu çalışmadı). Kullanıcı isterse Eklenti Yöneticisi'nden onaylı yalıtılmış sınama yapabilir.
