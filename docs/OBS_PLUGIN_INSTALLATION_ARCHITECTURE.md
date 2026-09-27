# OBS eklenti kurulum mimarisi

> Kod: `src-tauri/src/eklenti/` (pe, win, cozumleme, uyumluluk, kayit, kesif, paket, zip, yoklama, hizmet),
> `src-tauri/src/server/eklenti_api.rs`, motor `motor/src/eklenti.rs`, arayüz `src/components/eklenti/EklentiYoneticisi.tsx`.
> Bu bir "DLL seç, yükle" düğmesi değildir: her eklenti önce çözümlenir, sınıflandırılır, gerekirse yalıtılmış süreçte
> sınanır, kullanıcı etkinleştirince **sonraki motor başlatmada** işaret dosyasıyla yüklenir.

## 1. Klasörler

```
<uygulama verisi>/
  eklentiler/
    kayit.json                    sürümlü kayıt defteri (yeni sürümün yazdığı ezilmez; bozuk olan .bozuk-<zaman>)
    kurulu/<modül>/bin/64bit/     bu uygulamanın kurduğu eklentiler (OBS'in ProgramData düzeniyle aynı)
    kurulu/<modül>/data/          locale, manifest.json, efektler
    yedek/<modül>-<zaman>[-…]/    güncelleme/geri alma/kaldırmada taşınan eski sürümler (kalıcı silme yok)
    hazirlik/<kimlik>/            zip incelemesi için geçici açma (kurulum ya da vazgeçince silinir)
  motor/
    oturum.json                   motor çalışırken var (çökme bekçisi)
    eklenti-yukleniyor.json       motor bir eklentiyi yüklerken var (şüpheli eklenti)
```

OBS'in klasörlerine (`Program Files\obs-studio`, `%ProgramData%\obs-studio\plugins`) hiçbir şey yazılmaz; oradaki
eklentiler kayıt defterinde **başvuru** olarak tutulur ve kaldırılınca yalnız listeden çıkar.

## 2. Kurulum yöntemleri

| Yöntem | Akış | Not |
|---|---|---|
| Paket (zip) | seç / sürükle-bırak → `paket/incele` → inceleme ekranı → `paket/kur` | Savunmacı zip açıcı (yol kaçışı, şifreli girdi, 20 000 girdi, 1 GB, CRC) |
| Klasör | aynı | Klasör yerinde incelenir, yalnız seçilen modüller kopyalanır |
| Tek DLL | aynı | Bulunduğu klasördeki yardımcı DLL'ler birlikte kopyalanır |
| OBS'ten içe aktar | izin → salt-okunur `tara` → sayılar + tablo → `ice-aktar` | Başvuru; dosya kopyalanmaz; kapalı gelir |
| Konum ekle | Konumlar sekmesi → `konum ekle` | Taramaya dahil edilir (salt-okunur) |
| Kurulum programı (.exe/.msi) | **reddedilir** | "Güvenlik nedeniyle çalıştırılmaz: üreticinin kurulumunu kendiniz çalıştırın ya da zip sürümünü seçin" |

İnceleme ekranı: dosya sayısı, OBS eklentileri (x64 + `obs_module_load`), yardımcı kitaplıklar, kurulum programları ve
betikler (uyarı), her aday için imza, sürüm, durum, neden, güncelleme bilgisi (kurulu sürüm yedeklenecek).

## 3. Yaşam döngüsü

```
çözümle ──► sınıflandır ──► (onaylı) yalıtılmış sına ──► etkinleştir ──► motor başlatma
   ▲                                                                        │
   └── dosya değişti (SHA) / OBS sürümü değişti ──── yeniden değerlendir ◄──┘ gerçek yükleme sonucu
```

- Etkinleştir/devre dışı: kayıt defterine yazılır; motor çalışıyorsa "Sonraki motor başlatmada yüklenecek /
  yüklenmeyecek" gösterilir. libobs çalışan süreçten modül boşaltmayı desteklemez; sahte "anında kapat" yoktur.
- Güncelleme: aynı modülün yeni paketi kurulunca eski klasör `yedek/`e taşınır, kayıtta `oncekiSurumler`e eklenir.
- Geri alma: mevcut klasör yedeğe, yedek yerine; SHA değişir → eski yoklama geçersiz.
- Kaldırma: yönetilen klasör yedeğe taşınır; başvuru yalnız listeden çıkar. Bu eklentinin kaynakları sahnede
  **yer tutucu** olarak kalır, ayarları silinmez.

## 4. Kayıt defteri alanları (istem "runtime compatibility registry")

| İstenen alan | Kayıt alanı |
|---|---|
| Plugin ID | `id` (libobs modül adı) |
| Name / Version / Vendor | `ad`, `surum`, `satici` (manifest > sürüm kaynağı > imzalayan) |
| Binary Architecture | `mimari` |
| Required OBS Version / Required API | `gerekliLibobs` (yoklamadaki `obs_module_ver`) |
| Required Libraries | `bagimliliklar`, `eksikBagimliliklar` |
| Plugin Types | `turler` (kaynak/filtre/geçiş/çıkış/kodlayıcı/servis; yoklama ya da motor yüklemesinden) |
| Frontend / Qt / Browser Dependency | `onYuz`, `qt`, `tarayici` |
| Compatibility Status | `durum` + arayüz `arayuz` (§51) + `nedenler` + `oneri` |
| Last Tested App Version | `sonTestSurumu` |
| Last Load Result | `sonYukleme` {zaman, sonuc, kod} |
| Crash History | `cokmeler` [{zaman, asama: yukleme/calisma/yoklama, kod}] |
| (ek) | `konum`, `dll`, `veri`, `sha256`, `boyut`, `imza`, `imzalayan`, `birinciTaraf`, `motorNotu`, `karantina`, `oncekiSurumler`, `obsEtkin`, `diller` |

## 5. API (`/api/eklentiler…`)

| Uç | İzin | Yalnız yerel |
|---|---|---|
| `GET /api/eklentiler` | plugins.read | — |
| `POST tara` (izin: true), `ice-aktar`, `paket/incele`, `paket/kur`, `paket/vazgec`, `etkin`, `sina` (onay), `karantina`, `kaldir` (onay), `geri-al`, `konum` | plugins.manage | **Evet** |
| `GET gunluk?id=` | plugins.read | — |

Her değişiklik denetim günlüğüne yazılır (PLUGIN_SCAN, PLUGIN_IMPORT, PLUGIN_PACKAGE_INSPECT, PLUGIN_INSTALL,
PLUGIN_ENABLE/DISABLE, PLUGIN_PROBE, PLUGIN_QUARANTINE, PLUGIN_UNINSTALL, PLUGIN_ROLLBACK, PLUGIN_LOCATION).

## 6. Motorda yükleme

Motor `baslat` isteğinde `eklentiler: [{id, dll, veri}]` ve `isaret` yolunu alır. Her eklenti için: işaret dosyası yaz →
`obs_open_module` → `obs_module_ver` oku → `obs_init_module` → yalnız bu modülün `obs_module_post_load`'u → işareti sil →
kaydedilen türleri (öncesi/sonrası farkı) ve modül meta verisini döndür. Motor OBS'in arama modelini taklit eder:
`SetDllDirectory` + `AddDllDirectory(<OBS>\bin\64bit)` (OBS'te uygulama klasörü). Çökme/hata pencereleri kapalıdır
(`SetErrorMode`).

## 7. Eklenti özelliklerinin arayüzü

Eklenti kaynakları libobs'un özellik tanımıyla (`obs_source_properties`) panelin kendi formunda gösterilir
(`OzellikFormu.tsx`): bool, int, float, metin (normal/çok satır/parola/bilgi), yol, liste (seçim/düzenlenebilir), renk,
opaklıklı renk, grup. Düğme (OBS 32.2'de kullanımdan kalktı), yazı tipi, düzenlenebilir liste ve kare hızı alanları
"henüz düzenlenemiyor" olarak gösterilir (değerleri korunur). Parola alanlarının değeri sunucudan dönmez; kalıcı
kayıtta koleksiyon dosyasına değil Kimlik Yöneticisine yazılır.
