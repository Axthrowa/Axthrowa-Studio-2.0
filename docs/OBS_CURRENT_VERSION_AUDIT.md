# OBS güncel sürüm denetimi

> Tarih: 2026-09-26 · Kural: istem ile güncel OBS çelişirse **güncel OBS kazanır** (istem §2).

## Güncel kararlı sürüm

| Soru | Yanıt | Sınıf |
|---|---|---|
| Güncel kararlı OBS | **32.2.2** (GitHub "latest release", 2026-08-14) | `CONFIRMED_PUBLIC_SOURCE` (github.com/obsproject/obs-studio/releases/latest) |
| Bu makinede kurulu | 32.2.2 (`C:\Program Files\obs-studio`) | `OBSERVED_IN_RUNTIME` |
| Motorumuzun hedeflediği libobs | 32.x (`DESTEKLENEN_ANA_SURUM = 32`, yapı düzenleri 32.2.2 başlıklarıyla boyut testli) | `OBSERVED_IN_RUNTIME` |
| Kaynak referansı | `obsproject/obs-studio` etiket `32.2.2` (ba2f32b), seyrek kopya: libobs, frontend (plugin-manager, api, widgets, utility) | `CONFIRMED_PUBLIC_SOURCE` |

Sonuç: istemde "current stable" olarak kastedilen sürüm kurulu sürümle aynı; ayrı bir sürüm farkı yok.

## 32.2'de paritemizi etkileyen değişiklikler (sürüm notlarından)

| Değişiklik | Etkisi |
|---|---|
| "Kaynak ekle" açılır listesi yerine **iletişim kutusu** | Bizim "Kaynak ekle" akışı da menü değil, tür listesi + özellikler iletişim kutusu olmalı |
| Yeni ses mikseri: **Sustur ve İzle bağımsız**; Gelişmiş Ses Özellikleri'nden "Monitor Only" kaldırıldı | Mikserde "İzle" aç/kapa + ayrı sustur; libobs izleme türü buna göre eşlenir (izle açık + susturulmuş = yalnız izle) |
| Frontend API'ye kopyala/yapıştır işlevleri | Kaynak/filtre/dönüşüm kopyala-yapıştır OBS'te birinci sınıf; bizde de olmalı |
| Filtrelerde eksik dosya desteği; SDR→HDR birleştirme filtresi | Filtre türleri çalışma anında motordan listelenir (sabit liste yok) |
| Eklentiler yeni kaynak türleri için özel simge ayarlayabilir | Eklenti türleri kendi simgesi olmadan da listelenir (bizde tek simge ailesi, tür adına göre genel simge) |
| Windows'ta DLL yükleme davranışı iyileştirildi; ilk açılışta eklenti yüklenmeme hatası (32.2.2 düzeltmesi) | Bizim motor OBS'in `os_dlopen` arama modelini izler; `AddDllDirectory(OBS bin)` ile uygulama klasörü eşdeğeri sağlanır |
| `obs_properties_add_button` kullanımdan kaldırıldı (deprecated) | Genel özellik formunda düğme türü yalnız gösterilir; çağrısı desteklenmez (belgelenir) |
| Çoklu iz video (multitrack video) yalnız Özel servis | Bizim çoklu yayın kendi yönlendiricimiz/motorumuzla; OBS'in multitrack video'suna bağlı değil |
| Windows'ta süreç azaltma politikaları (process mitigation) | OBS'e özgü; motorumuz için ayrıca değerlendirilecek (bilinen sınırlama) |

## OBS 32 eklenti sistemi (kaynaktan doğrulandı)

- Zorunlu dışa aktarımlar: `obs_module_load`, `obs_module_set_pointer`, `obs_module_ver` (libobs/obs-module.c).
- Sürüm kuralı: `obs_module_ver() & 0xFFFF0000 > LIBOBS_API_VER` → reddedilir (yama sürümü yok sayılır); eski sürüm yüklenir.
- `manifest.json` (veri klasöründe): display_name, id, version, os_arch, name, description, urls, has_icon/banner.
- Konumlar (Windows): `%ProgramData%\obs-studio\plugins\<modül>\bin\64bit` (önerilen), `<OBS>\obs-plugins\64bit`
  (eski, "gelecek sürümde çalışmayacak" — obsproject.com/kb/plugins-guide), `OBS_PLUGINS_PATH` + `OBS_PLUGINS_DATA_PATH`.
- OBS 32 eklenti yöneticisi durum dosyası: `%APPDATA%\obs-studio\plugin_manager\modules.json` (yalnız devre dışı
  bırakılabilen = üçüncü taraf modüller; kaydettikleri kaynak/çıkış/kodlayıcı/servis türleriyle).
- Güvenli kip: `.sentinel` ile temiz olmayan kapanış algılanır; seçenekler "Güvenli kipte başlat / Normal başlat";
  güvenli kipte yalnız paketle gelen modüller (SAFE_MODULES) yüklenir, `frontend-tools` ve `obs-websocket` "güvensiz"
  sayılır. OBS şüpheli eklentiyi adıyla bilmez — bizim motor modül başına yükleme işaretiyle bilir.
