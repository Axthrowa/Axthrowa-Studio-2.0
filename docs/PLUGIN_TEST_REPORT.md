# Eklenti uyumluluk katmanı — sınama raporu

> Tarih: 2026-09-26 · Makine: Windows 11, OBS 32.2.2, RTX 5070 · Kural: üçüncü taraf ikili **indirilmedi, çalıştırılmadı**;
> çalıştırmalı sınamalar yalnız kendi GPL test eklentilerimizle (`motor/test-eklentileri`).

## 1. Test eklentileri (Rust cdylib, obs.dll'e raw-dylib ile bağlı)

| DLL | Davranış | Amaç |
|---|---|---|
| `yym_test_kaynak` | `yym_test_desen` (CPU'da çizgili desen, eşzamansız video; renk/kalınlık/hareket özellikleri) + `yym_test_filtre` (geçirgen video filtresi); name/description/author dışa aktarımları | Sağlıklı eklenti, genel özellik formu |
| `yym_test_eksik_bagimlilik` | `yym-olmayan-kutuphane.dll`'e bağlı | Eksik bağımlılığın adıyla bulunması |
| `yym_test_cokme` | `obs_module_load` içinde erişim ihlali | Çökme bekçisi, karantina |
| `yym_test_yeni_surum` | `obs_module_ver` = 99.0 | Sürüm reddi |
| `yym_test_onyuz` | `obs-frontend-api.dll`'e bağlı | Ön yüz bağımlılığı sınıflandırması |

Yapı düzeni testi: `obs_source_frame` 224 bayt, alan ofsetleri (timestamp 104, format 112, refs 212); `obs_source_info`
ilk 17 alanı 128 bayt (OBS 32.2.2 başlıklarıyla).

## 2. Otomatik sınamalar

| Katman | Sınama | Sonuç |
|---|---|---|
| PE ayrıştırıcı | küçük PE (x64/x86/ARM64, dışa/içe aktarım), bozuk girdi (300 rastgele bozma, panik yok), gerçek kernel32.dll | Geçti |
| İmza / sürüm | kendi DLL'imiz "İmzasız"; kurulu `obs-ffmpeg.dll` "Geçerli · OBS Project"; kernel32 sürüm kaynağı | Geçti |
| Çözümleme | sahte klasörde bağımlılık yerleri (eklenti klasörü, OBS bin, System32, API kümesi, eksik, dolaylı eksik), manifest, diller, SHA-256; gerçek test DLL'leri | Geçti |
| Sınıflandırma | statik kararlar, yoklama kararları, sürüm metni, yükleme politikası, §51 eşlemesi | Geçti |
| Kayıt defteri | yazma/okuma, yeni sürümü ezmeme, bozuğu kenara alma, çökme bekçisi (iki çökmede karantina), gözlenmeyen kapanışta soru yok, kararlar | Geçti |
| Zip | açma, yol kaçışı (5 biçim), CRC bozulması, zip olmayan girdi | Geçti |
| Keşif | ProgramData ve kurulum düzenleri, OBS modules.json | Geçti |
| Paket | zip → hazırlık → kur → güncelle (yedek) → geri al → kaldır (yedeğe taşı); kurulum programı reddi; geçersiz modül adları | Geçti |
| Yoklama (gerçek süreç) | kaynak → yuklendi (2 tür); eksik → acilamadi; yeni sürüm → surum (99); çökme → cokme 0xC0000005 | Geçti (≈2 sn) |
| Hizmet | kullanıcı kararlarının korunması, SHA değişince yoklamanın sıfırlanması, iki çökmede karantina, OBS güncellenince eski yoklamanın geçersizliği | Geçti |
| API uçtan uca | `eklenti_yoneticisi_kurulum_sinama_cokme_ve_karantina`: izinsiz tarama 428; OBS kurulumunun salt-okunur taraması (defter değişmez, obs-ffmpeg ENGINE_MANAGED); klasör paketi incele/kur (kurulum.exe kopyalanmaz); onaysız sınama 428, onaylı sınama COMPATIBLE + libobs 32.0; etkinleştirme; motor açılışta çöken eklentiyle düşer → 409 şüpheli adıyla → karar yokken yine 409 → "devre dışı" → motor açılır, çöken QUARANTINED, sağlıklı yüklü; `eklenti` kaynak türü (kayıtsız tür 400), özellik formu okuma/yazma, önizleme karesi; düzgün durdurmada işaretler silinir; onaylı kaldırma yedeğe taşır; denetim kayıtları | Geçti (≈4 sn) |
| Ön yüz | renk dönüşümü (0xAABBGGRR), sayı alanı, liste seçimi, grup düzleştirme; çıkış kodu metni, çökme metni, etkinleştirme kuralları, durum sayıları, eklenti kaynak türleri | Geçti |

Sayılar (2026-09-26): Rust kitaplık 275+ (eklenti 24), API 25, ön yüz 364, motor 12 + 1, sentetik uçtan uca 18/18.

## 3. Tarayıcıda (başsız sunucu, `panel-headless-sx3012` + UI 1422)

- Yayın sekmesi → Eklentiler (2) → OBS'ten içe aktar: 35 DLL, 29 eklenti, 27 birinci taraf, 2 üçüncü taraf
  (Logitech imzalı / SE.Live imzasız, ikisi TEST_REQUIRED), 14 motor yönetir.
- Paket kur (klasör): 3 test eklentisi — eksik bağımlılık adıyla, test kaynağı "Muhtemelen uyumlu", ön yüz "Sınama gerekli".
- Sına → onay metni ("sanal alan değildir") → "Uyumlu", 2 tür. Ön yüz eklentisini etkinleştirme → açık onay istemi.
  Eksik bağımlılıklı eklentinin kutusu kapalı, neden ipucunda.
- Motor yeniden açıldı: iki eklenti yüklendi; "Kaynak ekle" menüsünde "YYM test deseni — YYM test kaynağı"; kaynak eklendi,
  çift tıklamayla Özellikler (renk #3366cc, 45 px, hareket açık — varsayılanlar dahil); değer değişikliği uygulandı ve
  yeniden başlatmada korundu; önizlemede mavi çizgili desen (ekran görüntüsü).

## 4. Sınanmayan / bilinen sınırlar

- Gerçek üçüncü taraf eklentiler (Logitech, SE.Live) yalnız statik: kullanıcı onayı olmadan kodları çalıştırılmadı.
- `obs-browser` (tarayıcı kaynağı) Qt + ön yüze bağlı; motorda sınaması Aşama 2'de.
- Filtre/geçiş/kodlayıcı türündeki eklentilerin arayüzde kullanımı Aşama 2 motor API'sini bekliyor (türler görünür).
- İlk API test çalıştırmasında bir kez, test paniği sonrası süreç 10 dk kapanmadı; sonraki 3 çalıştırmada tekrarlanmadı
  (yalnız test ortamı; uygulamada kapanışta motor düzgün durdurulur).
