# yayin-motoru — yerel yayın çekirdeği

Yayın Yönetim Aracı'nın kendi yayın çekirdeği. Kurulu OBS Studio'nun `libobs` kitaplığını **çalışma anında** yükler
(OBS arayüzü açılmaz) ve üzerine kendi tuval / sahne / kodlayıcı / hedef modelini kurar: aynı anda yatay ve dikey
tuval, aynı kaynağın iki tuvalde farklı dönüşümle kullanımı, kodlayıcı paylaşan hedefler, hedef başına bağımsız
başlat/durdur, kayıt, önizleme.

Lisans: **GPL-2.0-or-later** (bkz. `LICENSE`). Panel bu programla yalnız stdio üzerinden JSON satırlarıyla konuşur.
Karar ve gerekçe: `../docs/STREAMING_ENGINE_DECISION.md` ADR-003.

```
cargo build --release                      # motor/target/release/yayin-motoru.exe
yayin-motoru bilgi                         # libobs sürümü, modüller, kullanılabilir kodlayıcılar
yayin-motoru sinama [klasör]               # sentetik uçtan uca sınama (yalnız 127.0.0.1 alıcıları)
yayin-motoru hizmet                        # panelin kullandığı stdio protokolü
```

Gereksinim: OBS Studio 32.x (`C:\Program Files\obs-studio` ya da `YYA_OBS_DIR`), FFmpeg (yalnız `sinama` için).

Protokol komutları: `baslat`, `bilgi`, `moduller.yukle`, `tuval.olustur`, `tuvaller`, `sahne.olustur`,
`sahne.etkinlestir`, `kaynak.olustur`, `kaynak.sil`, `kaynak.sessiz`, `kaynak.ses`, `sahne.ekle`, `oge.donustur`,
`kodlayici.video`, `kodlayici.ses`, `cikis.rtmp`, `cikis.kayit`, `cikis.baslat`, `cikis.durdur`, `istatistik`,
`onizleme`, `kapat`. Olaylar: `{"olay":"cikis","id":…,"durum":…}`.
